# GitHub Direct Deployment to Firebase App Hosting

## 🎯 Overview

Automatic deployment directly from GitHub to Firebase App Hosting (Cloud Run) without using Firebase Web IDE.

**Flow**: `Push to main` → `GitHub Actions runs` → `Builds Module_Manager` → `Deploys to Cloud Run` → `Routes traffic automatically`

---

## 🔧 Setup Steps

### 1. Create Service Account in Google Cloud

```bash
# Create service account
gcloud iam service-accounts create github-actions-deployer \
  --display-name "GitHub Actions Deployer" \
  --project lte-pci-mapper-65450042-bbf71

# Grant necessary permissions
gcloud projects add-iam-policy-binding lte-pci-mapper-65450042-bbf71 \
  --member="serviceAccount:github-actions-deployer@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding lte-pci-mapper-65450042-bbf71 \
  --member="serviceAccount:github-actions-deployer@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding lte-pci-mapper-65450042-bbf71 \
  --member="serviceAccount:github-actions-deployer@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create and download key
gcloud iam service-accounts keys create ~/github-actions-key.json \
  --iam-account github-actions-deployer@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com \
  --project lte-pci-mapper-65450042-bbf71
```

### 2. Add Secret to GitHub Repository

1. **Copy the key file content**:
   ```bash
   cat ~/github-actions-key.json
   ```

2. **Go to GitHub Repository Settings**:
   - Navigate to: https://github.com/theorem6/lte-pci-mapper/settings/secrets/actions
   - Click **"New repository secret"**
   - Name: `GCP_SA_KEY`
   - Value: Paste the entire JSON content from the key file
   - Click **"Add secret"**

3. **IMPORTANT**: Delete the local key file after adding to GitHub:
   ```bash
   rm ~/github-actions-key.json
   ```

---

## 📁 Files Created

### `.github/workflows/firebase-app-hosting.yml`

GitHub Actions workflow that:
- ✅ Triggers on push to `main` branch
- ✅ Builds Module_Manager with 4GB memory
- ✅ Deploys to Cloud Run with optimized settings
- ✅ Automatically routes traffic to latest revision
- ✅ Shows deployment URL in summary

---

## 🚀 How It Works

### On Every Push to `main`:

1. **Checkout Code**: Gets latest code from GitHub
2. **Setup Node.js 20**: Installs Node.js environment
3. **Install Dependencies**: Runs `npm ci` in Module_Manager
4. **Build Application**: Runs `npm run build` with 4GB heap
5. **Authenticate**: Uses service account credentials
6. **Deploy to Cloud Run**: Deploys Module_Manager as Cloud Run service
7. **Route Traffic**: Automatically sends 100% traffic to new revision
8. **Show URL**: Displays deployment URL in GitHub Actions summary

### Configuration:
```yaml
CPU: 1 core
Memory: 2Gi (2 GB)
Min Instances: 0 (scale to zero)
Max Instances: 5
Concurrency: 80
Port: 8080
```

---

## ✅ Benefits of This Approach

### vs. Firebase Web IDE:
- ✅ **Automatic**: No manual deployment needed
- ✅ **Consistent**: Same build process every time
- ✅ **Trackable**: All deployments logged in GitHub Actions
- ✅ **Reviewable**: Can review changes before merge
- ✅ **Rollback**: Easy to revert to previous commits

### vs. Firebase CLI:
- ✅ **No local setup**: Works from any machine
- ✅ **No manual commands**: Push to deploy
- ✅ **Built-in CI/CD**: Testing and deployment in one place
- ✅ **Team friendly**: Anyone with push access can deploy

---

## 🔄 Deployment Workflow

```
1. Code Changes (Local)
   ↓
2. Commit & Push to main
   ↓
3. GitHub Actions Triggered
   ↓
4. Build Module_Manager
   ↓
5. Deploy to Cloud Run
   ↓
6. Route Traffic Automatically
   ↓
7. ✅ Live at: https://lte-pci-mapper-nfomthzoza-uc.a.run.app
```

---

## 📊 Monitoring Deployments

### View Deployment Status:
- Go to: https://github.com/theorem6/lte-pci-mapper/actions
- Click on latest workflow run
- See build logs, deployment status, and URL

### Check Live Service:
- Cloud Run Console: https://console.cloud.google.com/run/detail/us-central1/lte-pci-mapper
- Service URL: https://lte-pci-mapper-nfomthzoza-uc.a.run.app

---

## 🛠️ Customization

### Deploy on Pull Request (Optional):

The workflow already includes PR triggers for preview:
```yaml
on:
  pull_request:
    branches:
      - main
```

### Add Environment Variables:

Edit `.github/workflows/firebase-app-hosting.yml`:
```yaml
--set-env-vars="NODE_ENV=production,OTHER_VAR=value"
```

### Change Deployment Settings:

Edit the `gcloud run deploy` command in the workflow:
```yaml
--cpu 2              # Increase CPU
--memory 4Gi         # Increase memory
--min-instances 1    # Keep warm instance
```

---

## 🔒 Security Best Practices

1. ✅ **Service Account**: Limited permissions (only Cloud Run)
2. ✅ **GitHub Secret**: Credentials encrypted in GitHub
3. ✅ **No Keys in Code**: Never commit service account keys
4. ✅ **Principle of Least Privilege**: Only necessary permissions granted

---

## 🚨 Troubleshooting

### Deployment Fails:

**Check GitHub Actions logs**:
1. Go to: https://github.com/theorem6/lte-pci-mapper/actions
2. Click failed run
3. Expand failed step to see error

**Common Issues**:
- ❌ `GCP_SA_KEY` secret not set → Add in GitHub settings
- ❌ Service account lacks permissions → Grant roles as shown above
- ❌ Build fails → Check Node.js version and dependencies
- ❌ Memory error during build → Increase `NODE_OPTIONS` heap size

### Traffic Not Routing:

**Manual route** (if automatic fails):
```bash
gcloud run services update-traffic lte-pci-mapper \
  --region us-central1 \
  --to-latest \
  --project lte-pci-mapper-65450042-bbf71
```

Or use Cloud Run Console UI.

---

## 🎯 Next Steps

### 1. Complete Setup (One-Time):
```bash
# Create service account and grant permissions (commands above)
# Add GCP_SA_KEY secret to GitHub
```

### 2. Test Deployment:
```bash
# Make a small change
echo "# Test" >> README.md

# Commit and push
git add README.md
git commit -m "Test GitHub Actions deployment"
git push origin main

# Watch deployment
# Go to: https://github.com/theorem6/lte-pci-mapper/actions
```

### 3. Verify:
- Check GitHub Actions completed successfully
- Visit: https://lte-pci-mapper-nfomthzoza-uc.a.run.app
- Confirm app is working

---

## ✅ Summary

**What You Need to Do**:

1. Run the `gcloud` commands to create service account ✅
2. Add `GCP_SA_KEY` secret to GitHub repository ✅
3. Push to `main` branch ✅
4. GitHub Actions handles the rest automatically! 🎉

**After Setup**:
- Every push to `main` = automatic deployment
- No more Firebase Web IDE needed
- No more manual commands
- Just code, commit, push → deployed! 🚀

---

## 📝 Files Modified

- ✅ `.github/workflows/firebase-app-hosting.yml` - GitHub Actions workflow
- ✅ `GITHUB_DIRECT_DEPLOYMENT_SETUP.md` - This setup guide

**Ready to deploy from GitHub!** 🎊

