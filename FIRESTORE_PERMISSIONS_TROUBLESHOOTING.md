# 🔐 Firestore Permissions Troubleshooting Guide

## Quick Fix: Use Development Rules (Temporary)

If you're getting permissions errors during setup, temporarily use the more permissive development rules:

```bash
# Backup current rules
cp firestore.rules firestore.rules.backup

# Copy development rules
cp firestore.rules.dev firestore.rules

# Deploy development rules
firebase deploy --only firestore:rules
```

**⚠️ IMPORTANT: Switch back to production rules before going live!**

---

## Common Permission Issues & Solutions

### Issue 1: "Missing or insufficient permissions"

**Symptoms:**
```
FirebaseError: Missing or insufficient permissions.
Code: permission-denied
```

**Causes:**
1. User not authenticated
2. Network doesn't have `ownerId` field
3. `ownerId` doesn't match authenticated user

**Solutions:**

#### A. Check if user is authenticated:
```javascript
// In browser console
import { getAuth } from 'firebase/auth';
const auth = getAuth();
console.log('Current user:', auth.currentUser);
console.log('UID:', auth.currentUser?.uid);
```

#### B. Check network document structure:
```javascript
// Networks must have this structure:
{
  id: "network-id",
  name: "Network Name",
  ownerId: "user-uid-here",        // REQUIRED!
  ownerEmail: "user@example.com",  // REQUIRED!
  cells: [...],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### C. Fix existing networks without ownerId:
```javascript
// Run this in browser console if you have networks without ownerId
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '$lib/firebase';

async function fixNetworks() {
  const networksRef = collection(db, 'networks');
  const snapshot = await getDocs(networksRef);
  const currentUser = auth.currentUser;
  
  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    if (!data.ownerId && currentUser) {
      await updateDoc(doc(db, 'networks', docSnapshot.id), {
        ownerId: currentUser.uid,
        ownerEmail: currentUser.email
      });
      console.log('Fixed network:', docSnapshot.id);
    }
  }
}

fixNetworks();
```

---

### Issue 2: Cannot create new networks

**Symptoms:**
```
Error creating network: Missing or insufficient permissions
```

**Solution:**

Make sure your network creation code includes `ownerId` and `ownerEmail`:

```typescript
// In networkService.ts - createNetwork function
const newNetwork = {
  id: networkId,
  name: networkData.name,
  description: networkData.description || '',
  location: networkData.location || { lat: 0, lng: 0 },
  cells: [],
  ownerId: userId,              // MUST include!
  ownerEmail: userEmail,         // MUST include!
  createdAt: new Date(),
  updatedAt: new Date()
};
```

---

### Issue 3: Cannot read networks

**Symptoms:**
```
No networks showing up
Empty network list
```

**Possible Causes:**
1. Networks exist but don't have `ownerId` field
2. `ownerId` doesn't match current user
3. User not authenticated

**Solutions:**

#### A. Check what networks exist:
In Firebase Console:
1. Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore
2. Click on `networks` collection
3. Check if documents have `ownerId` field
4. Verify `ownerId` matches your user UID

#### B. Get your user UID:
```javascript
// In browser console
import { getAuth } from 'firebase/auth';
console.log('My UID:', getAuth().currentUser?.uid);
```

#### C. Update networks to include your UID:
Manually in Firebase Console:
1. Open each network document
2. Add field: `ownerId` (string) = your UID
3. Add field: `ownerEmail` (string) = your email

---

### Issue 4: Cannot update/delete networks

**Symptoms:**
```
Error updating network: Missing or insufficient permissions
```

**Cause:**
Rules check that `ownerId` matches current user

**Solution:**
Verify the network's `ownerId` matches your UID:
```javascript
// Check network ownership
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '$lib/firebase';

const networkRef = doc(db, 'networks', 'your-network-id');
const networkSnap = await getDoc(networkRef);
const networkData = networkSnap.data();

