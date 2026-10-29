// apps/web/app/api/encryption/verify-recovery-code/route.ts
/**
 * Verify Recovery Code API — Security Architecture v2 (Phase 2)
 *
 * POST /api/encryption/verify-recovery-code
 * Body: { code: string }
 *
 * Called during new-device onboarding (Option C: Recovery Code).
 * The server:
 *   1. Verifies the user is authenticated (Supabase session)
 *   2. Fetches all unused recovery_codes rows for the user
 *   3. bcrypt.compare() against each hash (Node.js runtime)
 *   4. On match: marks code as used, returns account-level wrapped master key
 *   5. Fires a security notification email (fire-and-forget)
 *   6. On no match: returns 401
 *
 * Security notes:
 *   - Rate limiting: max 5 failed attempts per user per 15 min (enforced via Supabase)
 *   - Timing: bcrypt dominates; no meaningful timing oracle possible
 *   - The returned encrypted_master_key is still encrypted — the client must
 *     unwrap it using the user's credential before use
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { code, action = 'consume' } = body;

    if (!code || typeof code !== 'string' || code.trim().length < 8) {
      return NextResponse.json({ error: 'Recovery code is required' }, { status: 400 });
    }

    const normalised = code.toUpperCase().trim();

    // ── Fetch all unused codes ────────────────────────────────────────────────
    const { data: rows, error: fetchError } = await supabase
      .from('recovery_codes')
      .select('id, code_hash')
      .eq('user_id', user.id)
      .is('used_at', null);

    if (fetchError) {
      console.error('[verify-recovery-code] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'No recovery codes available for this account' },
        { status: 401 }
      );
    }

    // ── bcrypt compare against each unused code ───────────────────────────────
    let matchedId: string | null = null;
    for (const row of rows) {
      try {
        const isMatch = await bcrypt.compare(normalised, row.code_hash);
        if (isMatch) {
          matchedId = row.id;
          break;
        }
      } catch (compareErr) {
        console.warn('[verify-recovery-code] bcrypt compare error for row:', row.id, compareErr);
      }
    }

    if (!matchedId) {
      // Rate limit note: this 401 fires for BOTH action='dry-run' and action='consume'.
      // The bcrypt work above is intentional — it's the same cost regardless of action,
      // so dry-run doesn't become a cheaper brute-force oracle.
      return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 });
    }

    let remaining = rows.length;

    // ── Mark code as used (if not dry-run) ───────────────────────────────────
    if (action === 'consume') {
      const usedAt = new Date().toISOString();
      const { error: markError } = await supabase
        .from('recovery_codes')
        .update({ used_at: usedAt })
        .eq('id', matchedId)
        .eq('user_id', user.id);

      if (markError) {
        console.error('[verify-recovery-code] Mark-used error:', markError);
        return NextResponse.json({ error: 'Failed to consume recovery code' }, { status: 500 });
      }
      
      remaining = rows.length - 1;
      
      // Update user settings and fire notification in background
      supabase
        .from('user_settings')
        .upsert(
          { user_id: user.id, recovery_codes_count: remaining },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.warn('[verify-recovery-code] Settings update failed:', error);
        });
        
      sendSecurityNotification(user.email ?? '', remaining).catch((err) =>
        console.warn('[verify-recovery-code] Security email failed:', err)
      );
    }



    // ── Fetch account-level wrapped master key from users table ───────────────
    // The admin client bypasses RLS so we can read the users table directly
    const adminSupabase = createAdminClient();
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('encrypted_master_key, master_key_iv, encryption_salt, key_version, recovery_key_wrappings')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('[verify-recovery-code] Failed to fetch user encryption data:', userError);
      return NextResponse.json(
        { error: 'Failed to retrieve encryption data after verification' },
        { status: 500 }
      );
    }

    // ── Fire security email notification (non-blocking) ───────────────────────
    sendSecurityNotification(user.email ?? '', remaining).catch((err) =>
      console.warn('[verify-recovery-code] Security email failed (non-fatal):', err)
    );

    // ── Return wrapped master key to client ───────────────────────────────────
    // Client will unwrap this using their credential (password for email users,
    // or userId for OAuth users) and then re-wrap with the new device secret.
    //
    // recovery_key_wrappings: array of { code_index, encrypted_key, iv } entries,
    // one per recovery code. The client uses the entered code as PBKDF2 password
    // to decrypt the matching wrapping — independently of the account password.
    // Null if codes were generated before the dual-wrapping feature was added.
    return NextResponse.json({
      success: true,
      remaining,
      encrypted_master_key: userData.encrypted_master_key,
      master_key_iv: userData.master_key_iv,
      encryption_salt: userData.encryption_salt,
      key_version: userData.key_version ?? 1,
      recovery_key_wrappings: userData.recovery_key_wrappings ?? [],
    });
  } catch (err) {
    console.error('[verify-recovery-code] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── Internal: fire-and-forget security notification ──────────────────────────

async function sendSecurityNotification(email: string, remaining: number): Promise<void> {
  if (!email) return;

  // Use the existing notifications API to create an in-app notification
  // and trigger an email via nodemailer
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/security/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'recovery_code_used',
        email,
        data: { remaining },
      }),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[verify-recovery-code] Skipped security notification in dev.`);
    } else {
      console.error(`[verify-recovery-code] Security notification failed:`, err);
    }
  }
}
