// apps/web/app/api/user/devices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// GET /api/user/devices - Fetch active user sessions/devices (metadata only)
export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = authResult.user;

    const callerDeviceId =
      req.headers.get('x-device-id') ||
      req.nextUrl.searchParams.get('device_id');

    const adminClient = createAdminClient();

    // Fetch all active sessions for this user
    const { data: sessions, error: sessionsError } = await adminClient
      .from('user_sessions')
      .select('id, device_id, device_name, device_type, browser, os, ip_address, city, country, last_activity, is_active, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('last_activity', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
    }

    const allSessions = (sessions || []).map((s) => ({
      ...s,
      is_current: callerDeviceId ? s.device_id === callerDeviceId : false,
    }));

    // Backfill geo data for sessions with a real IP but no geo data yet
    const sessionsNeedingGeo = allSessions.filter((s) => {
      const ip = s.ip_address;
      const hasRealIp =
        ip &&
        ip !== '0.0.0.0' &&
        ip !== '::1' &&
        ip !== '127.0.0.1' &&
        !ip.startsWith('192.168.') &&
        !ip.startsWith('10.');
      return hasRealIp && !s.city && !s.country;
    });

    if (sessionsNeedingGeo.length > 0) {
      const backfillGeo = async () => {
        for (const session of sessionsNeedingGeo.slice(0, 5)) {
          try {
            const geoRes = await fetch(
              `http://ip-api.com/json/${session.ip_address}?fields=status,country,city`,
              { signal: AbortSignal.timeout(2000) }
            );
            if (geoRes.ok) {
              const geo = await geoRes.json();
              if (geo.status === 'success') {
                await adminClient
                  .from('user_sessions')
                  .update({ city: geo.city || null, country: geo.country || null })
                  .eq('id', session.id);
                session.city = geo.city || null;
                session.country = geo.country || null;
              }
            }
          } catch {
            /* silently skip */
          }
        }
      };
      backfillGeo();
    }

    return NextResponse.json({ devices: allSessions });
  } catch (error) {
    console.error('Error in GET /api/user/devices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
