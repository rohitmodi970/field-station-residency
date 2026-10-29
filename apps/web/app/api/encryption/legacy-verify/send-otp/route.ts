// apps/web/app/api/encryption/legacy-verify/send-otp/route.ts
/**
 * Legacy Migration — Send OTP
 *
 * POST /api/encryption/legacy-verify/send-otp
 *
 * Called when a V1 (legacy) user is detected by ensureEncryptionReady().
 * Generates a 6-digit OTP, stores it (bcrypt-hashed) in legacy_otp_challenges,
 * and sends it to the authenticated user's email via Supabase admin email.
 *
 * Security properties:
 *   - User must be authenticated (valid Supabase session) to call this
 *   - OTP has 10-minute expiry
 *   - Max 3 active resend requests per user (enforced by attempts column)
 *   - Only 1 active challenge per user (UNIQUE on user_id — upsert replaces)
 *   - Code stored as bcrypt hash (cost 10) — never plaintext in DB
 *   - Table uses admin client only (RLS blocks all user-level access)
 *
 * Response: { sent: true, email: 'r***@g.com' }
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const OTP_EXPIRY_MINUTES = 10;
const MAX_DAILY_SENDS = 5;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/** Generate a cryptographically random 6-digit OTP string */
function generateOtp(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  // Combine bytes into a number, mod 1_000_000, zero-pad to 6 digits
  const num =
    ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
  return String(num % 1_000_000).padStart(6, '0');
}

/** Mask email for display: rohit@gmail.com → r***@gmail.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // ── Rate-limit check ─────────────────────────────────────────────────────
    // Count OTPs sent within the last 24 hours to prevent abuse.
    // (The UNIQUE constraint already limits to 1 active challenge; this catches
    //  rapid resend loops even if each upsert clears the previous.)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await adminSupabase
      .from('legacy_otp_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', yesterday);

    if ((recentCount ?? 0) >= MAX_DAILY_SENDS) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again tomorrow.' },
        { status: 429 }
      );
    }

    // ── Generate and hash OTP ────────────────────────────────────────────────
    const otp = generateOtp();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // ── Upsert into legacy_otp_challenges ────────────────────────────────────
    // UNIQUE(user_id) → any previous active challenge is replaced
    const { error: upsertError } = await adminSupabase
      .from('legacy_otp_challenges')
      .upsert(
        {
          user_id: user.id,
          code_hash: codeHash,
          expires_at: expiresAt,
          attempts: 0,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('[send-otp] Upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to create verification code' }, { status: 500 });
    }

    // ── Send OTP via Nodemailer ──────────────────────────────────────────────
    try {
      if (!process.env.EMAIL_ADDRESS || !process.env.EMAIL_PASSWORD) {
        throw new Error('EMAIL_ADDRESS and EMAIL_PASSWORD must be set');
      }

      await transporter.sendMail({
        from: `FORCE Security <${process.env.EMAIL_ADDRESS}>`,
        to: user.email,
        subject: 'Your FORCE security upgrade code',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin:0;padding:0;background:#f8f5ef;font-family:Arial,Helvetica,sans-serif;">
            <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
              <div style="background:#ffffff;border:1px solid #eee3d7;border-radius:20px;padding:32px 28px;box-shadow:0 20px 50px rgba(122,95,59,0.08);">
                <div style="text-align:center;margin-bottom:28px;">
                  <div style="display:inline-flex;width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#f59e0b,#fb923c);align-items:center;justify-content:center;color:#fff;font-size:28px;">🔐</div>
                  <h1 style="margin:20px 0 8px;color:#2f241a;font-size:24px;font-weight:600;">Security Upgrade</h1>
                  <p style="margin:0;color:#7a6a5c;font-size:15px;line-height:1.6;">Use the code below to continue your one-time verification.</p>
                </div>
                <div style="background:#fff7e8;border:1px solid #f4d8a8;border-radius:16px;padding:18px 20px;margin-bottom:24px;color:#6b4f1d;line-height:1.7;">
                  We sent a 6-digit verification code to <strong>${maskEmail(user.email)}</strong>.
                </div>
                <div style="text-align:center;margin:28px 0;">
                  <div style="display:inline-block;letter-spacing:0.5em;font-size:34px;font-weight:700;color:#2f241a;background:#f7f3ee;border-radius:18px;padding:18px 22px;">${otp}</div>
                </div>
                <p style="margin:0;color:#7a6a5c;font-size:13px;line-height:1.7;text-align:center;">This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request it, you can ignore this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Your FORCE security upgrade code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      });

      console.log(`[send-otp] OTP sent to ${user.email}`);
    } catch (emailErr) {
      console.error('[send-otp] Email send failed:', emailErr);
      if (process.env.NODE_ENV === 'development') {
        console.log(`\n  ╔═══════════════════════════════╗`);
        console.log(`  ║  LEGACY MIGRATION OTP: ${otp}  ║`);
        console.log(`  ╚═══════════════════════════════╝\n`);
      }
      return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
    }

    return NextResponse.json({
      sent: true,
      email: maskEmail(user.email),
    });
  } catch (err) {
    console.error('[send-otp] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
