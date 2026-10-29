import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * POST /api/journal/bulk-create
 *
 * Creates multiple journal entries in one request, optionally copying
 * source images from temp storage to permanent journal paths and
 * inserting journal_media records.
 *
 * After all journals are processed the temp folder is deleted.
 */

interface BulkJournalEntry {
  journal_id: string;
  // Encrypted fields
  title_encrypted?: string | null;
  title_iv?: string | null;
  content_encrypted?: string | null;
  content_iv?: string | null;
  is_encrypted?: boolean;
  // Plaintext fallback (when encryption disabled/failed)
  title?: string | null;
  content?: string | null;
  // Metadata (always plaintext)
  date: string;
  tags: string[];
  journal_type: string;
  word_count: number;
  reading_time_minutes: number;
  // Images
  attach_images: boolean;
  source_image_paths: string[]; // temp Supabase paths
}

interface BulkCreatePayload {
  journals: BulkJournalEntry[];
  tempFolder: string;
}

interface JournalResult {
  journal_id: string;
  db_id?: string;
  date: string;
  title_plain?: string | null; // returned for embedding generation (client already has it)
  success: boolean;
  error?: string;
  imagesAttached: number;
}

const BUCKET = 'users_cloud';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth ─────────────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse body ───────────────────────────────────────────────────
    const body: BulkCreatePayload = await request.json();
    const { journals, tempFolder } = body;

    if (!journals || !Array.isArray(journals) || journals.length === 0) {
      return NextResponse.json(
        { error: 'journals array is required' },
        { status: 400 },
      );
    }

    if (journals.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 journals per request' },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const created: JournalResult[] = [];
    const failed: JournalResult[] = [];

    console.log(
      `[bulk-create] Creating ${journals.length} journal(s) for user ${user.id}`,
    );

    // ── Process each journal ─────────────────────────────────────────
    for (const entry of journals) {
      try {
        // Build insert payload
        const journalData: Record<string, unknown> = {
          user_id: user.id,
          journal_id: entry.journal_id,
          journal_type: entry.journal_type || 'personal',
          tags: entry.tags || ['handwritten', 'bulk-import'],
          date: entry.date || new Date().toISOString().slice(0, 10),
          display_date: entry.date ? new Date(entry.date).toISOString() : new Date().toISOString(),
          is_favorite: false,
          is_archived: false,
          word_count: entry.word_count || 0,
          reading_time_minutes: entry.reading_time_minutes || 0,
        };

        if (entry.is_encrypted) {
          journalData.title_encrypted = entry.title_encrypted;
          journalData.title_iv = entry.title_iv;
          journalData.content_encrypted = entry.content_encrypted;
          journalData.content_iv = entry.content_iv;
          journalData.is_encrypted = true;
          journalData.title = '';
          journalData.content = '';
        } else {
          journalData.title = entry.title || '';
          journalData.content = entry.content || '';
          journalData.is_encrypted = false;
        }

        // Insert journal row
        const { data: journal, error: insertErr } = await adminClient
          .from('journals')
          .insert(journalData)
          .select('id, journal_id')
          .single();

        if (insertErr || !journal) {
          console.error(
            `[bulk-create] Insert failed for ${entry.journal_id}:`,
            insertErr,
          );
          failed.push({
            journal_id: entry.journal_id,
            date: entry.date,
            success: false,
            error: insertErr?.message || 'Insert failed',
            imagesAttached: 0,
          });
          continue;
        }

        let imagesAttached = 0;

        // ── Copy images if requested ─────────────────────────────────
        if (entry.attach_images && entry.source_image_paths.length > 0) {
          for (const srcPath of entry.source_image_paths) {
            try {
              // Extract original filename from temp path (e.g. "0_photo.jpg")
              const parts = srcPath.split('/');
              const tempFileName = parts[parts.length - 1] ?? srcPath;
              // Strip the numeric prefix we added during upload
              const cleanName = tempFileName.replace(/^\d+_/, '');

              const destPath = `${user.id}/journal/${entry.journal_id}/${cleanName}`;

              // Copy file within the same bucket
              const { error: copyErr } = await adminClient.storage
                .from(BUCKET)
                .copy(srcPath, destPath);

              if (copyErr) {
                console.error(
                  `[bulk-create] Copy failed ${srcPath} → ${destPath}:`,
                  copyErr,
                );
                // Non-fatal — journal was created, just image attachment failed
                continue;
              }

              // Get file metadata for the media record
              // We don't have exact size easily, estimate from original
              const { data: fileList } = await adminClient.storage
                .from(BUCKET)
                .list(
                  destPath.substring(0, destPath.lastIndexOf('/')),
                  { search: cleanName, limit: 1 },
                );

              const fileMeta = fileList?.[0];

              // Determine mime type based on extension
              const ext = cleanName.split('.').pop()?.toLowerCase() || '';
              const mimeMap: Record<string, string> = {
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                png: 'image/png',
                webp: 'image/webp',
                heic: 'image/heic',
                heif: 'image/heif'
              };
              const fallbackMime = mimeMap[ext] || 'application/octet-stream';

              // Insert journal_media record
              const { error: mediaErr } = await adminClient
                .from('journal_media')
                .insert({
                  journal_id: journal.id,
                  user_id: user.id,
                  media_type: 'image',
                  file_name: cleanName,
                  path: destPath,
                  bucket: BUCKET,
                  storage_provider: 'supabase',
                  file_size: fileMeta?.metadata?.size || null,
                  mime_type: fileMeta?.metadata?.mimetype || fallbackMime,
                });

              if (mediaErr) {
                console.error(
                  `[bulk-create] Media record failed for ${destPath}:`,
                  mediaErr,
                );
              } else {
                imagesAttached++;
              }
            } catch (imgErr) {
              console.error(
                `[bulk-create] Image processing error:`,
                imgErr,
              );
            }
          }
        }

        created.push({
          journal_id: entry.journal_id,
          db_id: journal.id,
          date: entry.date,
          success: true,
          imagesAttached,
        });
      } catch (entryErr) {
        console.error(
          `[bulk-create] Unexpected error for ${entry.journal_id}:`,
          entryErr,
        );
        failed.push({
          journal_id: entry.journal_id,
          date: entry.date,
          success: false,
          error:
            entryErr instanceof Error
              ? entryErr.message
              : 'Unexpected error',
          imagesAttached: 0,
        });
      }
    }

    // ── Clean up temp folder ─────────────────────────────────────────
    let tempCleaned = false;
    if (tempFolder) {
      try {
        // List all files in the temp folder
        const { data: tempFiles } = await adminClient.storage
          .from(BUCKET)
          .list(tempFolder);

        if (tempFiles && tempFiles.length > 0) {
          const filePaths = tempFiles.map(
            (f) => `${tempFolder}/${f.name}`,
          );
          const { error: removeErr } = await adminClient.storage
            .from(BUCKET)
            .remove(filePaths);

          if (removeErr) {
            console.error(
              '[bulk-create] Temp cleanup error:',
              removeErr,
            );
          } else {
            tempCleaned = true;
            console.log(
              `[bulk-create] Cleaned ${filePaths.length} temp file(s)`,
            );
          }
        } else {
          tempCleaned = true; // Nothing to clean
        }
      } catch (cleanErr) {
        console.error('[bulk-create] Temp cleanup failed:', cleanErr);
      }
    }

    console.log(
      `[bulk-create] Done: ${created.length} created, ${failed.length} failed`,
    );

    return NextResponse.json({
      success: failed.length === 0,
      created,
      failed,
      totalCreated: created.length,
      totalFailed: failed.length,
      tempCleaned,
    });
  } catch (error) {
    console.error('[bulk-create] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create journals',
      },
      { status: 500 },
    );
  }
}
