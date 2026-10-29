// apps/web/app/auth/callback/route.ts
// Fixed Base64 encoding for OAuth encryption setup - byte-by-byte conversion
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Default next route after successful OAuth auth. We may override to encryption setup.
  let next = searchParams.get('next') ?? '/dashboard'
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      const user = data.user!;
      const adminClient = createAdminClient();
      
      // Check waitlist status for OAuth users
      if (user.email) {
        const adminClient = createAdminClient();
        const { data: waitlistEntries, error: waitlistError } = await adminClient
          .from('waitlist_submissions')
          .select('status, converted_at')
          .eq('email', user.email)
          .order('created_at', { ascending: false });

        // Handle query errors
        if (waitlistError) {
          console.error('[OAuth Callback] Waitlist query error:', waitlistError);
          // On error, allow through (fail open for better UX)
        } else {
          // Get the most recent entry
          const waitlistEntry = waitlistEntries && waitlistEntries.length > 0 ? waitlistEntries[0] : null;

          // If user is in waitlist, check their status
          if (waitlistEntry) {
            // If already converted or approved, allow through
            if (waitlistEntry.converted_at) {
              console.log('[OAuth Callback] User already converted, proceeding...');
            } else if (waitlistEntry.status === 'approved') {
              console.log('[OAuth Callback] User approved in waitlist, proceeding...');
            } else if (waitlistEntry.status === 'pending') {
              console.log('[OAuth Callback] User pending approval, signing out and redirecting...');
              await supabase.auth.signOut();
              return NextResponse.redirect(`${origin}/pending-approval?reason=oauth&email=${encodeURIComponent(user.email)}`);
            } else if (waitlistEntry.status === 'rejected') {
              console.log('[OAuth Callback] User rejected, signing out and redirecting...');
              await supabase.auth.signOut();
              return NextResponse.redirect(`${origin}/access-denied`);
            }
          } else {
            // User not in waitlist - sign out and redirect to waitlist form
            console.log('[OAuth Callback] User not in waitlist, signing out and redirecting...');
            await supabase.auth.signOut();
            return NextResponse.redirect(`${origin}/waitlist?email=${encodeURIComponent(user.email)}&source=oauth`);
          }
        }
      }

      // Ensure user profile exists for OAuth users (Google sign-in)
      const { data: existingUser } = await adminClient
        .from("users")
        .select("id, onboarding_complete")
        .eq("id", user.id)
        .single();

      if (!existingUser) {
        // New user - redirect to onboarding after setup
        const emailPrefix = (user.email ?? 'user').split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
        let username =
          user.user_metadata?.preferred_username ||
          (user.user_metadata?.name ? `${user.user_metadata.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_${user.id.substring(0, 4)}` : null) ||
          `${emailPrefix}_${user.id.substring(0, 6)}`;

        let { error: insertError } = await adminClient.from("users").upsert({
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          username: username,
          phone: user.user_metadata?.phone || null,
          profile_image: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          last_login: new Date().toISOString(),
          onboarding_complete: false, // Explicitly set to false for new users
        }, { onConflict: 'id' });

        // If username collision or error occurred, retry with guaranteed unique username
        if (insertError) {
          console.warn('[OAuth Callback] Initial profile insert error, retrying with unique username:', insertError);
          const fallbackUsername = `${emailPrefix}_${user.id.replace(/-/g, '').substring(0, 8)}_${Math.floor(1000 + Math.random() * 9000)}`;
          const retryResult = await adminClient.from("users").upsert({
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            username: fallbackUsername,
            phone: user.user_metadata?.phone || null,
            profile_image: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            last_login: new Date().toISOString(),
            onboarding_complete: false,
          }, { onConflict: 'id' });

          insertError = retryResult.error;
        }

        if (insertError) {
          console.error('[OAuth Callback] Failed to create user profile after retry:', insertError);
          return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent('Failed to create user profile')}`);
        }
        
        // New users should go to onboarding
        next = '/onboarding';
        console.log('[OAuth Callback] New user created, redirecting to onboarding');
      } else {
        // Update last login for existing users
        const { error: updateProfileError } = await adminClient
          .from("users")
          .update({ last_login: new Date().toISOString() })
          .eq("id", user.id);

        if (updateProfileError) {
          console.warn('[OAuth Callback] Failed to update last_login:', updateProfileError);
        }
        
        // Existing users who haven't completed onboarding should go there
        if (existingUser.onboarding_complete === false) {
          next = '/onboarding';
          console.log('[OAuth Callback] Existing user has not completed onboarding, redirecting');
        }
      }

      // Ensure user_settings row exists (encryption REQUIRED - enabled by default)
      const { data: settingsRow } = await adminClient
        .from('user_settings')
        .select('encryption_enabled')
        .eq('user_id', user.id)
        .single();

      if (!settingsRow) {
        const { error: settingsInsertError } = await adminClient
          .from('user_settings')
          .upsert({ user_id: data.user.id, encryption_enabled: true }, { onConflict: 'user_id' });

        if (settingsInsertError) {
          console.warn('[OAuth Callback] Failed to create user_settings row:', settingsInsertError);
        }
      } else if (!settingsRow.encryption_enabled) {
        // Enable encryption for existing users
        const { error: settingsUpdateError } = await adminClient
          .from('user_settings')
          .update({ encryption_enabled: true })
          .eq('user_id', user.id);

        if (settingsUpdateError) {
          console.warn('[OAuth Callback] Failed to enable encryption settings:', settingsUpdateError);
        }
      }

      // Check if user has encryption setup - if not, AUTO-GENERATE for OAuth users
      const { data: userData, error: userDataError } = await adminClient
        .from('users')
        .select('encryption_salt, encrypted_master_key, master_key_iv')
        .eq('id', user.id)
        .single();

      if (userDataError && userDataError.code !== 'PGRST116') {
        console.warn('[OAuth Callback] Failed to fetch encryption data:', userDataError);
      }

      // Auto-generate encryption for OAuth users (no password prompt needed)
      if (!userData?.encryption_salt || !userData?.encrypted_master_key || !userData?.master_key_iv) {
        // Step 1: Generate or use existing salt
        let saltBase64 = userData?.encryption_salt;
        if (!saltBase64) {
          const raw = new Uint8Array(16);
          crypto.getRandomValues(raw);
          
          // Convert salt to Base64 properly (byte-by-byte)
          let saltBinary = '';
          for (let i = 0; i < raw.length; i++) {
            saltBinary += String.fromCharCode(raw[i]!);
          }
          saltBase64 = btoa(saltBinary);
          console.log('[OAuth Callback] Generated encryption salt');
        }

        // Step 2: Generate master key (32 bytes for AES-256)
        const masterKeyBytes = new Uint8Array(32);
        crypto.getRandomValues(masterKeyBytes);
        
        // Convert master key to Base64 properly (byte-by-byte)
        console.log('[OAuth Callback] 🔧 USING NEW FIXED BASE64 ENCODING - byte-by-byte');
        let masterKeyBinary = '';
        for (let i = 0; i < masterKeyBytes.length; i++) {
          masterKeyBinary += String.fromCharCode(masterKeyBytes[i]!);
        }
        const masterKeyBase64 = btoa(masterKeyBinary);
        console.log('[OAuth Callback] Generated master key with length:', masterKeyBase64.length);

        // Step 3: Derive password key from user.id (OAuth users use their ID as "password")
        const encoder1 = new TextEncoder();
        const passwordBuffer = encoder1.encode(user.id);
        const saltBytes = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
        
        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          passwordBuffer,
          { name: 'PBKDF2' },
          false,
          ['deriveBits', 'deriveKey']
        );

        // Derive password key using PBKDF2
        const passwordKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: 100000,
            hash: 'SHA-256',
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        console.log('[OAuth Callback] Derived password key from user.id');

        // Step 4: Encrypt master key with password key
        const iv = new Uint8Array(12);
        crypto.getRandomValues(iv);
        
        // Convert IV to Base64 properly (byte-by-byte)
        let ivBinary = '';
        for (let i = 0; i < iv.length; i++) {
          ivBinary += String.fromCharCode(iv[i]!);
        }
        const ivBase64 = btoa(ivBinary);

        // Encrypt the master key Base64 STRING (not raw bytes)
        // This way decryptText() can decode it as UTF-8 text correctly
        const encoder2 = new TextEncoder();
        const masterKeyTextBuffer = encoder2.encode(masterKeyBase64);

        // Encrypt master key
        const encryptedBuffer = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv },
          passwordKey,
          masterKeyTextBuffer
        );
        
        // Convert encrypted buffer to Base64 properly (byte-by-byte)
        const encryptedBytes = new Uint8Array(encryptedBuffer);
        let encryptedBinary = '';
        for (let i = 0; i < encryptedBytes.length; i++) {
          encryptedBinary += String.fromCharCode(encryptedBytes[i]!);
        }
        const encryptedMasterKey = btoa(encryptedBinary);
        console.log('[OAuth Callback] Encrypted master key with password key');

        // Step 5: Store everything in database
        const { error: encryptionUpdateError } = await adminClient
          .from('users')
          .update({
            encryption_salt: saltBase64,
            encrypted_master_key: encryptedMasterKey,
            master_key_iv: ivBase64
          })
          .eq('id', user.id);

        if (encryptionUpdateError) {
          console.error('[OAuth Callback] Failed to store encryption data:', encryptionUpdateError);
          return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent('Failed to store encryption data')}`);
        }
        
        // Store salt in user_metadata as well for consistency
        await supabase.auth.updateUser({
          data: { encryption_salt: saltBase64 }
        });
        
        console.log('[OAuth Callback] ✅ Complete encryption setup for OAuth user');
      }

      const isNewUser = !existingUser;
      const toastParam = `auth_toast=${isNewUser ? 'oauth_signup' : 'oauth_login'}`;
      const nextWithToast = next.includes('?') ? `${next}&${toastParam}` : `${next}?${toastParam}`;

      // Build redirect URL
      const redirectUrl = isLocalEnv
        ? `${origin}${nextWithToast}`
        : forwardedHost
        ? `https://${forwardedHost}${nextWithToast}`
        : `${origin}${nextWithToast}`

      // If Supabase returned a session, explicitly set session cookies so
      // the browser is authenticated after the redirect. This is a safe
      // fallback in case server SDK cookie plumbing does not set them.
      const session = (data as any)?.session;
      const res = NextResponse.redirect(redirectUrl);

      if (session) {
        try {
          const accessToken = session.access_token as string | undefined;
          const refreshToken = session.refresh_token as string | undefined;
          const expiresIn = Number(session.expires_in) || undefined;

          if (accessToken) {
            res.cookies.set({
              name: 'sb-access-token',
              value: accessToken,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              path: '/',
              sameSite: 'lax',
              maxAge: expiresIn ?? 60 * 60,
            });
          }

          if (refreshToken) {
            res.cookies.set({
              name: 'sb-refresh-token',
              value: refreshToken,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              path: '/',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 30,
            });
          }

          console.log('[OAuth Callback] Set auth cookies for user');
        } catch (cookieErr) {
          console.warn('[OAuth Callback] Failed to set auth cookies:', cookieErr);
        }
      }

      return res;
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}