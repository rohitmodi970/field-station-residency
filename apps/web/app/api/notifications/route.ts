// apps/web/app/api/notifications/route.ts
// List and create notifications

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from '@/utils/notifications/notificationService';
import type { Notification, NotificationListResponse, CreateNotificationRequest } from '@/types/notifications';

/**
 * GET /api/notifications
 * Fetch user's notifications with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const unreadOnly = searchParams.get('unread') === 'true';

    const adminClient = createAdminClient();

    // Release due scheduled reminders for this user so local/dev works even without cron.
    await notificationService.processScheduledReminders(user.id);

    // Build query
    let query = adminClient
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('recipient_id', user.id)
      .eq('is_dismissed', false)
      .neq('status', 'queued')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error, count } = await query;

    if (error) throw error;

    // Get unread count
    const { count: unreadCount } = await adminClient
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)
      .neq('status', 'queued')
      .eq('is_dismissed', false);

    const response: NotificationListResponse = {
      notifications: (notifications as Notification[]) || [],
      unreadCount: unreadCount || 0,
      total: count || 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/notifications] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Create a new notification (admin/system use)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateNotificationRequest = await request.json();

    // Validate required fields
    if (!body.recipientId || !body.type || !body.title || !body.body) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientId, type, title, body' },
        { status: 400 }
      );
    }

    // For security, users can only send notifications to themselves
    // unless they have admin role (future implementation)
    if (body.recipientId !== user.id) {
      return NextResponse.json(
        { error: 'Cannot send notifications to other users' },
        { status: 403 }
      );
    }

    const { notification, error } = await notificationService.send({
      recipientId: body.recipientId,
      templateKey: body.templateKey,
      type: body.type,
      title: body.title,
      body: body.body,
      data: body.data,
      priority: body.priority,
      channels: body.channels,
    });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create notification', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/notifications] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
