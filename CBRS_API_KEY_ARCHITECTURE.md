# CBRS SAS API Key Architecture Analysis

## Executive Summary

You have **two options** for managing SAS API keys in a multi-tenant environment:

1. **Option A: Single Platform API Key** (Shared) - Simpler, lower cost
2. **Option B: Per-Tenant API Keys** (Isolated) - More secure, recommended for production

**Current Implementation**: Your module supports **Option B** (per-tenant), but can be easily modified to support **Option A**.

## Detailed Analysis

### 🔵 Google SAS API Architecture

#### How Google SAS Works
- **Authentication**: OAuth 2.0 Client Credentials Flow
- **Client ID + Secret**: Platform-level credentials
- **User ID**: Organization/tenant-level identifier
- **Structure**: One API key can manage multiple User IDs

#### Google's Recommendation
```
Single API Key → Multiple User IDs → Multiple Organizations
     ↓               ↓                    ↓
Platform Level   Per-Tenant ID      Your Customers
```

**Key Insight**: Google SAS differentiates tenants using **User ID** in the request payload, NOT separate API keys.

#### Example Request Structure
```json
{
  "registrationRequest": [{
    "cbsdSerialNumber": "SN123456",
    "fccId": "ABC123",
    "userId": "tenant-001",  ← Tenant identifier
    ...
  }]
}
```

### 🟢 Federated Wireless API Architecture

#### How Federated Wireless Works
- **Authentication**: API Key + Customer ID
- **API Key**: Platform-level or per-customer
- **Customer ID**: Organization/account identifier
- **Structure**: One API key can manage multiple Customer IDs

#### Federated Wireless Recommendation
```
Single API Key → Multiple Customer IDs → Multiple Organizations
     ↓                 ↓                      ↓
Platform Level    Per-Customer ID         Your Tenants
```

**Key Insight**: Federated Wireless differentiates customers using **Customer ID**, not separate API keys.

## Option A: Single Platform API Key (Shared)

### Architecture
```
┌─────────────────────────────────────────────┐
│        Platform-Level Configuration          │
│  • One Google SAS API Key                   │
│  • One Federated Wireless API Key           │
│  • Stored in Firebase Functions config      │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┬─────────────┐
        │                       │             │
┌───────────────┐      ┌───────────────┐     ...
│  Tenant A     │      │  Tenant B     │
│  User ID: A   │      │  User ID: B   │
│  Cust ID: A   │      │  Cust ID: B   │
└───────────────┘      └───────────────┘
```

### Implementation
```typescript
// Platform-level config (environment variables)
GOOGLE_SAS_API_KEY=xxx          // Shared
FEDERATED_WIRELESS_API_KEY=yyy  // Shared

// Per-tenant config (Firestore)
{
  tenantId: "tenant-001",
  googleUserId: "user-001",        // Tenant's Google User ID
  federatedCustomerId: "cust-001"  // Tenant's Federated Customer ID
}
```

### Pros ✅
- **Lower cost**: Only pay for one SAS account
- **Simpler management**: One set of credentials
- **Easier deployment**: Single configuration
- **Centralized billing**: One invoice
- **Quick setup**: Fewer steps for new tenants

### Cons ❌
- **Security risk**: All tenants share same API key
- **No isolation**: API key compromise affects all tenants
- **Rate limiting**: Shared quota across all tenants
- **Audit trail**: Harder to track per-tenant usage
- **Compliance**: May not meet some regulatory requirements

### Best For
- Development/testing environments
- Small deployments (<10 tenants)
- Trusted customer base
- Cost-sensitive deployments
- POC/MVP stages

## Option B: Per-Tenant API Keys (Isolated)

### Architecture
```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Tenant A    │      │  Tenant B    │      │  Tenant C    │
│  • API Key A │      │  • API Key B │      │  • API Key C │
│  • User ID A │      │  • User ID B │      │  • User ID C │
│  • Cust ID A │      │  • Cust ID B │      │  • Cust ID C │
└──────────────┘      └──────────────┘      └──────────────┘
       │                     │                     │
       └─────────────────────┴─────────────────────┘
                            │
               ┌────────────────────────┐
               │  Your Platform         │
               │  Manages All Tenants   │
               └────────────────────────┘
```

