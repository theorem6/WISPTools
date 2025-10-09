# Service Account Setup for Automatic Functions Deployment

## Overview

This guide shows how to set up **fully automatic** Firebase Functions deployment using a **Google Cloud Service Account**. No manual login required!

## One-Time Setup (5 Minutes)

### Step 1: Create Service Account in Google Cloud

1. **Go to Google Cloud Console:**
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=lte-pci-mapper-65450042-bbf71
   ```

2. **Click:** "Create Service Account"

3. **Configure:**
   - **Service account name:** `github-actions-deployer`
   - **Service account ID:** `github-actions-deployer` (auto-filled)
   - **Description:** "Service account for GitHub Actions to deploy Firebase Functions"

4. **Click:** "Create and Continue"

5. **Grant roles** (add these 3 roles):
   - `Cloud Functions Admin`
   - `Service Account User`
   - `Firebase Admin`

6. **Click:** "Continue" → "Done"

### Step 2: Create and Download Service Account Key

1. **In the service accounts list**, find: `github-actions-deployer@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com`

2. **Click the email** to open details

3. **Go to:** "Keys" tab

4. **Click:** "Add Key" → "Create new key"

5. **Select:** JSON format

6. **Click:** "Create"

7. **Save the downloaded JSON file** securely (you'll need it in the next step)

### Step 3: Add Service Account Key to GitHub Secrets

1. **Go to your GitHub repository:**
   ```
   https://github.com/theorem6/lte-pci-mapper/settings/secrets/actions
   ```

2. **Click:** "New repository secret"

3. **Configure:**
   - **Name:** `GCP_SERVICE_ACCOUNT_KEY`
   - **Value:** Copy and paste the **entire contents** of the JSON file you downloaded
   
   Example format:
   ```json
   {
     "type": "service_account",
     "project_id": "lte-pci-mapper-65450042-bbf71",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "github-actions-deployer@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com",
     "client_id": "...",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "..."
   }
   ```

4. **Click:** "Add secret"

### Step 4: Enable Required APIs

1. **Go to Google Cloud Console:**
   ```
   https://console.cloud.google.com/apis/library?project=lte-pci-mapper-65450042-bbf71
   ```

2. **Enable these APIs:**
   - Cloud Functions API
   - Cloud Build API
   - Cloud Resource Manager API
   - Service Usage API

3. **For each API:**
   - Search for it
   - Click on it
   - Click "Enable"

### Step 5: Push Code to Trigger Deployment

The GitHub Actions workflow is already in your repository. Just push:

```bash
git push
```

**GitHub Actions will automatically:**
1. ✅ Detect the push
2. ✅ Authenticate using service account
3. ✅ Build Functions
4. ✅ Deploy to Firebase
5. ✅ Takes 3-5 minutes
6. ✅ No manual intervention needed!

## How It Works

```
Developer pushes to GitHub
    ↓
GitHub Actions triggered
    ↓
Uses GCP_SERVICE_ACCOUNT_KEY secret
    ↓
Authenticates to Google Cloud
    ↓
Builds TypeScript Functions
    ↓
Deploys to Firebase Cloud Functions
    ↓
Functions are live! ✅
```

## Verify Setup

### Check GitHub Actions

1. **Go to:** `https://github.com/theorem6/lte-pci-mapper/actions`

2. **You should see:**
   - Workflow: "Deploy Firebase Functions (Production)"
   - Status: ✅ Success or 🔄 Running

3. **Click on the workflow run** to see detailed logs

### Check Firebase Functions

1. **Go to:** `https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/functions`

2. **You should see:** 30+ functions listed

3. **Status:** All should show as "Active"

### Test Functions

Visit in browser:
```
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/checkMongoHealth
```

**Expected response:**
```json
{"success":true,"connected":true,"database":"genieacs"}
```

## After Setup: Fully Automatic!

**Every time you push code:**

```bash
git add .
git commit -m "Update functions"
git push
```

