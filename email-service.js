// Email Notification Service for Alerts
// Uses SendGrid for email delivery

const sgMail = require('@sendgrid/mail');

class EmailService {
  constructor() {
    // Initialize SendGrid with API key
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.enabled = true;
      console.log('✅ Email service initialized with SendGrid');
    } else {
      this.enabled = false;
      console.warn('⚠️  SENDGRID_API_KEY not set - email notifications disabled');
    }
    
    this.fromEmail = process.env.ALERT_FROM_EMAIL || 'alerts@4gengineer.com';
    this.fromName = process.env.ALERT_FROM_NAME || 'LTE WISP Alerts';
  }

  /**
   * Send alert notification email
   */
  async sendAlertEmail(to, alert, rule, tenantId) {
    if (!this.enabled) {
      console.log(`[DRY RUN] Would send alert email to ${to}: ${alert.message}`);
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const subject = this.formatSubject(alert);
      const html = this.formatAlertHTML(alert, rule, tenantId);
      const text = this.formatAlertText(alert, rule);

      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        text,
        html
      };

      await sgMail.send(msg);
      
      console.log(`✅ Alert email sent to ${to}: ${alert.rule_name}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error sending alert email to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send alert resolution notification
   */
  async sendResolutionEmail(to, alert, rule, tenantId, resolvedBy) {
    if (!this.enabled) {
      console.log(`[DRY RUN] Would send resolution email to ${to}`);
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const subject = `[RESOLVED] ${alert.rule_name}`;
      const html = this.formatResolutionHTML(alert, rule, tenantId, resolvedBy);
      const text = this.formatResolutionText(alert, rule, resolvedBy);

      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        text,
        html
      };

      await sgMail.send(msg);
      
      console.log(`✅ Resolution email sent to ${to}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error sending resolution email:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send daily digest email
   */
  async sendDailyDigest(to, tenantId, summary) {
    if (!this.enabled) {
      console.log(`[DRY RUN] Would send daily digest to ${to}`);
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const subject = `Daily Monitoring Report - ${new Date().toLocaleDateString()}`;
      const html = this.formatDigestHTML(summary);
      const text = this.formatDigestText(summary);

      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        text,
        html
      };

      await sgMail.send(msg);
      
      console.log(`✅ Daily digest sent to ${to}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error sending daily digest:`, error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // EMAIL FORMATTING
  // ============================================

  formatSubject(alert) {
    const emoji = {
      'critical': '🔴',
      'error': '🟠',
      'warning': '🟡',
      'info': '🔵'
    };

    return `${emoji[alert.severity]} [${alert.severity.toUpperCase()}] ${alert.rule_name}`;
  }

  formatAlertText(alert, rule) {
    return `
ALERT TRIGGERED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alert: ${alert.rule_name}
Severity: ${alert.severity.toUpperCase()}
Source: ${alert.source}

${alert.message}

Details:
- Metric: ${alert.metric_name}
- Current Value: ${alert.current_value}
- Threshold: ${alert.operator} ${alert.threshold}
- First Triggered: ${new Date(alert.first_triggered).toLocaleString()}

Action Required:
${this.getActionForAlert(alert, rule)}

View in dashboard:
https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/modules/monitoring

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LTE WISP Management Platform
Automated Alert System
    `.trim();
  }

  formatAlertHTML(alert, rule, tenantId) {
    const severityColors = {
      'critical': '#dc2626',
      'error': '#ef4444',
      'warning': '#f59e0b',
      'info': '#3b82f6'
    };

    const color = severityColors[alert.severity];

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: ${color};
      color: white;
      padding: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .header .severity {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(255,255,255,0.2);
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      margin-top: 8px;
    }
    .content {
      padding: 30px;
    }
    .alert-message {
      background: #f9fafb;
      border-left: 4px solid ${color};
      padding: 15px;
      margin: 20px 0;
      font-size: 16px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .details-table td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    .details-table td:first-child {
      font-weight: 600;
      color: #6b7280;
      width: 40%;
    }
    .action-box {
      background: #fef3c7;
      border: 1px solid #fbbf24;
      border-radius: 6px;
      padding: 15px;
      margin: 20px 0;
    }
    .action-box h3 {
      margin: 0 0 10px 0;
      color: #92400e;
    }
    .action-box p {
      margin: 0;
      color: #78350f;
    }
    .button {
      display: inline-block;
      background: ${color};
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin-top: 20px;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 Alert Triggered</h1>
      <span class="severity">${alert.severity.toUpperCase()}</span>
    </div>
    
    <div class="content">
      <h2>${alert.rule_name}</h2>
      
      <div class="alert-message">
        ${alert.message}
      </div>
      
      <table class="details-table">
        <tr>
          <td>Source Module</td>
          <td><strong>${alert.source.toUpperCase()}</strong></td>
        </tr>
        <tr>
          <td>Metric</td>
          <td>${alert.metric_name}</td>
        </tr>
        <tr>
          <td>Current Value</td>
          <td><strong>${alert.current_value}</strong></td>
        </tr>
        <tr>
          <td>Threshold</td>
          <td>${alert.operator} ${alert.threshold}</td>
        </tr>
        <tr>
          <td>First Triggered</td>
          <td>${new Date(alert.first_triggered).toLocaleString()}</td>
        </tr>
        <tr>
          <td>Alert ID</td>
          <td><code>${alert.alert_id}</code></td>
        </tr>
      </table>
      
      <div class="action-box">
        <h3>⚠️ Action Required</h3>
        <p>${this.getActionForAlert(alert, rule)}</p>
      </div>
      
      <a href="https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/modules/monitoring" class="button">
        View in Dashboard
      </a>
    </div>
    
    <div class="footer">
      LTE WISP Management Platform - Automated Alert System<br>
      Tenant: ${tenantId}<br>
      This is an automated message. Do not reply to this email.
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  formatResolutionHTML(alert, rule, tenantId, resolvedBy) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: #10b981;
      color: white;
      padding: 20px;
    }
    .content {
      padding: 30px;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Alert Resolved</h1>
    </div>
    
    <div class="content">
      <h2>${alert.rule_name}</h2>
      <p>This alert has been resolved.</p>
      
      <table style="width: 100%; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; font-weight: 600; color: #6b7280;">Resolved At</td>
          <td style="padding: 10px;">${new Date(alert.resolved_at).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: 600; color: #6b7280;">Resolved By</td>
          <td style="padding: 10px;">${resolvedBy}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: 600; color: #6b7280;">Duration</td>
          <td style="padding: 10px;">${this.formatDuration(alert.first_triggered, alert.resolved_at)}</td>
        </tr>
      </table>
      
      ${alert.notes ? `<p><strong>Notes:</strong> ${alert.notes}</p>` : ''}
    </div>
    
    <div class="footer">
      LTE WISP Management Platform<br>
      Tenant: ${tenantId}
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  formatResolutionText(alert, rule, resolvedBy) {
    return `
ALERT RESOLVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alert: ${alert.rule_name}
Status: RESOLVED

Resolved At: ${new Date(alert.resolved_at).toLocaleString()}
Resolved By: ${resolvedBy}
Duration: ${this.formatDuration(alert.first_triggered, alert.resolved_at)}

${alert.notes ? `Notes: ${alert.notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LTE WISP Management Platform
    `.trim();
  }

  formatDigestHTML(summary) {
    // TODO: Format daily digest HTML
    return '<html><body>Daily Digest</body></html>';
  }

  formatDigestText(summary) {
    // TODO: Format daily digest text
    return 'Daily Digest';
  }

  formatDuration(start, end) {
    const ms = new Date(end) - new Date(start);
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  getActionForAlert(alert, rule) {
    const actions = {
      'HSS Service Down': 'SSH to server and run: systemctl status open5gs-hssd. Check logs: journalctl -u open5gs-hssd -n 50',
      'High Authentication Failure Rate': 'Review subscriber credentials and check for SIM/IMSI mismatches. View failed auth logs in HSS.',
      'MME Disconnected': 'Check MME FreeDiameter configuration and network connectivity to 136.112.111.167:3868',
      'Subscriber Limit Reached': 'Consider upgrading server capacity or cleaning up inactive subscribers.',
      'GenieACS Service Down': 'Restart GenieACS services: systemctl restart genieacs-{cwmp,nbi,fs,ui}',
      'High CPE Fault Rate': 'Review fault logs in GenieACS and identify common issues across devices.',
      'CPE Offline Spike': 'Check for network outages or eNodeB issues affecting multiple sites.',
      'SAS Connection Lost': 'Verify CBRS API keys and check Google SAS API status.',
      'Grant Heartbeat Failures': 'Review CBRS grant status and ensure heartbeat intervals are correct.',
      'Low Available Spectrum': 'Review current grants and consider requesting additional spectrum.',
      'High API Error Rate': 'Check application logs: journalctl -u hss-api.service -n 100',
      'Slow API Response': 'Check database query performance and server load.',
      'High CPU Usage': 'Check top processes: ssh root@136.112.111.167 "top -bn1"',
      'High Memory Usage': 'Check memory usage: ssh root@136.112.111.167 "free -h"',
      'Low Disk Space': 'Clean up logs: find /var/log -name "*.log" -mtime +30 -delete',
      'MongoDB Connection Lost': 'Check MongoDB Atlas status and IP whitelist configuration.'
    };

    return actions[alert.rule_name] || 'Check the monitoring dashboard for more details and investigate the affected component.';
  }

  /**
   * Test email configuration
   */
  async sendTestEmail(to) {
    if (!this.enabled) {
      return { success: false, error: 'Email service not configured. Set SENDGRID_API_KEY environment variable.' };
    }

    try {
      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: '✅ Test Email - LTE WISP Alerts',
        text: 'This is a test email from the LTE WISP Management Platform alert system. If you received this, email notifications are working correctly!',
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>✅ Email Notification Test</h2>
              <p>This is a test email from the LTE WISP Management Platform alert system.</p>
              <p>If you received this, email notifications are <strong>working correctly!</strong></p>
              <hr>
              <p style="font-size: 12px; color: #666;">
                Sent at: ${new Date().toLocaleString()}<br>
                From: ${this.fromEmail}
              </p>
            </body>
          </html>
        `
      };

      await sgMail.send(msg);
      
      console.log(`✅ Test email sent to ${to}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error sending test email:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();

