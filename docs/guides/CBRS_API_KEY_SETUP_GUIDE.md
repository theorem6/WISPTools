# CBRS API Key Setup Guide

## Overview

This guide walks you through obtaining API keys for both **Google SAS** and **Federated Wireless** to use with the CBRS Management module.

## 🔵 Google SAS API Key Setup

### Prerequisites
- Google Cloud Platform account
- Valid payment method
- Organization registered with FCC for CBRS use

### Step-by-Step Instructions

#### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** at the top
3. Click **"New Project"**
4. Enter project details:
   - **Project Name**: "Your Company - CBRS SAS"
   - **Organization**: Select your organization
   - **Location**: Your organization folder
5. Click **"Create"**

#### 2. Enable Google SAS API

1. In the Google Cloud Console, go to **"APIs & Services"** > **"Library"**
2. Search for **"Spectrum Access System"** or **"Google SAS"**
3. Click on **"Google Spectrum Access System API"**
4. Click **"Enable"**

**Note**: If Google SAS API is not visible:
- Google SAS is a restricted/partner API
- You may need to contact Google Cloud Sales
- Or apply for access through the [Google SAS Program](https://cloud.google.com/spectrum-access-system)

#### 3. Create API Credentials

##### Option A: API Key (Simpler)

1. Go to **"APIs & Services"** > **"Credentials"**
2. Click **"Create Credentials"**
3. Select **"API key"**
4. Your API key will be generated
5. **IMPORTANT**: Click **"Restrict Key"** immediately

**Restrict Your API Key**:
- Name: "CBRS SAS Production Key"
- **API restrictions**: 
  - Select "Restrict key"
  - Choose "Google Spectrum Access System API"
- **Application restrictions**:
  - Select "IP addresses"
  - Add your server's IP addresses
- Click **"Save"**

##### Option B: OAuth 2.0 Client (More Secure)

1. Go to **"APIs & Services"** > **"Credentials"**
2. Click **"Create Credentials"**
3. Select **"OAuth client ID"**
4. Choose **"Web application"**
5. Configure:
   - **Name**: "CBRS SAS Client"
   - **Authorized redirect URIs**: Your application URLs
6. Click **"Create"**
7. Download the JSON file with client ID and secret

#### 4. Get Your Google SAS User ID

Your **User ID** is typically:
- Your FCC Registration Number (FRN), OR
- A unique identifier registered with Google SAS

**To register**:
1. Contact Google Cloud Sales or SAS Support
2. Complete Google SAS onboarding
3. Receive your official User ID
4. This User ID represents your organization in the SAS system

**Format**: Usually alphanumeric (e.g., "ACME-WIRELESS-001", "FRN-0123456789")

#### 5. Configure in Platform

**For Platform Admin (Shared Mode)**:
1. Go to Tenant Management > CBRS Platform Keys
2. Enter:
   - **API Endpoint**: `https://sas.googleapis.com/v1`
   - **API Key**: Your restricted API key
3. Save

**For Individual Tenant**:
1. Go to CBRS Management > Settings
2. Select deployment model
3. Enter your **Google User ID**
4. If per-tenant mode, also enter your API key
5. Save

---

## 🟢 Federated Wireless API Key Setup

### Prerequisites
- Valid business or organization
- Location in FCC-regulated spectrum
- Equipment certification (FCC IDs for devices)

### Step-by-Step Instructions

#### 1. Create Federated Wireless Account

1. Go to [Federated Wireless](https://www.federatedwireless.com/)
2. Click **"Contact Us"** or **"Get Started"**
3. Fill out the contact form:
   - Company name
   - Contact information
   - Intended use case
   - Number of CBSDs (devices)
   - Geographic locations
4. Sales team will contact you

**What to Expect**:
- Initial consultation call
- Technical requirements discussion
- Pricing proposal
- Contract negotiation
- Account setup

#### 2. Onboarding Process

Once you sign up:

1. **Account Creation**:
   - Federated Wireless creates your account
   - You receive login credentials
   - Access to Federated Wireless Portal

2. **Portal Access**:
   - Login URL: [https://portal.federatedwireless.com/](https://portal.federatedwireless.com/)
   - Or enterprise-specific portal URL
   - Username and password provided by FW

3. **Customer ID Assignment**:
   - Federated Wireless assigns your **Customer ID**
   - Format: `company-name-###` or `CUSTOMER-######`
   - This is your unique identifier in their system

#### 3. Generate API Credentials

**In the Federated Wireless Portal**:

1. Navigate to **"API Access"** or **"Developer"** section
2. Click **"Generate API Key"** or **"Create Credentials"**
3. Configure key settings:
   - **Name**: "Production CBRS Management"
   - **Permissions**: Full SAS access
   - **IP Restrictions**: (Optional) Your server IPs
4. Click **"Generate"**
5. **Copy the API key immediately** (shown only once!)
6. Store securely

**API Key Format**: Usually a long alphanumeric string
```
Example: fw_live_abc123def456ghi789jkl012mno345pqr678stu901vwx
```

#### 4. Get Your Customer ID

Your **Customer ID** should be provided by Federated Wireless during onboarding.

**Where to Find It**:
- Federated Wireless Portal (Account Settings)
- Welcome email from Federated Wireless
- Contract/agreement documentation
- Contact your account manager

**Format Examples**:
- `ACME-WIRELESS`
- `CUSTOMER-001234`
- `ORG-ACME-001`

#### 5. Configure in Platform

**For Platform Admin (Shared Mode)**:
1. Go to Tenant Management > CBRS Platform Keys
2. Enter:
   - **API Endpoint**: `https://sas.federatedwireless.com/api/v1`
   - **API Key**: Your API key from portal
3. Save

**For Individual Tenant**:
1. Go to CBRS Management > Settings
2. Select deployment model
3. Enter your **Customer ID**
4. If per-tenant mode, also enter your API key
5. Save

---

## 🚀 Quick Start for Development/Testing

### For Testing Without Real SAS Accounts

If you want to test the module without real SAS credentials:

#### Option 1: Use Demo/Test Credentials

```
Google SAS Test:
- API Key: "test-google-sas-key-demo-only"
- User ID: "test-user-001"
- Endpoint: "https://sas.googleapis.com/v1"

Federated Wireless Test:
- API Key: "test-fw-key-demo-only"
- Customer ID: "test-customer-001"
- Endpoint: "https://sas.federatedwireless.com/api/v1"
```

**Note**: These will not work with real SAS providers but allow you to test the UI and configuration flow.

#### Option 2: Contact Providers for Sandbox Access

**Google SAS**:
- Email: cloud-sales@google.com
- Request sandbox/test environment access
- Mention you're developing CBRS management software

**Federated Wireless**:
- Email: sales@federatedwireless.com
- Request developer/sandbox account
- They may provide test credentials

---

## 💰 Cost Information

### Google SAS Pricing

**Typical Pricing** (varies by contract):
- Base subscription: ~$500-1,000/month
- Device registrations: May be included or per-device
- API calls: Usually unlimited within subscription
- Support: Included or tiered

**Contact for Pricing**:
- Google Cloud Sales: cloud-sales@google.com
- Google SAS Team: Spectrum Access System division

### Federated Wireless Pricing

**Typical Pricing** (varies by deployment):
- Monthly subscription: $500-2,000/month
- Per-device fees: Some plans charge per CBSD
- Enhanced features: Analytics and optimization may cost extra
- Support tiers: Basic, Premium, Enterprise

**Contact for Pricing**:
- Federated Wireless Sales: sales@federatedwireless.com
- Phone: Check their website for current number

### Cost-Saving Tips

1. **Negotiate Volume Discounts**:
   - Multiple sites
   - Higher device counts
   - Multi-year contracts

2. **Start with One Provider**:
   - Begin with Google or Federated Wireless
   - Expand to both later if needed

3. **Use Shared Platform Mode**:
   - One subscription serves all tenants
   - 95% cost reduction vs per-tenant

---

## 🔐 Security Best Practices

### Storing API Keys

**DO**:
- ✅ Store in environment variables
- ✅ Use Firebase Secret Manager
- ✅ Encrypt at rest
- ✅ Restrict to backend only
- ✅ Use IP restrictions
- ✅ Set expiration dates
- ✅ Monitor usage logs

**DON'T**:
- ❌ Commit to version control
- ❌ Expose in client-side code
- ❌ Share via email/chat
- ❌ Use same key for dev and prod
- ❌ Grant excessive permissions

### API Key Restrictions

**Google Cloud API Key Restrictions**:
```
Restriction Type: API restrictions
- Restrict to: Google Spectrum Access System API only

Application restrictions:
- IP addresses: Your server IPs
OR
- HTTP referrers: Your domain(s)

Set expiration: 90 days (rotate regularly)
```

### Environment Variables

**For Platform Configuration** (Firebase Functions):
```bash
# .env or Firebase environment config
GOOGLE_SAS_API_KEY=your-google-api-key-here
GOOGLE_SAS_API_ENDPOINT=https://sas.googleapis.com/v1
FEDERATED_WIRELESS_API_KEY=your-fw-api-key-here
FEDERATED_WIRELESS_API_ENDPOINT=https://sas.federatedwireless.com/api/v1
```

**Set in Firebase**:
```bash
firebase functions:config:set \
  cbrs.google_api_key="your-key" \
  cbrs.federated_api_key="your-key"
```

---

## 📝 Registration Checklist

### Before Contacting Providers

Have this information ready:

#### Business Information
- [ ] Company legal name
- [ ] Business address
- [ ] EIN or Tax ID
- [ ] Business license
- [ ] Contact person details

#### Technical Information
- [ ] Number of CBSDs (devices)
- [ ] Device manufacturers/models
- [ ] FCC IDs for all equipment
- [ ] Geographic deployment areas
- [ ] Expected spectrum usage

#### Use Case Information
- [ ] Service type (Fixed wireless, mobile, etc.)
- [ ] Coverage area size
- [ ] Number of end users
- [ ] Indoor vs outdoor deployment
- [ ] Category A vs Category B devices

### Google SAS Registration

**Required Documents**:
- FCC Form 601 (if applicable)
- Equipment certifications (FCC IDs)
- Installation location details
- Professional installer certification

**Process**:
1. Submit application
2. Technical review (1-2 weeks)
3. Contract execution
4. Account provisioning
5. API access granted
6. User ID assigned

### Federated Wireless Registration

**Required Documents**:
- Business registration
- Equipment list with FCC IDs
- Site survey data
- Deployment plans

**Process**:
1. Initial consultation
2. Proposal and pricing
3. Contract signing
4. Account creation
5. Portal access
6. Customer ID assigned
7. API key generation

---

## 🆘 Troubleshooting

### "API Key Not Working"

**Check**:
1. Key is active and not expired
2. API is enabled in Google Cloud Console
3. Restrictions don't block your requests
4. Billing is enabled on project
5. Correct endpoint URL
6. Proper authentication headers

### "Access Denied" Errors

**Possible Causes**:
- API key doesn't have SAS API permission
- User ID not registered with provider
- Billing account suspended
- Exceeded rate limits
- IP address not whitelisted

**Solutions**:
- Verify API restrictions in Google Cloud Console
- Check User ID with SAS provider
- Review billing status
- Contact provider support

### "User ID Invalid"

**Check**:
- User ID matches what was registered
- No typos or extra spaces
- Correct format (some use all caps, some don't)
- User ID is active and approved

**Get Help**:
- Google SAS: Check Cloud Console or contact support
- Federated Wireless: Check portal or contact account manager

---

## 📞 Contact Information

### Google SAS Support

**Sales**:
- Email: cloud-sales@google.com
- Website: https://cloud.google.com/spectrum-access-system

**Technical Support**:
- Google Cloud Console: Support tab
- Documentation: https://cloud.google.com/sas/docs
- Phone: Check Google Cloud Console for regional support numbers

**Partner Program**:
- For CBRS manufacturers and service providers
- Enhanced support and resources

### Federated Wireless Support

**Sales**:
- Website: https://www.federatedwireless.com/
- Contact form on website
- Phone: Check website for current number

**Technical Support**:
- Email: support@federatedwireless.com
- Portal: https://portal.federatedwireless.com/
- Documentation: In portal after login

**Account Management**:
- Assigned account manager after signup
- Dedicated support for enterprise customers

---

## 🎯 Quick Start Checklist

### For Platform Admin (Shared Mode)

- [ ] Create Google Cloud project
- [ ] Enable Google SAS API
- [ ] Generate and restrict API key
- [ ] Sign up with Federated Wireless
- [ ] Get Federated API key from portal
- [ ] Go to Tenant Management > CBRS Platform Keys
- [ ] Enter both API keys
- [ ] Save platform configuration
- [ ] Test with a tenant

### For Tenant (Shared Mode)

- [ ] Get your Google User ID from platform admin
- [ ] Get your Federated Customer ID from platform admin
- [ ] Go to CBRS Management module
- [ ] Click Settings
- [ ] Select "Shared Platform"
- [ ] Enter your User ID
- [ ] Enter your Customer ID
- [ ] Save
- [ ] Start using the module!

### For Enterprise Tenant (Per-Tenant Mode)

- [ ] Create your own Google Cloud project
- [ ] Enable Google SAS API
- [ ] Generate your API key
- [ ] Sign up with Federated Wireless
- [ ] Get your API key and Customer ID
- [ ] Go to CBRS Management module
- [ ] Click Settings
- [ ] Select "Private Credentials"
- [ ] Enter all your credentials
- [ ] Save
- [ ] Start using the module!

---

## 💡 Recommended Approach

### Phase 1: Get Started (Week 1)

**Quick Start**:
1. Contact Google Cloud Sales
2. Contact Federated Wireless Sales
3. Request trial/sandbox accounts
4. Get test API keys

**Goal**: Test the module with sandbox credentials

### Phase 2: Production Setup (Week 2-4)

**Full Registration**:
1. Complete Google SAS registration
2. Complete Federated Wireless registration
3. Obtain production API keys
4. Configure platform keys
5. Onboard first tenants

**Goal**: Production-ready deployment

### Phase 3: Scale (Ongoing)

**Growth**:
1. Add tenants in shared mode
2. Offer enterprise tier for per-tenant keys
3. Monitor API usage and costs
4. Optimize based on needs

---

## 🔍 Verification Steps

### Verify Google SAS API Key

```bash
# Test API call (using curl)
curl -X GET \
  "https://sas.googleapis.com/v1/health?key=YOUR_API_KEY" \
  -H "Content-Type: application/json"

# Expected: 200 OK response
```

### Verify Federated Wireless API Key

```bash
# Test API call
curl -X GET \
  "https://sas.federatedwireless.com/api/v1/status" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"

# Expected: 200 OK with status information
```

### Verify in Module

1. Open CBRS Management module
2. Click Settings
3. Enter credentials
4. Click **"🧪 Test Connection"**
5. Should show: ✓ Configuration valid

---

## 📊 Comparison: Google SAS vs Federated Wireless

| Feature | Google SAS | Federated Wireless |
|---------|------------|-------------------|
| **Ease of Setup** | ⭐⭐⭐⭐ (Google Cloud account) | ⭐⭐⭐ (Sales process) |
| **Cost** | $$$ | $$$-$$$$ |
| **API Quality** | Excellent | Excellent |
| **Documentation** | Extensive | Good |
| **Support** | Google Cloud Support | Dedicated account manager |
| **Enhanced Features** | Standard | Analytics, optimization |
| **Multi-site** | Standard | Advanced coordination |
| **Best For** | Standard deployments | Enterprise, analytics needs |

### Which Provider to Choose?

**Choose Google SAS if**:
- You already use Google Cloud Platform
- You want simple, standards-compliant SAS
- You prefer self-service setup
- Cost is primary concern

**Choose Federated Wireless if**:
- You need advanced analytics
- You want multi-site optimization
- You prefer white-glove support
- You need interference monitoring

**Choose Both if**:
- Maximum redundancy needed
- Geographic coverage optimization
- A/B testing different providers
- Enterprise requirements

---

## 🎓 Learning Resources

### General CBRS Information
- [FCC CBRS Overview](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/35-ghz-band/35-ghz-band-overview)
- [WinnForum Specifications](https://www.wirelessinnovation.org/cbrs)
- [CBRS Alliance](https://www.cbrsalliance.org/)

### Google SAS Resources
- [Google SAS Documentation](https://cloud.google.com/spectrum-access-system/docs)
- [API Reference](https://cloud.google.com/sas/docs/reference)
- [Best Practices Guide](https://cloud.google.com/sas/docs/best-practices)

### Federated Wireless Resources
- [Federated Wireless Documentation](https://www.federatedwireless.com/resources)
- Portal documentation (after login)
- Knowledge base in customer portal

---

## ⚡ Alternative: Start with Test Mode

### Test Mode Configuration

While waiting for real API keys, you can test the module:

**Platform Configuration**:
```
Google SAS Test:
- Endpoint: https://sas.googleapis.com/v1
- API Key: test-google-sas-demo-key
- User ID: test-user-001

Federated Wireless Test:
- Endpoint: https://sas.federatedwireless.com/api/v1
- API Key: test-fw-demo-key
- Customer ID: test-customer-001
```

**What Works**:
- ✅ Configuration UI
- ✅ Settings saving/loading
- ✅ Deployment model selection
- ✅ Form validation
- ✅ Device management UI
- ✅ Map visualization

**What Doesn't Work**:
- ❌ Actual SAS registration
- ❌ Real grant requests
- ❌ Live heartbeat
- ❌ Production spectrum allocation

---

## 📋 Summary

### To Get Started Quickly:

1. **Contact Both Providers** (parallel):
   - Google Cloud Sales for Google SAS
   - Federated Wireless sales team

2. **Request**:
   - Sandbox/test access initially
   - Production access for go-live
   - API documentation

3. **Configure**:
   - Platform admin sets up shared keys, OR
   - Each tenant sets up their own keys

4. **Deploy**:
   - Configure in module
   - Test with demo devices
   - Go live with real equipment

### Timeline Estimate:

- **Google SAS**: 1-2 weeks (if Google Cloud customer)
- **Federated Wireless**: 2-4 weeks (includes sales process)
- **Total**: Plan for 1 month to have everything ready

### Fastest Path to Production:

1. **Day 1**: Contact both providers
2. **Week 1**: Receive sandbox credentials
3. **Week 2**: Test module with sandbox
4. **Week 3**: Production credentials arrive
5. **Week 4**: Configure platform, onboard tenants
6. **Go Live**: Full production deployment

---

## 🎯 Next Steps

1. **Decide on Provider**: Google SAS, Federated Wireless, or both
2. **Contact Sales**: Reach out for account setup
3. **Plan Deployment Model**: Shared platform or per-tenant
4. **Get Credentials**: Obtain API keys and IDs
5. **Configure Platform**: Set up in module
6. **Test**: Verify with test devices
7. **Deploy**: Onboard tenants and go live!

---

**Need Help?** 
- Google SAS: cloud-sales@google.com
- Federated Wireless: sales@federatedwireless.com
- Module Support: Check inline documentation

**Ready to Configure?**
- Platform Admin: Tenant Management > CBRS Platform Keys
- Tenant User: CBRS Management > Settings

---

**Document Version**: 1.0  
**Last Updated**: October 12, 2025  
**Status**: Complete Guide

