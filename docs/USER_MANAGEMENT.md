# Firebase User Management Guide

## Quick Solution: Create New User via Signup

1. **Go to the login page:**
   https://wisptools-production.web.app/login

2. **Click "Sign Up" tab** (switch from Sign In to Sign Up)

3. **Enter your email and password** (password must be at least 6 characters)

4. **Click "Sign Up"**

5. **After signup, go to:**
   https://wisptools-production.web.app/setup-admin
   
   This will grant you admin access to your tenants.

---

## Alternative: Create User via Firebase Console

1. Go to: https://console.firebase.google.com/project/wisptools-production/authentication/users

2. Click "Add user"

3. Enter email and password

4. Click "Add user"

---

## Existing Users (need password reset?)

If you need to reset a password for an existing user:

1. Go to: https://console.firebase.google.com/project/wisptools-production/authentication/users

2. Find the user by email

3. Click the user → Click "Reset password"

4. Or use Firebase CLI:
   ```bash
   firebase auth:users:update <email> --password <new-password> --project wisptools-production
   ```

---

## Current Users in System

Based on the export, these users exist:
- `david@tenant.com`
- `josh.lambert@centrevilletech.com`
- `michael@nimbussolutions.org`
- `david@david.com`

If you're trying to login with one of these emails and getting "invalid credentials", the password is incorrect. You'll need to reset it via Firebase Console or create a new account.

