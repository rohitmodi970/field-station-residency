'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from '@/utilities/context/ThemeContext';
import { ChevronLeft, Shield, Lock, KeyRound, Smartphone, Monitor, ShieldAlert } from 'lucide-react';

const GUIDE_STYLES = `
  :root {
    --cream-page:   #F0EDE4;
    --cream-card:   #FAFAF8;
    --cream-inner:  #F3F1EC;
    --cream-border: rgba(0,0,0,0.08);
    --cream-border-strong: rgba(0,0,0,0.14);
    --cream-text:   #1A1917;
    --cream-muted:  #6B6862;
    --cream-faint:  #9B9790;
    --cream-link:   #1A1917;
  }

  [data-theme="dark"] {
    --cream-page:   #141412;
    --cream-card:   #1E1D1B;
    --cream-inner:  #272522;
    --cream-border: rgba(255,255,255,0.08);
    --cream-border-strong: rgba(255,255,255,0.14);
    --cream-text:   #EDEAE4;
    --cream-muted:  #9B9790;
    --cream-faint:  #6B6862;
    --cream-link:   #EDEAE4;
  }

  .guide-layout {
    display: flex;
    max-width: 1050px;
    margin: 0 auto;
    padding: 48px 24px;
    gap: 48px;
    font-family: var(--font-sans, system-ui, sans-serif);
  }

  .guide-sidebar {
    width: 240px;
    flex-shrink: 0;
    position: sticky;
    top: 48px;
    align-self: start;
    display: flex;
    flex-direction: column;
  }

  .guide-sidebar-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--cream-text);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 16px;
    padding-left: 12px;
  }

  .guide-sidebar-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    color: var(--cream-muted);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .guide-sidebar-link:hover {
    color: var(--cream-text);
    background: var(--cream-inner);
  }

  .guide-container {
    flex: 1;
    min-width: 0;
    max-width: 720px;
  }

  @media (max-width: 900px) {
    .guide-layout {
      flex-direction: column;
      padding: 24px 16px;
    }
    .guide-sidebar {
      display: none;
    }
  }

  .guide-header {
    margin-bottom: 48px;
  }

  .guide-title {
    margin: 0 0 16px;
    font-size: clamp(32px, 4vw, 48px);
    font-weight: 800;
    color: var(--cream-text);
    letter-spacing: -0.04em;
    line-height: 1.1;
  }

  .guide-subtitle {
    margin: 0;
    font-size: 16px;
    line-height: 1.6;
    color: var(--cream-muted);
  }

  .guide-section {
    margin-bottom: 56px;
  }

  .guide-section-title {
    margin: 0 0 24px;
    font-size: 24px;
    font-weight: 700;
    color: var(--cream-text);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .guide-section-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--cream-card);
    border: 1px solid var(--cream-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cream-muted);
  }

  .guide-content p {
    margin: 0 0 16px;
    font-size: 15px;
    line-height: 1.7;
    color: var(--cream-muted);
  }

  .guide-content strong {
    color: var(--cream-text);
    font-weight: 600;
  }

  .guide-content ul {
    margin: 0 0 24px;
    padding-left: 20px;
    color: var(--cream-muted);
    font-size: 15px;
    line-height: 1.7;
  }

  .guide-content li {
    margin-bottom: 8px;
  }

  .guide-note {
    background: var(--cream-inner);
    border-radius: 16px;
    padding: 20px 24px;
    margin-bottom: 24px;
    border: 1px solid var(--cream-border);
  }

  .guide-note h4 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 600;
    color: var(--cream-text);
  }

  .guide-note p {
    margin: 0;
    font-size: 14px;
  }

  .guide-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 12px;
    background: var(--cream-text);
    color: var(--cream-card);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    margin-top: 24px;
    transition: opacity 0.2s;
  }

  .guide-back:hover {
    opacity: 0.9;
  }

  .guide-back:hover {
    opacity: 0.9;
  }

  .guide-image-container {
    width: 100%;
    background: var(--cream-card);
    border: 1px solid var(--cream-border);
    border-radius: 16px;
    overflow: hidden;
    margin: 24px 0;
    box-shadow: 0 4px 20px rgba(0,0,0,0.03);
  }
  
  .guide-image-container img {
    width: 100%;
    height: auto;
    display: block;
  }
  
  [data-theme="dark"] .guide-image-container {
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  }
`;

