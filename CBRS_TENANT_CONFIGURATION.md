# CBRS Module - Per-Tenant Configuration

## Overview

The CBRS Management module uses **per-tenant configuration** where each tenant manages their own SAS API credentials directly in the CBRS module settings.

## How It Works

### Each Tenant Configures Their Own Keys

**Location**: CBRS Management Module > ⚙️ Settings

**What Each Tenant Provides**:
1. **Deployment Model**: Per-Tenant (default)
2. **SAS Provider**: Google SAS, Federated Wireless, or Both
3. **Their Own Credentials**:
   - Google User ID
   - Google API Key
   - Federated Customer ID  
   - Federated API Key

### Per-Tenant Storage

**Firestore Collection**: `cbrs_config`  
**Document ID**: `{tenantId}`

**Example**:
```
cbrs_config/
├── tenant-001/
│   ├── deploymentModel: "per-tenant"
│   ├── provider: "google"
│   ├── googleUserId: "acme-wireless-001"
│   ├── googleApiKey: "tenant-001-private-key"
│   └── ...
│
├── tenant-002/
│   ├── deploymentModel: "per-tenant"
│   ├── provider: "federated-wireless"
│   ├── federatedCustomerId: "enterprise-corp"
│   ├── federatedApiKey: "tenant-002-private-key"
│   └── ...
```

## Tenant Setup Process

### Step 1: Tenant Obtains SAS Credentials

**For Google SAS**:
1. Contact Google Cloud Sales: cloud-sales@google.com
2. Register for Google SAS access
3. Receive:
   - API Key or OAuth credentials
   - User ID for your organization

**For Federated Wireless**:
1. Contact Federated Wireless Sales: sales@federatedwireless.com
2. Complete registration
3. Receive:
   - API Key from portal
   - Customer ID for your organization

### Step 2: Tenant Configures in CBRS Module

1. **Open CBRS Management** module
2. **Click "⚙️ Settings"** in the header
3. **Deployment Model**: "Private Credentials" (pre-selected)
4. **Select Provider**: Google SAS or Federated Wireless
5. **Enter Credentials**:

**For Google SAS**:
```
Google User ID: your-company-name
API Endpoint: https://sas.googleapis.com/v1
API Key: your-google-sas-api-key
```

**For Federated Wireless**:
```
Customer ID: your-customer-id
API Endpoint: https://sas.federatedwireless.com/api/v1
API Key: your-federated-wireless-api-key
```

6. **Optional**: Enable enhanced features
7. **Click "💾 Save Settings"**
8. **Done!** CBRS module is ready to use

### Step 3: Start Using CBRS Module

After configuration:
- ✅ Add CBSD devices
- ✅ Register with SAS
- ✅ Request spectrum grants
- ✅ Monitor device status
- ✅ Automated heartbeat management

## Security Model

### Tenant Isolation

Each tenant's configuration is completely isolated:
- ✅ Stored in separate Firestore document
- ✅ Protected by Firestore security rules
- ✅ Only accessible to that tenant's users
- ✅ API keys never shared between tenants

### Firestore Security Rules

```javascript
match /cbrs_config/{tenantId} {
  // Only users from this tenant can read/write
  allow read, write: if request.auth != null 
    && request.auth.token.tenantId == tenantId;
}
```

### Backend Proxy

All SAS API calls go through Firebase Functions:
- ✅ API keys never exposed to frontend
- ✅ Server-side validation
- ✅ Request logging for compliance
- ✅ Tenant verification

## Benefits of Per-Tenant Configuration

### For Tenants
✅ **Complete Control**: Own your SAS credentials  
✅ **Privacy**: Your data, your keys  
✅ **Independence**: Not affected by other tenants  
✅ **Compliance**: Meet regulatory requirements  
✅ **White-Label**: Can rebrand with your SAS account  
✅ **Dedicated Quota**: No sharing with others  

### For Platform Owner
✅ **No Shared Liability**: Each tenant manages own SAS relationship  
✅ **Scalable**: No platform-wide rate limits  
✅ **Simple Billing**: Tenants pay SAS providers directly  
✅ **Flexible**: Different tenants can use different providers  
✅ **Clean Architecture**: True multi-tenant isolation  

