// apps/web/app/api/journals/route.ts
/**
 * Journal Entries API (Supabase + Encryption Support)
 * Replaces old MongoDB /api/journal-entry endpoints
 * 
 * Endpoints:
 * - GET /api/journals - Fetch all journals for user (with decryption) [CACHED]
 * - POST /api/journals - Create new journal (with encryption)
 * - PUT /api/journals - Update journal (with encryption)
 * - DELETE /api/journals - Soft delete journal
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import { getSignedUrl } from '@/utils/supabase/storage';
import { ingestVektoriMessages, clearVektoriMemory } from '@/utils/vektori/client';
import { buildVektoriJournalMessages } from '@/utils/vektori/payload.js';
import {
  buildJournalAutosaveSkippedMessage,
  buildJournalSaveThrottleMessage,
  InMemoryJournalSaveThrottle,
  JOURNAL_AUTOSAVE_EMPTY_VOICE_CODE,
  JOURNAL_SAVE_THROTTLE_CODE,
  toRetryAfterSeconds,
} from '@/utils/journalSaveThrottle';
// Note: Server no longer encrypts/decrypts journal content; clients must handle it.

// ============ CACHE CONFIGURATION ============
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

const CACHE_TTL = 60 * 1000; // 60 seconds
const journalCache = new Map<string, CacheEntry>();
const journalSaveThrottle = new InMemoryJournalSaveThrottle();

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of journalCache.entries()) {
    if (entry.expiresAt < now) {
      journalCache.delete(key);
    }
  }
  journalSaveThrottle.pruneExpired(now);
}, 30 * 1000); // Clean every 30 seconds

function getCacheKey(userId: string, params: URLSearchParams): string {
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return `${userId}:${sortedParams}`;
}

function getCachedData(cacheKey: string): any | null {
  const cached = journalCache.get(cacheKey);
  if (!cached) return null;
  
  const now = Date.now();
  if (cached.expiresAt < now) {
    journalCache.delete(cacheKey);
    return null;
  }
  
  console.log(`[Cache HIT] ${cacheKey} (age: ${Math.round((now - cached.timestamp) / 1000)}s)`);
  return cached.data;
}

function setCachedData(cacheKey: string, data: any): void {
  const now = Date.now();
  journalCache.set(cacheKey, {
    data,
    timestamp: now,
    expiresAt: now + CACHE_TTL
  });
  console.log(`[Cache SET] ${cacheKey} (TTL: ${CACHE_TTL / 1000}s)`);
}

function shouldRejectEmptyVoiceAutosave(params: {
  saveSource?: unknown;
  journalType?: unknown;
  isDefaultVoiceTitle?: unknown;
  contentPlaintextLength?: unknown;
  mediaAttachmentCount?: unknown;
  voiceTranscriptEncrypted?: unknown;
  voiceTranscriptSourceSignature?: unknown;
  voiceTranscriptGeneratedAt?: unknown;
}): boolean {
  const isAutoSave = params.saveSource === 'auto';
  const isVoiceEntry = params.journalType === 'voice';
  const usesDefaultVoiceTitle = params.isDefaultVoiceTitle === true;
  const plaintextLength = Number(params.contentPlaintextLength);
  const mediaCount = Number(params.mediaAttachmentCount);
  const hasVoiceTranscript = Boolean(
    params.voiceTranscriptEncrypted ||
    params.voiceTranscriptSourceSignature ||
    params.voiceTranscriptGeneratedAt
  );

  const hasPlaintext = Number.isFinite(plaintextLength) && plaintextLength > 0;
  const hasMedia = Number.isFinite(mediaCount) && mediaCount > 0;

  return isAutoSave && isVoiceEntry && !hasPlaintext && !hasMedia && !hasVoiceTranscript;
}

export function invalidateUserCache(userId: string): void {
  let deletedCount = 0;
  for (const key of journalCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      journalCache.delete(key);
      deletedCount++;
    }
  }
  console.log(`[Cache INVALIDATE] Cleared ${deletedCount} entries for user ${userId}`);
}
// ============ END CACHE CONFIGURATION ============

async function isMemoryOptedIn(userId: string): Promise<boolean> {
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from('user_settings')
      .select('memory_opt_in')
      .eq('user_id', userId)
      .single();

    return data?.memory_opt_in !== false;
  } catch {
    return true;
  }
}

async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { error: 'Server misconfigured', status: 500 };
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { error: 'Unauthorized', status: 401 };
    }
    return { user };
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}

/**
 * GET /api/journals - Fetch journals with optional decryption
 * Query params:
 * - limit: number
 * - offset: number
 * - sortBy: display_date | created_at | date | updated_at
 * - sortOrder: asc | desc
 * - is_favorite: boolean
 * - is_archived: boolean
 * - tags: comma-separated tags
 * - search: search term (only works on unencrypted entries)
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
  const { searchParams } = new URL(req.url);
    
    // Check cache first
    const cacheKey = getCacheKey(user.id, searchParams);
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      // Return cached response with cache headers
      const response = NextResponse.json(cachedData);
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('Cache-Control', `private, max-age=${Math.floor(CACHE_TTL / 1000)}`);
      return response;
    }
    
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'display_date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const isFavorite = searchParams.get('is_favorite');
    const isArchived = searchParams.get('is_archived');
    const tags = searchParams.get('tags')?.split(',');
    const search = searchParams.get('search');

  const adminClient = createAdminClient();

    // Build query
    const includeMedia = searchParams.get('include_media') === 'true';

    let baseSelect = '*';
    if (includeMedia) {
      baseSelect = '*, journal_media(id, media_type, file_name, drive_file_id, path, bucket, storage_provider)';
    }

    let query = adminClient
      .from('journals')
      .select(baseSelect, { count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_deleted', false);

    // Apply filters
    if (isFavorite !== null) {
      query = query.eq('is_favorite', isFavorite === 'true');
    }

    if (isArchived !== null) {
      query = query.eq('is_archived', isArchived === 'true');
    }

    if (tags && tags.length > 0) {
      query = query.contains('tags', tags);
    }

    // Search only works on unencrypted content
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
      // Note: This won't find encrypted content. Consider client-side search.
    }

    // Apply sorting
    query = query.order(sortBy as any, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

  const { data: journals, error, count } = await query;

    if (error) {
      console.error('[API] Error fetching journals:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    console.log(`[API] Fetched ${journals?.length || 0} journals, includeMedia=${includeMedia}`);

    // Generate signed URLs for Supabase media if include_media is true
    let processedJournals = journals || [];
    if (includeMedia && processedJournals.length > 0) {
      try {
        processedJournals = await Promise.all(
          processedJournals.map(async (journal: any) => {
            if (journal.journal_media && Array.isArray(journal.journal_media)) {
              const mediaWithUrls = await Promise.all(
                journal.journal_media.map(async (media: any) => {
                  // Generate signed URL for Supabase storage
                  if (media.storage_provider === 'supabase' && media.path && media.bucket) {
                    try {
                      const signedUrl = await getSignedUrl(media.bucket, media.path);
                      return { ...media, signed_url: signedUrl, thumbnail_url: signedUrl };
                    } catch (err) {
                      console.error('Error generating signed URL for media:', err);
                      // Return media without signed URL on error
                      return media;
                    }
                  }
                  // For Google Drive or other providers, keep as is
                  return media;
                })
              );
              return { ...journal, journal_media: mediaWithUrls };
            }
            return journal;
          })
        );
      } catch (err) {
        console.error('Error processing media for journals:', err);
        // Return journals without processed media on error
        processedJournals = journals || [];
      }
    }

    const responseData = {
      journals: processedJournals,
      total: count,
      limit,
      offset,
    };
    
    // Cache the response
    setCachedData(cacheKey, responseData);
    
    // Return response with cache headers
    const response = NextResponse.json(responseData);
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', `private, max-age=${Math.floor(CACHE_TTL / 1000)}`);
    return response;
  } catch (error: any) {
    console.error('Error in GET /api/journals:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/journals - Create new journal (with optional encryption)
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const body = await req.json();

    const {
      journal_id,
      title,
      content,
      journal_type,
      mood,
      tags,
      location,
      weather,
      date,
      is_favorite,
      is_archived,
      // Encrypted fields from client
      title_encrypted,
      title_iv,
      content_encrypted,
      content_iv,
      is_encrypted,
      word_count,
      voice_transcript_encrypted,
      voice_transcript_iv,
      voice_transcript_source_signature,
      voice_transcript_generated_at,
      save_source,
      content_plaintext_length,
      media_attachment_count,
      is_default_voice_title,
      prompt_encrypted,
      prompt_iv,
      is_prompt_response,
    } = body;

    if (!journal_id) {
      return NextResponse.json(
        { error: 'journal_id is required' },
        { status: 400 }
      );
    }

    const throttle = journalSaveThrottle.check(user.id, journal_id);
    if (!throttle.allowed) {
      const retryAfterSeconds = toRetryAfterSeconds(throttle.retryAfterMs);
      return NextResponse.json(
        {
          error: buildJournalSaveThrottleMessage(retryAfterSeconds),
          code: JOURNAL_SAVE_THROTTLE_CODE,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      );
    }

    if (
      shouldRejectEmptyVoiceAutosave({
        saveSource: save_source,
        journalType: journal_type,
        isDefaultVoiceTitle: is_default_voice_title,
        contentPlaintextLength: content_plaintext_length,
        mediaAttachmentCount: media_attachment_count,
        voiceTranscriptEncrypted: voice_transcript_encrypted,
        voiceTranscriptSourceSignature: voice_transcript_source_signature,
        voiceTranscriptGeneratedAt: voice_transcript_generated_at,
      })
    ) {
      return NextResponse.json(
        {
          error: buildJournalAutosaveSkippedMessage(),
          code: JOURNAL_AUTOSAVE_EMPTY_VOICE_CODE,
        },
        { status: 422 }
      );
    }

    const adminClient = createAdminClient();

    if (save_source === 'onboarding') {
      const { data: existingOnboarding } = await adminClient
        .from('journals')
        .select('journal_id')
        .eq('user_id', user.id)
        .eq('save_source', 'onboarding')
        .eq('is_deleted', false)
        .limit(1)
        .maybeSingle();

      if (existingOnboarding && existingOnboarding.journal_id !== journal_id) {
        return NextResponse.json(
          {
            error: 'Onboarding entry already exists',
            journal_id: existingOnboarding.journal_id,
          },
          { status: 409 }
        );
      }
    }

    let journalData: any = {
      user_id: user.id,
      journal_id,
      journal_type,
      mood,
      tags: tags || [],
      location,
      weather,
      date: date || new Date().toISOString(),
      is_favorite: is_favorite || false,
      is_archived: is_archived || false,
      voice_transcript_encrypted: voice_transcript_encrypted || null,
      voice_transcript_iv: voice_transcript_iv || null,
      voice_transcript_source_signature: voice_transcript_source_signature || null,
      voice_transcript_generated_at: voice_transcript_generated_at || null,
      prompt_encrypted: prompt_encrypted || null,
      prompt_iv: prompt_iv || null,
      is_prompt_response: is_prompt_response !== undefined ? Boolean(is_prompt_response) : Boolean(prompt_encrypted),
      save_source: save_source || null,
    };

    // Encryption is REQUIRED. Allow blank content as long as at least one field is encrypted.
    if (!is_encrypted || (!title_encrypted && !content_encrypted)) {
      return NextResponse.json(
        { error: 'Encryption is required. Provide encrypted title or content and try again.' },
        { status: 400 }
      );
    }

    // Use client-provided encrypted data
    console.log('[API POST] Saving encrypted journal:', { journal_id, is_encrypted: true });
    journalData = {
      ...journalData,
      title_encrypted,
      title_iv,
      content_encrypted,
      content_iv,
      is_encrypted: true,
      title: '', // Empty string for plain text field (not used)
      content: '', // Empty string for plain text field (not used)
      word_count: word_count || 0,
      reading_time_minutes: Math.ceil((word_count || 0) / 200),
      save_source: save_source || null,
    };

    // Check if journal already exists
    const { data: existingJournal } = await adminClient
      .from('journals')
      .select('id')
      .eq('user_id', user.id)
      .eq('journal_id', journal_id)
      .single();

    let journal;
    let error;

    if (existingJournal) {
      // Update existing journal
      const updateResult = await adminClient
        .from('journals')
        .update(journalData)
        .eq('user_id', user.id)
        .eq('journal_id', journal_id)
        .select()
        .single();
      
      journal = updateResult.data;
      error = updateResult.error;
    } else {
      // Insert new journal
      const insertResult = await adminClient
        .from('journals')
        .insert(journalData)
        .select()
        .single();
      
      journal = insertResult.data;
      error = insertResult.error;
    }

    if (error) {
      console.error('Error creating/updating journal:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Invalidate cache for this user
    invalidateUserCache(user.id);

    // Trigger knowledge extraction in the background (fire-and-forget)
    // Uses plaintext title/content available from the request before encryption
    if (content && content.length > 50) {
      const baseUrl = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/[^/]*$/, '') || '';
      if (baseUrl) {
        const authHeader = req.headers.get('authorization') || '';
        const cookieHeader = req.headers.get('cookie') || '';
        fetch(`${baseUrl}/api/knowledge/extract`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { 'Authorization': authHeader } : {}),
            ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
          },
          body: JSON.stringify({ entryId: journal_id, content, title: title || '' }),
        }).catch(err => console.error('[Knowledge] Background extraction failed:', err));
      }
    }

    // Trigger Vektori ingestion in the background (non-blocking) with Sensitivity Gate
    const { data: sensitiveTag } = await adminClient
      .from('journal_sensitivity_tags')
      .select('id')
      .eq('journal_id', journal_id)
      .maybeSingle();

    if (sensitiveTag) {
      console.log(`[Vektori] Skipping ingestion for sensitive entry: ${journal_id}`);
    } else if ((await isMemoryOptedIn(user.id)) && content && content.trim().length > 20) {
      const messages = buildVektoriJournalMessages({
        title: title || '',
        content,
        journalId: journal_id,
        eventType: 'create',
        createdAt: journal.created_at || '',
        updatedAt: journal.updated_at || '',
        entryDate: journal.journal_date || journal.created_at || '',
        mood: journal.mood || '',
      });

      if (messages.length > 0) {
        ingestVektoriMessages({
          userId: user.id,
          sessionId: `journal-${journal_id}`,
          messages,
        }).catch((err) => console.error('[Vektori] Background ingest failed:', err));
      }
    }

    // Return success - client already has plaintext data
    return NextResponse.json({
      message: 'Journal created successfully',
      journal: journal,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/journals:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/journals - Update existing journal (with encryption support)
 */
