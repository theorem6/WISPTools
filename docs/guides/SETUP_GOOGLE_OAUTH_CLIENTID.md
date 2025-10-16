# Setup Google OAuth Client ID - Quick Guide

**Time Required:** 5 minutes  
**Required For:** CBRS module "Sign in with Google" functionality

---

## 🎯 Step 1: Create OAuth Client ID in Google Cloud Console

1. **Go to Google Cloud Console:**
   https://console.cloud.google.com/apis/credentials?project=lte-pci-mapper-65450042-bbf71

2. **Click "Create Credentials"** → **"OAuth client ID"**

3. **Choose "Web application"**

4. **Configure the OAuth client:**

   **Name:**
   ```
   LTE PCI Mapper - CBRS OAuth
   ```

   **Authorized JavaScript origins** (click "Add URI" for each):
   ```
   https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app
   http://localhost:5173
   http://localhost:4173
   ```

   **Authorized redirect URIs** (click "Add URI" for each):
   ```
   https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/oauth/google/callback
   http://localhost:5173/oauth/google/callback
   http://localhost:4173/oauth/google/callback
   ```

5. **Click "Create"**

6. **Copy your Client ID** - it will look like:
   ```
   1044782186913-abc123def456ghi789.apps.googleusercontent.com
   ```

---

## 🔧 Step 2: Update Firebase App Hosting Configuration

**Option A: Via Firebase Console (Easiest)**

1. Go to Firebase Console:
   https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting

2. Click on your app hosting instance

3. Click **"Environment variables"** tab

4. Click **"Add variable"**

5. Set:
   - **Key:** `PUBLIC_GOOGLE_OAUTH_CLIENT_ID`
   - **Value:** Your OAuth Client ID (paste from Step 1)
   - **Availability:** Both Build and Runtime

6. Click **"Save"**

7. **Redeploy** - Firebase will rebuild with new variable

**Option B: Via apphosting.yaml (Code-based)**

1. **Edit:** `apphosting.yaml` (line 188)

2. **Replace:**
   ```yaml
   - variable: PUBLIC_GOOGLE_OAUTH_CLIENT_ID
     value: "1044782186913-REPLACEME.apps.googleusercontent.com"
   ```

   **With your actual Client ID:**
   ```yaml
   - variable: PUBLIC_GOOGLE_OAUTH_CLIENT_ID
     value: "1044782186913-abc123def456ghi789.apps.googleusercontent.com"
   ```

3. **Commit and push:**
   ```bash
   git add apphosting.yaml
   git commit -m "Configure Google OAuth Client ID for CBRS"
   git push origin main
   ```

4. **Wait for auto-deployment** (~5 minutes)

---

## ✅ Step 3: Verify Configuration

After deployment:

1. **Hard refresh browser** (`Ctrl + F5`)
2. **Go to CBRS Management** → **Settings** ⚙️
3. **Click "Sign in with Google"**
4. **Popup should open** with Google sign-in page ✅

**If you see an error message:**
- "OAuth Client ID not configured" = Step 2 wasn't completed
- "Popup blocked" = Allow popups in browser
- "Invalid client" = Client ID is wrong, check copy/paste

---

## 🎨 What Users Will See

**Settings Modal:**
```
⚙️ CBRS Configuration

🏢 Shared Platform Mode - Google SAS

🔵 Google SAS Authentication

┌────────────────────────────────────────────┐
│                                            │
│    [🔵 Sign in with Google]                │
│                                            │
│    Sign in with your Google account       │
│    registered for SAS API access          │
│                                            │
└────────────────────────────────────────────┘

Google User ID *
┌──────────────────┐
│ isp-supplies     │
└──────────────────┘

Google Account Email *
┌─────────────────────────┐
│ (auto-fills after login)│
└─────────────────────────┘
```

**After clicking "Sign in with Google":**

→ Popup opens with Google's standard sign-in page  
→ User selects their Google account  
→ Grants permission  
→ Popup closes automatically  
→ Email auto-fills in the form! ✅

---

## 🔒 Security Notes

- ✅ OAuth Client ID is **public** (safe to commit to git)
- ✅ Access token is **per-user, per-tenant**
- ✅ Tokens stored in localStorage
- ✅ Tokens auto-expire after 1 hour
- ✅ Refresh authentication by signing in again

---

## 📋 Quick Checklist

### **Setup (One-Time):**
- [ ] Create OAuth Client ID in Google Cloud Console
- [ ] Add authorized origins (production + localhost)
- [ ] Add redirect URIs (/oauth/google/callback)
- [ ] Copy the Client ID
- [ ] Update `PUBLIC_GOOGLE_OAUTH_CLIENT_ID` in Firebase
- [ ] Deploy (auto or manual)
- [ ] Test the sign-in flow

### **For Each User:**
- [ ] Open CBRS Settings
- [ ] Click "Sign in with Google"
- [ ] Allow popup if browser asks
- [ ] Sign in with Google account
- [ ] Email auto-fills
- [ ] Enter User ID
- [ ] Save configuration
- [ ] Done! ✅

---

## 🚀 Deployment

**After updating `apphosting.yaml`:**

```bash
git add apphosting.yaml
git commit -m "Configure Google OAuth Client ID"
git push origin main
```

Firebase will automatically:
1. ✅ Detect the push
2. ✅ Rebuild with new environment variable
3. ✅ Deploy to App Hosting
4. ✅ OAuth will work! (~5 minutes)

**Or update via Firebase Console** (instant):
1. App Hosting → Environment variables
2. Add `PUBLIC_GOOGLE_OAUTH_CLIENT_ID`
3. Redeploy

---

## 📞 Need Help?

**Can't create OAuth Client ID:**
- Make sure you're an owner/editor of the Google Cloud project
- Enable "Google+ API" if prompted

**Popup doesn't open:**
- Browser blocked it - look for blocked popup icon
- Click icon and "Always allow popups from this site"

**OAuth fails with "Invalid client":**
- Double-check Client ID in `apphosting.yaml`
- Make sure authorized origins include your domain
- Make sure redirect URIs include `/oauth/google/callback`

---

**Status:** Ready to configure ✅  
**Effort:** 5 minutes one-time setup  
**Benefit:** Professional Google OAuth authentication