### Implementation (Current)
```typescript
// Per-tenant config (Firestore: cbrs_config/{tenantId})
{
  tenantId: "tenant-001",
  provider: "google",
  googleApiKey: "tenant-001-api-key",      // Unique per tenant
  federatedApiKey: "tenant-001-fw-key",    // Unique per tenant
  federatedCustomerId: "tenant-001-cust"
}
```

### Pros ✅
- **Security**: Each tenant has isolated credentials
- **Compliance**: Meets regulatory requirements
- **Audit trail**: Clear per-tenant usage tracking
- **Rate limiting**: Independent quotas per tenant
- **Blast radius**: Key compromise only affects one tenant
- **Scalability**: No shared resource contention
- **White-label**: Each tenant can have their own SAS account

### Cons ❌
- **Higher cost**: Multiple SAS subscriptions
- **Complex management**: Multiple sets of credentials
- **Tenant onboarding**: Each tenant needs own SAS account
- **Billing complexity**: Multiple invoices to track
- **Initial setup**: More steps for new tenants

### Best For
- Production environments
- Enterprise deployments
- Multi-tenant SaaS
- High-security requirements
- White-label solutions
- Large customer bases (>10 tenants)

## Hybrid Option C: Platform Key + Tenant Segregation

### Architecture
```
┌─────────────────────────────────────────────┐
│        Platform API Key (Shared)             │
│  Stored in: Firebase Functions Environment   │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┬─────────────┐
        │                       │             │
┌───────────────┐      ┌───────────────┐     ...
│  Tenant A     │      │  Tenant B     │
│  User ID: A   │      │  User ID: B   │
│  Quota: 100   │      │  Quota: 200   │
└───────────────┘      └───────────────┘
```

### Implementation
```typescript
// Platform config (Environment)
GOOGLE_SAS_API_KEY=platform-key-shared-by-all

// Per-tenant config (Firestore)
{
  tenantId: "tenant-001",
  googleUserId: "tenant-001-user-id",  // Unique per tenant
  federatedCustomerId: "tenant-001",    // Unique per tenant
  quotaLimit: 100,                      // Tenant-specific limits
  useSharedPlatformKey: true            // Flag
}
```

### Pros ✅
- **Cost-effective**: Single SAS account
- **Tenant isolation**: Separate User IDs
- **Easy management**: One API key
- **Good security**: Tenant data still isolated via User ID
- **Rate limiting**: Can implement per-tenant quotas in your code

### Cons ❌
- **Shared quota**: SAS rate limits apply to all tenants combined
- **Partial isolation**: API key still shared
- **Audit complexity**: Need custom tracking

## Current Implementation Analysis

### What You Have Now: **Option B (Per-Tenant)**

**Storage Structure**:
```
Firestore Collection: cbrs_config
├── tenant-001/
│   ├── googleApiKey: "key-for-tenant-001"
│   ├── federatedApiKey: "key-for-tenant-001"
│   └── federatedCustomerId: "customer-001"
│
├── tenant-002/
│   ├── googleApiKey: "key-for-tenant-002"
│   ├── federatedApiKey: "key-for-tenant-002"
│   └── federatedCustomerId: "customer-002"
```

**Advantages of Current Design**:
✅ Maximum security and isolation  
✅ Ready for enterprise customers  
✅ Compliance-friendly  
✅ Scalable architecture  

## Recommendation: Support Both Models

I recommend **enhancing the module** to support both approaches with a configuration flag:

### Enhanced Configuration Model

