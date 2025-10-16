# Email Alert Configuration Guide

Complete guide to setting up email notifications for the monitoring system.

---

## 📧 **Overview**

The monitoring system sends email notifications when alerts are triggered and resolved. 

**Key Features:**
- ✅ **Uses tenant email by default** - Alerts appear to come from your account
- ✅ **Custom sender option** - Set a custom "from" address if needed
- ✅ **Tenant branding** - Add your company logo and colors
- ✅ **Multi-recipient support** - Different emails for different severity levels
- ✅ **Beautiful HTML emails** - Professional templates with your branding
- ✅ **SendGrid integration** - Reliable email delivery

**How It Works:**
1. Platform uses a shared SendGrid account
2. Each tenant's alerts come from their own email address
3. Tenants can optionally configure custom branding and sender
4. No need for each tenant to have their own SendGrid account

---

## 🚀 **Quick Setup (SendGrid)**

### **Step 1: Create SendGrid Account**

1. Go to: https://sendgrid.com/
2. Sign up for free account (100 emails/day free tier)
3. Verify your email address

### **Step 2: Create API Key**

1. Login to SendGrid
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**
4. Name: `LTE-WISP-Alerts`
5. Permissions: **Full Access** (or just **Mail Send**)
6. Click **Create & View**
7. **Copy the API key** (you won't see it again!)

### **Step 3: Verify Sender Identity**

1. Go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Fill in your details:
   - **From Name:** `LTE WISP Alerts`
   - **From Email:** `alerts@4gengineer.com` (or your domain)
   - **Reply To:** Your support email
4. Click **Create**
5. Check your email and verify

### **Step 4: Add API Key to Server**

SSH to your server (`136.112.111.167`) and add the SendGrid API key:

```bash
# SSH to server
ssh root@136.112.111.167

# Add SendGrid API key to environment
cat >> /opt/hss-api/.env << 'EOF'

# SendGrid Configuration
SENDGRID_API_KEY=SG.your_actual_api_key_here
ALERT_FROM_EMAIL=alerts@4gengineer.com
ALERT_FROM_NAME=LTE WISP Alerts
EOF

# Install SendGrid npm package
cd /opt/hss-api
npm install @sendgrid/mail

# Restart API to load new environment variables
systemctl restart hss-api.service

# Verify service started
systemctl status hss-api.service
```

### **Step 5: Test Email Configuration**

```bash
# Test email sending
curl -X POST http://136.112.111.167:3000/monitoring/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'

# Should return:
# {"success": true, "message": "Test email sent to your-email@example.com"}

# Check your inbox for the test email
```

---

## 👤 **Tenant Email Configuration (Web UI)**

### **Default Behavior:**

By default, alerts are sent **from the tenant owner's email address**. For example:
- Tenant owner: `john@acme.com`
- Alerts appear from: `john@acme.com`
- Display name: `Acme Corp Alerts` (based on tenant name)

### **Configure via Web UI:**

1. **Go to Monitoring Module:**
   ```
   https://your-app.com/modules/monitoring
   ```

2. **Click "📧 Email Settings" tab**

3. **Configure Sender:**
   - ☑️ **Use my tenant email** (default) - Alerts from your account email
   - ☐ **Use custom email** - Set a different sender (e.g., `alerts@yourcompany.com`)

4. **Add Branding (Optional):**
   - Company Name: `Your Company Name`
   - Logo URL: `https://yoursite.com/logo.png`
   - Primary Color: Pick your brand color
   - Support Email: `support@yourcompany.com`
   - Support Phone: `+1-555-0123`

5. **Set Default Recipients:**
   - **Critical Alerts:** `ops@example.com, oncall@example.com`
   - **Error Alerts:** `ops@example.com`
   - **Warning Alerts:** `team@example.com`

6. **Test Configuration:**
   - Enter your email
   - Click "📧 Send Test"
   - Check your inbox

7. **Click "💾 Save Configuration"**

### **Result:**

Now when alerts trigger:
- ✉️ **From:** Your configured email or tenant email
- 📧 **To:** Recipients from alert rule or default recipients
- 🎨 **Branding:** Your logo, colors, and company name
- 📞 **Support:** Your support contact info in footer

---

## ⚙️ **Configuration Options**

### **Environment Variables**

Add to `/opt/hss-api/.env`:

```bash
# SendGrid API Key (required)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx

# From email address (must be verified in SendGrid)
ALERT_FROM_EMAIL=alerts@4gengineer.com

# From display name
ALERT_FROM_NAME=LTE WISP Alerts

# Optional: Default alert recipients
DEFAULT_ALERT_EMAILS=ops@example.com,admin@example.com
```

### **Per-Alert Email Configuration**

When creating alert rules, specify recipients:

```bash
curl -X POST http://136.112.111.167:3000/monitoring/alert-rules \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_001" \
  -d '{
    "name": "HSS Service Down",
    "source": "hss",
    "metric_name": "service_health",
    "operator": "eq",
    "threshold": 0,
    "severity": "critical",
    "duration_seconds": 60,
    "notifications": {
      "email": [
        "ops-team@example.com",
        "network-admin@example.com"
      ]
    }
  }'
```

---

## 📧 **Email Templates**

### **Alert Triggered Email**

**Subject:** `🔴 [CRITICAL] HSS Service Down`

**Body:**
```
ALERT TRIGGERED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alert: HSS Service Down
Severity: CRITICAL
Source: hss

service_health is 0 (equal to threshold of 0)

Details:
- Metric: service_health
- Current Value: 0
- Threshold: eq 0
- First Triggered: 10/16/2025, 5:30:00 PM

Action Required:
SSH to server and run: systemctl status open5gs-hssd
Check logs: journalctl -u open5gs-hssd -n 50

[View in Dashboard Button]
```

### **Alert Resolved Email**

**Subject:** `[RESOLVED] HSS Service Down`

**Body:**
```
ALERT RESOLVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alert: HSS Service Down
Status: RESOLVED

Resolved At: 10/16/2025, 5:35:00 PM
Resolved By: admin@example.com
Duration: 5m
```

---

## 🧪 **Testing Email Notifications**

### **1. Test Email Service**

```bash
# Via API
curl -X POST http://136.112.111.167:3000/monitoring/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'

# Via Web UI
# Go to: /modules/monitoring → Settings → Test Email
```

### **2. Create Test Alert Rule**

```bash
# Create a rule that will immediately trigger
curl -X POST http://136.112.111.167:3000/monitoring/alert-rules \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -d '{
    "name": "Test Email Alert",
    "source": "hss",
    "metric_name": "active_subscribers",
    "operator": "gte",
    "threshold": 0,
    "severity": "info",
    "duration_seconds": 0,
    "notifications": {
      "email": ["your-email@example.com"]
    },
    "cooldown_minutes": 1
  }'

# Wait 60 seconds for monitoring loop to evaluate
# Check your email!
```

### **3. Verify Email Received**

Check for:
- ✅ Subject line with severity emoji
- ✅ Proper formatting
- ✅ Alert details
- ✅ Action recommendations
- ✅ "View in Dashboard" link

### **4. Clean Up Test**

```bash
# Delete the test alert rule
curl -X DELETE http://136.112.111.167:3000/monitoring/alert-rules/RULE_ID \
  -H "x-tenant-id: YOUR_TENANT_ID"
```

---

## 🔧 **Alternative Email Providers**

### **Option 2: Google Gmail SMTP (For Testing)**

```javascript
// In email-service.js, replace SendGrid with Nodemailer + Gmail

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: 'your-gmail@gmail.com',
    pass: 'your-app-password'  // Not your real password! Use App Password
  }
});

// Send email
await transporter.sendMail({
  from: '"LTE WISP Alerts" <your-gmail@gmail.com>',
  to: to,
  subject: subject,
  text: text,
  html: html
});
```

**Note:** Gmail limits to 500 emails/day. Not recommended for production.

### **Option 3: AWS SES (For High Volume)**

```javascript
// Install AWS SDK
npm install @aws-sdk/client-ses

// In email-service.js
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sesClient = new SESClient({ 
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Send email
const command = new SendEmailCommand({
  Source: 'alerts@4gengineer.com',
  Destination: { ToAddresses: [to] },
  Message: {
    Subject: { Data: subject },
    Body: {
      Text: { Data: text },
      Html: { Data: html }
    }
  }
});

await sesClient.send(command);
```

---

## 📊 **Email Usage Limits**

### **SendGrid Free Tier:**
- **100 emails/day** permanently free
- Good for: Testing, small deployments
- Upgrade: $19.95/month for 40,000 emails

### **Recommended Settings:**

```javascript
// Alert rule cooldown to prevent email spam
{
  "cooldown_minutes": 15  // Min 15 minutes between same alert emails
}

// Only email for critical/error severity
{
  "severity": "critical",  // or "error"
  "notifications": {
    "email": ["ops@example.com"]
  }
}

// Use webhooks for warnings
{
  "severity": "warning",
  "notifications": {
    "webhook": "https://hooks.slack.com/..."  // Slack instead of email
  }
}
```

---

## 🔔 **Notification Best Practices**

### **1. Severity-Based Recipients**

```javascript
// Critical alerts → Multiple recipients + SMS
{
  "severity": "critical",
  "notifications": {
    "email": ["ops@example.com", "cto@example.com", "oncall@example.com"]
  }
}

// Warnings → Single team email
{
  "severity": "warning",
  "notifications": {
    "email": ["ops-team@example.com"]
  }
}
```

### **2. Use Distribution Lists**

Instead of:
```javascript
"email": ["admin1@example.com", "admin2@example.com", "admin3@example.com"]
```

Create a distribution list and use:
```javascript
"email": ["ops-team@example.com"]
```

### **3. Combine Email + Webhook**

```javascript
"notifications": {
  "email": ["critical-alerts@example.com"],  // For critical issues
  "webhook": "https://hooks.slack.com/..."   // For team chat
}
```

---

## 🚨 **Troubleshooting**

### **Emails Not Sending:**

```bash
# Check SendGrid API key is set
ssh root@136.112.111.167 "cat /opt/hss-api/.env | grep SENDGRID"

# Check email service status
curl http://136.112.111.167:3000/monitoring/email-config

# Should show: "enabled": true

# Check API logs for email errors
ssh root@136.112.111.167 "journalctl -u hss-api.service -n 100 | grep -i email"
```

### **SendGrid API Key Invalid:**

```bash
# Verify API key works
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "personalizations": [{"to": [{"email": "test@example.com"}]}],
    "from": {"email": "alerts@4gengineer.com"},
    "subject": "Test",
    "content": [{"type": "text/plain", "value": "Test"}]
  }'

# Should return 202 Accepted
```

### **Sender Not Verified:**

```bash
# Check SendGrid dashboard → Sender Authentication
# Verify the sender email address
# Wait for verification email and click link
```

### **Emails Going to Spam:**

1. **Set up SPF record** for your domain:
   ```
   v=spf1 include:sendgrid.net ~all
   ```

2. **Set up DKIM** in SendGrid:
   - Settings → Sender Authentication → Domain Authentication
   - Add your domain (4gengineer.com)
   - Follow DNS setup instructions

3. **Set up DMARC** record:
   ```
   v=DMARC1; p=none; rua=mailto:dmarc@4gengineer.com
   ```

---

## 📈 **Email Monitoring**

### **Track Email Delivery**

```bash
# View email statistics in SendGrid Dashboard
# Stats → Overview

# Check delivery rate
# Check bounce rate
# Check spam reports
```

### **Monitor via API**

```bash
# Get email stats from SendGrid
curl -X GET https://api.sendgrid.com/v3/stats \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 🎯 **Production Checklist**

Before going live with email alerts:

- [ ] SendGrid account created
- [ ] API key generated and added to server
- [ ] Sender identity verified
- [ ] Test email sent successfully
- [ ] SPF/DKIM configured (optional but recommended)
- [ ] Alert rules configured with appropriate email recipients
- [ ] Cooldown periods set to prevent spam
- [ ] Distribution lists created for teams
- [ ] Email templates reviewed
- [ ] Spam/bounce monitoring configured

---

## 💰 **Cost Estimates**

### **SendGrid:**
- **Free:** 100 emails/day (good for small deployments)
- **Essentials:** $19.95/month - 40,000 emails
- **Pro:** $89.95/month - 120,000 emails

### **AWS SES:**
- **Free tier:** 62,000 emails/month (if hosted on AWS EC2)
- **After free tier:** $0.10 per 1,000 emails

### **Estimated Usage:**

For a deployment with:
- 10 alert rules
- 2 alerts/day average
- 3 recipients per alert
- 30 days

**Total:** ~180 emails/month (well within free tier)

---

## 📧 **Email Examples**

### **Critical Alert:**

```
From: LTE WISP Alerts <alerts@4gengineer.com>
To: ops@example.com
Subject: 🔴 [CRITICAL] HSS Service Down

[Formatted HTML email with red header, alert details, and action button]
```

### **Warning Alert:**

```
From: LTE WISP Alerts <alerts@4gengineer.com>
To: ops@example.com
Subject: 🟡 [WARNING] High Authentication Failure Rate

[Formatted HTML email with yellow header, alert details]
```

### **Resolution:**

```
From: LTE WISP Alerts <alerts@4gengineer.com>
To: ops@example.com
Subject: [RESOLVED] HSS Service Down

[Formatted HTML email with green header, resolution details]
```

---

## 🔐 **Security**

### **Protect API Key:**

```bash
# Never commit API key to git
# Store in .env file (already in .gitignore)

# Rotate API key every 90 days
# Create new key in SendGrid
# Update server .env
# Delete old key

# Use Google Secret Manager (recommended for production)
gcloud secrets create sendgrid-api-key \
  --data-file=- <<< "SG.your_api_key_here"

# Grant access to service account
gcloud secrets add-iam-policy-binding sendgrid-api-key \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 📞 **Support**

### **SendGrid Issues:**
- **Documentation:** https://docs.sendgrid.com/
- **Support:** https://support.sendgrid.com/
- **Status:** https://status.sendgrid.com/

### **Common Issues:**

**API Key Invalid:**
- Regenerate key in SendGrid dashboard
- Ensure no extra spaces when copying

**Sender Not Verified:**
- Check verification email
- Re-send verification if needed

**Rate Limited:**
- Upgrade SendGrid plan
- Reduce alert frequency
- Use cooldown periods

---

## 🎯 **Next Steps**

After configuring emails:

1. ✅ Test email configuration
2. ✅ Configure alert rules with email recipients
3. ✅ Set appropriate cooldown periods
4. ✅ Test triggering an alert
5. ✅ Verify email received
6. ✅ Test alert resolution email
7. ✅ Document on-call procedures
8. ✅ Set up email forwarding rules if needed

---

**Email alerts are now ready for production use!** 📧

For webhook/Slack notifications, see [MONITORING_AND_ALERTING.md](./MONITORING_AND_ALERTING.md)

**Last Updated:** October 16, 2025

