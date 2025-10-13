# Firebase App Hosting Secrets Setup

## Important: App Hosting vs Functions

You're using **Firebase App Hosting** (Cloud Build), which uses **Google Secret Manager** directly, NOT Firebase Functions secrets.

## Current Situation

Your deployment is failing because `apphosting.yaml` references secrets that either:
1. Don't exist in Google Secret Manager yet, OR
2. The App Hosting backend doesn't have permission to access them

## Option 1: Remove Secret References (Deploy Now)

Since MongoDB, Google SAS, and Federated Wireless are **optional** for the core modules (PCI Resolution, Dashboard, etc.), you can deploy WITHOUT these secrets:

### Already Done ✅

I've already commented out the secrets in your `apphosting.yaml`:

```yaml
# MongoDB Configuration (for GenieACS - Optional)
# Uncomment when you have MongoDB configured
# - variable: MONGODB_URI
#   secret: mongodb-uri

# Google SAS - Optional
# - variable: GOOGLE_SAS_CLIENT_SECRET
#   secret: google-sas-client-secret

# Federated Wireless - Optional
# - variable: FEDERATED_WIRELESS_API_KEY
#   secret: federated-wireless-api-key
```

### Action: Deploy Now

Just pull the latest code in your deployment environment:

```bash
git pull origin main
```

Then retry the deployment. It should work now! ✅

## Option 2: Create Secrets in Google Secret Manager (For CBRS Module)

If you want to enable the CBRS module functionality, create the secrets:

### Via Google Cloud Console:

1. **Go to Secret Manager**:
   ```
   https://console.cloud.google.com/security/secret-manager?project=lte-pci-mapper-65450042-bbf71
   ```

2. **Create Secret: google-sas-client-secret**
   - Click "CREATE SECRET"
   - Name: `google-sas-client-secret`
   - Secret value: `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`
   - Click "CREATE SECRET"

3. **Grant Access to App Hosting**
   - Click on the secret you just created
   - Go to "PERMISSIONS" tab
   - Click "GRANT ACCESS"
   - Add member: Your App Hosting service account
     (Format: `lte-pci-mapper@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com` or similar)
   - Role: "Secret Manager Secret Accessor"
   - Click "SAVE"

4. **Repeat for Other Secrets** (if needed):
   - `mongodb-uri` (for GenieACS)
   - `federated-wireless-api-key` (for Federated Wireless)

### Via gcloud CLI:

```bash
# Create Google SAS secret
echo -n "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" | \
  gcloud secrets create google-sas-client-secret \
    --project=lte-pci-mapper-65450042-bbf71 \
    --data-file=-

# Grant access to App Hosting service account
gcloud secrets add-iam-policy-binding google-sas-client-secret \
  --project=lte-pci-mapper-65450042-bbf71 \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor"
```

## Option 3: Use Environment Variables (Simplest for Now)

Instead of secrets, use plain environment variables in `apphosting.yaml`:

### Update apphosting.yaml:

```yaml
# Google SAS Configuration - Using environment variables instead of secrets
- variable: GOOGLE_SAS_CLIENT_ID
  value: 1044782186913-7ukvo096g0r9oal2lg2tehiunae49ceq.apps.googleusercontent.com
  availability:
    - RUNTIME

- variable: GOOGLE_SAS_CLIENT_SECRET
  value: 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
  availability:
    - RUNTIME
```

**Note**: Less secure (visible in logs), but works for development/testing.

## Recommended Approach

### For Immediate Deployment:

**Just pull and deploy** - secrets are already commented out:

```bash
git pull origin main
# Then retry your deployment (it should work now)
```

### For CBRS Module (Later):

When you're ready to use the CBRS module:

1. **Create secrets in Google Secret Manager** (Option 2)
2. **Grant access to App Hosting backend**
3. **Uncomment in apphosting.yaml**
4. **Redeploy**

## What Works Without Secrets

**Currently Functional Modules**:
- ✅ Dashboard
- ✅ PCI Resolution (fully functional)
- ✅ ACS CPE Management (fully functional - uses Firestore)
- ✅ Tenant Management
- ✅ Authentication

**Requires Secrets**:
- ⏳ CBRS Management (needs Google SAS secret for actual SAS operations)
- ⏳ GenieACS MongoDB features (needs MongoDB URI)

## Summary

**Immediate Action**: Your latest code (commit `88954d4`) has secrets commented out, so:

1. **Pull latest code** in your deployment environment:
   ```bash
   git pull origin main
   ```

2. **Retry deployment** - should work now! ✅

3. **Add secrets later** when you're ready to use CBRS/GenieACS features

---

**Status**: Secrets are optional now  
**Deployment**: Should succeed  
**CBRS Module**: UI works, SAS operations need secrets  
**Action**: Pull and retry deployment 🚀