```typescript
export interface CBRSConfig {
  // Deployment model
  deploymentModel: 'per-tenant' | 'shared-platform';
  
  // Shared platform credentials (Option A/C)
  platformGoogleApiKey?: string;
  platformFederatedApiKey?: string;
  
  // Per-tenant credentials (Option B - current)
  googleApiKey?: string;
  federatedApiKey?: string;
  
  // Tenant identifiers (all models)
  googleUserId?: string;           // Google's User ID for this tenant
  federatedCustomerId?: string;    // Federated's Customer ID
  
  // Standard fields
  provider: 'google' | 'federated-wireless' | 'both';
  tenantId: string;
}
```

### Usage Examples

**Shared Platform Model**:
```typescript
// Platform admin configures once (via admin panel)
platformConfig = {
  googleApiKey: "shared-platform-key",
  federatedApiKey: "shared-platform-key"
};

// Each tenant only configures their IDs
tenantConfig = {
  deploymentModel: 'shared-platform',
  googleUserId: "tenant-unique-id",
  federatedCustomerId: "tenant-unique-id"
};
```

**Per-Tenant Model** (current):
```typescript
tenantConfig = {
  deploymentModel: 'per-tenant',
  googleApiKey: "tenant-specific-key",
  federatedApiKey: "tenant-specific-key",
  federatedCustomerId: "tenant-customer-id"
};
```

## Cost Comparison

### Google SAS Pricing Estimate
- **Per-tenant**: $X/month per tenant account
- **Shared platform**: $X/month total (all tenants)

### Federated Wireless Pricing Estimate
- **Per-tenant**: Varies by customer volume
- **Shared platform**: Single customer account with multiple sites

### Example Scenarios

**10 Tenants**:
- Option A (Shared): ~$500/month total
- Option B (Per-tenant): ~$5,000/month total (10 × $500)

**100 Tenants**:
- Option A (Shared): ~$500/month total (with higher tier)
- Option B (Per-tenant): ~$50,000/month total

**Break-even**: Around 5-10 tenants depending on pricing tier

## Security Considerations

### Shared API Key Security Measures

If using Option A, implement these protections:

1. **Backend Proxy Only**
   ```typescript
   // NEVER expose platform API key to frontend
   // All SAS calls go through Firebase Functions
   export const proxySASRequest = onCall(async (request) => {
     const apiKey = process.env.PLATFORM_GOOGLE_SAS_KEY;
     // Make SAS request server-side
   });
   ```

2. **Rate Limiting Per Tenant**
   ```typescript
   // Track tenant API usage
   const tenantUsage = await checkTenantQuota(tenantId);
   if (tenantUsage > tenantQuota) {
     throw new Error('Tenant quota exceeded');
   }
   ```

3. **User ID Validation**
   ```typescript
   // Ensure tenant can only use their assigned User ID
   const tenantConfig = await getTenantConfig(tenantId);
   if (request.userId !== tenantConfig.googleUserId) {
     throw new Error('Unauthorized User ID');
   }
   ```

4. **Encryption at Rest**
   ```typescript
   // Encrypt platform API key in environment
   // Use Google Secret Manager
   const apiKey = await secretManager.get('GOOGLE_SAS_API_KEY');
   ```

### Per-Tenant Security Measures

If using Option B (current):

1. **Tenant Isolation**
   ```typescript
   // Each tenant's API key stored separately
   // Firestore security rules enforce access
   match /cbrs_config/{tenantId} {
     allow read, write: if request.auth.token.tenantId == tenantId;
   }
   ```

2. **Key Encryption**
   ```typescript
   // Encrypt API keys before storing
   const encryptedKey = await encrypt(apiKey, tenantId);
   await saveToFirestore(encryptedKey);
   ```

## Recommendation Matrix

| Criteria | Shared Key (A) | Per-Tenant (B) | Hybrid (C) |
|----------|----------------|----------------|------------|
| **Cost** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ |
| **Security** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Setup Complexity** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Scalability** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Compliance** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Isolation** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Audit Trail** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### Recommended Approach by Use Case

#### Startup/POC
**Use**: Option A (Shared Platform Key)
- Lower upfront cost
- Faster deployment
- Easier to manage initially
- Can migrate to Option B later

#### Growing Business (5-50 tenants)
**Use**: Option C (Hybrid)
- Balance cost and security
- Tenant isolation via User ID
- Centralized billing
- Good scalability

