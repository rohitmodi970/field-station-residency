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

// Helper to check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const adminClient = createAdminClient();
  const { data: user } = await adminClient
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single();
  
  return user?.is_admin === true;
}

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

    // Check if user is admin
    if (!(await isAdmin(user.id))) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    let data;
    if (userId) {
      // Get metrics for specific user
      const { data: userMetrics, error } = await adminClient
        .from('user_metrics')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error || !userMetrics) {
        return NextResponse.json(
          { error: 'User metrics not found' },
          { status: 404 }
        );
      }
      data = { userMetrics };
    } else {
      // Get global metrics - aggregate from all users
      const { data: allMetrics, error } = await adminClient
        .from('user_metrics')
        .select('*');
      
      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch global metrics' },
          { status: 500 }
        );
      }

      // Calculate global totals
      const globalMetrics = allMetrics?.reduce((acc, metric) => ({
        total_characters_written: (acc.total_characters_written || 0) + metric.total_characters_written,
        total_time_spent_seconds: (acc.total_time_spent_seconds || 0) + metric.total_time_spent_seconds,
        total_journal_count: (acc.total_journal_count || 0) + metric.journal_count,
        total_users: (acc.total_users || 0) + 1,
        waitlist_signed_up_count: (acc.waitlist_signed_up_count || 0) + (metric.waitlist_signed_up ? 1 : 0),
        waitlist_access_granted_count: (acc.waitlist_access_granted_count || 0) + (metric.waitlist_access_granted ? 1 : 0),
      }), {
        total_characters_written: 0,
        total_time_spent_seconds: 0,
        total_journal_count: 0,
        total_users: 0,
        waitlist_signed_up_count: 0,
        waitlist_access_granted_count: 0,
      });

      data = { globalMetrics };
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

// Endpoint to update waitlist status
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;

    // Check if user is admin
    if (!(await isAdmin(user.id))) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { userId, action } = await req.json();

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const updates: any = {};
    
    if (action === 'grantAccess') {
      updates.waitlist_access_granted = true;
      updates.waitlist_access_granted_at = new Date().toISOString();
    } else if (action === 'revokeAccess') {
      updates.waitlist_access_granted = false;
      updates.waitlist_access_granted_at = null;
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const { data: updatedMetrics, error } = await adminClient
      .from('user_metrics')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !updatedMetrics) {
      return NextResponse.json(
        { error: 'User metrics not found or failed to update' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, metrics: updatedMetrics });
  } catch (error) {
    console.error('Error updating waitlist status:', error);
    return NextResponse.json(
      { error: 'Failed to update waitlist status' },
      { status: 500 }
    );
  }
} 