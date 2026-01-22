/**
 * Email Verification Routes
 * Handles sending and verifying email verification codes
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const emailService = require('../../services/emailService');

// In-memory store for verification codes (in production, use Redis or database)
const verificationCodes = new Map();

// Code expiration time: 10 minutes
const CODE_EXPIRATION_MS = 10 * 60 * 1000;

/**
 * Generate a 6-digit verification code
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Clean up expired codes periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

/**
 * POST /api/auth/send-verification-code
 * Send a verification code to the email address
 */
router.post('/send-verification-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Check if code was sent recently (rate limiting)
    const existingCode = verificationCodes.get(email.toLowerCase());
    if (existingCode && Date.now() < existingCode.sentAt + 60000) {
      // Wait 60 seconds between sends
      const waitTime = Math.ceil((existingCode.sentAt + 60000 - Date.now()) / 1000);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Please wait ${waitTime} seconds before requesting another code`
      });
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + CODE_EXPIRATION_MS;

    // Store code
    verificationCodes.set(email.toLowerCase(), {
      code,
      expiresAt,
      sentAt: Date.now(),
      attempts: 0
    });

    // Send email with verification code
    try {
      const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .code-box { background: #f5f3ff; border: 2px dashed #8b5cf6; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
    .code { font-size: 32px; font-weight: 700; color: #7c3aed; letter-spacing: 4px; font-family: monospace; }
    .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>🌐 WISPTools Email Verification</h1>
      <p>Hi there,</p>
      <p>You're creating a new WISPTools account. Please use the verification code below to verify your email address:</p>
      <div class="code-box">
        <div class="code">${code}</div>
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, you can safely ignore this email.</p>
      <div class="footer">
        <p>WISPTools - WISP Management Platform</p>
        <p>https://wisptools.io</p>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      // Send email with verification code using email service
      console.log(`[Email Verification] Sending code to ${email}: ${code}`);
      
      try {
        await emailService.sendVerificationEmail({
          email: email.toLowerCase(),
          code: code
        });
        
        console.log(`[Email Verification] ✅ Email sent successfully to ${email}`);
        
        res.json({
          success: true,
          message: 'Verification code sent to your email',
          expiresIn: CODE_EXPIRATION_MS / 1000 // seconds
        });
      } catch (emailError) {
        console.error('[Email Verification] Failed to send email:', emailError);
        // Still return success - code is generated and stored
        // But log the error for debugging
        res.json({
          success: true,
          message: 'Verification code generated (email sending may have failed - check server logs)',
          expiresIn: CODE_EXPIRATION_MS / 1000
        });
      }
    } catch (emailError) {
      console.error('[Email Verification] Failed to send email:', emailError);
      // Still return success - code is generated and stored
      // In production, you might want to fail here
      res.json({
        success: true,
        message: 'Verification code generated (email sending may have failed)',
        code: code, // For development/testing - remove in production
        expiresIn: CODE_EXPIRATION_MS / 1000
      });
    }
  } catch (error) {
    console.error('[Email Verification] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send verification code'
    });
  }
});

/**
 * POST /api/auth/verify-email-code
 * Verify the email verification code
 */
router.post('/verify-email-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'Email and verification code are required'
      });
    }

    const storedData = verificationCodes.get(email.toLowerCase());

    if (!storedData) {
      return res.status(400).json({
        error: 'Invalid code',
        message: 'No verification code found for this email. Please request a new code.'
      });
    }

    // Check if code expired
    if (Date.now() > storedData.expiresAt) {
      verificationCodes.delete(email.toLowerCase());
      return res.status(400).json({
        error: 'Code expired',
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    // Check attempts (max 5 attempts)
    if (storedData.attempts >= 5) {
      verificationCodes.delete(email.toLowerCase());
      return res.status(400).json({
        error: 'Too many attempts',
        message: 'Too many failed attempts. Please request a new verification code.'
      });
    }

    // Verify code
    if (code !== storedData.code) {
      storedData.attempts++;
      return res.status(400).json({
        error: 'Invalid code',
        message: `Invalid verification code. ${5 - storedData.attempts} attempts remaining.`
      });
    }

    // Code verified - mark email as verified
    verificationCodes.set(email.toLowerCase(), {
      ...storedData,
      verified: true,
      verifiedAt: Date.now()
    });

    res.json({
      success: true,
      message: 'Email verified successfully',
      email: email.toLowerCase()
    });
  } catch (error) {
    console.error('[Email Verification] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify code'
    });
  }
});

/**
 * GET /api/auth/check-email-verified
 * Check if an email has been verified
 */
router.get('/check-email-verified/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const storedData = verificationCodes.get(email.toLowerCase());

    if (!storedData) {
      return res.json({ verified: false });
    }

    res.json({
      verified: storedData.verified === true && Date.now() <= storedData.expiresAt
    });
  } catch (error) {
    console.error('[Email Verification] Error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;
