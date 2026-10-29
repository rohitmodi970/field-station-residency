// apps/web/app/api/security/notify/route.ts
/**
 * Security Event Notification API — Phase 2 + Phase 3
 *
 * POST /api/security/notify
 * Body: { event: string, email: string, data: Record<string, unknown> }
 *
 * Supported events:
 *   - recovery_code_used         → email: "A recovery code was used"
 *   - recovery_codes_regenerated → email: "New recovery codes generated"
 *   - new_device_registered      → email: "New device registered"
 *   - totp_enabled               → email: "Authenticator app (2FA) enabled"
 *   - totp_removed               → email: "Authenticator app (2FA) removed"
 *   - totp_used                  → email: "TOTP code used for new device"
 *
 * Uses nodemailer via the existing mailService utilities.
 * Called server-side from other API routes (fire-and-forget pattern).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.EMAIL_PASSWORD,
  },
});

type SecurityEvent =
  | 'recovery_code_used'
  | 'recovery_codes_regenerated'
  | 'new_device_registered'
  | 'password_set'          // Phase 5: OAuth user set a password for the first time
  | 'oauth_key_upgraded'    // Phase 5: OAuth master key auto-upgraded silently
  | 'totp_enabled'          // Phase 3: Authenticator app (2FA) was set up
  | 'totp_removed'          // Phase 3: Authenticator app (2FA) was disabled
  | 'totp_used';            // Phase 3: TOTP code used to register a new device

function getEmailContent(
  event: SecurityEvent,
  data: Record<string, unknown>
): { subject: string; html: string } {
  const year = new Date().getFullYear();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.findmyforce.com';
  const securityUrl = `${appUrl}/security`;

  const footer = `
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
      <p style="margin:0;">© ${year} FORCE. If you didn't perform this action, 
        <a href="${securityUrl}" style="color:#9f6958;">go to Security Settings</a> immediately.</p>
    </div>`;

  const wrap = (content: string) => `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;
                  border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <div style="background:linear-gradient(135deg,#9f6958,#7a8f66);padding:24px 28px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">🔐 FORCE Security</h1>
        </div>
        <div style="padding:28px;">${content}</div>
        ${footer}
      </div>
    </body></html>`;

  if (event === 'recovery_code_used') {
    const remaining = (data.remaining as number) ?? 0;
    return {
      subject: 'A recovery code was used on your FORCE account',
      html: wrap(`
        <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Recovery Code Used</h2>
        <p style="color:#374151;line-height:1.7;margin:0 0 16px;">
          One of your FORCE recovery codes was just used to access your account and register a new device.
        </p>
        <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
          <strong style="color:#92400e;">⚠️ ${remaining} recovery code${remaining !== 1 ? 's' : ''} remaining.</strong>
          ${remaining <= 2 ? '<br><span style="color:#92400e;font-size:13px;">You are running low. Generate new codes from Security Settings.</span>' : ''}
        </div>
        <p style="color:#374151;line-height:1.7;margin:0 0 16px;">
          If you performed this action, no further action is needed.
        </p>
        <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
          If this was <strong>not you</strong>, your account may be compromised. 
          Go to Security Settings immediately and revoke any unrecognised devices.
        </p>
        <a href="${securityUrl}" style="display:inline-block;background:linear-gradient(135deg,#9f6958,#7a8f66);
           color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;
           font-weight:600;font-size:14px;">Open Security Settings →</a>
      `),
    };
  }

  if (event === 'recovery_codes_regenerated') {
    return {
      subject: 'New FORCE recovery codes generated',
      html: wrap(`
        <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Recovery Codes Regenerated</h2>
        <p style="color:#374151;line-height:1.7;margin:0 0 16px;">
          Your FORCE recovery codes were just regenerated. All previous codes are now permanently invalid.
        </p>
        <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
          <strong style="color:#166534;">✅ 8 new recovery codes are now active.</strong>
        </div>
        <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
          Make sure you have saved your new codes somewhere safe (password manager, printed copy, etc.).
          If you did not perform this action, go to Security Settings immediately.
        </p>
        <a href="${securityUrl}" style="display:inline-block;background:linear-gradient(135deg,#9f6958,#7a8f66);
           color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;
           font-weight:600;font-size:14px;">Open Security Settings →</a>
      `),
    };
  }

  // new_device_registered
  const deviceName = (data.device_name as string) ?? 'Unknown device';
  const location = (data.location as string) ?? 'Unknown location';

  if (event === 'new_device_registered') {
    return {
      subject: 'New device added to your FORCE account',
      html: wrap(`
        <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">New Device Registered</h2>
        <p style="color:#374151;line-height:1.7;margin:0 0 16px;">
          A new device was just registered to access your FORCE account.
        </p>
        <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:0 0 16px;">
          <p style="margin:0 0 8px;"><strong style="color:#374151;">Device:</strong> <span style="color:#6b7280;">${deviceName}</span></p>
          <p style="margin:0;"><strong style="color:#374151;">Location:</strong> <span style="color:#6b7280;">${location}</span></p>
        </div>
        <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
          If this was not you, revoke this device immediately from Security Settings.
        </p>
        <a href="${securityUrl}" style="display:inline-block;background:linear-gradient(135deg,#9f6958,#7a8f66);
           color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;
           font-weight:600;font-size:14px;">Review Security Settings →</a>
      `),
    };
  }

  if (event === 'password_set') {
    return {
      subject: 'Password added to your FORCE account',
      html: wrap(`
        <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Password Set ✅</h2>
        <p style="color:#374151;line-height:1.7;margin:0 0 16px;">
          A password has been added to your FORCE account. You can now sign in with your email and this password, in addition to Google.
        </p>
        <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
          <strong style="color:#166534;">✅ Your journal encryption has been upgraded.</strong><br>
          <span style="color:#166534;font-size:13px;">Your journals are now protected with your password instead of a legacy credential.</span>
        </div>
        <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
          If you did not perform this action, go to Security Settings immediately and change your password.
        </p>
        <a href="${securityUrl}" style="display:inline-block;background:linear-gradient(135deg,#9f6958,#7a8f66);
           color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;
           font-weight:600;font-size:14px;">Open Security Settings →</a>
      `),
    };
  }

  // oauth_key_upgraded (silent auto-upgrade)
  if (event === 'oauth_key_upgraded') {
    return {
      subject: 'Your FORCE account encryption was upgraded',
      html: wrap(`
        <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Encryption Upgraded 🔐</h2>
        <p style="color:#374151;line-height:1.7;margin:0 0 16px;">
          Your FORCE account encryption has been automatically upgraded to use a device-specific secure key, replacing a legacy credential.
        </p>
        <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
          <strong style="color:#166534;">✅ No action required.</strong><br>
          <span style="color:#166534;font-size:13px;">Your journals are still fully accessible. This was a background security improvement.</span>
        </div>
        <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
          We recommend also setting a password from Security Settings for an additional layer of protection.
        </p>
        <a href="${securityUrl}" style="display:inline-block;background:linear-gradient(135deg,#9f6958,#7a8f66);
           color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;
           font-weight:600;font-size:14px;">View Security Settings →</a>
      `),
    };
  }

  // ── Phase 3: TOTP events ────────────────────────────────────────────────────

  if (event === 'totp_enabled') {
    return {
      subject: 'Authenticator app (2FA) enabled on your FORCE account',
      html: wrap(`
        <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Authenticator App Enabled 🔐</h2>
        <p style="color:#374151;line-height:1.7;margin:0 0 16px;">
          Two-factor authentication via an authenticator app has been enabled on your FORCE account.
          You will now be asked for a 6-digit code when signing in on a new device.
        </p>
        <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
          <strong style="color:#166534;">✅ Your account is now better protected.</strong>
        </div>
        <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
          If you did not perform this action, go to Security Settings immediately and disable 2FA.
        </p>
        <a href="${securityUrl}" style="display:inline-block;background:linear-gradient(135deg,#9f6958,#7a8f66);
           color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;
           font-weight:600;font-size:14px;">Open Security Settings →</a>
      `),
    };
  }

  if (event === 'totp_removed') {
    return {
      subject: 'Authenticator app (2FA) removed from your FORCE account',
      html: wrap(`
        <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Authenticator App Removed ⚠️</h2>
        <p style="color:#374151;line-height:1.7;margin:0 0 16px;">
          Two-factor authentication has been <strong>disabled</strong> on your FORCE account.
          You will no longer be prompted for a 6-digit code when accessing from a new device.
        </p>
        <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
          <strong style="color:#92400e;">⚠️ Your account is now less secure.</strong><br>
          <span style="color:#92400e;font-size:13px;">We strongly recommend re-enabling 2FA from Security Settings.</span>
        </div>
        <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
          If you did not perform this action, go to Security Settings immediately and revoke all unrecognised devices.
        </p>
        <a href="${securityUrl}" style="display:inline-block;background:linear-gradient(135deg,#9f6958,#7a8f66);
           color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;
           font-weight:600;font-size:14px;">Open Security Settings →</a>
      `),
    };
  }

  // totp_used
  const totpDeviceName = (data.device_name as string) ?? 'Unknown device';
  return {
    subject: 'TOTP code used to register a new device on FORCE',
    html: wrap(`
      <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">New Device Verified via Authenticator App</h2>
      <p style="color:#374151;line-height:1.7;margin:0 0 16px;">
        A 6-digit authenticator code was used to verify and register a new device on your FORCE account.
      </p>
      <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 8px;"><strong style="color:#374151;">Device:</strong> <span style="color:#6b7280;">${totpDeviceName}</span></p>
        <p style="margin:0;"><strong style="color:#374151;">Time:</strong> <span style="color:#6b7280;">${new Date().toUTCString()}</span></p>
      </div>
      <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
        If this was not you, revoke this device immediately from Security Settings and disable your authenticator app to generate a new secret.
      </p>
      <a href="${securityUrl}" style="display:inline-block;background:linear-gradient(135deg,#9f6958,#7a8f66);
         color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;
         font-weight:600;font-size:14px;">Review Security Settings →</a>
    `),
  };
}

export async function POST(req: NextRequest) {
  try {
    // Validate request is from within the app (same origin or service role)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json();
    const { event, email, data = {} } = body as {
      event: SecurityEvent;
      email: string;
      data?: Record<string, unknown>;
    };

    if (!event || !email) {
      return NextResponse.json({ error: 'event and email are required' }, { status: 400 });
    }

    const validEvents: SecurityEvent[] = [
      'recovery_code_used',
      'recovery_codes_regenerated',
      'new_device_registered',
      'password_set',
      'oauth_key_upgraded',
      'totp_enabled',
      'totp_removed',
      'totp_used',
    ];
    if (!validEvents.includes(event)) {
      return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
    }

    const { subject, html } = getEmailContent(event, data);

    await transporter.sendMail({
      from: `FORCE Security <${process.env.EMAIL_ADDRESS}>`,
      to: email,
      subject,
      html,
    });

    // Also create an in-app notification if we have a user
    if (user) {
      const notifBody = (() => {
        if (event === 'recovery_code_used')
          return `A recovery code was used. ${data.remaining ?? 0} remaining.`;
        if (event === 'recovery_codes_regenerated')
          return 'Your recovery codes were regenerated. Previous codes are now invalid.';
        if (event === 'password_set')
          return 'A password has been added to your account. Your encryption has been upgraded.';
        if (event === 'oauth_key_upgraded')
          return 'Your account encryption was automatically upgraded to a device-specific key.';
        if (event === 'totp_enabled')
          return '🔐 Authenticator app (2FA) has been enabled on your account.';
        if (event === 'totp_removed')
          return '⚠️ Authenticator app (2FA) was disabled from your account.';
        if (event === 'totp_used')
          return `A TOTP code was used to register a new device on your account.`;
        return `New device "${data.device_name ?? 'Unknown'}" was registered to your account.`;
      })();

      await supabase.from('notifications').insert({
        recipient_id: user.id,
        type: 'security',
        title: '🔐 Security alert',
        body: notifBody,
        is_read: false,
        is_dismissed: false,
        status: 'sent',
      }).then(({ error }) => {
        if (error) console.warn('[security/notify] In-app notification failed (non-fatal):', error);
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[security/notify] Error:', err);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
