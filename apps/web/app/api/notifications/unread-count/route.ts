// apps/web/app/api/notifications/unread-count/route.ts
// Get unread notification count

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from '@/utils/notifications/notificationService';

/**
 * GET /api/notifications/unread-count
 * Get the count of unread notifications for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Release due scheduled reminders for this user so queued reminders surface immediately.
    await notificationService.processScheduledReminders(user.id);

    const { count, error } = await adminClient
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)
      .neq('status', 'queued')
      .eq('is_dismissed', false);

    if (error) throw error;

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('[GET /api/notifications/unread-count] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get unread count' },
      { status: 500 }
    );
  }
}
