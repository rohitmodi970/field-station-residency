import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { BUCKETS, getSignedUrl } from '@/utils/supabase/storage';

const MEDIA_LIMITS = {
  image: { count: 6, size: 25 * 1024 * 1024 },
  audio: { count: 11, size: 50 * 1024 * 1024 },
  video: { count: 2, size: 200 * 1024 * 1024 },
  document: { count: 5, size: 5 * 1024 * 1024 },
};

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  return { user };
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const body = await req.json();
    const journalId = body?.journal_id;
    const filePath = body?.filePath;
    const fileName = body?.fileName || 'voice.webm';
    const mimeType = body?.mimeType || 'audio/webm';
    const fileSize = Number(body?.fileSize || 0);

    if (!journalId || !filePath) {
      return NextResponse.json({ error: 'journal_id and filePath are required' }, { status: 400 });
    }

    if (!filePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Unauthorized access to file' }, { status: 403 });
    }

    if (fileSize > MEDIA_LIMITS.audio.size) {
      return NextResponse.json({ error: `File exceeds ${MEDIA_LIMITS.audio.size / (1024 * 1024)}MB size limit` }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: journal } = await adminClient
      .from('journals')
      .select('id')
      .eq('journal_id', journalId)
      .eq('user_id', user.id)
      .single();

    if (!journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    const { count } = await adminClient
      .from('journal_media')
      .select('id', { count: 'exact', head: true })
      .eq('journal_id', journal.id)
      .eq('media_type', 'audio');

    if (count && count >= MEDIA_LIMITS.audio.count) {
      return NextResponse.json({ error: `Maximum audio limit (${MEDIA_LIMITS.audio.count}) reached` }, { status: 400 });
    }

    const { data: existingSameFile } = await adminClient
      .from('journal_media')
      .select('id')
      .eq('journal_id', journal.id)
      .eq('file_name', fileName)
      .maybeSingle();

    if (existingSameFile) {
      return NextResponse.json({ error: 'Voice note already attached' }, { status: 409 });
    }

    const signedUrl = await getSignedUrl(BUCKETS.USERS_CLOUD, filePath);

    const mediaRecord = {
      user_id: user.id,
      journal_id: journal.id,
      media_type: 'audio',
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      storage_provider: 'supabase',
      upload_status: 'completed',
      bucket: BUCKETS.USERS_CLOUD,
      path: filePath,
      public_url: signedUrl,
    };

    const { data: media, error: insertError } = await adminClient
      .from('journal_media')
      .insert(mediaRecord)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Voice note attached successfully',
      media: {
        ...media,
        signed_url: signedUrl,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[api/journals/media/from-upload] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to attach uploaded voice note' },
      { status: 500 }
    );
  }
}
