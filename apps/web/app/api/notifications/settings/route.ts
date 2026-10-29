// apps/web/app/api/notifications/settings/route.ts
// User notification settings

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { UserNotificationSettings, NotificationType } from '@/types/notifications';

/**
 * GET /api/notifications/settings
 * Get the current user's notification settings
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: settings, error } = await adminClient
      .from('user_notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is OK (use defaults)
      throw error;
    }

    // Return settings or defaults
    const response: UserNotificationSettings = settings || {
      user_id: user.id,
      in_app_enabled: true,
      email_enabled: false,
      push_enabled: false,
      sms_enabled: false,
      muted_types: [],
      quiet_start: null,
      quiet_end: null,
      time_zone: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json({ settings: response });
  } catch (error) {
    console.error('[GET /api/notifications/settings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification settings' },
      { status: 500 }
    );
  }
}

interface UpdateSettingsRequest {
  in_app_enabled?: boolean;
  email_enabled?: boolean;
  push_enabled?: boolean;
  sms_enabled?: boolean;
  muted_types?: NotificationType[];
  quiet_start?: string | null;
  quiet_end?: string | null;
  time_zone?: string | null;
}

/**
 * PATCH /api/notifications/settings
 * Update the current user's notification settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdateSettingsRequest = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const allowedKeys: Array<keyof UpdateSettingsRequest> = [
      'in_app_enabled',
      'email_enabled',
      'push_enabled',
      'sms_enabled',
      'muted_types',
      'quiet_start',
      'quiet_end',
      'time_zone',
    ];

    const incomingKeys = Object.keys(body) as Array<keyof UpdateSettingsRequest>;
    if (incomingKeys.length === 0) {
      return NextResponse.json({ error: 'No settings provided to update' }, { status: 400 });
    }

    const invalidKeys = incomingKeys.filter((key) => !allowedKeys.includes(key));
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: `Unsupported settings fields: ${invalidKeys.join(', ')}` },
        { status: 400 }
      );
    }

    const boolKeys: Array<'in_app_enabled' | 'email_enabled' | 'push_enabled' | 'sms_enabled'> = [
      'in_app_enabled',
      'email_enabled',
      'push_enabled',
      'sms_enabled',
    ];

    for (const key of boolKeys) {
      if (key in body && typeof body[key] !== 'boolean') {
        return NextResponse.json(
          { error: `${key} must be a boolean` },
          { status: 400 }
        );
      }
    }

    // Validate muted_types if provided
    const validTypes: NotificationType[] = ['reminder', 'action', 'journal', 'achievement', 'system', 'social'];
    if (body.muted_types) {
      const invalidTypes = body.muted_types.filter(t => !validTypes.includes(t));
      if (invalidTypes.length > 0) {
        return NextResponse.json(
          { error: `Invalid notification types: ${invalidTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate quiet hours format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (body.quiet_start && !timeRegex.test(body.quiet_start)) {
      return NextResponse.json(
        { error: 'Invalid quiet_start format. Use HH:MM' },
        { status: 400 }
      );
    }
    if (body.quiet_end && !timeRegex.test(body.quiet_end)) {
      return NextResponse.json(
        { error: 'Invalid quiet_end format. Use HH:MM' },
        { status: 400 }
      );
    }

    if (body.time_zone !== undefined && body.time_zone !== null && typeof body.time_zone !== 'string') {
      return NextResponse.json(
        { error: 'time_zone must be a string or null' },
        { status: 400 }
      );
    }

    if (typeof body.time_zone === 'string' && body.time_zone.length > 100) {
      return NextResponse.json(
        { error: 'time_zone is too long' },
        { status: 400 }
      );
    }

    if (body.email_enabled === true) {
      const adminClient = createAdminClient();
      const [{ data: gmailConnection }, smtpConfigured] = await Promise.all([
        adminClient
          .from('user_google_gmail_connections')
          .select('id,is_active,google_email')
          .eq('user_id', user.id)
          .maybeSingle(),
        Promise.resolve(Boolean(process.env.EMAIL_ADDRESS && process.env.EMAIL_PASSWORD)),
      ]);

      const gmailReady = Boolean(gmailConnection?.is_active && gmailConnection?.google_email);
      if (!gmailReady && !smtpConfigured) {
        return NextResponse.json(
          { error: 'Connect Gmail in Settings > Integrations before enabling email notifications.' },
          { status: 400 }
        );
      }
    }

    const adminClient = createAdminClient();

    // Upsert settings
    const { data: settings, error } = await adminClient
      .from('user_notification_settings')
      .upsert(
        {
          user_id: user.id,
          ...body,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[PATCH /api/notifications/settings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    );
  }
}
