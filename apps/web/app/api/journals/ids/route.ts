// apps/web/app/api/journals/ids/route.ts
/**
 * Fetch Journal IDs API
 * Replaces old MongoDB /api/journal-entry/fetch-data
 * 
 * Returns just the journal_id values for quick lookups
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  return { user };
}

/**
 * GET /api/journals/ids - Get all journal IDs for user
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const adminClient = createAdminClient();

    const { data: journals, error } = await adminClient
      .from('journals')
      .select('journal_id, created_at, is_favorite, is_archived')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching journal IDs:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const journalIds = journals?.map(j => j.journal_id) || [];

    return NextResponse.json({
      journalIds,
      journals, // Return full metadata for caching
    });
  } catch (error: any) {
    console.error('Error in GET /api/journals/ids:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
