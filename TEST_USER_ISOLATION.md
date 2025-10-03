# 🧪 Testing User Network Isolation

## Quick Test: Verify Users Cannot See Each Other's Networks

### Step-by-Step Test

#### 1️⃣ Create First User & Network

```bash
# Open your app: https://your-app-url.web.app
```

1. **Sign Up** as User A (e.g., `usera@test.com`)
2. **Create a network** called "User A Network"
3. **Add some cells** to the network
4. **Note the network ID** (visible in URL or network manager)
5. **Sign Out**

#### 2️⃣ Create Second User

1. **Sign Up** as User B (e.g., `userb@test.com`)
2. **Check network list** - should be EMPTY
3. ✅ **Expected:** User B sees NO networks (User A's network is hidden)

#### 3️⃣ Create Network for User B

1. **Create a network** called "User B Network"
2. **Add some cells**
3. ✅ **Expected:** User B only sees "User B Network"

#### 4️⃣ Switch Back to User A

1. **Sign Out** from User B
2. **Sign In** as User A (`usera@test.com`)
3. ✅ **Expected:** User A only sees "User A Network" (not User B's network)

### ✅ PASS Criteria

- ✅ User A cannot see User B's networks
- ✅ User B cannot see User A's networks
- ✅ Each user only sees their own networks
- ✅ Network counts are different for each user

### ❌ FAIL Criteria (Security Issue)

- ❌ User sees networks they didn't create
- ❌ User can access another user's network by URL
- ❌ Network list shows all users' networks

---

## Advanced Test: Try to Access Another User's Network by ID

### Using Browser DevTools

#### 1️⃣ Get Another User's Network ID

1. Sign in as **User A**
2. Open **DevTools** (F12)
3. **Console** tab
4. Run:
```javascript
import { networkStore } from '$lib/stores/networkStore';
const networks = networkStore.subscribe(s => console.log('Networks:', s.networks));
// Copy a network ID
```
5. **Copy** one of User A's network IDs
6. **Sign Out**

#### 2️⃣ Try to Access as Different User

1. Sign in as **User B**
2. Open **DevTools** → **Console**
3. Try to access User A's network:

```javascript
import { networkService } from '$lib/services/networkService';
const userANetworkId = 'PASTE_USER_A_NETWORK_ID_HERE';

// Try to get User A's network
const result = await networkService.getNetwork(userANetworkId);
console.log('Result:', result);
```

#### ✅ Expected Result:

```javascript
{
  success: false,
  error: "Missing or insufficient permissions"
}
```

**OR**

```javascript
{
  success: false,
  error: "Network not found"
}
```

#### ❌ Security Issue if:

```javascript
{
  success: true,
  data: { /* User A's network data */ }  // ❌ This should NOT happen!
}
```

---

## Firestore Rules Verification

### Check Rules in Firebase Console

1. Go to: **Firebase Console** → **Firestore Database** → **Rules**
2. Verify you see:

```javascript
match /networks/{networkId} {
  // Only owner can read
  allow read: if isOwner(resource.data.ownerId);
  
  // Only authenticated users can create (as themselves)
  allow create: if isAuthenticated() 
                && request.resource.data.ownerId == request.auth.uid;
  
  // Only owner can update
  allow update: if isOwner(resource.data.ownerId);
  
  // Only owner can delete
  allow delete: if isOwner(resource.data.ownerId);
}
```

### Deploy Rules (If Not Deployed)

```bash
# In your project directory
firebase deploy --only firestore:rules
```

---

## Monitoring Security in Production

### Firebase Console - Monitor Access

1. **Firestore Database** → **Usage**
2. Check for:
   - Failed read/write attempts (permission denied)
   - Unusual access patterns

### Check Logs

```bash
# View Firestore security rule violations
firebase projects:logs --only firestore
```

---

## Common Security Issues (What NOT to Do)

### ❌ Bad: Client-Side Filtering Only

```typescript
// BAD - Don't do this!
const allNetworks = await getDocs(collection(db, 'networks'));
const myNetworks = allNetworks.filter(net => net.ownerId === currentUserId);
```

**Problem:** Fetches ALL networks (fails with Firestore rules anyway)

### ✅ Good: Server-Side Filtering

```typescript
// GOOD - Filter at database level
const q = query(
  collection(db, 'networks'),
  where('ownerId', '==', currentUserId)  // ← Enforced by Firestore
);
const myNetworks = await getDocs(q);
```

---

## Security Checklist

Before deploying to production, verify:

- [ ] **Firestore rules deployed** (`firebase deploy --only firestore:rules`)
- [ ] **Rules require authentication** (check `isAuthenticated()`)
- [ ] **Rules check ownership** (check `isOwner()`)
- [ ] **App queries by ownerId** (check `networkService.ts`)
- [ ] **No admin/bypass logic** in client code
- [ ] **Tested with multiple users** (manual test above)
- [ ] **Production Firebase API keys** are set correctly

---

## Emergency: If Security Issue Detected

### 1. Immediate Action

```bash
# Temporarily lock down ALL access
firebase deploy --only firestore:rules

# Edit firestore.rules to:
match /{document=**} {
  allow read, write: if false;  // Block everything
}
```

### 2. Investigate

1. Check Firebase Console → **Firestore** → **Usage**
2. Review recent reads/writes
3. Check who accessed what data

### 3. Fix & Redeploy

```bash
# After fixing rules
firebase deploy --only firestore:rules

# Verify rules
firebase firestore:rules get
```

---

## Summary

**Your app is secure IF:**

- ✅ Firestore rules are deployed
- ✅ Rules check `ownerId` matches `request.auth.uid`
- ✅ App always queries with `where('ownerId', '==', userId)`
- ✅ Tests confirm users cannot see each other's data

**Test regularly to ensure security remains intact!**

---

**Last Updated:** October 3, 2025

