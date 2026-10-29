import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
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

    // Phase 3 (AI encryption): also fetch key pair columns alongside master key data
    const { data, error: userError } = await supabase
      .from('users')
      .select('encryption_salt, encrypted_master_key, master_key_iv, key_version, encryption_public_key, encrypted_private_key, private_key_iv')
      .eq('id', user.id)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Phase 5: fetch security settings and TOTP status in parallel
    const [{ data: settings }, { data: totpRow }] = await Promise.all([
      supabase
        .from('user_settings')
        .select('encryption_enabled, vault_password_set, oauth_vault_mode, totp_enabled, recovery_codes_count')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('totp_settings')
        .select('enabled')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    // Determine if this is an OAuth (non-email) user
    const provider = user.app_metadata?.provider ?? 'email';
    const isOAuthUser = provider !== 'email';
    const isTotpActive = Boolean(settings?.totp_enabled || totpRow?.enabled);
    const twoFactorEnabled = Boolean(
      isTotpActive ||
      (settings?.recovery_codes_count && settings.recovery_codes_count > 0)
    );

    return NextResponse.json({
      salt: data?.encryption_salt || null,
      encrypted_master_key: data?.encrypted_master_key || null,
      master_key_iv: data?.master_key_iv || null,
      key_version: data?.key_version || 1,
      encryption_enabled: settings?.encryption_enabled || false,
      // Phase 5 additions:
      is_oauth_user: isOAuthUser,
      vault_password_set: settings?.vault_password_set || false,
      oauth_vault_mode: settings?.oauth_vault_mode || 'none',
      two_factor_enabled: twoFactorEnabled,
      // Phase 3 (AI encryption): key pair data for private key loading on client
      encryption_public_key: data?.encryption_public_key || null,
      encrypted_private_key: data?.encrypted_private_key || null,
      private_key_iv: data?.private_key_iv || null,
      has_key_pair: !!(data?.encryption_public_key),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { salt, enable } = body;
    if (!salt) {
      return NextResponse.json({ error: 'salt is required' }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Update salt
    const { error: updateError } = await admin
      .from('users')
      .update({ encryption_salt: salt })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (enable) {
      // Ensure settings row exists
      const { data: existingSettings } = await admin
        .from('user_settings')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      if (!existingSettings) {
        await admin.from('user_settings').insert({ user_id: user.id, encryption_enabled: true });
      } else {
        await admin.from('user_settings').update({ encryption_enabled: true }).eq('user_id', user.id);
      }
    }

    return NextResponse.json({ message: 'Salt stored', enabled: !!enable });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
