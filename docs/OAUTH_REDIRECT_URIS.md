# OAuth Redirect URIs Configuration

This document lists all OAuth redirect URIs that need to be configured in Google Cloud Console for Google Sign-In to work properly.

## Login / Signup Google Auth (Module_Manager)

The login and signup pages use **direct Google OAuth** with callback at `/auth/google/callback`.  
Production app URL: **https://wisptools.io**.  
OAuth client ID: `VITE_GOOGLE_AUTH_CLIENT_ID` or `PUBLIC_GOOGLE_AUTH_CLIENT_ID` (Firebase Web client for wisptools-production).

**Authorized redirect URIs for this client must include:**

- **https://wisptools.io/auth/google/callback** (production)
- `https://wisptools-production.web.app/auth/google/callback` (if using Firebase hosting)
- `https://wisptools-production.firebaseapp.com/auth/google/callback` (Firebase app domain)
- `http://localhost:5173/auth/google/callback` (development)

**Authorized JavaScript origins:** `https://wisptools.io`, `http://localhost:5173`, and any Firebase preview/hosting origins you use.

---

## CBRS / Google SAS (oauth path)

### Production Domains

1. **https://wisptools.io/oauth/google/callback**
2. **https://wisptools-io.web.app/oauth/google/callback**
3. **https://wisptools-io.firebaseapp.com/oauth/google/callback**
4. **https://lte-pci-mapper-65450042-bbf71.web.app/oauth/google/callback**
5. **https://lte-pci-mapper-65450042-bbf71.firebaseapp.com/oauth/google/callback**

### Development

6. **http://localhost:5173/oauth/google/callback**

## How to Add Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: `lte-pci-mapper-65450042-bbf71` (or your project)
3. Navigate to: **APIs & Services** → **Credentials**
4. Find your **OAuth 2.0 Client ID** (or create one if needed)
5. Click **Edit** (pencil icon)
6. Under **Authorized redirect URIs**, click **+ ADD URI**
7. Add each URI from the list above
8. Click **Save**

## Firebase Authentication Redirect URIs

Firebase Authentication also needs these domains authorized (already done):

- ✅ `wisptools.io`
- ✅ `wisptools-io.web.app`
- ✅ `wisptools-io.firebaseapp.com`
- ✅ `lte-pci-mapper-65450042-bbf71.web.app`
- ✅ `lte-pci-mapper-65450042-bbf71.firebaseapp.com`
- ✅ `localhost`

## Verification

**Login/signup flow:**

1. Test Google Sign-In on `https://wisptools.io/login` (or your app URL).
2. Click "Sign in with Google".
3. Complete OAuth flow.
4. Should redirect to `https://<your-domain>/auth/google/callback` (with token in hash), then to dashboard or signup.

**CBRS flow:** Same steps but callback is `/oauth/google/callback`.

## Common Errors

### Error 400: redirect_uri_mismatch

**Error:**
```
Error 400: redirect_uri_mismatch
The redirect URI in the request does not match the ones authorized for the OAuth client.
```

**Fix:**
- Verify the redirect URI is exactly in the list above
- Check for typos (trailing slashes, http vs https)
- Ensure the domain matches exactly

### OAuth callback not working

**Check:**
- Login/signup: callback route is `/auth/google/callback` (Module_Manager).
- CBRS: callback route is `/oauth/google/callback`.
- Route is accessible (not blocked by middleware).
- Session storage is working (for OAuth state).

