// Auto-initialize encryption for OAuth users
import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

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

    const body = await req.json().catch(() => ({}));
    const { encrypted_master_key, master_key_iv, salt, force_reset } = body as {
      encrypted_master_key?: string;
      master_key_iv?: string;
      salt?: string;
      force_reset?: boolean;
    };

    const admin = createAdminClient();

    // If client supplied encrypted master key data to initialize or repair OAuth encryption
    if (encrypted_master_key && master_key_iv && salt) {
      if (force_reset) {
        // Only allow force reset if user does NOT have 2FA/recovery codes set up
        const { count: recoveryCount } = await admin
          .from('recovery_codes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('used_at', null);

        const { data: settings } = await admin
          .from('user_settings')
          .select('totp_enabled, vault_password_set')
          .eq('user_id', user.id)
          .single();

        if ((recoveryCount ?? 0) > 0 || settings?.totp_enabled || settings?.vault_password_set) {
          return NextResponse.json(
            { error: 'Cannot reset encryption: 2-step verification is active' },
            { status: 403 }
          );
        }
      }

      await admin
        .from('users')
        .update({
          encryption_salt: salt,
          encrypted_master_key,
          master_key_iv,
          key_version: 1,
        })
        .eq('id', user.id);

      await admin
        .from('user_settings')
        .upsert({
          user_id: user.id,
          encryption_enabled: true,
          oauth_vault_mode: 'none',
          vault_password_set: false,
        }, { onConflict: 'user_id' });

      return NextResponse.json({
        success: true,
        salt,
        message: 'Master key successfully initialized',
      });
    }

    // Check if user has encryption salt
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('encryption_salt')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.encryption_salt) {
      // Generate salt if it doesn't exist
      const raw = new Uint8Array(16);
      crypto.getRandomValues(raw);
      let saltBinary = '';
      for (let i = 0; i < raw.length; i++) {
        saltBinary += String.fromCharCode(raw[i]!);
      }
      const generatedSalt = btoa(saltBinary);
      
      // Store in database
      await admin
        .from('users')
        .update({ encryption_salt: generatedSalt })
        .eq('id', user.id);
      
      // Store in user_metadata
      await supabase.auth.updateUser({
        data: { encryption_salt: generatedSalt }
      });

      return NextResponse.json({ 
        success: true, 
        salt: generatedSalt,
        message: 'Encryption salt auto-generated' 
      });
    }

    return NextResponse.json({ 
      success: true, 
      salt: userData.encryption_salt,
      message: 'Encryption salt already exists' 
    });

  } catch (error: any) {
    console.error('[Auto-init encryption] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
