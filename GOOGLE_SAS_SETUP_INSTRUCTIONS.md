# Google SAS Setup Instructions

## Current Situation

You have a **Google Cloud OAuth Client** for your Firebase hosting:
- **Client ID**: `1044782186913-7ukvo096g0r9oal2lg2tehiunae49ceq.apps.googleusercontent.com`
- **Client Secret**: `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`
- **Project**: `lte-pci-mapper-65450042-bbf71`
- **Project Number**: `1044782186913`

This is for **App Hosting/Firebase Authentication**, NOT for Google SAS (Spectrum Access System).

## What You Need for CBRS Module

To use Google SAS for CBRS spectrum management, you need **separate API access** to the Google Spectrum Access System.

## Option 1: Contact Google SAS Sales (Recommended for Production)

### Why Contact Them?

Google SAS (Spectrum Access System) is a **specialized FCC-regulated service** for CBRS spectrum management. It's not a standard Google Cloud API.

### How to Contact:

**Email**: cloud-sales@google.com

**Subject**: "Request for Google Spectrum Access System (SAS) API Access"

**Email Template**:
```
Hello Google Cloud Sales Team,

I am developing a CBRS network management platform and would like to 
integrate with Google's Spectrum Access System (SAS) for 3.5 GHz 
spectrum coordination.

Current Setup:
- Google Cloud Project: lte-pci-mapper-65450042-bbf71
- Project Number: 1044782186913
- Use Case: Multi-tenant CBRS device management platform

I need:
1. Access to Google SAS API
2. API credentials (key or service account)
3. Information on User ID registration
4. Pricing for our deployment

Could you please connect me with the Google SAS team or provide 
next steps for getting API access?

Thank you!
```

### What They'll Provide:

1. **API Access Instructions**
2. **API Key or Service Account credentials**
3. **User ID registration process**
4. **Pricing information**
5. **Technical documentation**
6. **Support contact**

### Timeline: 1-2 weeks

## Option 2: Use Your Existing Project (If SAS API is Available)

If Google SAS API is publicly available in your region:

### Steps:

1. **Go to Google Cloud Console**
   - https://console.cloud.google.com/
   - Select project: `lte-pci-mapper-65450042-bbf71`

2. **Check API Library**
   - Go to "APIs & Services" > "Library"
   - Search: "Spectrum Access System"
   - If available, click "Enable"

3. **Create API Key**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API key"
   - Copy the key immediately

4. **Restrict the Key**
   - Name: "Google SAS API Key"
   - API restrictions: Select "Google Spectrum Access System API"
   - (Optional) IP restrictions: Add your server IPs
   - Save

5. **Configure in Your Platform**
   - Go to: Tenant Management > CBRS Platform Keys
   - Enter the API key
   - Save

## Option 3: Development/Testing Mode (Temporary)

While waiting for real Google SAS access, you can configure the module to work with the UI:

### For Testing Only:

**Platform Configuration** (Tenant Management > CBRS Platform Keys):
```
Google SAS:
- API Endpoint: https://sas.googleapis.com/v1
- API Key: development-test-key-not-for-production
```

**Tenant Configuration** (CBRS Management > Settings):
```
Deployment Model: Shared Platform
Google User ID: test-tenant-001
```

**What This Enables**:
- ✅ Module UI works completely
- ✅ Configuration flows work
- ✅ Device management UI functional
- ✅ Map visualization works
- ❌ Actual SAS API calls will fail (expected)

## Current Configuration in Your Project

I've already configured your `apphosting.yaml` with:

```yaml
env:
  # Google SAS Platform Configuration
  - variable: GOOGLE_SAS_CLIENT_ID
    value: 1044782186913-7ukvo096g0r9oal2lg2tehiunae49ceq.apps.googleusercontent.com
    availability:
      - RUNTIME
  
  - variable: GOOGLE_SAS_CLIENT_SECRET
    secret: google-sas-client-secret
  
  - variable: GOOGLE_SAS_API_ENDPOINT
    value: https://sas.googleapis.com/v1
    availability:
      - RUNTIME
```

**Note**: This OAuth client can be used IF Google SAS supports OAuth authentication. You may need a simple API key instead.

## Recommended Action Plan

### Immediate (Today):

1. **Email Google Cloud Sales** (see template above)
2. **Request Google SAS API access**
3. **Ask about API authentication methods** (API key vs OAuth)

### This Week:

1. **Wait for Google SAS response**
2. **Meanwhile, configure module in test mode**
3. **Test UI and configuration flows**
4. **Prepare device data**

### Week 2-3:

1. **Receive Google SAS credentials**
2. **Configure in platform**
3. **Test with real SAS API**
4. **Onboard first tenant**

## Alternative: Start with Federated Wireless Only

If Google SAS takes too long:

1. **Focus on Federated Wireless first**
   - Contact: sales@federatedwireless.com
   - Usually faster onboarding
   - Good analytics features

2. **Configure Module**:
   - Provider: "Federated Wireless" only
   - Skip Google SAS for now
   - Add Google later when ready

## Summary

**Your Current OAuth Client**: Used for Firebase/App Hosting ✅  
**What You Need**: Separate Google SAS API access  
**Action**: Contact cloud-sales@google.com  
**Alternative**: Start with Federated Wireless only  
**Timeline**: 1-2 weeks for real SAS access  

I can help you with any of these steps! Let me know how you'd like to proceed.

---

**Important**: The OAuth Client ID you provided is perfect for your Firebase hosting, but Google SAS requires **additional specialized API access**. Contact Google to enable it on your project.

