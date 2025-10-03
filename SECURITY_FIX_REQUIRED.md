# 🚨 CRITICAL: Security Rules Not Deployed

## ❌ Current Problem

**You can see other users' networks because DEVELOPMENT rules are deployed!**

### What's Wrong:

The file `firestore.rules.dev` contains **development rules** that allow ANY authenticated user to see ALL networks:

```javascript
// firestore.rules.dev (INSECURE!)
match /networks/{networkId} {
  allow read: if isAuthenticated();  // ❌ ANY user can read ANY network!
  allow create: if isAuthenticated();
  allow update: if isAuthenticated();
  allow delete: if isAuthenticated();
}
```

### What Should Be Deployed:

The file `firestore.rules` contains **production rules** that enforce user isolation:

```javascript
// firestore.rules (SECURE!)
match /networks/{networkId} {
  allow read: if isOwner(resource.data.ownerId);  // ✅ Only owner can read
  allow create: if isAuthenticated() 
                && request.resource.data.ownerId == request.auth.uid;
  allow update: if isOwner(resource.data.ownerId);
  allow delete: if isOwner(resource.data.ownerId);
}
```

---

## ✅ Solution: Deploy Production Rules

### Option 1: Using the Deploy Script (Recommended)

#### On Windows (PowerShell):
```powershell
.\deploy-prod-rules.ps1
```

#### On Mac/Linux:
```bash
chmod +x deploy-prod-rules.sh
./deploy-prod-rules.sh
```

### Option 2: Manual Deployment

```bash
# 1. Install Firebase CLI (if not installed)
npm install -g firebase-tools

# 2. Login to Firebase
firebase login

# 3. Select your project
firebase use lte-pci-mapper-65450042-bbf71

# 4. Deploy PRODUCTION rules
firebase deploy --only firestore:rules
```

### Option 3: Firebase Console (Web UI)

1. Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore/rules
2. **Replace** the rules with the contents of `firestore.rules`
3. Click **Publish**

---

## 🧪 How to Verify It's Fixed

### Test 1: Create Two Users

1. **Sign in as User A** (e.g., `usera@test.com`)
2. Create a network called "User A Network"
3. **Sign out**
4. **Sign in as User B** (e.g., `userb@test.com`)
5. **Check:** You should see ZERO networks (not User A's network)

### Test 2: Check Firebase Console

1. Go to **Firestore Database** → **Rules**
2. Verify you see:
   ```javascript
   allow read: if isOwner(resource.data.ownerId);
   ```
   NOT:
   ```javascript
   allow read: if isAuthenticated();  // ❌ This is insecure!
   ```

---

## 🔍 Understanding the Files

| File | Purpose | Security |
|------|---------|----------|
| `firestore.rules` | **Production** rules | ✅ SECURE - User isolation |
| `firestore.rules.dev` | **Development** rules | ❌ INSECURE - No user isolation |
| `firebase.json` | Deployment config | Points to `firestore.rules` |

**ALWAYS deploy `firestore.rules` in production!**

---

## 📋 Complete Security Checklist

After deploying production rules, verify:

- [ ] Deployed using: `firebase deploy --only firestore:rules`
- [ ] Firebase Console shows the production rules
- [ ] Rules contain `isOwner()` checks
- [ ] Rules check `request.auth.uid == ownerId`
- [ ] Tested with two different user accounts
- [ ] User A cannot see User B's networks
- [ ] User B cannot see User A's networks

---

## ⚠️ Never Deploy Dev Rules to Production!

The `firestore.rules.dev` file is **only for local testing** when you want to quickly test without security constraints.

**NEVER run:**
```bash
# ❌ DON'T DO THIS IN PRODUCTION!
firebase deploy --only firestore:rules --config firestore.rules.dev
```

**ALWAYS run:**
```bash
# ✅ CORRECT - Deploys production rules
firebase deploy --only firestore:rules
```

---

## 🚀 Quick Fix Command

Copy and paste this command to fix immediately:

```bash
firebase deploy --only firestore:rules
```

Or use the PowerShell script:

```powershell
.\deploy-prod-rules.ps1
```

---

## 📊 Before vs After

### Before (INSECURE):
- User A creates network → User B can see it ❌
- User B creates network → User A can see it ❌
- ALL users see ALL networks ❌

### After (SECURE):
- User A creates network → User B CANNOT see it ✅
- User B creates network → User A CANNOT see it ✅
- Each user only sees their own networks ✅

---

## 🆘 If You Have Issues

### Issue: "Firebase CLI not found"

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Verify installation
firebase --version
```

### Issue: "Permission denied"

```bash
# Re-authenticate
firebase login --reauth

# Check which project is active
firebase use
```

### Issue: "Rules still not working"

1. Clear browser cache and reload
2. Wait 1-2 minutes for rules to propagate
3. Sign out and sign in again
4. Check Firebase Console Rules tab

---

## ✅ Summary

**Problem:** Development rules allow all users to see all networks

**Solution:** Deploy production rules with user isolation

**Command:** `firebase deploy --only firestore:rules`

**Test:** Sign in with two accounts and verify isolation

---

**Last Updated:** October 3, 2025

