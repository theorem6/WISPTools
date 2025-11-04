# Firebase Authentication Authorized Domains

This document lists all domains that need to be added to Firebase Authentication's authorized domains list.

## Required Domains

### Production Hosting Sites

1. **wisptools-io.web.app**
   - Default Firebase Hosting URL for `wisptools-io` site
   - Status: ✅ Needs to be added

2. **wisptools-io.firebaseapp.com**
   - Legacy Firebase Hosting URL for `wisptools-io` site
   - Status: ✅ Needs to be added

3. **lte-pci-mapper-65450042-bbf71.web.app**
   - Default Firebase Hosting URL for default site
   - Status: ✅ Needs to be added

4. **lte-pci-mapper-65450042-bbf71.firebaseapp.com**
   - Legacy Firebase Hosting URL for default site
   - Status: ✅ Needs to be added

### Custom Domain

5. **wisptools.io**
   - Custom domain connected to `wisptools-io` hosting site
   - Status: ⚠️ Currently causing OAuth errors - needs to be added

### Development

6. **localhost**
   - Local development environment
   - Status: ✅ Usually added by default, verify it exists

### Firebase App Domain

7. **lte-pci-mapper-65450042-bbf71.firebaseapp.com**
   - This is the authDomain in firebase.ts
   - Status: ✅ Should already be authorized

## How to Add Domains

### Via Firebase Console (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `lte-pci-mapper-65450042-bbf71`
3. Navigate to: **Authentication** → **Settings** → **Authorized domains** tab
4. Click **Add domain** for each domain listed above
5. Enter the domain name (e.g., `wisptools.io`)
6. Click **Add**

### Domains to Add

Add these domains one by one:

```
wisptools-io.web.app
wisptools-io.firebaseapp.com
lte-pci-mapper-65450042-bbf71.web.app
lte-pci-mapper-65450042-bbf71.firebaseapp.com
wisptools.io
```

**Note:** `localhost` should already be there by default.

## Verification

After adding domains, test authentication:

1. Visit `https://wisptools.io/login`
2. Try to sign in with email/password or Google OAuth
3. Check browser console for any OAuth domain errors
4. Verify redirect works correctly after authentication

## Current Status

- [x] wisptools-io.web.app ✅ Added
- [x] wisptools-io.firebaseapp.com ✅ Added
- [x] lte-pci-mapper-65450042-bbf71.web.app ✅ Added
- [x] lte-pci-mapper-65450042-bbf71.firebaseapp.com ✅ Added
- [x] wisptools.io ✅ Added
- [x] localhost ✅ Verified

## Troubleshooting

If you see errors like:
```
The current domain is not authorized for OAuth operations. 
Add your domain (wisptools.io) to the OAuth redirect domains list
```

This means the domain is not yet authorized. Follow the steps above to add it.
