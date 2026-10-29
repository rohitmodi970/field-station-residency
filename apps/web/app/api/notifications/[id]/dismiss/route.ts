// apps/web/app/api/notifications/[id]/dismiss/route.ts
// Dismiss a notification

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { notificationService } from '@/utils/notifications/notificationService';

/**
 * POST /api/notifications/[id]/dismiss
 * Dismiss a notification (soft delete)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const success = await notificationService.dismiss(id, user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to dismiss notification' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/notifications/[id]/dismiss] Error:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss notification' },
      { status: 500 }
    );
  }
}
