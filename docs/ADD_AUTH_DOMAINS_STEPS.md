# Step-by-Step: Add Domains to Firebase Authentication

## Quick Steps

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com/
   - Select project: `lte-pci-mapper-65450042-bbf71`

2. **Navigate to Authentication Settings**
   - Click **Authentication** in the left sidebar
   - Click **Settings** tab
   - Scroll to **Authorized domains** section

3. **Add Each Domain**

   Click **Add domain** and add these one by one:

   ✅ **wisptools-io.web.app**
   - Click "Add domain"
   - Enter: `wisptools-io.web.app`
   - Click "Add"

   ✅ **wisptools-io.firebaseapp.com**
   - Click "Add domain"
   - Enter: `wisptools-io.firebaseapp.com`
   - Click "Add"

   ✅ **wisptools.io**
   - Click "Add domain"
   - Enter: `wisptools.io`
   - Click "Add"

   ✅ **lte-pci-mapper-65450042-bbf71.web.app**
   - Click "Add domain"
   - Enter: `lte-pci-mapper-65450042-bbf71.web.app`
   - Click "Add"

   ✅ **lte-pci-mapper-65450042-bbf71.firebaseapp.com**
   - Click "Add domain"
   - Enter: `lte-pci-mapper-65450042-bbf71.firebaseapp.com`
   - Click "Add"

4. **Verify**
   - You should see all domains listed in the authorized domains section
   - `localhost` should already be there by default

## Direct Link

You can go directly to the authorized domains page:
https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/authentication/settings

## What This Fixes

After adding these domains:
- ✅ OAuth redirects will work on `wisptools.io`
- ✅ Email/password authentication will work on all hosting URLs
- ✅ Google Sign-In will work on all domains
- ✅ No more "domain not authorized" errors

## Verification Test

After adding domains, test:
1. Visit `https://wisptools.io/login`
2. Try signing in with email/password
3. Try signing in with Google OAuth
4. Check browser console - should see no OAuth domain errors

