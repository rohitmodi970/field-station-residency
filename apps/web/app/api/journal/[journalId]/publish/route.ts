// apps/web/app/api/journal/[journalId]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * Get authenticated user — supports Bearer token (mobile) and cookie (web)
 */
async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { error: 'Server misconfigured', status: 500 as const };
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { error: 'Unauthorized', status: 401 as const };
    return { user };
  }

  // Fallback: cookie-based auth (web)
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: 'Unauthorized', status: 401 as const };
  return { user };
}

/**
 * Generate short random share ID (12 chars base62-like)
 */
function generateShareId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Sanitize HTML content (basic sanitization - add proper sanitizer in production)
 */
function sanitizeContent(content: string): string {
  if (!content) return '';
  
  // Remove script tags and potentially dangerous HTML
  let sanitized = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
  
  return sanitized;
}

/**
 * POST /api/journal/[journalId]/publish
 * Publish a journal entry to a public URL
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ journalId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const { journalId } = await params;
    const body = await req.json();
    const adminClient = createAdminClient();

    // Validate request body
    const {
      include_media = false,
      media_mode = 'signed',
      expires_at = null,
      is_anonymous = false,
      anonymous_alias = null,
      include_analysis = false,
      snapshot_analysis = null,
    } = body;

    // Validate media_mode
    if (!['signed', 'proxy', 'public_copy'].includes(media_mode)) {
      return NextResponse.json(
        { error: 'Invalid media_mode. Must be: signed, proxy, or public_copy' },
        { status: 400 }
      );
    }

    // 1. Fetch the journal entry
    const { data: journal, error: journalError } = await adminClient
      .from('journals')
      .select('*')
      .eq('journal_id', journalId)
      .eq('user_id', user.id)
      .single();

    if (journalError || !journal) {
      return NextResponse.json(
        { error: 'Journal not found or unauthorized' },
        { status: 404 }
      );
    }

    // 2. Check if already published (deactivate old publish)
    if (journal.is_public && journal.published_share_id) {
      await adminClient
        .from('journal_publics')
        .update({ is_active: false })
        .eq('share_id', journal.published_share_id);
    }

    // 3. Get user profile info for snapshot (including username for new URL structure)
    const { data: userProfile } = await adminClient
      .from('users')
      .select('name, email, profile_image, username')
      .eq('id', user.id)
      .single();
    
    if (!userProfile || !userProfile.username) {
      return NextResponse.json(
        { error: 'User profile or username not found. Please complete your profile first.' },
        { status: 400 }
      );
    }

    // 4. Handle encrypted content
    let snapshotTitle = journal.title;
    let snapshotContent = journal.content;

    if (journal.is_encrypted) {
      // If encrypted, use encrypted fields as-is (assume client provides decrypted snapshot)
      // OR require client to send decrypted snapshot in request body
      if (body.snapshot_title && body.snapshot_content) {
        snapshotTitle = body.snapshot_title;
        snapshotContent = body.snapshot_content;
      } else {
        return NextResponse.json(
          { 
            error: 'Cannot publish encrypted journal without providing decrypted snapshot',
            hint: 'Include snapshot_title and snapshot_content in request body'
          },
          { status: 400 }
        );
      }
    }

    // 5. Sanitize content
    const sanitizedContent = sanitizeContent(snapshotContent || '');

    // 6. Generate unique share ID
    let shareId = generateShareId();
    let attempts = 0;
    const maxAttempts = 5;

    // Ensure unique share ID
    while (attempts < maxAttempts) {
      const { data: existing } = await adminClient
        .from('journal_publics')
        .select('id')
        .eq('share_id', shareId)
        .single();

      if (!existing) break;
      shareId = generateShareId();
      attempts++;
    }

    if (attempts === maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique share ID. Please try again.' },
        { status: 500 }
      );
    }

    // 7. Create journal_publics record
    // When publishing anonymously, omit personal info from the snapshot
    const publishedByName = is_anonymous ? (anonymous_alias?.trim() || 'Anonymous') : (userProfile?.name || null);
    const publishedByEmail = is_anonymous ? null : (userProfile?.email || null);
    const publishedByProfileImage = is_anonymous ? null : (userProfile?.profile_image || null);

    const { data: publishedJournal, error: publishError } = await adminClient
      .from('journal_publics')
      .insert({
        journal_id: journal.id,
        share_id: shareId,
        published_by: user.id,
        published_by_name: publishedByName,
        published_by_email: publishedByEmail,
        published_by_profile_image: publishedByProfileImage,
        snapshot_title: snapshotTitle,
        snapshot_content: sanitizedContent,
        snapshot_tags: journal.tags || [],
        snapshot_mood: journal.mood,
        snapshot_location: journal.location,
        snapshot_weather: journal.weather,
        snapshot_date: journal.date,
        include_media,
        media_mode,
        is_active: true,
        expires_at,
        include_analysis: !!include_analysis,
        snapshot_analysis: (include_analysis && snapshot_analysis) ? snapshot_analysis : null,
      })
      .select()
      .single();

    if (publishError) {
      console.error('Error creating journal_publics:', publishError);
      return NextResponse.json(
        { error: 'Failed to publish journal', details: publishError.message },
        { status: 500 }
      );
    }

    // 8. Update journals table
    const { error: updateError } = await adminClient
      .from('journals')
      .update({
        is_public: true,
        published_at: new Date().toISOString(),
        published_share_id: shareId,
      })
      .eq('id', journal.id);

    if (updateError) {
      console.error('Error updating journal:', updateError);
      // Rollback: delete journal_publics
      await adminClient
        .from('journal_publics')
        .delete()
        .eq('id', publishedJournal.id);

      return NextResponse.json(
        { error: 'Failed to update journal publish status' },
        { status: 500 }
      );
    }

    // 9. Build public URL with new username-based structure
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';
    const publicUrl = `${baseUrl}/${userProfile.username}/journal/${shareId}`;

    // 10. Return success response
    return NextResponse.json({
      success: true,
      message: 'Journal published successfully',
      data: {
        share_id: shareId,
        username: userProfile.username,
        public_url: publicUrl,
        legacy_url: `${baseUrl}/p/${shareId}`, // Keep legacy URL for backwards compatibility
        published_at: publishedJournal.created_at,
        expires_at: publishedJournal.expires_at,
        include_media,
        media_mode,
        is_anonymous: !!is_anonymous,
        include_analysis: !!include_analysis,
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error in publish journal:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
