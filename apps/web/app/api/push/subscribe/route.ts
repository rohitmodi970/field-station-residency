// apps/web/app/api/push/subscribe/route.ts
// Save push subscription for the authenticated user

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }
    const { user, supabase } = authResult;

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      );
    }

    // Store subscription in database
    const { data, error } = await supabase
      .from('user_push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: request.headers.get('user-agent') || null,
          created_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,endpoint',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('[Push Subscribe] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to save subscription' },
        { status: 500 }
      );
    }

    // Update user's notification settings to enable push
    await supabase
      .from('user_notification_settings')
      .upsert(
        {
          user_id: user.id,
          push_enabled: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

    return NextResponse.json({
      success: true,
      subscriptionId: data.id,
      message: 'Push subscription saved',
    });
  } catch (err) {
    console.error('[Push Subscribe] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
