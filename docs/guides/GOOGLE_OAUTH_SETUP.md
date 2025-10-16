# Google OAuth Setup for CBRS Module

**Purpose:** Enable Google Sign-In popup for CBRS/Google SAS authentication

## 🎯 What This Does

The CBRS module now includes a **"Sign in with Google"** button that:
- ✅ Opens a Google OAuth popup
- ✅ User signs in with their Google account (e.g., `david@4gengineer.com`)
- ✅ Automatically fills the Google Account Email field
- ✅ Provides Google OAuth access token for Google SAS API calls
- ✅ Stores token per-tenant with automatic expiration handling

---

## ⚙️ ONE-TIME SETUP REQUIRED

You need to create a Google OAuth Client ID for your application.

### **Step 1: Create OAuth Client ID in Google Cloud Console**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **lte-pci-mapper-65450042-bbf71**
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Choose application type: **Web application**
6. Configure:

   **Name:**
   ```
   LTE PCI Mapper - CBRS OAuth
   ```

   **Authorized JavaScript origins:**
   ```
   https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app
   http://localhost:5173
   http://localhost:4173
   ```

   **Authorized redirect URIs:**
   ```
   https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/oauth/google/callback
   http://localhost:5173/oauth/google/callback
   http://localhost:4173/oauth/google/callback
   ```

7. Click **Create**

8. **Copy the Client ID** - you'll need it next!

---

### **Step 2: Update the Client ID in Code**

**File to edit:** `Module_Manager/src/lib/services/googleOAuthService.ts`

**Find this line (line 17):**
```typescript
const GOOGLE_CLIENT_ID = '1044782186913-yourappclientid.apps.googleusercontent.com';
```

**Replace with your actual Client ID:**
```typescript
const GOOGLE_CLIENT_ID = '1044782186913-abc123xyz456.apps.googleusercontent.com';
```

---

### **Step 3: Commit and Push**

```bash
git add Module_Manager/src/lib/services/googleOAuthService.ts
git commit -m "Configure Google OAuth Client ID for CBRS"
git push origin main
```

This will trigger automatic deployment! ✅

---

## 🔐 Required Google Cloud APIs

Make sure these APIs are enabled in your Google Cloud project:

1. **Google Cloud Platform API** ✅
   - For general cloud resource access

2. **People API** ✅ (or Identity Toolkit API)
   - For getting user email/profile

3. **Spectrum Access System API** ✅
   - For Google SAS calls (if available)

**To enable:**
1. Go to **APIs & Services** → **Library**
2. Search for each API
3. Click **Enable**

---

## 📱 How Users Will Use It

### **CBRS Settings Flow:**

1. User opens **CBRS Management** module
2. Clicks **⚙️ Settings** button
3. Sees this interface:

```
🔵 Google SAS Authentication

┌─────────────────────────────────────────────┐
│  [🔵 Sign in with Google]                   │
│  Sign in with your Google account           │
│  registered for SAS API access              │
└─────────────────────────────────────────────┘

Google User ID *
┌──────────────────────┐
│ FRN-123456789        │
└──────────────────────┘

Google Account Email *
┌──────────────────────┐
│ (fills after signin) │
└──────────────────────┘
```

4. **User clicks "Sign in with Google"**
5. **Popup opens** with Google sign-in page
6. **User signs in** with `david@4gengineer.com`
7. **Popup closes** automatically
8. **Email auto-fills** in the form ✅
9. **Status shows:** `✅ Signed in as: david@4gengineer.com`
10. User fills **Google User ID**
11. User saves configuration
12. **Done!** 🎉

---

## 🔄 OAuth Flow Diagram

```
User clicks "Sign in with Google"
  ↓
Popup opens: accounts.google.com/o/oauth2/v2/auth
  ↓
User signs in with Google account
  ↓
Google redirects to: /oauth/google/callback
  ↓
Callback page extracts access_token from URL
  ↓
Sends token to parent window via postMessage
  ↓
Parent window receives token
  ↓
Token saved to localStorage (per-tenant)
  ↓
Email auto-filled in form
  ↓
Status shows: "✅ Signed in as: email@gmail.com"
  ↓
Popup closes automatically
```

---

## 🔑 OAuth Token Usage

After user signs in, the token is used for all Google SAS API calls:

```typescript
// In proxySASRequest Cloud Function:
headers: {
  'Authorization': 'Bearer {platform_api_key}',
  'X-User-Email': 'david@4gengineer.com',  // From OAuth
  'X-User-Id': 'isp-supplies',             // User configured
  'X-OAuth-Token': '{user_google_oauth_token}' // From OAuth popup
}
```

The token identifies the user to Google SAS and provides proof they're authorized.

---

## 💾 Token Storage

**Where tokens are stored:**
- `localStorage: google_oauth_{tenantId}`
- Per-tenant isolation
- Automatically cleared on expiration
- User can sign out and re-authenticate

**Token contents:**
```json
{
  "accessToken": "ya29.a0AfH6SMB...",
  "expiresAt": 1728954000000,
  "email": "david@4gengineer.com",
  "refreshToken": "optional"
}
```

---

## 🧪 Testing

### **Test OAuth Flow:**

1. Open CBRS Settings
2. Click "Sign in with Google"
3. **Allow popups** when browser prompts
4. Google sign-in page should open in popup
5. Sign in with your Google account
6. Popup should close automatically
7. Email should auto-fill in the form
8. Status should show: "✅ Signed in as: your-email@gmail.com"

### **Test Sign Out:**

1. Click "Sign out" button
2. Email field should clear
3. "Sign in with Google" button reappears
4. Can sign in again

### **Test Token Persistence:**

1. Sign in with Google
2. Close settings modal
3. Reopen settings modal
4. Should still show "✅ Signed in as: ..." (token persists)

---

## ⚠️ Important Notes

### **OAuth Client ID Must Be Configured**

The default Client ID is a placeholder:
```typescript
const GOOGLE_CLIENT_ID = '1044782186913-yourappclientid.apps.googleusercontent.com';
```

**You MUST replace this** with your actual OAuth client ID from Google Cloud Console!

### **Popup Blockers**

Users need to **allow popups** for your domain:
- Browser may block popup on first click
- User needs to click "Allow" in browser prompt
- Or add your site to popup allow list

### **HTTPS Required**

Google OAuth requires HTTPS in production:
- ✅ Your Firebase hosting uses HTTPS
- ✅ OAuth will work in production
- ✅ Localhost works for development

---

## 🎨 UI Preview

**Before Sign-In:**
```
┌──────────────────────────────────────┐
│  🔵 Google SAS Authentication        │
├──────────────────────────────────────┤
│                                      │
│  ╔════════════════════════════╗      │
│  ║  🔵 Sign in with Google    ║      │
│  ╚════════════════════════════╝      │
│                                      │
│  Sign in with your Google account   │
│  registered for SAS API access      │
│                                      │
└──────────────────────────────────────┘
```

**After Sign-In:**
```
┌──────────────────────────────────────┐
│  🔵 Google SAS Authentication        │
├──────────────────────────────────────┤
│                                      │
│  ✅ Signed in as:                    │
│     david@4gengineer.com             │
│                       [Sign out]     │
│                                      │
│  Google User ID *                    │
│  ┌──────────────────────┐            │
│  │ isp-supplies         │            │
│  └──────────────────────┘            │
│                                      │
│  Google Account Email *              │
│  ┌──────────────────────────┐        │
│  │ david@4gengineer.com     │ 🔒     │
│  └──────────────────────────┘        │
│  ✅ Auto-filled from Google sign-in  │
│                                      │
└──────────────────────────────────────┘
```

---

## 🚀 Next Steps

1. **Create OAuth Client ID** in Google Cloud Console
2. **Update Client ID** in `googleOAuthService.ts`
3. **Commit and push** the change
4. **Wait for auto-deployment** (~5 mins)
5. **Test the OAuth flow!**

---

## 📞 Support

**Popup doesn't open:**
- Check if popups are blocked in browser
- Look for popup blocker icon in address bar
- Add site to allowed list

**OAuth fails with error:**
- Verify Client ID is correct
- Check authorized origins include your domain
- Check redirect URIs include `/oauth/google/callback`

**Token expires:**
- Normal - tokens expire after 1 hour
- User can sign in again
- Or implement refresh token flow (advanced)

---

**Status:** Implemented ✅  
**Requires:** OAuth Client ID configuration  
**User Experience:** Professional Google OAuth popup flow

