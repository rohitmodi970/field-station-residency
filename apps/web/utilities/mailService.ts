// utilities/mailService.ts
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Supabase client for fetching admin settings
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Email configuration types
export interface EmailConfig {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: Attachment[];
}

export interface Attachment {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
}

// Email templates
export enum EmailTemplate {
  WELCOME = 'welcome',
  PASSWORD_RESET = 'password-reset',
  VERIFICATION = 'verification',
  ONBOARDING_COMPLETE = 'onboarding-complete',
}

// User data for templates
export interface UserEmailData {
  name?: string;
  email: string;
  userId?: number;
  username?: string;
  verificationToken?: string;
  resetToken?: string;
  onboardingStatus?: boolean;
  
}

// Initialize Nodemailer transport
const smtpUser = process.env.SMTP_USER || process.env.EMAIL_ADDRESS;
const smtpPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

const transporter = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort || 587,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

/**
 * Verifies email configuration is working
 * @returns Promise<boolean> - Whether verification was successful
 */
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('Email service is ready');
    return true;
  } catch (error) {
    console.error('Email service configuration error:', error);
    return false;
  }
}

/**
 * Send an email with provided configuration
 * @param config - Email configuration
 * @returns Promise<boolean> - Whether email was sent successfully
 */
const DEFAULT_SENDER =
  process.env.FORCE_SENDER_EMAIL || process.env.EMAIL_ADDRESS || process.env.SMTP_USER || 'work@findmyforce.com';

