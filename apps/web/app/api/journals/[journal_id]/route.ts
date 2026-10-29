// apps/web/app/api/journals/[journal_id]/route.ts
/**
 * Single Journal API
 * Replaces old MongoDB /api/journal-entry/[journalid]
 * 
 * Endpoints:
 * - GET /api/journals/[journal_id] - Get single journal (no server-side decryption)
 * - DELETE /api/journals/[journal_id] - Delete single journal
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import { clearVektoriMemory } from '@/utils/vektori/client';
// Note: No server-side decryption. Clients handle decrypting based on their session keys.

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
 * GET /api/journals/[journal_id] - Fetch single journal (stored values only)
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ journal_id: string }> }
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
    const { journal_id } = await context.params;

    if (!journal_id) {
      return NextResponse.json(
        { error: 'journal_id is required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    let { data: journal, error } = await adminClient
      .from('journals')
      .select('*')
      .eq('journal_id', journal_id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .single();

    // Some callers may pass the internal UUID id instead of journal_id.
    if (error?.code === 'PGRST116' && UUID_REGEX.test(journal_id)) {
      const fallbackResult = await adminClient
        .from('journals')
        .select('*')
        .eq('id', journal_id)
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .single();

      journal = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Journal not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching journal:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Return stored values only; clients are responsible for decryption
    const responseJournal = journal;

    // Fetch associated media
    const { data: media } = await adminClient
      .from('journal_media')
      .select('*')
      .eq('journal_id', journal.id)
      .eq('upload_status', 'completed')
      .order('display_order', { ascending: true });

    return NextResponse.json({
      journal: responseJournal,
      media: media || [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/journals/[journal_id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/journals/[journal_id] - Soft delete journal
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ journal_id: string }> }
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
    const { journal_id } = await context.params;

    if (!journal_id) {
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
      .eq('journal_id', journal_id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting journal:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Contract: soft-delete purges Vektori memory immediately.
    // If an un-delete endpoint is ever added, it MUST re-ingest the restored journal.
    clearVektoriMemory({
      userId: user.id,
      sessionId: `journal-${journal_id}`,
    }).catch((err) => console.error('[Vektori] Failed to clear memory on delete:', err));

    return NextResponse.json({
      message: 'Journal deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/journals/[journal_id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
