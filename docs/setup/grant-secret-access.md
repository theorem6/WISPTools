# Grant App Hosting Access to Secrets

## The Issue

The secret `google-sas-client-secret` exists in Secret Manager, but the **App Hosting backend doesn't have permission** to read it.

## Solution: Grant Access

Run this command in your **deployment environment** (where Firebase CLI is available):

### Command:

```bash
firebase apphosting:secrets:grantaccess google-sas-client-secret \
  --project=lte-pci-mapper-65450042-bbf71
```

This grants the App Hosting backend permission to read the secret.

## If You Don't Have Firebase CLI

### Option A: Use gcloud CLI

```bash
# Find your App Hosting service account
gcloud app describe --project=lte-pci-mapper-65450042-bbf71

# Grant access (replace SERVICE_ACCOUNT_EMAIL with the actual email)
gcloud secrets add-iam-policy-binding google-sas-client-secret \
  --project=lte-pci-mapper-65450042-bbf71 \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor"
```

### Option B: Use Google Cloud Console

1. **Go to Secret Manager**:
   ```
   https://console.cloud.google.com/security/secret-manager/secret/google-sas-client-secret?project=lte-pci-mapper-65450042-bbf71
   ```

2. **Click on the secret** `google-sas-client-secret`

3. **Go to "PERMISSIONS" tab**

4. **Click "GRANT ACCESS"**

5. **Add the App Hosting service account**:
   - New principals: `lte-pci-mapper@appspot.gserviceaccount.com`
   - Or find it in: IAM & Admin > Service Accounts
   - Look for one with "App Hosting" or "App Engine" in the name

6. **Select role**: "Secret Manager Secret Accessor"

7. **Click "SAVE"**

## Alternative: Comment Out Secret (Deploy Without It)

If you want to deploy immediately without the secret:

I can comment it out again temporarily. Let me know if you want to do this.

## After Granting Access

Once you've granted access:

1. **Retry deployment** - it should work now!
2. Secret will be available to App Hosting
3. CBRS module will be able to use Google SAS

---

**Quick Fix**: Run in your deployment terminal:
```bash
firebase apphosting:secrets:grantaccess google-sas-client-secret
```

Then retry the deployment! 🚀

