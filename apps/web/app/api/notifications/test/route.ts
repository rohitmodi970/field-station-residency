// apps/web/app/api/notifications/test/route.ts
// Send a test notification to the current user

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import notificationService from '@/utils/notifications/notificationService';

/**
 * POST /api/notifications/test
 * Send a test notification to verify the user's notification settings
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notification, error } = await notificationService.send({
      recipientId: user.id,
      type: 'system',
      title: 'Test Notification',
      body: 'Your in-app notifications are working. Gmail delivery is limited to important task alerts only.',
      data: {
        link: '/settings/notifications',
        test: true,
      },
      priority: 'normal',
      channels: ['in_app'],
    });

    if (error) {
      console.error('[POST /api/notifications/test] Send error:', error);
      return NextResponse.json(
        { error: 'Failed to create test notification' },
        { status: 500 }
      );
    }

    if (!notification) {
      return NextResponse.json({
        success: false,
        message: 'Notification was suppressed by your settings or quiet hours.',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully',
      notification,
    });
  } catch (error) {
    console.error('[POST /api/notifications/test] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
}
