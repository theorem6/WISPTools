# gcloud Authentication for Firebase Web IDE

## 🔐 Problem

Getting authentication error when trying to route traffic:
```
ERROR: (gcloud.run.services.update-traffic) There was a problem refreshing your current auth tokens
Please run: $ gcloud auth login
```

---

## ✅ Solution: Authenticate gcloud in Firebase Web IDE

### Method 1: Application Default Credentials (Recommended)

```bash
# Authenticate with your Google account
gcloud auth application-default login

# Or use the regular auth
gcloud auth login
```

This will:
1. Open a browser window for authentication
2. Ask you to sign in with your Google account
3. Grant permissions to gcloud
4. Store credentials for future use

### Method 2: Set the Project

```bash
# Set your Firebase project
gcloud config set project lte-pci-mapper-65450042-bbf71

# Verify it's set
gcloud config get-value project
```

### Method 3: Use Your Account

```bash
# If you have multiple accounts, set the correct one
gcloud config set account david@4gengineer.com

# List available accounts
gcloud auth list
```

---

## 🌐 Alternative: Route Traffic via Firebase Console (No CLI Needed)

If authentication is difficult, use the **Firebase Console UI** instead:

### Steps:

1. **Go to Cloud Run Console**:
   https://console.cloud.google.com/run/detail/us-central1/lte-pci-mapper?project=lte-pci-mapper-65450042-bbf71

2. **Click "MANAGE TRAFFIC"** button (top of page)

3. **Find Latest Working Revision**:
   - Look for the newest successful revision
   - Should be something like `lte-pci-mapper-build-2025-10-08-XXX`
   - Check "Ready" status = True

4. **Set Traffic to 100%**:
   - Click the dropdown next to the latest revision
   - Set percentage to **100**
   - Remove traffic from old revisions (set to 0)

5. **Click "SAVE"**

Traffic will switch in ~30-60 seconds.

---

## 🔄 Alternative: Let Firebase Handle It Automatically

Firebase App Hosting can automatically route traffic to new deployments if configured correctly.

### Option 1: Deploy with Auto-Traffic

```bash
# Deploy and Firebase will handle traffic
firebase deploy --only apphosting
```

### Option 2: Use Firebase App Hosting Rollout

In Firebase Console:
1. Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
2. Click on your backend
3. Click "Rollouts"
4. Manually promote the latest rollout to 100%

---

## 🚀 Quick Setup Script

If gcloud auth keeps failing, here's a complete setup:

```bash
# 1. Authenticate
gcloud auth login

# 2. Set project
gcloud config set project lte-pci-mapper-65450042-bbf71

# 3. Verify setup
gcloud config list

# 4. Test connection
gcloud run services list --region=us-central1

# 5. Now route traffic
gcloud run services update-traffic lte-pci-mapper \
  --region=us-central1 \
  --project=lte-pci-mapper-65450042-bbf71 \
  --to-latest
```

---

## 🎯 Recommended Approach

**Use the Firebase Console UI** (easier and doesn't require CLI auth):

1. Open: https://console.cloud.google.com/run/detail/us-central1/lte-pci-mapper?project=lte-pci-mapper-65450042-bbf71
2. Click **"MANAGE TRAFFIC"**
3. Route 100% to latest revision
4. Click **"SAVE"**

Done! No CLI authentication needed! 🎉

---

## 📝 Why Authentication Error Happens

The error occurs because:
1. Firebase Web IDE uses different credentials than local terminal
2. gcloud CLI needs explicit authentication in the web environment
3. Metadata service (used for automatic auth) isn't accessible

**Solution**: Either authenticate gcloud explicitly OR use the web console UI.

---

## ✅ After Traffic is Routed

Verify it worked:

### Check in Browser:
Visit: https://lte-pci-mapper-nfomthzoza-uc.a.run.app

### Check Traffic Distribution:
```bash
gcloud run services describe lte-pci-mapper \
  --region=us-central1 \
  --project=lte-pci-mapper-65450042-bbf71 \
  --format='value(status.traffic[0].revisionName,status.traffic[0].percent)'
```

Should show:
```
lte-pci-mapper-build-2025-10-08-XXX
100
```

---

## 🎊 Summary

**Easiest Method**: Use Firebase Console UI to route traffic (no CLI needed)

**CLI Method**: Run `gcloud auth login` first, then route traffic

Both work fine - choose whichever is easier for you! 🚀

