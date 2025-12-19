# Fix Google OAuth Redirect URI Mismatch Error

## Error Message
```
Error 400: redirect_uri_mismatch
Access blocked: This app's request is invalid
```

## Root Cause
The `authDomain` in Firebase config was set to `wisptools.io` (custom domain), but Firebase Auth requires the Firebase project's default domain (e.g., `wisptools-production.firebaseapp.com`) for OAuth redirect URIs. Custom domains work via the authorized domains list, but `authDomain` must be the Firebase hosting domain.

## Solution: Two-Step Fix

### Step 1: Verify Firebase Auth Domain Configuration (Already Done ✅)

The `authDomain` in `firebase.ts` has been fixed to use `wisptools-production.firebaseapp.com` instead of `wisptools.io`. This ensures Firebase Auth uses the correct OAuth redirect URIs.

**Authorized domains in Firebase Console** (already configured):
- ✅ `wisptools.io` (custom domain - allows OAuth from this domain)
- ✅ `wisptools-production.firebaseapp.com` (Firebase hosting)
- ✅ `wisptools-production.web.app` (Firebase hosting)
- ✅ `wisptools-prod.firebaseapp.com` (Firebase hosting)
- ✅ `localhost` (development)

**Important:** The `authDomain` config value must be the Firebase project domain, not the custom domain. Custom domains work via the authorized domains list.

---

### Step 2: Fix Google Cloud Console OAuth Client Redirect URIs (REQUIRED)

Firebase Authentication uses its own OAuth client. You need to add the correct redirect URIs:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/apis/credentials?project=wisptools-production
   - Select project: `wisptools-production`

2. **Find Firebase's OAuth Client**
   - Look for an OAuth 2.0 Client ID named something like:
     - "Web client (auto created by Google Service)"
     - Or one with your Firebase App ID
   - **Note:** There may be multiple OAuth clients - find the one that Firebase Auth uses

3. **Click Edit** (pencil icon) on the Firebase Auth OAuth client

4. **Add Authorized Redirect URIs**
   Under **Authorized redirect URIs**, click **+ ADD URI** and add these **exact** URIs:
   ```
   https://wisptools-production.firebaseapp.com/__/auth/handler
   https://wisptools-production.web.app/__/auth/handler
   https://wisptools-prod.firebaseapp.com/__/auth/handler
   ```

5. **Add Authorized JavaScript Origins**
   Under **Authorized JavaScript origins**, click **+ ADD URI** and add:
   ```
   https://wisptools.io
   https://wisptools-production.web.app
   https://wisptools-production.firebaseapp.com
   https://wisptools-prod.firebaseapp.com
   https://wisptools-production--preview-2ua34jsa.web.app
   http://localhost
   ```

6. **Save Changes**
   - Click **Save** at the bottom
   - **Wait 2-5 minutes** for changes to propagate (Google can take a few minutes)

**Important:** The redirect URIs must match **exactly** - no trailing slashes, correct protocol (https), and exact domain names.

---

## Quick Fix Checklist

- [x] ✅ `wisptools.io` is already in Firebase Authentication → Settings → Authorized domains
- [ ] **REQUIRED:** Added Firebase Auth redirect URIs to Google Cloud Console OAuth client:
  - `https://wisptools-production.firebaseapp.com/__/auth/handler`
  - `https://wisptools-production.web.app/__/auth/handler`
  - `https://wisptools-prod.firebaseapp.com/__/auth/handler`
- [ ] Added JavaScript origins to Google Cloud Console OAuth client
- [ ] Waited 2-5 minutes for changes to propagate
- [ ] Cleared browser cache/cookies
- [ ] Tested Google Sign-In on `https://wisptools.io/login`

---

## Testing

After making changes:

1. **Clear Browser Cache**
   - Clear cookies and cache for `wisptools.io`
   - Or use incognito/private browsing

2. **Test Google Sign-In**
   - Visit: https://wisptools.io/login
   - Click "Sign in with Google"
   - Should redirect to Google sign-in page
   - After signing in, should redirect back to dashboard

3. **Check Browser Console**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Should see no OAuth redirect errors

---

## Common Issues

### Issue: Still Getting Error After Adding Domain
**Solution:** 
- Wait 2-5 minutes for Firebase to propagate changes
- Clear browser cache and cookies
- Try incognito/private browsing mode

### Issue: Different Error After Fix
**Solution:**
- Check browser console for specific error code
- Verify the OAuth client ID matches in both Firebase and Google Cloud Console
- Ensure Email/Password and Google providers are enabled in Firebase Authentication

### Issue: Works on Firebase Hosting but Not Custom Domain
**Solution:**
- Verify custom domain DNS is properly configured
- Check that `wisptools.io` is added to authorized domains (not just Firebase hosting domains)
- Ensure SSL certificate is valid for custom domain

---

## Additional Resources

- [Firebase Auth Authorized Domains Docs](https://firebase.google.com/docs/auth/web/redirect-best-practices)
- [Google OAuth Redirect URI Guide](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred)

