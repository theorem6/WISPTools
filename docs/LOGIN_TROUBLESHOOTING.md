# Login Troubleshooting Guide

## Issues Fixed

1. **Firebase Project References Updated**
   - All Cloud Function URLs updated from `lte-pci-mapper-65450042-bbf71` to `wisptools-production`
   - Files updated:
     - `Module_Manager/src/lib/services/customerService.ts`
     - `Module_Manager/src/lib/services/tenantService.ts`
     - `Module_Manager/src/lib/services/apiService.ts`

2. **Frontend Rebuilt and Redeployed**
   - Build completed successfully
   - Deployed to `wisptools-prod` hosting site
   - URL: https://wisptools-prod.web.app

## Remaining Manual Steps

### 1. Enable Firebase Authentication
**Firebase Console → Authentication → Sign-in method**
- Enable **Email/Password** provider
- Enable **Google** provider (if using Google Sign-In)

### 2. Add Authorized Domains
**Firebase Console → Authentication → Settings → Authorized domains**
Add these domains:
- `wisptools-prod.web.app`
- `wisptools-prod.firebaseapp.com`
- `wisptools-production.web.app`
- `wisptools-production.firebaseapp.com`
- `wisptools.io` (if custom domain is connected)

### 3. Migrate Users (if needed)
If you have users in the old project:
```bash
# Export from old project
firebase auth:export users_old.json --project lte-pci-mapper-65450042-bbf71

# Import to new project
firebase auth:import users_old.json --project wisptools-production
```

### 4. Test Login
1. Visit: https://wisptools-prod.web.app/login
2. Try logging in with existing credentials
3. Check browser console for errors
4. Check Firebase Console → Authentication → Users for successful login

## Common Issues

### "Invalid credentials"
- Verify Email/Password provider is enabled
- Check if user exists in Firebase Authentication
- Verify password is correct

### "Domain not authorized"
- Add domain to Authorized domains list
- Wait a few minutes for changes to propagate

### "Authentication provider disabled"
- Enable Email/Password in Sign-in methods
- Save changes

### Console Errors
- Check browser console for specific error messages
- Verify Firebase config in `Module_Manager/src/lib/firebase.ts`
- Ensure correct project ID: `wisptools-production`

## Verification Checklist

- [ ] Email/Password provider enabled
- [ ] Google provider enabled (if using)
- [ ] All domains added to Authorized domains
- [ ] Frontend deployed to `wisptools-prod`
- [ ] Functions deployed to `wisptools-production`
- [ ] Users migrated (if needed)
- [ ] Login tested on https://wisptools-prod.web.app

## Current Configuration

- **Project ID**: `wisptools-production`
- **Web App ID**: `1:1048161130237:web:160789736967985b655094`
- **Hosting Site**: `wisptools-prod`
- **Hosting URL**: https://wisptools-prod.web.app
- **Functions Region**: `us-central1`
- **Firestore**: Enabled (us-central1)

