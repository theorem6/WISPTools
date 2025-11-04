# Firebase Domain Setup Errors

This document lists all common errors related to Firebase Authentication domain configuration and how to fix them.

## Common Domain Errors

### 1. OAuth Domain Not Authorized

**Error Message:**
```
The current domain is not authorized for OAuth operations. 
Add your domain (wisptools.io) to the OAuth redirect domains list in the Firebase console -> Authentication -> Settings -> Authorized domains tab.
```

**Where it appears:**
- Browser console when trying to use Google Sign-In
- OAuth redirect attempts fail silently
- User sees generic authentication errors

**Fix:**
1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Click "Add domain"
3. Enter the domain (e.g., `wisptools.io`)
4. Click "Add"

**Required Domains:**
- `wisptools.io` (custom domain)
- `wisptools-io.web.app` (Firebase Hosting)
- `wisptools-io.firebaseapp.com` (legacy Firebase Hosting)
- `lte-pci-mapper-65450042-bbf71.web.app` (default site)
- `lte-pci-mapper-65450042-bbf71.firebaseapp.com` (legacy default)
- `localhost` (for development)

---

### 2. Firebase Auth Domain Mismatch

**Error Message:**
```
FirebaseError: The domain (wisptools.io) is not authorized for this Firebase project.
```

**Where it appears:**
- Browser console on page load
- When Firebase Auth initializes
- When trying to sign in

**Fix:**
- Ensure `authDomain` in `firebase.ts` matches one of the authorized domains
- Current `authDomain`: `lte-pci-mapper-65450042-bbf71.firebaseapp.com`
- This should work, but if using custom domain, may need to verify configuration

---

### 3. CORS Error on API Calls

**Error Message:**
```
Access to fetch at 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/apiProxy/api/customers' 
from origin 'https://wisptools.io' has been blocked by CORS policy
```

**Where it appears:**
- Browser console when making API calls
- Network tab shows CORS error
- API requests fail with CORS error

**Fix:**
- Backend CORS configuration must include all domains
- Check `backend-services/server.js`:
  ```javascript
  app.use(cors({
    origin: [
      'https://wisptools.io',
      'https://wisptools-io.web.app',
      'https://lte-pci-mapper-65450042-bbf71.web.app'
    ],
    credentials: true
  }));
  ```

---

### 4. Firebase Hosting Rewrite Not Working

**Error Message:**
```
GET https://wisptools.io/api/customers 404 (Not Found)
```

**Where it appears:**
- Browser console when loading customer data
- Network tab shows 404 errors
- API calls fail

**Possible Causes:**
1. Custom domain not properly connected to Firebase Hosting site
2. `firebase.json` rewrite rules not applied to custom domain
3. DNS not fully propagated

**Fix:**
1. Verify custom domain in Firebase Console → Hosting
2. Check DNS records match Firebase requirements
3. Use direct Cloud Function URL as fallback (already implemented in `customerService.ts`)

---

### 5. OAuth Redirect URI Mismatch

**Error Message:**
```
Error 400: redirect_uri_mismatch
The redirect URI in the request (https://wisptools.io/oauth/google/callback) 
does not match the ones authorized for the OAuth client.
```

**Where it appears:**
- Google OAuth callback fails
- Browser redirects to Google error page
- OAuth flow breaks

**Fix:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Find your OAuth 2.0 Client ID
4. Add authorized redirect URIs:
   - `https://wisptools.io/oauth/google/callback`
   - `https://wisptools-io.web.app/oauth/google/callback`
   - `https://lte-pci-mapper-65450042-bbf71.web.app/oauth/google/callback`

---

### 6. Firebase Auth Token Refresh Failed

**Error Message:**
```
FirebaseError: Auth token refresh failed
```

**Where it appears:**
- Browser console when auth token expires
- API calls fail with 401 Unauthorized
- User gets logged out unexpectedly

**Possible Causes:**
- Domain not authorized
- Auth persistence not set correctly
- Network issues

**Fix:**
- Ensure domain is in authorized domains list
- Check `firebase.ts` has `browserLocalPersistence` set
- Verify network connectivity

---

### 7. Invalid Auth Domain in Configuration

**Error Message:**
```
FirebaseError: The provided value for the app's authDomain property is invalid.
```

**Where it appears:**
- Browser console on Firebase initialization
- App fails to load
- Authentication completely broken

**Fix:**
- Check `Module_Manager/src/lib/firebase.ts`
- Ensure `authDomain` matches authorized domain format
- Should be: `lte-pci-mapper-65450042-bbf71.firebaseapp.com` or `wisptools.io`

---

## Error Detection Checklist

### Browser Console Errors

Open browser DevTools (F12) and check for:

1. **OAuth Domain Errors:**
   ```
   [Firebase] The current domain is not authorized
   ```

2. **CORS Errors:**
   ```
   Access to fetch at ... has been blocked by CORS policy
   ```

3. **404 Errors:**
   ```
   GET https://wisptools.io/api/... 404 (Not Found)
   ```

4. **Auth Errors:**
   ```
   FirebaseError: Auth domain not authorized
   ```

### Network Tab Errors

1. Check API requests:
   - Look for 404 status codes
   - Check CORS preflight failures
   - Verify request URLs are correct

2. Check OAuth redirects:
   - Verify redirect URI matches Google OAuth config
   - Check for redirect_uri_mismatch errors

---

## Quick Fix Reference

| Error | Quick Fix |
|-------|-----------|
| Domain not authorized | Add to Firebase Console → Auth → Authorized domains |
| CORS error | Add domain to backend CORS origin list |
| 404 on API calls | Verify Firebase Hosting rewrites or use direct Cloud Function URL |
| OAuth redirect mismatch | Add redirect URI to Google Cloud Console OAuth config |
| Auth token refresh failed | Check domain authorization and network |

---

## Testing Checklist

After fixing domain issues, test:

- [ ] Sign in with email/password on `wisptools.io`
- [ ] Sign in with Google OAuth on `wisptools.io`
- [ ] API calls work (no 404 errors)
- [ ] No CORS errors in console
- [ ] Auth token refreshes correctly
- [ ] User stays logged in after page refresh
- [ ] Redirects work correctly after login

---

## Current Configuration Status

✅ **Authorized Domains (Firebase Auth):**
- `wisptools.io`
- `wisptools-io.web.app`
- `wisptools-io.firebaseapp.com`
- `lte-pci-mapper-65450042-bbf71.web.app`
- `lte-pci-mapper-65450042-bbf71.firebaseapp.com`
- `localhost`

✅ **Hosting Sites:**
- `wisptools-io` (connected to `wisptools.io`)
- `lte-pci-mapper-65450042-bbf71` (default)

✅ **Backend CORS:**
- Configured to accept requests from `wisptools.io` and other hosting URLs

---

## Need Help?

If you're still seeing errors:

1. Check browser console for specific error messages
2. Verify all domains are in Firebase Console → Auth → Authorized domains
3. Check backend logs for CORS or authentication errors
4. Verify DNS propagation for custom domain
5. Test on different hosting URL to isolate custom domain issues