console.log('Network ownerId:', networkData.ownerId);
console.log('My UID:', auth.currentUser?.uid);
console.log('Match:', networkData.ownerId === auth.currentUser?.uid);
```

---

## Development vs Production Rules

### Development Rules (firestore.rules.dev)
✅ Good for:
- Initial setup
- Testing
- Development
- Debugging

❌ Don't use for:
- Production
- Public deployments
- Real user data

### Production Rules (firestore.rules)
✅ Good for:
- Production
- Real users
- Security

❌ May be too strict for:
- Initial testing
- Debugging

---

## Deploying Rules

### Deploy Development Rules:
```bash
# Backup production rules
cp firestore.rules firestore.rules.production

# Use development rules
cp firestore.rules.dev firestore.rules

# Deploy
firebase deploy --only firestore:rules

# Verify in console
echo "Check: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore/rules"
```

### Deploy Production Rules:
```bash
# Restore production rules
cp firestore.rules.production firestore.rules

# Deploy
firebase deploy --only firestore:rules
```

---

## Testing Rules Locally

You can test rules without deploying:

```bash
# Install Firebase emulators
firebase init emulators

# Start emulators
firebase emulators:start

# Your app will connect to local emulator
# Check: http://localhost:4000
```

---

## Debugging Checklist

- [ ] User is authenticated (`auth.currentUser` is not null)
- [ ] User has UID (`auth.currentUser.uid` exists)
- [ ] Network has `ownerId` field
- [ ] Network has `ownerEmail` field
- [ ] `ownerId` matches current user's UID
- [ ] Firestore rules are deployed
- [ ] Using correct Firebase project (check `.firebaserc`)
- [ ] Environment variables are set correctly
- [ ] Browser console shows no CORS errors
- [ ] Firebase Console shows the data exists

---

## Quick Test Script

Run this in your browser console to test permissions:

```javascript
// Test Firestore Permissions
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '$lib/firebase';

async function testPermissions() {
  console.log('🔐 Testing Firestore Permissions...');
  console.log('');
  
  // 1. Check authentication
  const user = auth.currentUser;
  if (!user) {
    console.error('❌ Not authenticated!');
    console.log('👉 Sign in first');
    return;
  }
  console.log('✅ Authenticated:', user.email);
  console.log('   UID:', user.uid);
  console.log('');
  
  // 2. Test read
  try {
    const networksRef = collection(db, 'networks');
    const snapshot = await getDocs(networksRef);
    console.log(`✅ Read: Found ${snapshot.size} networks`);
    
    // Show details
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.name}`);
      console.log(`     ownerId: ${data.ownerId}`);
      console.log(`     match: ${data.ownerId === user.uid ? '✅' : '❌'}`);
    });
  } catch (error) {
    console.error('❌ Read failed:', error.message);
  }
  console.log('');
  
  // 3. Test write
  try {
    const testNetwork = {
      name: 'Test Network ' + Date.now(),
      ownerId: user.uid,
      ownerEmail: user.email,
      cells: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(collection(db, 'networks'), testNetwork);
    console.log('✅ Write: Created test network:', docRef.id);
  } catch (error) {
    console.error('❌ Write failed:', error.message);
  }
  
  console.log('');
  console.log('🏁 Test complete!');
}

testPermissions();
```

---

## Emergency: Open Access (TESTING ONLY!)

**⚠️ WARNING: This makes your database PUBLIC. Use ONLY for debugging!**

```bash
# Create emergency open rules
cat > firestore.rules.emergency << 'EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // ⚠️ COMPLETELY OPEN!
    }
  }
}
EOF

# Deploy emergency rules
cp firestore.rules.emergency firestore.rules
firebase deploy --only firestore:rules

# ⚠️ REMEMBER TO SWITCH BACK AFTER TESTING!
```

---

## Support Resources

1. **Firebase Console Rules Editor:**
   https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore/rules

2. **Firestore Rules Simulator:**
   Use the "Rules Playground" tab in Firebase Console to test rules

3. **Firebase Documentation:**
   https://firebase.google.com/docs/firestore/security/get-started

4. **Check Firebase Status:**
   https://status.firebase.google.com/

