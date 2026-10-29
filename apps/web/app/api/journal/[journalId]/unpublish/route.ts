// apps/web/app/api/journal/[journalId]/unpublish/route.ts
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
 * PATCH /api/journal/[journalId]/unpublish
 * Unpublish a journal entry (deactivate public access)
 */
export async function PATCH(
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
    const adminClient = createAdminClient();

    // 1. Fetch the journal entry
    const { data: journal, error: journalError } = await adminClient
      .from('journals')
      .select('id, user_id, is_public, published_share_id')
      .eq('journal_id', journalId)
      .eq('user_id', user.id)
      .single();

    if (journalError || !journal) {
      return NextResponse.json(
        { error: 'Journal not found or unauthorized' },
        { status: 404 }
      );
    }

    if (!journal.is_public) {
      return NextResponse.json(
        { error: 'Journal is not currently published' },
        { status: 400 }
      );
    }

    // 2. Deactivate the journal_publics record
    if (journal.published_share_id) {
      // First, delete any existing inactive records to avoid unique constraint violation
      await adminClient
        .from('journal_publics')
        .delete()
        .eq('journal_id', journal.id)
        .eq('published_by', user.id)
        .eq('is_active', false);
      
      // Now deactivate the active record
      const { error: deactivateError } = await adminClient
        .from('journal_publics')
        .update({ is_active: false })
        .eq('share_id', journal.published_share_id)
        .eq('published_by', user.id);

      if (deactivateError) {
        console.error('Error deactivating journal_publics:', deactivateError);
        return NextResponse.json(
          { error: 'Failed to unpublish journal' },
          { status: 500 }
        );
      }
    }

    // 3. Update journals table
    const { error: updateError } = await adminClient
      .from('journals')
      .update({
        is_public: false,
        // Keep published_at and published_share_id for history
      })
      .eq('id', journal.id);

    if (updateError) {
      console.error('Error updating journal:', updateError);
      return NextResponse.json(
        { error: 'Failed to update journal status' },
        { status: 500 }
      );
    }

    // 4. Return success response
    return NextResponse.json({
      success: true,
      message: 'Journal unpublished successfully',
      data: {
        is_public: false,
      }
    });

  } catch (error: any) {
    console.error('Error in unpublish journal:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/journal/[journalId]/unpublish
 * Permanently delete the publish record (optional - use with caution)
 */
export async function DELETE(
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
    const adminClient = createAdminClient();

    // 1. Fetch the journal entry
    const { data: journal, error: journalError } = await adminClient
      .from('journals')
      .select('id, user_id, published_share_id')
      .eq('journal_id', journalId)
      .eq('user_id', user.id)
      .single();

    if (journalError || !journal) {
      return NextResponse.json(
        { error: 'Journal not found or unauthorized' },
        { status: 404 }
      );
    }

    // 2. Delete the journal_publics record (cascades to share_records and share_views)
    if (journal.published_share_id) {
      const { error: deleteError } = await adminClient
        .from('journal_publics')
        .delete()
        .eq('share_id', journal.published_share_id)
        .eq('published_by', user.id);

      if (deleteError) {
        console.error('Error deleting journal_publics:', deleteError);
        return NextResponse.json(
          { error: 'Failed to delete publish record' },
          { status: 500 }
        );
      }
    }

    // 3. Update journals table
    const { error: updateError } = await adminClient
      .from('journals')
      .update({
        is_public: false,
        published_at: null,
        published_share_id: null,
      })
      .eq('id', journal.id);

    if (updateError) {
      console.error('Error updating journal:', updateError);
      return NextResponse.json(
        { error: 'Failed to update journal status' },
        { status: 500 }
      );
    }

    // 4. Return success response
    return NextResponse.json({
      success: true,
      message: 'Publish record permanently deleted',
    });

  } catch (error: any) {
    console.error('Error in delete publish record:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
