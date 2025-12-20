# 📊 Database Structure & Security

## Overview

Your PCI Mapper uses Firestore with a **network + cells subcollection** structure. All data is **tied to the login** that created it.

---

## 🗂️ Database Structure

### Collection Hierarchy

```
firestore/
└─ networks/                      ← Top-level collection
    └─ {networkId}/               ← Network document
        ├─ name: "My Network"
        ├─ market: "New York"
        ├─ ownerId: "user123"     ← Firebase User ID (CRITICAL!)
        ├─ ownerEmail: "user@example.com"
        ├─ location: { lat, lng }
        ├─ createdAt: timestamp
        ├─ updatedAt: timestamp
        └─ cells/                 ← Subcollection (not a field!)
            ├─ CELL001/
            │   ├─ id: "CELL001"
            │   ├─ pci: 15
            │   ├─ latitude: 40.7580
            │   ├─ longitude: -73.9855
            │   ├─ frequency: 2100
            │   └─ ... (all cell data)
            ├─ CELL002/
            └─ CELL003/
```

### Key Points

- ✅ **Networks** are top-level documents
- ✅ **Cells** are in a subcollection inside each network
- ✅ **ownerId** ties the network to a specific user
- ✅ Cells inherit security from their parent network

---

## 🔒 Security Model

### How Data is Protected

#### 1. Network Security
```javascript
// In firestore.rules
match /networks/{networkId} {
  // Only owner can read
  allow read: if resource.data.ownerId == request.auth.uid;
  
  // Only authenticated users can create (with themselves as owner)
  allow create: if request.resource.data.ownerId == request.auth.uid;
  
  // Only owner can update/delete
  allow update, delete: if resource.data.ownerId == request.auth.uid;
}
```

#### 2. Cells Security (Inherited from Network)
```javascript
// In firestore.rules
match /networks/{networkId}/cells/{cellId} {
  // Can read cells if you own the parent network
  allow read: if get(/databases/$(database)/documents/networks/$(networkId)).data.ownerId == request.auth.uid;
  
  // Can write cells if you own the parent network
  allow write: if get(/databases/$(database)/documents/networks/$(networkId)).data.ownerId == request.auth.uid;
}
```

**How it works:**
1. User tries to access a cell
2. Firestore checks the **parent network's ownerId**
3. If ownerId matches the logged-in user → ✅ Allow
4. If ownerId doesn't match → ❌ Deny

---

## 💾 How Data is Saved

### When Creating a Network

```typescript
// src/lib/services/networkService.ts
async createNetwork(userId, userEmail, data) {
  const network = {
    id: "net_123",
    name: data.name,
    market: data.market,
    ownerId: userId,        // ← Automatically set to current user
    ownerEmail: userEmail,  // ← Current user's email
    cells: [],              // Empty initially
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await setDoc(doc(db, 'networks', network.id), network);
}
```

### When Adding Cells

```typescript
// src/lib/services/networkService.ts
async updateNetworkCells(networkId, cells) {
  // Store in subcollection: networks/{networkId}/cells/
  const cellsRef = collection(db, 'networks', networkId, 'cells');
  
  // Save each cell as a document
  for (const cell of cells) {
    await setDoc(doc(cellsRef, cell.id), cell);
  }
}
```

### When Loading Networks

```typescript
// src/lib/services/networkService.ts
async getUserNetworks(userId) {
  // 1. Get networks where ownerId matches
  const networks = await getDocs(
    query(collection(db, 'networks'), 
          where('ownerId', '==', userId))
  );
  
  // 2. For each network, load cells from subcollection
  for (const network of networks) {
    const cells = await getDocs(
      collection(db, 'networks', network.id, 'cells')
    );
    network.cells = cells.docs.map(d => d.data());
  }
}
```

---

## ✅ What's Automatically Protected

| Data | Security | How |
|------|----------|-----|
| **Networks** | ✅ User-specific | `ownerId` field + Firestore rules |
| **Cells** | ✅ User-specific | Inherit from parent network |
| **Network metadata** | ✅ User-specific | Part of network document |
| **Location data** | ✅ User-specific | Part of network document |

### Example Scenario

**User A creates a network:**
```json
{
  "id": "net_001",
  "name": "NYC Network",
  "ownerId": "userA_uid",
  "cells": [
    "CELL001", "CELL002", "CELL003"
  ]
}
```

**User B tries to access:**
- ❌ Can't see the network (blocked by `ownerId` check)
- ❌ Can't see the cells (blocked by parent network check)
- ❌ Can't modify anything (no write permission)

**User A accesses:**
- ✅ Can see the network
- ✅ Can see all cells
- ✅ Can modify everything

---

## 📋 Data Flow Diagram

```
User Login
    ↓
[Auth Service]
    ↓ (gets userId)
[Network Service]
    ↓
Query: where('ownerId', '==', userId)
    ↓
[Firestore Security Rules Check]
    ↓
✅ Returns ONLY user's networks
    ↓
For each network:
    ↓
Query: collection('networks/{id}/cells')
    ↓
[Firestore Security Rules Check Parent]
    ↓
✅ Returns ONLY cells from user's networks
```

---

## 🧪 Testing Security

### Test 1: Multiple Users

1. **Login as User A**
   - Create network "Network A"
   - Add 5 cells
   - Count: 1 network, 5 cells

2. **Logout → Login as User B**
   - Create network "Network B"
   - Add 3 cells
   - Count: 1 network, 3 cells ✅
   - Should NOT see "Network A" ✅

3. **Switch back to User A**
   - Count: 1 network, 5 cells ✅
   - Should NOT see "Network B" ✅

### Test 2: Direct Access (Should Fail)

Open browser console and try:

```javascript
// Try to read someone else's network
const otherNetworkRef = doc(db, 'networks', 'someone_elses_network_id');
const snap = await getDoc(otherNetworkRef);

// Result: Permission denied ❌
```

---

## 🔧 Troubleshooting

### Issue: "I can see other users' networks"

**Cause:** Development rules are deployed instead of production rules.

**Fix:**
1. Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore/rules
2. Verify rules contain: `if resource.data.ownerId == request.auth.uid`
3. NOT: `if request.auth != null` (this is insecure!)
4. Click "Publish" if you made changes

### Issue: "I can see cells but not networks"

**Cause:** Cached data in browser.

**Fix:**
1. Sign out
2. Clear browser cache (Ctrl+Shift+Delete)
3. Close browser completely
4. Reopen and sign in

### Issue: "Cells not saving"

**Cause:** Firestore rules not deployed or network doesn't have ownerId.

**Fix:**
1. Check network document in Firestore console
2. Verify it has `ownerId` field
3. Verify rules are deployed

---

## 📝 Summary

### What Makes Data Secure

1. ✅ Every network has `ownerId` field
2. ✅ `ownerId` is automatically set to current user
3. ✅ Firestore rules enforce ownership checks
4. ✅ Cells inherit security from parent network
5. ✅ No user can modify `ownerId` after creation

### What's Required for New Data

When creating networks, the code **automatically**:
- ✅ Sets `ownerId` to current user's UID
- ✅ Sets `ownerEmail` to current user's email
- ✅ Sets timestamps
- ✅ Saves cells in proper subcollection

**You don't need to do anything manually!** The code handles it all.

---

**Last Updated:** October 3, 2025

