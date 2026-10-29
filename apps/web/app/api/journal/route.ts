// apps/web/app/api/journals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';

import { createAdminClient } from '@/utils/supabase/admin';
import { 
  uploadToSupabaseStorage, 
  deleteFromSupabaseStorage,
  getSignedUrl,
  validateFile,
  BUCKETS,
  MediaType
} from '@/utils/supabase/storage';

// Media limits per type
const MEDIA_LIMITS = {
  image: { count: 6, size: 25 * 1024 * 1024 }, // 25MB
  audio: { count: 11, size: 50 * 1024 * 1024 }, // 50MB
  video: { count: 2, size: 200 * 1024 * 1024 }, // 200MB
  document: { count: 5, size: 5 * 1024 * 1024 }, // 5MB
};

/**
 * Generate unique journal ID
 */
function generateJournalId(userId: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${userId.substring(0, 8)}_${timestamp}_${random}`;
}

/**
 * CREATE journal entry
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
    const adminClient = createAdminClient();

    const journalId = body.journal_id || generateJournalId(user.id);

    // Check if journal already exists
    const { data: existingJournal } = await adminClient
      .from('journals')
      .select('id')
      .eq('user_id', user.id)
      .eq('journal_id', journalId)
      .single();

    const journalData = {
      user_id: user.id,
      journal_id: journalId,
      title: body.title || null,
      content: body.content || null,
      journal_type: body.journal_type || 'general',
      date: body.date || new Date().toISOString(),
      tags: body.tags || [],
      mood: body.mood || null,
      location: body.location || null,
      weather: body.weather || null,
      display_date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
      is_favorite: body.is_favorite || false,
      is_archived: body.is_archived || false,
      // Accept word_count and reading_time from client (calculated before encryption)
      word_count: body.word_count || 0,
      reading_time_minutes: body.reading_time_minutes || 0,
      is_conflict_draft: body.is_conflict_draft || false,
    };

    let journal;
    let insertError;

    if (existingJournal) {
      // Update existing journal
      const updateResult = await adminClient
        .from('journals')
        .update(journalData)
        .eq('user_id', user.id)
        .eq('journal_id', journalId)
        .select()
        .single();
      
      journal = updateResult.data;
      insertError = updateResult.error;
    } else {
      // Insert new journal
      const insertResult = await adminClient
        .from('journals')
        .insert(journalData)
        .select()
        .single();
      
      journal = insertResult.data;
      insertError = insertResult.error;
    }

    if (insertError) {
      console.error('Error creating/updating journal:', insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Background refresh of resident intent snapshot & cohort graph with new journal data
    try {
      const { refreshUserSnapshotFromLatestData } = await import('@/lib/residency/residencyStore');
      refreshUserSnapshotFromLatestData(user.id).catch((err) => {
        console.warn('⚠️ [API:Journals] Residency snapshot background update warning:', err?.message);
      });
    } catch (e) {}

    return NextResponse.json(
      { message: 'Journal created successfully', journal },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/journals:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET journal entries
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
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
    const includeMedia = searchParams.get('include_media') === 'true';
    const adminClient = createAdminClient();

    // Get single journal
    if (journalId) {
      const selectQuery = includeMedia 
        ? '*, journal_media(*)'
        : '*';
      
      const { data: journal, error } = await adminClient
        .from('journals')
        .select(selectQuery)
        .eq('journal_id', journalId)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Journal not found' },
          { status: 404 }
        );
      }

      // Generate signed URLs for media if requested
      if (includeMedia && journal && 'journal_media' in journal && journal.journal_media) {
        (journal as any).journal_media = await Promise.all(
          (journal.journal_media as any[]).map(async (media: any) => {
            if (media.path && media.bucket) {
              try {
                const signedUrl = await getSignedUrl(media.bucket, media.path);
                return { ...media, signed_url: signedUrl, url: signedUrl, uri: signedUrl, thumbnail_url: signedUrl };
              } catch (err) {
                console.error('Error generating signed URL:', err);
                return media;
              }
            }
            return media;
          })
        );
      }

      return NextResponse.json({ journal });
    }

    // Get all journals for user with full journal_media
    const selectQuery = includeMedia
      ? '*, journal_media(*)'
      : '*';
    
    const { data: journals, error } = await adminClient
      .from('journals')
      .select(selectQuery)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching journals:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Generate signed URLs for all journal media
    let processedJournals = journals || [];
    if (includeMedia && processedJournals.length > 0) {
      processedJournals = await Promise.all(
        processedJournals.map(async (j: any) => {
          if (j.journal_media && Array.isArray(j.journal_media)) {
            const mediaWithUrls = await Promise.all(
              j.journal_media.map(async (media: any) => {
                if (media.path && media.bucket) {
                  try {
                    const signedUrl = await getSignedUrl(media.bucket, media.path);
                    return { ...media, signed_url: signedUrl, url: signedUrl, uri: signedUrl, thumbnail_url: signedUrl };
                  } catch (err) {
                    console.error('Error generating signed URL for journal media:', err);
                    return media;
                  }
                }
                return media;
              })
            );
            return { ...j, journal_media: mediaWithUrls, media: mediaWithUrls };
          }
          return j;
        })
      );
    }

    return NextResponse.json({ journals: processedJournals });
  } catch (error: any) {
    console.error('Error in GET /api/journals:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * UPDATE journal entry
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
    const { journal_id, ...updateData } = body;

    if (!journal_id) {
      return NextResponse.json(
        { error: 'journal_id is required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Accept word_count and reading_time from client if provided (calculated before encryption)
    updateData.updated_at = new Date().toISOString();
    if (updateData.date) {
      updateData.display_date = new Date(updateData.date).toISOString();
    }

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

    return NextResponse.json({
      message: 'Journal updated successfully',
      journal
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
 * DELETE journal entry (soft delete or permanent delete, supports bulk)
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
    const permanent = searchParams.get('permanent') === 'true';
    
    // Support bulk delete via request body
    let journalIds: string[] = [];
    
    if (journalId) {
      journalIds = [journalId];
    } else {
      try {
        const body = await req.json();
        journalIds = body.journal_ids || [];
      } catch {
        // No body provided
      }
    }

    if (journalIds.length === 0) {
      return NextResponse.json(
        { error: 'journal_id or journal_ids is required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const deletedCount = journalIds.length;

    if (permanent) {
      // Get associated media for all journals
      const { data: mediaFiles } = await adminClient
        .from('journal_media')
        .select('*')
        .in('journal_id', journalIds)
        .eq('user_id', user.id);

      // Delete media files from storage
      if (mediaFiles) {
        for (const media of mediaFiles) {
          try {
            if (media.path && media.bucket) {
              await deleteFromSupabaseStorage(media.bucket, media.path);
            }
            if (media.thumbnail_url) {
              // Delete thumbnail if exists
              const thumbPath = media.thumbnail_url.split('/').pop();
              if (thumbPath) {
                await deleteFromSupabaseStorage(media.bucket, `thumbnails/${thumbPath}`);
              }
            }
          } catch (err) {
            console.error('Error deleting media file:', err);
          }
        }
      }

      // Permanently delete journals
      const { error } = await adminClient
        .from('journals')
        .delete()
        .in('journal_id', journalIds)
        .eq('user_id', user.id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: `${deletedCount} journal${deletedCount > 1 ? 's' : ''} permanently deleted`,
        count: deletedCount
      });
    } else {
      // Soft delete
      const { error } = await adminClient
        .from('journals')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .in('journal_id', journalIds)
        .eq('user_id', user.id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: `${deletedCount} journal${deletedCount > 1 ? 's' : ''} moved to trash`,
        count: deletedCount
      });
    }
  } catch (error: any) {
    console.error('Error in DELETE /api/journals:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}