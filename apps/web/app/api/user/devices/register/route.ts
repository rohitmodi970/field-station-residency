import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { headers } from 'next/headers';
import { UAParser } from 'ua-parser-js';

// POST /api/user/devices/register
// Upserts the current browser session in user_sessions with geo-lookup.
// Race-condition safe: uses a short-window (5 min) duplicate check before inserting.
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;
    const supabase = authResult.supabase;

    const headersList = await headers();
    const rawIp =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      '::1';

    // Normalize IPv6 localhost to 127.0.0.1 to avoid display issues
    const ip = (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') ? '127.0.0.1' : rawIp;
    const isLocalhost = ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.');

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty or not json
    }

    const deviceId =
      headersList.get('x-device-id') ||
      req.headers.get('x-device-id') ||
      req.nextUrl.searchParams.get('device_id') ||
      body?.device_id ||
      null;

    const customDeviceName = body?.device_name;
    const customDeviceType = body?.device_type;
    const customBrowser = body?.browser;
    const customOs = body?.os;

    const userAgent = headersList.get('user-agent') || body?.user_agent || '';
    const parser = new UAParser(userAgent);
    const ua = parser.getResult();
    const browser = customBrowser || `${ua.browser.name || 'Unknown'} ${ua.browser.version || ''}`.trim();
    const os = customOs || `${ua.os.name || 'Unknown'} ${ua.os.version || ''}`.trim();
    const deviceName = customDeviceName || (ua.browser.name ? `${ua.browser.name} on ${ua.os.name || 'Unknown'}` : (customOs ? `Force on ${customOs}` : 'Unknown Device'));
    const deviceType = customDeviceType || ua.device.type || 'desktop';

    const adminClient = createAdminClient();

    // ── 1. If deviceId is provided, deduplicate by device_id first ──
    if (deviceId) {
      const { data: existingDevice } = await adminClient
        .from('user_sessions')
        .select('id, city, country')
        .eq('user_id', user.id)
        .eq('device_id', deviceId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingDevice) {
        await adminClient
          .from('user_sessions')
          .update({
            last_activity: new Date().toISOString(),
            ip_address: ip,
            ...(customDeviceName ? { device_name: customDeviceName } : {}),
            ...(customBrowser ? { browser: customBrowser } : {}),
            ...(customOs ? { os: customOs } : {}),
          })
          .eq('id', existingDevice.id);
        return NextResponse.json({ status: 'updated', id: existingDevice.id });
      }
    }

    // ── 2. Deduplication: check for any session with same user_agent within the last 10 minutes ──
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existing } = await adminClient
      .from('user_sessions')
      .select('id, city, country, last_activity, device_id')
      .eq('user_id', user.id)
      .eq('user_agent', userAgent)
      .eq('is_active', true)
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Touch last_activity, update device_id if missing
      await adminClient
        .from('user_sessions')
        .update({
          last_activity: new Date().toISOString(),
          ...(deviceId && !existing.device_id ? { device_id: deviceId } : {}),
        })
        .eq('id', existing.id);
      return NextResponse.json({ status: 'updated', id: existing.id });
    }

    // ── 3. Also deduplicate against older sessions with same UA (update if exists) ──
    const { data: olderExisting } = await adminClient
      .from('user_sessions')
      .select('id, city, country, device_id')
      .eq('user_id', user.id)
      .eq('user_agent', userAgent)
      .eq('is_active', true)
      .order('last_activity', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (olderExisting) {
      await adminClient
        .from('user_sessions')
        .update({
          last_activity: new Date().toISOString(),
          ip_address: ip,
          ...(deviceId && !olderExisting.device_id ? { device_id: deviceId } : {}),
        })
        .eq('id', olderExisting.id);
      return NextResponse.json({ status: 'updated', id: olderExisting.id });
    }

    // ── Geo-lookup (skip for localhost/private IPs) ──
    let city: string | null = null;
    let country: string | null = null;

    if (!isLocalhost) {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`, {
          signal: AbortSignal.timeout(2000),
        });
        if (geoRes.ok) {
          const geo = await geoRes.json();
          if (geo.status === 'success') {
            city = geo.city || null;
            country = geo.country || null;
          }
        }
      } catch {
        // Geo-lookup is best-effort — never fail the registration because of it
      }
    } else {
      city = 'Localhost';
      country = 'Local';
    }

    // ── Insert new session ──
    const { data: inserted, error: insertError } = await adminClient
      .from('user_sessions')
      .insert({
        user_id: user.id,
        device_id: deviceId,
        ip_address: ip,
        user_agent: userAgent,
        device_type: deviceType,
        device_name: deviceName,
        browser,
        os,
        city,
        country,
        is_active: true,
        last_activity: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error registering session:', insertError);
      return NextResponse.json({ error: 'Failed to register session' }, { status: 500 });
    }

    return NextResponse.json({ status: 'created', id: inserted.id, city, country });
  } catch (error) {
    console.error('Error in POST /api/user/devices/register:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