#### Enterprise SaaS (50+ tenants)
**Use**: Option B (Per-Tenant Keys)
- Maximum security
- Complete isolation
- Regulatory compliance
- White-label ready

## Implementation Options

### Current Setup (Option B)
Your module already supports per-tenant API keys. **No changes needed.**

**Current Flow**:
```
1. Tenant accesses CBRS module
2. Loads config from Firestore: cbrs_config/{tenantId}
3. Uses tenant-specific API keys
4. All devices registered under tenant's credentials
```

**To Use**: Each tenant needs to:
1. Obtain their own Google SAS API key
2. Obtain their own Federated Wireless account
3. Enter credentials in Settings modal
4. System uses their personal API keys

### Migration to Option A (Shared)

If you want to support shared keys, here's how to modify:

#### Step 1: Create Platform Configuration

```typescript
// Add to lib/services/configService.ts
export interface PlatformCBRSConfig {
  googleApiKey: string;
  googleCertificatePath?: string;
  federatedApiKey: string;
  sharedMode: boolean;
}

// Store in Firestore: cbrs_platform_config/platform
```

#### Step 2: Update Tenant Config

```typescript
export interface CBRSConfig {
  deploymentModel: 'shared-platform' | 'per-tenant';
  
  // For shared-platform model
  googleUserId?: string;
  federatedCustomerId?: string;
  
  // For per-tenant model (existing)
  googleApiKey?: string;
  federatedApiKey?: string;
  
  // Common fields
  provider: 'google' | 'federated-wireless' | 'both';
  tenantId: string;
}
```

#### Step 3: Modify Service Initialization

```typescript
async function initializeCBRSService(config: CBRSConfig) {
  if (config.deploymentModel === 'shared-platform') {
    // Load platform keys from secure storage
    const platformKeys = await loadPlatformKeys();
    
    return createCBRSService({
      googleConfig: {
        apiKey: platformKeys.googleApiKey,  // Platform key
        userId: config.googleUserId,        // Tenant User ID
        tenantId: config.tenantId
      },
      federatedConfig: {
        apiKey: platformKeys.federatedApiKey,    // Platform key
        customerId: config.federatedCustomerId,  // Tenant Customer ID
        tenantId: config.tenantId
      }
    });
  } else {
    // Use tenant-specific keys (current implementation)
    return createCBRSService({
      googleConfig: {
        apiKey: config.googleApiKey,  // Tenant key
        tenantId: config.tenantId
      }
    });
  }
}
```

## Migration Path

### Start with Shared, Move to Per-Tenant

**Phase 1: Development/MVP**
- Use shared platform API key
- Low cost, fast development
- All tenants use platform credentials

**Phase 2: Growth (5-20 tenants)**
- Offer both options
- New enterprise customers get per-tenant keys
- Existing customers remain on shared
- Gradual migration

**Phase 3: Enterprise (20+ tenants)**
- Require per-tenant keys for new customers
- Migrate existing to per-tenant
- Maximum security and isolation

### Migration Example

```typescript
// Add migration flag to tenant config
{
  tenantId: "tenant-001",
  deploymentModel: "shared-platform",  // Currently using shared
  migrationScheduled: "2025-12-01",    // When to migrate
  newApiKeyProvided: false             // Track migration status
}

// Migration function
async function migrateTenantToPrivateKeys(tenantId: string) {
  // 1. Tenant obtains their own SAS account
  // 2. Tenant enters API keys in settings
  // 3. System validates new keys
  // 4. Seamless switchover
  // 5. Devices re-register under new credentials
}
```

## Financial Analysis

### Cost Model A (Shared)
```
Platform SAS Account:
├── Google SAS: $500/month
├── Federated Wireless: $500/month
└── Total: $1,000/month

Cost per Tenant:
├── 10 tenants: $100/month each
├── 50 tenants: $20/month each
└── 100 tenants: $10/month each
```

