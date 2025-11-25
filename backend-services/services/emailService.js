/**
 * Email Service
 * Sends welcome emails and notifications to users
 * 
 * Uses nodemailer with SMTP or can be configured for SendGrid/AWS SES
 * Falls back to console logging if SMTP is not configured
 */

const nodemailer = require('nodemailer');

// Email configuration from environment
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@wisptools.io';
const FROM_NAME = process.env.FROM_NAME || 'WISPTools';

// Create transporter (lazy initialization)
let transporter = null;

function getTransporter() {
  if (!transporter && EMAIL_CONFIG.auth.user && EMAIL_CONFIG.auth.pass && 
      EMAIL_CONFIG.auth.user !== 'placeholder' && EMAIL_CONFIG.auth.pass !== 'placeholder') {
    transporter = nodemailer.createTransport(EMAIL_CONFIG);
    console.log('📧 [Email] SMTP transporter initialized');
  }
  return transporter;
}

/**
 * Check if email service is configured
 */
function isConfigured() {
  return !!(EMAIL_CONFIG.auth.user && EMAIL_CONFIG.auth.pass && 
            EMAIL_CONFIG.auth.user !== 'placeholder' && EMAIL_CONFIG.auth.pass !== 'placeholder');
}

/**
 * Send welcome email to new user
 */
async function sendWelcomeEmail(options) {
  const {
    email,
    displayName,
    tenantName,
    role,
    invitedByName
  } = options;

  const transport = getTransporter();
  
  if (!transport) {
    // Log the email details so admin can manually send if needed
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📧 [Email] WELCOME EMAIL - SMTP not configured`);
    console.log(`${'='.repeat(60)}`);
    console.log(`TO: ${email}`);
    console.log(`SUBJECT: Welcome to ${tenantName} - WISPTools`);
    console.log(`ROLE: ${getRoleName(role)}`);
    console.log(`INVITED BY: ${invitedByName || 'Admin'}`);
    console.log(`\nINSTRUCTIONS FOR USER:`);
    console.log(`1. Go to https://wisptools.io/login`);
    console.log(`2. Sign in with Google or create account with email: ${email}`);
    console.log(`3. You'll have access to ${tenantName} as ${getRoleName(role)}`);
    console.log(`${'='.repeat(60)}\n`);
    
    return { sent: false, reason: 'Email service not configured - see server logs for details' };
  }

  const firstName = displayName?.split(' ')[0] || email.split('@')[0];
  const roleName = getRoleName(role);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${tenantName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { color: #8b5cf6; margin: 0; font-size: 28px; }
    h2 { color: #1f2937; margin: 0 0 20px; }
    p { margin: 0 0 16px; color: #4b5563; }
    .highlight { background: #f5f3ff; border-left: 4px solid #8b5cf6; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0; }
    .highlight strong { color: #7c3aed; }
    .button { display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .button:hover { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); }
    .steps { margin: 24px 0; }
    .step { display: flex; align-items: flex-start; margin-bottom: 16px; }
    .step-number { background: #8b5cf6; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; margin-right: 12px; flex-shrink: 0; }
    .step-content { flex: 1; }
    .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; }
    .footer a { color: #8b5cf6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>🌐 WISPTools</h1>
      </div>
      
      <h2>Welcome to ${tenantName}!</h2>
      
      <p>Hi ${firstName},</p>
      
      <p>${invitedByName ? `${invitedByName} has added you` : 'You have been added'} to <strong>${tenantName}</strong> on WISPTools as a <strong>${roleName}</strong>.</p>
      
      <div class="highlight">
        <strong>Your Role:</strong> ${roleName}<br>
        <strong>Organization:</strong> ${tenantName}
      </div>
      
      <p><strong>Getting Started:</strong></p>
      
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">Go to <strong>wisptools.io</strong></div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">Sign in with <strong>Google</strong> or create an account using this email address</div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">You'll automatically have access to ${tenantName}</div>
        </div>
      </div>
      
      <center>
        <a href="https://wisptools.io/login" class="button">Sign In to WISPTools →</a>
      </center>
      
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        If you have any questions, please contact your organization administrator.
      </p>
    </div>
    
    <div class="footer">
      <p>This email was sent by <a href="https://wisptools.io">WISPTools</a></p>
      <p>WISP Management Platform</p>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
Welcome to ${tenantName}!

Hi ${firstName},

${invitedByName ? `${invitedByName} has added you` : 'You have been added'} to ${tenantName} on WISPTools as a ${roleName}.

Your Role: ${roleName}
Organization: ${tenantName}

Getting Started:
1. Go to wisptools.io
2. Sign in with Google or create an account using this email address
3. You'll automatically have access to ${tenantName}

Sign In: https://wisptools.io/login

If you have any questions, please contact your organization administrator.

---
WISPTools - WISP Management Platform
https://wisptools.io
  `;

  try {
    const result = await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: email,
      subject: `Welcome to ${tenantName} - WISPTools`,
      text: textContent,
      html: htmlContent
    });

    console.log(`✅ [Email] Welcome email sent to ${email}`);
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    console.error(`❌ [Email] Failed to send welcome email to ${email}:`, error.message);
    return { sent: false, reason: error.message };
  }
}

/**
 * Get human-readable role name
 */
function getRoleName(role) {
  const roleNames = {
    platform_admin: 'Platform Admin',
    owner: 'Owner',
    admin: 'Admin',
    engineer: 'Engineer',
    installer: 'Field Technician',
    helpdesk: 'Help Desk',
    support: 'Customer Support',
    viewer: 'Viewer'
  };
  return roleNames[role] || role;
}

/**
 * Send password reset email (placeholder)
 */
async function sendPasswordResetEmail(email, resetLink) {
  // Firebase Auth handles password reset emails
  console.log(`📧 [Email] Password reset requested for ${email}`);
  return { sent: false, reason: 'Use Firebase Auth password reset' };
}

module.exports = {
  isConfigured,
  sendWelcomeEmail,
  sendPasswordResetEmail
};

