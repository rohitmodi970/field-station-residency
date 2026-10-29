// apps/web/app/api/push/unsubscribe/route.ts
// Remove push subscription for the authenticated user

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint is required' },
        { status: 400 }
      );
    }

    // Delete subscription from database
    const { error } = await supabase
      .from('user_push_subscriptions')
      .delete()
      .match({
        user_id: user.id,
        endpoint,
      });

    if (error) {
      console.error('[Push Unsubscribe] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to remove subscription' },
        { status: 500 }
      );
    }

    // Check if user has any remaining subscriptions
    const { data: remaining } = await supabase
      .from('user_push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    // If no remaining subscriptions, disable push in settings
    if (!remaining || remaining.length === 0) {
      await supabase
        .from('user_notification_settings')
        .update({
          push_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Push subscription removed',
    });
  } catch (err) {
    console.error('[Push Unsubscribe] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE method as alternative
export async function DELETE(request: NextRequest) {
  return POST(request);
}
