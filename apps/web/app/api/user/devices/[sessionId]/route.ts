// apps/web/app/api/user/devices/[sessionId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { requireRecentAuth } from '@/utils/auth/stepUp';

// DELETE /api/user/devices/[sessionId] - Revoke a specific device session
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = authResult.user;

    const elevationHeader =
      request.headers.get('x-force-elevation') ||
      request.headers.get('X-Force-Elevation');

    if (elevationHeader) {
      const stepUp = await requireRecentAuth(request, {
        requiredScope: 'revoke_device',
        consumeToken: true,
      });

      if (!stepUp.authorized) {
        return NextResponse.json({ error: stepUp.error }, { status: stepUp.status });
      }
    }

    const { sessionId } = await context.params;
    const adminClient = createAdminClient();

    // Check session belongs to this user
    const { data: session, error: fetchError } = await adminClient
      .from('user_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Mark the session row as inactive
    const { error: updateError } = await adminClient
      .from('user_sessions')
      .update({ is_active: false, logout_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error revoking session:', updateError);
      return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
    }

    // Clean up corresponding device_keys row if device_id is recorded
    if (session.device_id) {
      await adminClient
        .from('device_keys')
        .delete()
        .eq('user_id', user.id)
        .eq('device_id', session.device_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully.',
    });
  } catch (error) {
    console.error('Error in DELETE /api/user/devices/[sessionId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