export default function SecurityGuidePage() {
  const { isDarkMode } = useTheme();

  return (
    <>
      <style>{GUIDE_STYLES}</style>
      <div data-theme={isDarkMode ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--cream-page)' }}>
        <div className="guide-layout">
          <aside className="guide-sidebar">
            <Link
              href="/security"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 13, fontWeight: 500, color: 'var(--cream-muted)',
                textDecoration: 'none', marginBottom: 32, paddingLeft: 12
              }}
            >
              <ChevronLeft size={14} /> Back to Settings
            </Link>

            <div className="guide-sidebar-title">Contents</div>
            <a href="#encryption" className="guide-sidebar-link"><Shield size={16} /> Encryption Overview</a>
            <a href="#password" className="guide-sidebar-link"><Lock size={16} /> Your Password</a>
            <a href="#recovery" className="guide-sidebar-link"><KeyRound size={16} /> Recovery Codes</a>
            <a href="#totp" className="guide-sidebar-link"><Smartphone size={16} /> Authenticator (2FA)</a>
            <a href="#device-verification" className="guide-sidebar-link"><ShieldAlert size={16} /> Verify New Device</a>
            <a href="#devices" className="guide-sidebar-link"><Monitor size={16} /> Active Devices</a>
          </aside>

          <div className="guide-container">


          <header className="guide-header">
            <h1 className="guide-title">Security Guide</h1>
            <p className="guide-subtitle">
              Learn how FORCE protects your data and how to manage your account security settings.
            </p>
          </header>

          <div className="guide-image-container" style={{ marginBottom: 48 }}>
            <img src="/security_page_ui_screenshot.png" alt="Security Overview" />
          </div>

          <div className="guide-content">
            {/* Encryption Overview */}
            <section className="guide-section" id="encryption">
              <h2 className="guide-section-title">
                <div className="guide-section-icon"><Shield size={20} /></div>
                End-to-End Encryption
              </h2>
              <p>
                FORCE uses zero-knowledge, end-to-end encryption (E2EE) to ensure your journals and entries are completely private. This means your data is encrypted on your device before it is ever sent to our servers.
              </p>
              <div className="guide-note">
                <h4>What this means for you</h4>
                <p>
                  No one at FORCE—or anyone else—can read your entries. Because we don't have your password, we cannot decrypt your data or reset your password if you lose it. This is why <strong>recovery codes are essential.</strong>
                </p>
              </div>
            </section>

            {/* Passwords */}
            <section className="guide-section" id="password">
              <h2 className="guide-section-title">
                <div className="guide-section-icon"><Lock size={20} /></div>
                Your Password
              </h2>
              <p>
                Your password is the key that unlocks your account. It protects your journals and ensures that only you can access them.
              </p>
              
              <h4>How to set or change your password</h4>
              <ol style={{ paddingLeft: '20px', color: 'var(--cream-muted)', marginBottom: '24px' }}>
                <li style={{ marginBottom: 8 }}>Go to your <strong>Security</strong> settings.</li>
                <li style={{ marginBottom: 8 }}>Under the Password section, click <strong>Set password</strong> or <strong>Change</strong>.</li>
                <li style={{ marginBottom: 8 }}>Enter your current password (if you have one) and your new password.</li>
              </ol>

              <div className="guide-image-container">
                <img src="/chnage_password.png" alt="Change Password dialog" />
              </div>

              <div className="guide-note" id="migration">
                <h4>Security Upgrades</h4>
                <p>
                  From time to time, we may prompt you to run a "Security Upgrade". This happens when we improve our encryption algorithms. Running the upgrade ensures your account uses the latest security standards.
                </p>
              </div>
            </section>

            {/* Recovery Codes */}
            <section className="guide-section" id="recovery">
              <h2 className="guide-section-title">
                <div className="guide-section-icon"><KeyRound size={20} /></div>
                Recovery Codes
              </h2>
              <p>
                Because FORCE is completely private, a forgotten password means you can't access your data. Recovery codes are your safety net.
              </p>
              
              <h4>How to generate recovery codes</h4>
              <ol style={{ paddingLeft: '20px', color: 'var(--cream-muted)', marginBottom: '24px' }}>
                <li style={{ marginBottom: 8 }}>Go to your <strong>Security</strong> settings.</li>
                <li style={{ marginBottom: 8 }}>Under the Recovery codes section, click <strong>Generate codes</strong>.</li>
                <li style={{ marginBottom: 8 }}>Save the 8 codes shown on the screen in a safe place (like a password manager or printed on paper).</li>
              </ol>

              <div className="guide-image-container" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <img src="/Regenerate_recovery_codes.png" alt="Regenerate recovery codes" />
                <div style={{ padding: 12, background: 'var(--cream-inner)', textAlign: 'center', fontSize: 13, color: 'var(--cream-muted)' }}>
                  After generating, store your codes safely offline.
                </div>
                <img src="/New_recovery_codes_generated.png" alt="New recovery codes generated" />
              </div>
            </section>

            {/* TOTP */}
            <section className="guide-section" id="totp">
              <h2 className="guide-section-title">
                <div className="guide-section-icon"><Smartphone size={20} /></div>
                Authenticator App (2FA)
              </h2>
              <p>
                Two-Factor Authentication (2FA) adds an extra layer of security. Even if someone guesses your password, they cannot log in without your device.
              </p>
              
              <h4>How to enable 2FA</h4>
              <ol style={{ paddingLeft: '20px', color: 'var(--cream-muted)', marginBottom: '24px' }}>
                <li style={{ marginBottom: 8 }}>Download an authenticator app (like Google Authenticator or Authy) on your phone. In your FORCE <strong>Security</strong> settings, click <strong>Enable</strong> under Authenticator app.</li>
                <li style={{ marginBottom: 8 }}><strong>Scan the QR code</strong> with your app.</li>
              </ol>

              <div className="guide-image-container" style={{ maxWidth: 500, margin: '0 auto 24px' }}>
                <img src="/set_up_auth_app_ui_2fa.png" alt="Scan QR code" />
              </div>

              <ol start={3} style={{ paddingLeft: '20px', color: 'var(--cream-muted)', marginBottom: '24px' }}>
                <li style={{ marginBottom: 8 }}>Click Next, and <strong>enter the 6-digit code</strong> generated by your app.</li>
              </ol>

              <div className="guide-image-container" style={{ maxWidth: 500, margin: '0 auto 24px' }}>
                <img src="/totp_code_verify_2fa.png" alt="Enter 6-digit code" />
              </div>

              <ol start={4} style={{ paddingLeft: '20px', color: 'var(--cream-muted)', marginBottom: '24px' }}>
                <li style={{ marginBottom: 8 }}>Click <strong>Verify & enable</strong>. You will see a success confirmation, and your account is now protected!</li>
              </ol>

              <div className="guide-note" style={{ borderColor: 'var(--pill-amber-text)' }}>
                <h4 style={{ color: 'var(--pill-amber-text)' }}>Having trouble verifying?</h4>
                <p>
                  If you see an "Invalid code" error, it's usually because the clock on your phone is out of sync. Go to your phone's date and time settings and make sure "Set automatically" is turned on.
                </p>
              </div>
            </section>

            {/* Device Verification */}
            <section className="guide-section" id="device-verification">
              <h2 className="guide-section-title">
                <div className="guide-section-icon"><ShieldAlert size={20} /></div>
                Verifying a New Device
              </h2>
              <p>
                Because FORCE is built for absolute privacy, logging in on a brand new phone or computer is a little different than other apps. Even if someone guesses your password, they can't see your journals without verifying the device first.
              </p>
              <div className="guide-note" style={{ marginBottom: '24px' }}>
                <h4>The "New House" Analogy</h4>
                <p>
                  Think of it like moving into a new house. Your password gets you through the front door, but you still need to verify your identity to unpack all your private boxes.
                </p>
              </div>
              <p style={{ marginBottom: '24px' }}>
                When you sign in on a new device, you'll see a verification screen. You can choose one of three simple ways to get your new device approved:
              </p>
              
              <h4>1. Approve from a device you already use (Easiest)</h4>
              <p style={{ color: 'var(--cream-muted)', marginBottom: '16px' }}>
                If you are already logged into FORCE on your phone or laptop, you can just tap a button to approve the new one.
              </p>
              <div className="guide-image-container" style={{ maxWidth: 500, margin: '0 auto 16px' }}>
                <img src="/Verify_this_device_before_sending approval_req.png" alt="Send approval request" />
              </div>
              <p style={{ color: 'var(--cream-muted)', marginBottom: '16px' }}>
                Click <strong>Send approval request</strong>, and a notification will pop up on your other device asking if you are trying to sign in. 
              </p>
              <div className="guide-image-container" style={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 500, margin: '0 auto 32px' }}>
                <img src="/Verify_this_device_after_sending approval_req.png" alt="Waiting for approval" />
                <div style={{ padding: 12, background: 'var(--cream-inner)', textAlign: 'center', fontSize: 13, color: 'var(--cream-muted)' }}>
                  Once you click "Approve" on your old device, your new device will instantly unlock like magic—no typing required!
                </div>
                <img src="/access_approved_device_req.png" alt="Device approved" />
              </div>

              <h4>2. Use a Recovery Code</h4>
              <p style={{ color: 'var(--cream-muted)', marginBottom: '16px' }}>
                If your phone is lost or you don't have another device handy, you can use one of your 8 saved Recovery Codes. Just type in the code along with your normal account password.
              </p>
              <div className="guide-image-container" style={{ maxWidth: 500, margin: '0 auto 32px' }}>
                <img src="/recovery_code.png" alt="Enter recovery code" />
              </div>

              <h4>3. Use your Authenticator App</h4>
              <p style={{ color: 'var(--cream-muted)', marginBottom: '16px' }}>
                If you've set up an authenticator app (like Google Authenticator), you can enter the 6-digit code from your app, followed by your account password, to verify the new device.
              </p>
              <div className="guide-image-container" style={{ maxWidth: 500, margin: '0 auto 24px' }}>
                <img src="/authenticator_app_totp.png" alt="Enter authenticator code" />
              </div>
            </section>

            {/* Devices */}
            <section className="guide-section" id="devices">
              <h2 className="guide-section-title">
                <div className="guide-section-icon"><Monitor size={20} /></div>
                Active Devices
              </h2>
              <p>
                The Active Devices section shows every browser and device currently logged into your FORCE account.
              </p>
              
              <h4>How to manage devices</h4>
              <ol style={{ paddingLeft: '20px', color: 'var(--cream-muted)', marginBottom: '24px' }}>
                <li style={{ marginBottom: 8 }}>Scroll down to <strong>Active devices</strong> in your Security settings.</li>
                <li style={{ marginBottom: 8 }}>Review the list of devices and their locations.</li>
                <li style={{ marginBottom: 8 }}>If you see a device you don't recognize, click <strong>Revoke</strong> to sign it out immediately.</li>
              </ol>

              <div className="guide-image-container">
                <img src="/security_page_with_2fa_active_device_advanced_setting.png" alt="Manage Active Devices" />
              </div>
            </section>

            {/* Advanced Settings */}
            <section className="guide-section" id="advanced">
              <h2 className="guide-section-title">
                <div className="guide-section-icon"><Shield size={20} /></div>
                Advanced Settings (Danger Zone)
              </h2>
              <p>
                In the Advanced Settings section, you can permanently delete your FORCE account and all associated journal data.
              </p>
              
              <h4>Deleting your account</h4>
              <ol style={{ paddingLeft: '20px', color: 'var(--cream-muted)', marginBottom: '24px' }}>
                <li style={{ marginBottom: 8 }}>Scroll to the bottom of the Security settings and click <strong>Advanced settings</strong>.</li>
                <li style={{ marginBottom: 8 }}>Click the <strong>Delete account</strong> button.</li>
                <li style={{ marginBottom: 8 }}>Provide a reason (optional) and confirm the permanent deletion.</li>
              </ol>

              <div className="guide-note" style={{ borderColor: 'var(--pill-red-text)' }}>
                <h4 style={{ color: 'var(--pill-red-text)' }}>Warning: Data loss is permanent</h4>
                <p>
                  Deleting your account permanently removes all your journals, settings, and encryption keys. Because we use zero-knowledge encryption, <strong>your data cannot be recovered by FORCE support</strong> once deleted.
                </p>
              </div>

              <div className="guide-image-container">
                <img src="/Delete_account.png" alt="Delete Account dialog" />
              </div>
            </section>

            <Link href="/security" className="guide-back">
              <ChevronLeft size={16} /> Return to Security Settings
            </Link>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
