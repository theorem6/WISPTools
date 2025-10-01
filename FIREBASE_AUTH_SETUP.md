# Firebase Authentication Setup Guide

## Overview

This guide will help you configure Firebase Authentication and Firestore for the PCI Mapper application.

## Prerequisites

- Firebase project created (you already have: `mapping-772cf`)
- Firebase CLI installed (optional, for index deployment)
- Admin access to Firebase Console

## Step-by-Step Setup

### 1. Enable Email/Password Authentication

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: `mapping-772cf`
3. **Navigate to**: Authentication → Sign-in method
4. **Enable Email/Password**:
   - Click on "Email/Password"
   - Toggle "Enable"
   - Click "Save"

### 2. Enable Google Sign-In (Optional)

1. In the same "Sign-in method" tab
2. **Enable Google**:
   - Click on "Google"
   - Toggle "Enable"
   - Add your support email
   - Click "Save"

### 3. Deploy Firestore Indexes

The app requires a composite index for querying networks. You have two options:

#### Option A: Auto-Create via Console (Easiest)

1. **Try to use the app** - you'll see the index error
2. **Click the link** in the error message
3. **Firebase Console opens** with the index pre-configured
4. **Click "Create Index"**
5. **Wait 2-5 minutes** for index to build

#### Option B: Deploy via Firebase CLI

```bash
# From your project directory
firebase deploy --only firestore:indexes
```

The index configuration is already in `firestore.indexes.json`:

```json
{
  "collectionGroup": "networks",
  "fields": [
    { "fieldPath": "ownerId", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
}
```

### 4. Configure Firestore Security Rules

Deploy the security rules to protect user data:

```bash
firebase deploy --only firestore:rules
```

The rules in `firestore.rules` ensure:
- Users can only read their own networks
- Users can only create networks for themselves
- Users can only update/delete their own networks

### 5. Verify Configuration

Test that everything works:

1. **Open the app**: Should see login page
2. **Click "Create account"**
3. **Enter email and password**
4. **Click "Create Account"**
5. **Should redirect to main app**
6. **Try creating a network**
7. **Verify data saves to Firestore**

## Common Issues

### Issue 1: "Bad Request" Error on Login

**Cause**: Email/Password authentication not enabled

**Solution**:
1. Go to Firebase Console → Authentication → Sign-in method
2. Enable "Email/Password" provider
3. Refresh the login page

### Issue 2: "The query requires an index"

**Cause**: Firestore composite index not created

**Solution**:
1. Click the link in the error message
2. Or run: `firebase deploy --only firestore:indexes`
3. Wait for index to build (2-5 minutes)

### Issue 3: "Permission denied" on Firestore

**Cause**: Security rules not deployed

**Solution**:
```bash
firebase deploy --only firestore:rules
```

### Issue 4: Google Sign-In doesn't work

**Cause**: Authorized domains not configured

**Solution**:
1. Firebase Console → Authentication → Settings
2. Add your domain to "Authorized domains"
3. For local dev: `localhost` should already be there

### Issue 5: "Project not found"

**Cause**: Firebase config in `.env` file incorrect

**Solution**:
1. Verify all `PUBLIC_FIREBASE_*` variables in `.env`
2. Get correct values from Firebase Console → Project Settings
3. Restart dev server after changing `.env`

## Environment Variables

Ensure your `.env` file has all Firebase variables:

```env
# Firebase Configuration
PUBLIC_FIREBASE_API_KEY=your_api_key_here
PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=your_project_id
PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
PUBLIC_FIREBASE_APP_ID=your_app_id
PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Optional: Gemini AI
PUBLIC_GEMINI_API_KEY=your_gemini_key (optional)
```

## Testing Authentication

### Test Email/Password Sign Up

1. Open login page
2. Click "Create account"
3. Fill in:
   - Email: `test@example.com`
   - Password: `test123` (at least 6 chars)
   - Confirm password: `test123`
4. Click "Create Account"
5. Should redirect to main app

### Test Email/Password Sign In

1. Use same credentials from sign up
2. Should successfully sign in
3. Networks should load (empty at first)

### Test Google Sign In

1. Click "Continue with Google"
2. Select Google account
3. Should redirect to main app

### Test Sign Out

1. Click user profile (top right)
2. Click "Sign Out"
3. Should redirect to login page

## Production Deployment

### Before deploying to production:

1. **Review Security Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Deploy Indexes**:
   ```bash
   firebase deploy --only firestore:indexes
   ```

3. **Configure Authorized Domains**:
   - Add your production domain
   - Firebase Console → Authentication → Settings → Authorized domains

4. **Enable Required Providers**:
   - Ensure Email/Password is enabled
   - Enable Google if you want OAuth

5. **Test Thoroughly**:
   - Create test account
   - Create test network
   - Verify data persistence
   - Test on multiple devices

## Firebase Console Quick Links

Replace `mapping-772cf` with your project ID:

- **Authentication**: https://console.firebase.google.com/project/mapping-772cf/authentication
- **Firestore**: https://console.firebase.google.com/project/mapping-772cf/firestore
- **Indexes**: https://console.firebase.google.com/project/mapping-772cf/firestore/indexes
- **Rules**: https://console.firebase.google.com/project/mapping-772cf/firestore/rules
- **Project Settings**: https://console.firebase.google.com/project/mapping-772cf/settings

## Quick Setup Checklist

- [ ] Enable Email/Password authentication
- [ ] (Optional) Enable Google authentication
- [ ] Deploy Firestore indexes (`firebase deploy --only firestore:indexes`)
- [ ] Deploy Firestore rules (`firebase deploy --only firestore:rules`)
- [ ] Test sign up with email
- [ ] Test sign in with email
- [ ] Test creating a network
- [ ] Verify data appears in Firestore Console
- [ ] Test sign out
- [ ] Test from different browser/device

## Summary

Once Firebase is configured:

✅ **Authentication works** - Email/password and Google  
✅ **Networks persist** - Data saved to Firestore  
✅ **Multi-user ready** - Each user has their own data  
✅ **Production ready** - Secure and scalable  

Your PCI Mapper will be **fully functional** with cloud persistence! 🚀

---

**Need Help?**

If you encounter issues:
1. Check Firebase Console for error logs
2. Review browser console for detailed errors
3. Verify all environment variables are set
4. Ensure Firebase project is on Blaze (pay-as-you-go) plan if needed