## User Interface

### Settings Modal - Per-Tenant Mode

```
┌──────────────────────────────────────────────────┐
│ ⚙️ CBRS Module Settings                          │
├──────────────────────────────────────────────────┤
│                                                   │
│ 💡 Deployment Model                              │
│ ┌───────────────────────┐                       │
│ │ 🔒 Private Credentials│ [Recommended]         │
│ │ Use your own SAS      │                       │
│ │ account and API keys  │                       │
│ └───────────────────────┘                       │
│                                                   │
│ SAS Provider: [Google SAS ▼]                    │
│                                                   │
│ 🔵 Google SAS Configuration                      │
│ ┌──────────────────────────────────────────────┐│
│ │ Google User ID *                             ││
│ │ [your-organization-id__________________]     ││
│ │                                               ││
│ │ API Endpoint *                               ││
│ │ [https://sas.googleapis.com/v1_________]    ││
│ │                                               ││
│ │ API Key *                                     ││
│ │ [••••••••••••••••••••••••••••••••••]        ││
│ └──────────────────────────────────────────────┘│
│                                                   │
│           [🧪 Test] [Cancel] [💾 Save]          │
└──────────────────────────────────────────────────┘
```

## Optional: Shared Platform Mode

The platform admin panel (`Tenant Management > CBRS Platform Keys`) is **optional** and only needed if you want to offer a shared platform model for cost savings.

**Most deployments should use per-tenant mode** where each tenant has their own credentials configured in the CBRS module.

## Configuration Flow

```
1. Tenant opens CBRS Management module
   ↓
2. Sees warning: "Configuration incomplete"
   ↓
3. Clicks "⚙️ Settings" or "Configure Now →"
   ↓
4. Fills in their SAS credentials
   ↓
5. Clicks "💾 Save Settings"
   ↓
6. Configuration saved to: cbrs_config/{tenantId}
   ↓
7. CBRS service initializes with tenant's keys
   ↓
8. Module fully functional ✅
```

## What Gets Stored

### Tenant Configuration (cbrs_config/{tenantId})

```json
{
  "deploymentModel": "per-tenant",
  "provider": "google",
  "googleUserId": "acme-wireless-001",
  "googleApiKey": "tenant-private-api-key",
  "googleApiEndpoint": "https://sas.googleapis.com/v1",
  "federatedCustomerId": "acme-corp",
  "federatedApiKey": "tenant-fw-api-key",
  "federatedApiEndpoint": "https://sas.federatedwireless.com/api/v1",
  "enableAnalytics": true,
  "enableOptimization": true,
  "tenantId": "tenant-001",
  "updatedAt": "2025-10-13T20:30:00Z"
}
```

### NOT Shared Between Tenants

Each tenant has completely separate:
- API keys
- User IDs / Customer IDs
- SAS accounts
- Device registrations
- Spectrum grants
- Analytics data

## Testing

### Test Per-Tenant Configuration

1. **Open CBRS Management** module
2. **Click "⚙️ Settings"**
3. **Verify**: "Private Credentials" is pre-selected
4. **Enter Test Credentials**:
   ```
   Google User ID: test-tenant-001
   API Endpoint: https://sas.googleapis.com/v1
   API Key: test-api-key-12345
   ```
5. **Click "💾 Save"**
6. **Verify**: Settings saved to Firestore
7. **Check Console**: Should show "Using tenant-specific API keys"

## Summary

**Configuration Location**: CBRS Management > Settings  
**Default Mode**: Per-Tenant ✅  
**Storage**: Firestore `cbrs_config/{tenantId}`  
**Isolation**: Complete per-tenant separation  
**Access**: Each tenant configures their own credentials  
**Platform Admin**: NOT required for per-tenant mode  

---

**This is the recommended approach**: Each tenant manages their own SAS credentials directly in the CBRS module settings. Simple, secure, and fully isolated! 🎯