**GitHub automatically:**
- ✅ Detects changes
- ✅ Builds Functions
- ✅ Deploys to Firebase
- ✅ All in 3-5 minutes
- ✅ Zero manual steps!

## Security Best Practices

### Service Account Permissions

The service account only has:
- ✅ Cloud Functions Admin (deploy functions)
- ✅ Service Account User (run as service account)
- ✅ Firebase Admin (access Firebase services)

**Does NOT have:**
- ❌ Project Owner (overly broad)
- ❌ Editor (too many permissions)
- ❌ Delete permissions (safer)

### Secret Storage

- ✅ Stored in GitHub Secrets (encrypted)
- ✅ Never exposed in logs
- ✅ Only accessible to GitHub Actions
- ✅ Can be rotated if compromised

### Best Practices

1. **Rotate keys annually**
2. **Use separate service accounts** for prod/dev
3. **Audit service account usage** regularly
4. **Delete unused service accounts**
5. **Monitor deployment logs** for unauthorized access

## Troubleshooting

### "Permission denied" Error

**Cause:** Service account missing required roles

**Fix:**
1. Google Cloud Console → IAM
2. Find: `github-actions-deployer@...`
3. Edit permissions
4. Add missing role
5. Save

### "Invalid credentials" Error

**Cause:** Service account key incorrect or expired

**Fix:**
1. Create new service account key
2. Update `GCP_SERVICE_ACCOUNT_KEY` secret in GitHub
3. Push code again

### "API not enabled" Error

**Cause:** Required Google Cloud API not enabled

**Fix:**
1. Google Cloud Console → APIs & Services
2. Enable the API mentioned in error
3. Retry deployment

### Workflow Not Triggering

**Cause:** Workflow file not in main branch or syntax error

**Fix:**
1. Check: `.github/workflows/deploy-functions-service-account.yml` exists
2. Verify: YAML syntax is correct
3. Check: GitHub Actions tab for error messages

## Cost

**Service Account:** Free  
**GitHub Actions:** Free (2,000 minutes/month for private repos, unlimited for public)  
**Cloud Build:** Free tier (120 build-minutes/day)  
**Cloud Functions:** Free tier (2M invocations/month)

**Total monthly cost for typical usage:** $0 - $5

## Comparison: Service Account vs Manual Login

| Feature | Service Account | Manual Login (`firebase login:ci`) |
|---------|----------------|-------------------------------------|
| Setup | One-time | One-time |
| Expiration | Keys expire (rotate annually) | Tokens can expire |
| Security | Scoped permissions | Full user permissions |
| Automation | Fully automatic | Fully automatic |
| Revocation | Delete service account | Revoke token |
| Best for | Production CI/CD | Quick testing |
| **Recommended** | ✅ YES | ❌ NO |

## Alternative: Workload Identity Federation (Advanced)

For even better security, use **Workload Identity Federation** (no long-lived keys):

```yaml
# In GitHub Actions
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: 'projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-provider'
    service_account: 'github-actions-deployer@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com'
```

**Advantages:**
- No service account key file needed
- More secure (no long-lived credentials)
- Recommended by Google for production

## Summary

✅ **Service Account Setup:** One-time, 5 minutes  
✅ **GitHub Secret:** Add JSON key  
✅ **GitHub Actions:** Already configured in your repo  
✅ **Push to Deploy:** Fully automatic!  

**After setup:**
```
git push → Functions deploy automatically → Database initialization works! 🚀
```

---

## Quick Setup Checklist

- [ ] Create service account in Google Cloud Console
- [ ] Grant roles: Cloud Functions Admin, Service Account User, Firebase Admin
- [ ] Create and download JSON key
- [ ] Add key to GitHub Secrets as `GCP_SERVICE_ACCOUNT_KEY`
- [ ] Enable required Google Cloud APIs
- [ ] Push code to trigger deployment
- [ ] Verify Functions are deployed
- [ ] Test database initialization

**This is the professional, production-ready approach!** ✅