export async function PUT(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const body = await req.json();

    const {
      journal_id,
      title,
      content,
      journal_type,
      mood,
      tags,
      location,
      weather,
      date,
      is_favorite,
      is_archived,
      // Optional encrypted fields
      title_encrypted,
      title_iv,
      content_encrypted,
      content_iv,
      is_encrypted,
      word_count,
      voice_transcript_encrypted,
      voice_transcript_iv,
      voice_transcript_source_signature,
      voice_transcript_generated_at,
      save_source,
      content_plaintext_length,
      media_attachment_count,
      is_default_voice_title,
      prompt_encrypted,
      prompt_iv,
      is_prompt_response,
    } = body;

    if (!journal_id) {
      return NextResponse.json(
        { error: 'journal_id is required' },
        { status: 400 }
      );
    }

    const throttle = journalSaveThrottle.check(user.id, journal_id);
    if (!throttle.allowed) {
      const retryAfterSeconds = toRetryAfterSeconds(throttle.retryAfterMs);
      return NextResponse.json(
        {
          error: buildJournalSaveThrottleMessage(retryAfterSeconds),
          code: JOURNAL_SAVE_THROTTLE_CODE,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      );
    }

    if (
      shouldRejectEmptyVoiceAutosave({
        saveSource: save_source,
        journalType: journal_type,
        isDefaultVoiceTitle: is_default_voice_title,
        contentPlaintextLength: content_plaintext_length,
        mediaAttachmentCount: media_attachment_count,
        voiceTranscriptEncrypted: voice_transcript_encrypted,
        voiceTranscriptSourceSignature: voice_transcript_source_signature,
        voiceTranscriptGeneratedAt: voice_transcript_generated_at,
      })
    ) {
      return NextResponse.json(
        {
          error: buildJournalAutosaveSkippedMessage(),
          code: JOURNAL_AUTOSAVE_EMPTY_VOICE_CODE,
        },
        { status: 422 }
      );
    }

    const adminClient = createAdminClient();

    // Get existing journal
    const { data: existingJournal } = await adminClient
      .from('journals')
      .select('*')
      .eq('journal_id', journal_id)
      .eq('user_id', user.id)
      .single();

    if (!existingJournal) {
      return NextResponse.json(
        { error: 'Journal not found' },
        { status: 404 }
      );
    }

    let updateData: any = {
      journal_type,
      mood,
      tags: tags || [],
      location,
      weather,
      date,
      is_favorite,
      is_archived,
      voice_transcript_encrypted,
      voice_transcript_iv,
      voice_transcript_source_signature,
      voice_transcript_generated_at,
      ...(prompt_encrypted !== undefined && { prompt_encrypted }),
      ...(prompt_iv !== undefined && { prompt_iv }),
      ...(is_prompt_response !== undefined && { is_prompt_response: Boolean(is_prompt_response) }),
      updated_at: new Date().toISOString(),
    };

    // Encryption is REQUIRED. Allow blank content as long as at least one field is encrypted.
    if (!is_encrypted || (!title_encrypted && !content_encrypted)) {
      return NextResponse.json(
        { error: 'Encryption is required. Provide encrypted title or content and try again.' },
        { status: 400 }
      );
    }

    console.log('[API PUT] Updating encrypted journal:', { journal_id, is_encrypted: true });
    updateData = {
      ...updateData,
      title_encrypted,
      title_iv,
      content_encrypted,
      content_iv,
      is_encrypted: true,
      title: '', // Empty string for plain text field (not used)
      content: '', // Empty string for plain text field (not used)
      word_count: word_count || 0,
      reading_time_minutes: Math.ceil((word_count || 0) / 200),
    };

    const { data: journal, error } = await adminClient
      .from('journals')
      .update(updateData)
      .eq('journal_id', journal_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating journal:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Invalidate cache for this user
    invalidateUserCache(user.id);

    // Trigger Vektori ingestion in the background with Sensitivity Gate & Clear-Then-Reingest
    const { data: sensitiveTag } = await adminClient
      .from('journal_sensitivity_tags')
      .select('id')
      .eq('journal_id', journal_id)
      .maybeSingle();

    if (sensitiveTag) {
      console.log(`[Vektori] Skipping update ingestion for sensitive entry: ${journal_id}`);
    } else if ((await isMemoryOptedIn(user.id)) && content && content.trim().length > 20) {
      // Clear-then-reingest sequence to prevent duplicate/contradictory chunks
      try {
        await clearVektoriMemory({
          userId: user.id,
          sessionId: `journal-${journal_id}`,
        });
      } catch (clearErr) {
        console.warn('[Vektori] Non-fatal clear before re-ingest failed:', clearErr);
      }

      const messages = buildVektoriJournalMessages({
        title: title || '',
        content,
        journalId: journal_id,
        eventType: 'update',
        createdAt: journal.created_at || '',
        updatedAt: journal.updated_at || '',
        entryDate: journal.journal_date || journal.created_at || '',
        mood: journal.mood || '',
      });

      if (messages.length > 0) {
        ingestVektoriMessages({
          userId: user.id,
          sessionId: `journal-${journal_id}`,
          messages,
        }).catch((err) => console.error('[Vektori] Background ingest failed:', err));
      }
    }

    // Return decrypted data to client
    const responseData = journal;

    return NextResponse.json({
      message: 'Journal updated successfully',
      journal: responseData,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/journals:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/journals - Soft delete journal
 * Query param: journal_id
 */
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const { searchParams } = new URL(req.url);
    const journalId = searchParams.get('journal_id');

    if (!journalId) {
      return NextResponse.json(
        { error: 'journal_id is required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('journals')
      .update({ 
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('journal_id', journalId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting journal:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Invalidate cache for this user
    invalidateUserCache(user.id);

    // Contract: soft-delete purges Vektori memory immediately.
    // If an un-delete endpoint is ever added, it MUST re-ingest the restored journal.
    clearVektoriMemory({
      userId: user.id,
      sessionId: `journal-${journalId}`,
    }).catch((err) => console.error('[Vektori] Failed to clear memory on delete:', err));

    return NextResponse.json({
      message: 'Journal deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/journals:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