### Cost Model B (Per-Tenant)
```
Per-Tenant SAS Accounts:
├── Google SAS: $500/month/tenant
├── Federated Wireless: $500/month/tenant
└── Total: $1,000/month/tenant

10 Tenants = $10,000/month
50 Tenants = $50,000/month
```

### Break-Even Analysis
- **Below 5 tenants**: Option A (Shared) cheaper
- **5-20 tenants**: Depends on pricing tier
- **Above 20 tenants**: Option B may be required for compliance

## Federated Wireless Specifics

### Customer ID Architecture

**Federated Wireless uses**:
```
API Key → Customer Account → Multiple Sites/Devices
```

**One Customer Account can have**:
- Multiple sites
- Multiple CBSDs
- Multiple geographic locations
- Multiple device types

**Customer ID Naming Convention**:
```
Format: {organization}-{identifier}
Example: "acme-wireless-001"
```

### Federated Wireless Multi-Site Support

Federated Wireless **explicitly supports** multi-site deployments under one Customer ID:

```typescript
// One API Key + One Customer ID can manage:
{
  customerId: "acme-wireless",
  sites: [
    { siteId: "site-nyc", devices: [...] },
    { siteId: "site-sf", devices: [...] },
    { siteId: "site-la", devices: [...] }
  ]
}
```

**Conclusion**: Federated Wireless is **designed for** Option A/C (shared key with Customer ID differentiation).

## Google SAS Specifics

### User ID Architecture

**Google SAS uses**:
```
API Key → Google Cloud Project → Multiple User IDs
```

**One API Key can manage**:
- Multiple User IDs (organizations)
- Thousands of CBSDs per User ID
- Different geographic regions
- Various device categories

**User ID Format**:
```
Can be any string identifier
Recommendation: Use your tenant ID
Example: "tenant-001", "acme-corp", "wisp-networks-nyc"
```

**Conclusion**: Google SAS is **designed for** Option A/C (shared key with User ID differentiation).

## Final Recommendation

### For Your Platform: **Hybrid Approach (Option C)**

**Why**:
1. **SAS providers designed for it**: Both Google and Federated Wireless use User ID/Customer ID for multi-tenant
2. **Cost-effective**: Share platform API key
3. **Good security**: Tenant isolation via User ID
4. **Easy onboarding**: Tenants only configure their ID, not full SAS account
5. **Scalable**: Works for 1-1000+ tenants
6. **Backend control**: API key never exposed to frontend
7. **Rate limiting**: Implement your own per-tenant quotas

### Implementation Plan

```typescript
// Platform Config (Admin-only, environment variable)
GOOGLE_SAS_PLATFORM_API_KEY=xxx
FEDERATED_WIRELESS_PLATFORM_API_KEY=yyy

// Tenant Config (per tenant in Settings modal)
{
  tenantId: "tenant-001",
  googleUserId: "tenant-001",           // Just an ID, not full credentials
  federatedCustomerId: "tenant-001",
  useSharedPlatformKey: true            // Most tenants use this
  
  // Optional: Enterprise tenants can override
  googleApiKeyOverride?: "their-own-key",
  federatedApiKeyOverride?: "their-own-key"
}

// Backend picks the right key
const apiKey = tenant.googleApiKeyOverride || PLATFORM_KEY;
```

## Next Steps

Would you like me to:

1. **Keep current design** (Option B - per-tenant keys)
   - Already implemented
   - Maximum security
   - Ready for enterprise

2. **Implement hybrid model** (Option C - recommended)
   - Add platform key support
   - Keep per-tenant override option
   - Add User ID fields to settings
   - Best balance of cost and security

3. **Implement shared model** (Option A - simplest)
   - Remove per-tenant key fields
   - Add User ID/Customer ID fields
   - Platform admin sets API keys
   - Lowest cost option

Let me know which approach you prefer, and I can implement it!

---

**Current Implementation**: Option B (Per-Tenant) ✅  
**Recommended Migration**: Option C (Hybrid) 🎯  
**Best for Cost**: Option A (Shared) 💰  
**Best for Security**: Option B (Per-Tenant) 🔒