export async function sendEmail(config: EmailConfig): Promise<boolean> {
  try {
    const mailOptions = {
      from: `Force <${DEFAULT_SENDER}>`,
      ...config,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${config.to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Get template for welcome email
 * @param user - User data for email personalization
 * @returns HTML template for welcome email
 */
function getWelcomeTemplate(user: UserEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <style>
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
          margin: 0;
          padding: 20px 0;
          min-height: 100vh;
        }
        .email-wrapper {
          background: #f8fafc;
          padding: 40px 20px;
          min-height: 100vh;
        }
        .container {
          background: #ffffff;
          max-width: 600px;
          margin: 0 auto;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.06);
          overflow: hidden;
          position: relative;
        }
        .header {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: white;
          text-align: center;
          padding: 40px 32px 32px 32px;
          position: relative;
        }
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          opacity: 0.1;
        }
        .logo {
          max-width: 120px;
          margin-bottom: 16px;
          filter: brightness(0) invert(1);
        }
        .welcome-icon {
          font-size: 48px;
          margin-bottom: 12px;
          display: block;
        }
        .header h2 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 8px 0 0 0;
          opacity: 0.9;
          font-size: 16px;
        }
        .content {
          padding: 40px 32px;
        }
        .greeting {
          font-size: 18px;
          color: #1f2937;
          margin: 0 0 24px 0;
          font-weight: 500;
        }
        .welcome-message {
          font-size: 16px;
          line-height: 1.7;
          color: #4b5563;
          margin: 0 0 32px 0;
        }
        .user-info {
          background: linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%);
          border: 2px solid #e0f2fe;
          padding: 24px;
          border-radius: 12px;
          margin: 32px 0;
          position: relative;
        }
        .user-info::before {
          content: '👤';
          position: absolute;
          top: -12px;
          left: 24px;
          background: white;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 16px;
        }
        .user-info h3 {
          color: #0369a1;
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
        }
        .info-grid {
          display: grid;
          gap: 12px;
        }
        .info-item {
          display: flex;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-item:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: #374151;
          min-width: 80px;
          margin-right: 12px;
        }
        .info-value {
          color: #4f46e5;
          font-weight: 500;
          flex: 1;
        }
        .features {
          background: #fefdf8;
          border: 2px solid #fef3c7;
          border-radius: 12px;
          padding: 24px;
          margin: 32px 0;
        }
        .features h3 {
          color: #92400e;
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
        }
        .features h3::before {
          content: '✨';
          margin-right: 8px;
        }
        .features ul {
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .features li {
          padding: 8px 0;
          padding-left: 24px;
          position: relative;
          color: #451a03;
        }
        .features li::before {
          content: '•';
          color: #f59e0b;
          font-weight: bold;
          position: absolute;
          left: 8px;
        }
        .button {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: none;
          color: white;
          padding: 16px 32px;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 16px;
          font-weight: 600;
          margin: 24px 0;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
          letter-spacing: 0.5px;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        }
        .button-container {
          text-align: center;
          margin: 32px 0;
        }
        .support-section {
          background: #f8fafc;
          border-radius: 8px;
          padding: 20px;
          margin: 32px 0;
          text-align: center;
          border-left: 4px solid #6366f1;
        }
        .support-section p {
          margin: 0;
          color: #475569;
          font-size: 14px;
        }
        .footer {
          background: #f1f5f9;
          padding: 24px 32px;
          text-align: center;
          font-size: 12px;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 4px 0;
        }
        .footer .email-highlight {
          color: #10b981;
          font-weight: 600;
        }
        .divider {
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #e2e8f0 50%, transparent 100%);
          border: none;
          margin: 24px 0;
        }
        @media (max-width: 600px) {
          .email-wrapper {
            padding: 20px 10px;
          }
          .container {
            border-radius: 8px;
            margin: 0 10px;
          }
          .header, .content {
            padding: 24px 20px;
          }
          .user-info, .features {
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <div class="header">
            <span class="welcome-icon">🎉</span>
            <img src="${process.env.COMPANY_LOGO_URL || 'https://force-web.vercel.app/logo-black.png'}" alt="Force Company Logo" class="logo" />
            <h2>Welcome to Force!</h2>
            <p>Your journey to enhanced productivity starts here</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${user.name || 'there'}! 👋</p>
            
            <p class="welcome-message">
              We're absolutely thrilled to have you join the Force community! Your account has been successfully created and you're all set to explore our powerful platform designed to boost your productivity and streamline your workflow.
            </p>
            
            <div class="user-info">
              <h3>Your Account Information</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Name:</span>
                  <span class="info-value">${user.name || 'Not provided'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Email:</span>
                  <span class="info-value">${user.email}</span>
                </div>
                ${user.userId ? `
                <div class="info-item">
                  <span class="info-label">User ID:</span>
                  <span class="info-value">#${user.userId}</span>
                </div>` : ''}
                ${user.username ? `
                <div class="info-item">
                  <span class="info-label">Username:</span>
                  <span class="info-value">@${user.username}</span>
                </div>` : ''}
              </div>
            </div>
            
            <div class="features">
              <h3>What's Next?</h3>
              <ul>
                <li>Complete your profile setup for a personalized experience</li>
                <li>Explore our AI-powered productivity tools</li>
                <li>Connect with team members and collaborators</li>
                <li>Access our comprehensive knowledge base</li>
                <li>Start your first project with our guided templates</li>
              </ul>
            </div>
            
            <hr class="divider">
            
            <div class="button-container">
              <a href="${process.env.NEXTAUTH_URL}/login" class="button">Get Started Now →</a>
            </div>
            
            <div class="support-section">
              <p>Need help getting started? Our friendly support team is ready to assist you 24/7. Just reply to this email or visit our help center.</p>
            </div>
            
            <p style="color: #6b7280; font-size: 16px; margin: 24px 0 0 0;">
              Welcome aboard! 🚀<br>
              <strong>Force</strong>
            </p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Force Company. All rights reserved.</p>
            <p>This email was sent to <span class="email-highlight">${user.email}</span></p>
            <p>Force HQ, Innovation District, Tech City</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Get template for password reset email
 * @param user - User data including reset token
 * @returns HTML template for password reset email
 */
function getPasswordResetTemplate(user: UserEmailData): string {
  const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${user.resetToken}&email=${encodeURIComponent(user.email)}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
        }
        .container {
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .logo {
          max-width: 150px;
          margin-bottom: 10px;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #777;
        }
        .button {
          background-color: #4285F4;
          border: none;
          color: white;
          padding: 10px 20px;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 16px;
          margin: 10px 0;
          cursor: pointer;
          border-radius: 4px;
        }
        .warning {
          color: #856404;
          background-color: #fff3cd;
          border-color: #ffeeba;
          padding: 12px;
          margin: 15px 0;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${process.env.COMPANY_LOGO_URL || 'https://force-web.vercel.app/logo-black.png'}" alt="Force Company Logo" class="logo" />
          <h2>Password Reset Request</h2>
        </div>
        
        <p>Hello ${user.name || 'there'},</p>
        
        <p>We received a request to reset your password for your Force account. If you didn't make this request, you can safely ignore this email.</p>
        
        <p>To reset your password, click the button below:</p>
        
        <div style="text-align: center;">
          <a href="${resetUrl}" class="button">Reset Password</a>
        </div>
        
        <div class="warning">
          <p>This link will expire in 1 hour for security reasons.</p>
        </div>
        
        <p>If the button above doesn't work, copy and paste this URL into your browser:</p>
        <p style="word-break: break-all;">${resetUrl}</p>
        
        <p>Best regards,<br>The Force Team</p>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Force Company. All rights reserved.</p>
          <p>This email was sent to ${user.email}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Get template for verification email
 * @param user - User data including verification token
 * @returns HTML template for verification email
 */
function getVerificationTemplate(user: UserEmailData): string {
  const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify?token=${user.verificationToken}&email=${encodeURIComponent(user.email)}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
        }
        .container {
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .logo {
          max-width: 150px;
          margin-bottom: 10px;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #777;
        }
        .button {
          background-color: #4CAF50;
          border: none;
          color: white;
          padding: 10px 20px;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 16px;
          margin: 10px 0;
          cursor: pointer;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${process.env.COMPANY_LOGO_URL || 'https://force-web.vercel.app/logo-black.png'}" alt="Force Company Logo" class="logo" />
          <h2>Verify Your Email Address</h2>
        </div>
        
        <p>Hello ${user.name || 'there'},</p>
        
        <p>Thank you for creating an account with Force. To complete your registration, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </div>
        
        <p>If the button above doesn't work, copy and paste this URL into your browser:</p>
        <p style="word-break: break-all;">${verificationUrl}</p>
        
        <p>Best regards,<br>The Force Team</p>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Force Company. All rights reserved.</p>
          <p>This email was sent to ${user.email}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Get template for onboarding completion email
 * @param user - User data for email personalization
 * @returns HTML template for onboarding completion email
 */
function getOnboardingCompleteTemplate(user: UserEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <style>
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          background: #f4f8fb;
          color: #222;
          margin: 0;
          padding: 0;
        }
        .container {
          background: #fff;
          max-width: 600px;
          margin: 40px auto;
          border-radius: 12px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.07), 0 1.5px 6px rgba(0,0,0,0.03);
          padding: 32px 28px 24px 28px;
        }
        .header {
          text-align: center;
          margin-bottom: 28px;
        }
        .logo {
          max-width: 120px;
          margin-bottom: 12px;
        }
        .success-box {
          background: linear-gradient(90deg, #e0ffe7 0%, #f0fff4 100%);
          border-left: 6px solid #4CAF50;
          color: #256029;
          padding: 18px 20px;
          border-radius: 8px;
          margin: 24px 0 18px 0;
          text-align: center;
        }
        .success-box h3 {
          margin: 0 0 6px 0;
          font-size: 1.25rem;
          letter-spacing: 0.5px;
        }
        .steps {
          margin: 18px 0 24px 0;
          padding: 0;
          list-style: none;
        }
        .steps li {
          margin: 0 0 10px 0;
          padding-left: 24px;
          position: relative;
          font-size: 1rem;
        }
        .steps li:before {
          content: "✓";
          color: #4CAF50;
          font-weight: bold;
          position: absolute;
          left: 0;
        }
        .button {
          background: linear-gradient(90deg, #4CAF50 0%, #43a047 100%);
          border: none;
          color: #fff;
          padding: 12px 32px;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 1.08rem;
          font-weight: 500;
          margin: 18px 0 0 0;
          cursor: pointer;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(76,175,80,0.08);
          transition: background 0.2s;
        }
        .button:hover {
          background: linear-gradient(90deg, #43a047 0%, #388e3c 100%);
        }
        .ai-insights {
          background: linear-gradient(90deg, #f1f6ff 0%, #f8fbff 100%);
          border-left: 6px solid #4285F4;
          padding: 18px 20px;
          border-radius: 8px;
          margin: 24px 0;
        }
        .ai-insights h3 {
          color: #1a57cb;
          margin: 0 0 10px 0;
          font-size: 1.15rem;
        }
        .footer {
          margin-top: 36px;
          text-align: center;
          font-size: 12px;
          color: #888;
        }
        .divider {
          border: none;
          border-top: 1px solid #e0e0e0;
          margin: 28px 0 18px 0;
        }
        .quote {
          font-style: italic;
          color: #555;
          border-left: 3px solid #4285F4;
          padding-left: 12px;
          margin: 16px 0;
        }
        @media (max-width: 600px) {
          .container {
            padding: 16px 6vw 18px 6vw;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${process.env.COMPANY_LOGO_URL || 'https://force-web.vercel.app/logo-black.png'}" alt="Force Company Logo" class="logo" />
          <h2 style="margin:0;font-weight:600;color:#222;">Onboarding Complete!</h2>
        </div>
        <div class="success-box">
          <h3>🎉 Welcome, ${user.name || 'there'}!</h3>
          <p>You've successfully completed onboarding and your account is ready.</p>
        </div>
        <p style="font-size:1.07rem;line-height:1.7;margin:18px 0 0 0;">
          Here's what you can do next:
        </p>
        <ul class="steps">
          <li>Explore your personalized dashboard</li>
          <li>Update your profile and preferences</li>
          <li>Connect and collaborate with other users</li>
          <li>Access our knowledge base and resources</li>
        </ul>
        
        <div class="ai-insights">
          <h3>Force AI Journal</h3>
          <p>Our AI journal feature is designed to help you track your progress, organize your thoughts, and enhance your productivity.</p>
          <div class="quote">
            "Journaling with AI assistance provides a structured way to reflect on your work and generate new insights."
          </div>
          <p>Try using the AI journal to:</p>
          <ul>
            <li>Document your project milestones</li>
            <li>Receive AI-powered suggestions for improvement</li>
            <li>Analyze patterns in your workflow</li>
            <li>Generate comprehensive reports based on your entries</li>
          </ul>
        </div>
        
        <div style="text-align:center;">
          <a href="${process.env.NEXTAUTH_URL}/dashboard" class="button">Go to Dashboard</a>
        </div>
        <hr class="divider"/>
        <p style="font-size:0.98rem;margin:0 0 10px 0;">
          Need help or have questions? Our support team is here for you at any time.
        </p>
        <p style="margin:0 0 10px 0;">Best regards,<br><b>The Force Team</b></p>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Force Company. All rights reserved.</p>
          <p>This email was sent to <span style="color:#4CAF50;">${user.email}</span></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Get the appropriate email template based on template type
 * @param template - Type of email template to use
 * @param user - User data for email personalization
 * @returns HTML template for the specified email type
 */
function getEmailTemplate(template: EmailTemplate, user: UserEmailData): string {
  switch (template) {
    case EmailTemplate.WELCOME:
      return getWelcomeTemplate(user);
    case EmailTemplate.PASSWORD_RESET:
      return getPasswordResetTemplate(user);
    case EmailTemplate.VERIFICATION:
      return getVerificationTemplate(user);
    case EmailTemplate.ONBOARDING_COMPLETE:
      return getOnboardingCompleteTemplate(user);
    default:
      throw new Error(`Email template ${template} not found`);
  }
}

/**
 * Fetch custom onboarding email subject from admin settings
 * @returns Promise<string | null> - Custom subject or null if not set
 */
async function getCustomOnboardingSubject(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'onboarding_email_subject')
      .single();
    return data?.value || null;
  } catch {
    return null;
  }
}

/**
 * Fetch custom onboarding email template from admin settings
 * @returns Promise<string | null> - Custom template or null if not set
 */
async function getCustomOnboardingTemplate(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'onboarding_email_template')
      .single();
    return data?.value || null;
  } catch {
    return null;
  }
}

/**
 * Send a template-based email to a user
 * @param template - Type of email template to use
 * @param user - User data for email personalization
 * @param customSubject - Optional custom subject line
 * @returns Promise<boolean> - Whether email was sent successfully
 */
export async function sendTemplatedEmail(
  template: EmailTemplate,
  user: UserEmailData,
  customSubject?: string
): Promise<boolean> {
  try {
    // Generate subject based on template if not provided
    let subject = customSubject;
    if (!subject) {
      if (template === EmailTemplate.ONBOARDING_COMPLETE) {
        // Try to fetch custom onboarding subject from database
        subject = await getCustomOnboardingSubject() || 'welcome to your digital mental space';
      } else {
        switch (template) {
          case EmailTemplate.WELCOME:
            subject = 'Welcome to Force - Registration Successful';
            break;
          case EmailTemplate.PASSWORD_RESET:
            subject = 'Reset Your Force Account Password';
            break;
          case EmailTemplate.VERIFICATION:
            subject = 'Verify Your Force Account Email';
            break;
          default:
            subject = 'Force Account Notification';
        }
      }
    }

    // For onboarding emails, try to fetch custom template first
    let htmlContent: string;
    if (template === EmailTemplate.ONBOARDING_COMPLETE) {
      const customTemplate = await getCustomOnboardingTemplate();
      htmlContent = customTemplate || getEmailTemplate(template, user);
    } else {
      htmlContent = getEmailTemplate(template, user);
    }
    
    return await sendEmail({
      to: user.email,
      subject,
      html: htmlContent,
    });
  } catch (error) {
    console.error(`Error sending ${template} email:`, error);
    return false;
  }
}

export default {
  sendEmail,
  sendTemplatedEmail,
  verifyEmailConfig,
  EmailTemplate,
};




// // Import the mail service
// import mailService, { EmailTemplate } from '@/utilities/mailService';

// // Send a welcome email
// await mailService.sendTemplatedEmail(
//   EmailTemplate.WELCOME,
//   {
//     name: user.name,
//     email: user.email,
//     userId: user.userId
//   }
// );

// // Send a password reset email
// await mailService.sendTemplatedEmail(
//   EmailTemplate.PASSWORD_RESET,
//   {
//     name: user.name,
//     email: user.email,
//     resetToken: resetToken
//   }
// );

// // Send a verification email
// await mailService.sendTemplatedEmail(
//   EmailTemplate.VERIFICATION,
//   {
//     name: user.name,
//     email: user.email,
//     verificationToken: verificationToken
//   }
// );

// ── Collaboration Invite Email ─────────────────────────────────────────────

export interface CollaborationInviteEmailParams {
  to: string;
  inviterName: string;
  role: 'viewer' | 'editor';
  acceptUrl: string;
  declineUrl: string;
  expiresAt: Date;
}

/**
 * Send a collaboration invitation email.
 *
 * SECURITY: Never include journal title — journal content is client-encrypted
 * and the server cannot see it. Email only contains: inviter name, role, links.
 */
export async function sendCollaborationInviteEmail(
  params: CollaborationInviteEmailParams
): Promise<boolean> {
  const { to, inviterName, role, acceptUrl, declineUrl, expiresAt } = params;

  const roleLabel = role === 'editor' ? 'Editor (can read & write)' : 'Viewer (read-only)';
  const expiresLabel = expiresAt.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const html = getCollaborationInviteTemplate({
    inviterName,
    roleLabel,
    acceptUrl,
    declineUrl,
    expiresLabel,
  });

  return sendEmail({
    to,
    subject: `${inviterName} invited you to collaborate on a journal`,
    html,
  });
}

interface CollaborationInviteTemplateParams {
  inviterName: string;
  roleLabel: string;
  acceptUrl: string;
  declineUrl: string;
  expiresLabel: string;
}

function getCollaborationInviteTemplate(params: CollaborationInviteTemplateParams): string {
  const { inviterName, roleLabel, acceptUrl, declineUrl, expiresLabel } = params;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Journal Collaboration Invite</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      background: #0f0f14;
      color: #e2e8f0;
      padding: 32px 16px;
    }
    .wrapper {
      max-width: 560px;
      margin: 0 auto;
    }
    .card {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      padding: 32px 40px;
      text-align: center;
    }
    .header-icon {
      font-size: 48px;
      display: block;
      margin-bottom: 12px;
    }
    .header h1 {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .header p {
      color: rgba(255,255,255,0.8);
      font-size: 14px;
      margin-top: 6px;
    }
    .body {
      padding: 36px 40px;
    }
    .invite-box {
      background: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 10px;
      padding: 20px 24px;
      margin-bottom: 24px;
    }
    .invite-box .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .invite-box .value {
      font-size: 15px;
      color: #e2e8f0;
      font-weight: 500;
    }
    .invite-box .value.highlight {
      color: #a5b4fc;
    }
    .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 8px 0; }
    .security-note {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 28px;
      font-size: 13px;
      color: #6ee7b7;
      line-height: 1.5;
    }
    .security-note strong { color: #34d399; }
    .cta-group {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }
    .btn {
      flex: 1;
      display: block;
      text-align: center;
      padding: 14px 20px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      letter-spacing: -0.2px;
    }
    .btn-accept {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #ffffff;
    }
    .btn-decline {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: #94a3b8;
    }
    .expiry {
      font-size: 12px;
      color: #64748b;
      text-align: center;
      margin-bottom: 8px;
    }
    .footer {
      border-top: 1px solid rgba(255,255,255,0.06);
      padding: 20px 40px;
      text-align: center;
      font-size: 12px;
      color: #475569;
      line-height: 1.6;
    }
    .footer a { color: #6366f1; text-decoration: none; }
    .logo {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #a5b4fc;
      margin-bottom: 16px;
      display: block;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <span class="header-icon">📓</span>
        <h1>You've been invited to collaborate</h1>
        <p>Secure, end-to-end encrypted journal sharing</p>
      </div>

      <div class="body">
        <div class="invite-box">
          <div class="label">Invited by</div>
          <div class="value highlight">${inviterName}</div>
          <div class="divider" style="margin: 12px 0;"></div>
          <div class="label">Your role</div>
          <div class="value">${roleLabel}</div>
        </div>

        <div class="security-note">
          <strong>🔐 End-to-end encrypted.</strong> The journal content is encrypted on your device.
          Even Force cannot read it. Only you and the people you collaborate with can access it.
        </div>

        <div class="cta-group">
          <a href="${acceptUrl}" class="btn btn-accept">✓ Accept Invitation</a>
          <a href="${declineUrl}" class="btn btn-decline">Decline</a>
        </div>

        <p class="expiry">This invitation expires on ${expiresLabel}.</p>
      </div>

      <div class="footer">
        <span class="logo">force.</span>
        If you didn't expect this invitation, you can safely ignore it.<br/>
        The accept link only works when logged in with the email it was sent to.<br/>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://findmyforce.com'}">findmyforce.com</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// // Send a custom email
// await mailService.sendEmail({
//   to: user.email,
//   subject: 'Custom Subject',
//   html: '<p>Custom HTML content</p>'
// });