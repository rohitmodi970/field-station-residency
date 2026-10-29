// apps/web/app/auth/confirm/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code') // For backwards compatibility
  const next = searchParams.get('next') ?? '/register'

  const supabase = await createClient()

  // Handle new format (token_hash + type)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error && data.user) {
      // Create user profile in users table after email verification
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existingUser) {
        const username =
          data.user.user_metadata?.username ||
          ((data.user.email?.split("@")[0]?.toLowerCase() || 'user') + "_" + data.user.id.substring(0, 4));

        await supabase.from("users").insert({
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name || null,
          username: username,
          phone: data.user.user_metadata?.phone || null,
          profile_image: data.user.user_metadata?.avatar_url || null,
          last_login: new Date().toISOString(),
          encryption_salt: data.user.user_metadata?.encryption_salt || null,
          encrypted_master_key: data.user.user_metadata?.encrypted_master_key || null,
          master_key_iv: data.user.user_metadata?.master_key_iv || null,
          key_version: 1, // Legacy PBKDF2 100k iterations
        });
      }

      // Create user_settings with encryption REQUIRED (always enabled)
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('user_id, encryption_enabled')
        .eq('user_id', data.user.id)
        .single();

      if (!existingSettings) {
        await supabase.from('user_settings').insert({
          user_id: data.user.id,
          encryption_enabled: true, // Encryption is mandatory
        });
      } else if (!existingSettings.encryption_enabled) {
        // Enable encryption for existing users
        await supabase.from('user_settings').update({
          encryption_enabled: true,
        }).eq('user_id', data.user.id);
      }

      // After verification, send user to registration to complete signup
      redirect(next)
    }
  }

  // Handle old format (just code) - for email confirmation
  if (code) {
    // Try email confirmation with exchangeCodeForSession (newer Supabase method)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Create user profile in users table after email verification
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existingUser) {
        const username =
          data.user.user_metadata?.username ||
          ((data.user.email?.split("@")[0]?.toLowerCase() || 'user') + "_" + data.user.id.substring(0, 4));

        await supabase.from("users").insert({
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name || null,
          username: username,
          phone: data.user.user_metadata?.phone || null,
          profile_image: data.user.user_metadata?.avatar_url || null,
          last_login: new Date().toISOString(),
          encryption_salt: data.user.user_metadata?.encryption_salt || null,
          encrypted_master_key: data.user.user_metadata?.encrypted_master_key || null,
          master_key_iv: data.user.user_metadata?.master_key_iv || null,
          key_version: 1, // Legacy PBKDF2 100k iterations
        });
      }

      // Create user_settings with encryption REQUIRED (always enabled)
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('user_id, encryption_enabled')
        .eq('user_id', data.user.id)
        .single();

      if (!existingSettings) {
        await supabase.from('user_settings').insert({
          user_id: data.user.id,
          encryption_enabled: true, // Encryption is mandatory
        });
      } else if (!existingSettings.encryption_enabled) {
        // Enable encryption for existing users
        await supabase.from('user_settings').update({
          encryption_enabled: true,
        }).eq('user_id', data.user.id);
      }

      // After verification, send user to registration to complete signup
      redirect('/register')
    }
  }

  // redirect the user to an error page with some instructions
  redirect('/auth/error?error=Verification')
}