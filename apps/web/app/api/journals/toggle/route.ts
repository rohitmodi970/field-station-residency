// apps/web/app/api/journals/toggle/route.ts
/**
 * Toggle Journal Status API
 * 
 * Endpoints:
 * - PATCH /api/journals/toggle - Toggle favorite or archived status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { invalidateUserCache } from '../route';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  return { user };
}

/**
 * PATCH /api/journals/toggle - Toggle favorite or archived status
 * Body: { journal_id: string, field: 'is_favorite' | 'is_archived', value: boolean }
 */
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const body = await req.json();

    const { journal_id, field, value } = body;

    if (!journal_id) {
      return NextResponse.json(
        { error: 'journal_id is required' },
        { status: 400 }
      );
    }

    if (!field || (field !== 'is_favorite' && field !== 'is_archived')) {
      return NextResponse.json(
        { error: 'field must be either "is_favorite" or "is_archived"' },
        { status: 400 }
      );
    }

    if (typeof value !== 'boolean') {
      return NextResponse.json(
        { error: 'value must be a boolean' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Update the specified field
    const updateData: any = {
      [field]: value,
      updated_at: new Date().toISOString(),
    };

    const { data: journal, error } = await adminClient
      .from('journals')
      .update(updateData)
      .eq('journal_id', journal_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error toggling journal status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!journal) {
      return NextResponse.json(
        { error: 'Journal not found' },
        { status: 404 }
      );
    }

    // Invalidate cache for this user
    invalidateUserCache(user.id);

    return NextResponse.json({
      message: `Journal ${field} updated successfully`,
      journal,
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/journals/toggle:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
