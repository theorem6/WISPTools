# Multi-Network & User Authentication Guide

## Overview

PCI Mapper now supports **multi-network management** with **Firebase authentication**, allowing users to create, manage, and switch between multiple network deployments across different markets. Each user owns their networks with full data isolation and persistence.

## Architecture

```
┌─────────────────────────────────────────────────┐
│           User Authentication Layer              │
│  - Firebase Auth (Email, Google Sign-In)        │
│  - User profiles and session management         │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│          Network Management Layer                │
│  - Multi-network support per user               │
│  - Market-based organization                    │
│  - Network switching and selection              │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│        Data Persistence Layer (Firestore)        │
│  - Network documents with cells                 │
│  - User ownership and access control            │
│  - Real-time sync and updates                   │
└─────────────────────────────────────────────────┘
```

## Key Features

### 1. **User Authentication**

#### Sign Up / Sign In
- ✅ Email/password authentication
- ✅ Google Sign-In (OAuth)
- ✅ Password reset via email
- ✅ Display name and profile support
- ✅ Persistent sessions

#### User Profile
- Avatar (Google photo or initials)
- Display name or email
- Quick access dropdown
- Sign out functionality

### 2. **Multi-Network Management**

#### Network Structure
Each network contains:
- **Name**: "Manhattan Downtown LTE"
- **Market**: Geographic area (e.g., "New York Metro")
- **Description**: Notes and details
- **Cells**: All cell tower data
- **Metadata**: Region, operator, deployment phase
- **Ownership**: User ID and email
- **Timestamps**: Created and updated dates

#### Network Operations
- ✅ Create new networks
- ✅ Switch between networks
- ✅ Delete networks
- ✅ Auto-save on changes
- ✅ Search by market
- ✅ View network summaries

### 3. **Data Persistence**

#### Firestore Collections

**Collection: `networks`**
```javascript
{
  id: "net_1234567890_abc123",
  name: "Manhattan Downtown LTE",
  market: "New York Metro",
  description: "Phase 1 deployment...",
  cells: [...],
  createdAt: Timestamp,
  updatedAt: Timestamp,
  ownerId: "firebase-user-id",
  ownerEmail: "user@example.com",
  isShared: false,
  tags: ["LTE", "urban"],
  metadata: {
    region: "Northeast",
    operator: "Verizon",
    deploymentPhase: "Planning"
  }
}
```

## User Workflow

### First Time User

1. **Open PCI Mapper** → Sees sample data (not logged in)
2. **Click "Sign In"** → Auth modal appears
3. **Sign up or Sign in** → Creates account
4. **Click "My Networks"** → Network manager opens
5. **Create first network** → Name it, set market
6. **Import or add cells** → Build network topology
7. **Auto-saved** → Network persists to Firestore

### Returning User

1. **Open PCI Mapper** → Auto-signs in
2. **Networks load** → Last used network selected
3. **Cells load automatically** → Shows on map
4. **Make changes** → Auto-saves to Firestore
5. **Switch networks** → Click network selector
6. **Create more networks** → Unlimited networks per user

## UI Components

### 1. **Topbar Integration**

```
┌────────────────────────────────────────────────┐
│ 🗺️ Mapper | 📍 Network  │ Stats │ 👤 User... │
└────────────────────────────────────────────────┘
```

**Left Side:**
- App branding
- Network selector (when logged in)

**Right Side:**
- User profile with dropdown
- Theme switcher
- Action buttons

### 2. **Auth Modal**

Three modes:
- **Sign In**: Email/password or Google
- **Sign Up**: Create new account
- **Reset Password**: Send reset email

Features:
- Form validation
- Error handling
- Loading states
- Google OAuth integration

### 3. **Network Manager**

Two views:
- **List View**: Grid of user's networks
- **Create View**: Form to create new network

Network Card Shows:
- Network name and market
- Description preview
- Cell count
- Last updated date
- Delete button
- Active indicator

### 4. **Network Selector**

Compact button in topbar:
- Shows current network name + market
- Click to open network manager
- "Select Network" if none chosen

### 5. **User Profile Dropdown**

Shows:
- User email
- "My Networks" action
- Sign out button

## Data Flow

### Network Selection Flow

```
User clicks network selector
    ↓
Network Manager opens
    ↓
User selects network
    ↓
networkStore.setCurrentNetwork(network)
    ↓
Reactive statement triggers
    ↓
syncNetworkCells(network)
    ↓
pciService.loadCells(network.cells)
    ↓
performAnalysis()
    ↓
Map updates with network cells
```

### Auto-Save Flow

```
User imports cells / optimizes PCIs
    ↓
Cells updated in cellsStore
    ↓
saveCurrentNetwork() called
    ↓
networkService.updateNetworkCells()
    ↓
Firestore document updated
    ↓
networkStore.updateCurrentNetworkCells()
    ↓
Local state synchronized
```

## API Reference

### Auth Service

```typescript
import { authService } from '$lib/services/authService';

// Sign up
await authService.signUp(email, password, displayName);

// Sign in
await authService.signIn(email, password);

// Google sign in
await authService.signInWithGoogle();

// Sign out
await authService.signOut();

// Get current user
const user = authService.getCurrentUser();
const profile = authService.getCurrentUserProfile();

// Check auth status
const isAuth = authService.isAuthenticated();
```

### Network Service

```typescript
import { networkService } from '$lib/services/networkService';

// Create network
const result = await networkService.createNetwork(userId, userEmail, {
  name: "My Network",
  market: "Chicago",
  description: "..."
});

// Get user's networks
const networks = await networkService.getUserNetworks(userId);

// Get specific network
const network = await networkService.getNetwork(networkId);

// Update network
await networkService.updateNetwork(networkId, updates);

// Update cells
await networkService.updateNetworkCells(networkId, cells);

// Delete network
await networkService.deleteNetwork(networkId);

// Search by market
const results = await networkService.searchNetworksByMarket(userId, "New York");
```

### Stores

```typescript
import { authStore, currentUser, isAuthenticated } from '$lib/stores/authStore';
import { networkStore, currentNetwork, allNetworks } from '$lib/stores/networkStore';

// Subscribe to auth
$: user = $currentUser;
$: loggedIn = $isAuthenticated;

// Subscribe to networks
$: network = $currentNetwork;
$: networks = $allNetworks;
$: cells = $currentNetwork?.cells || [];

// Actions
networkStore.setCurrentNetwork(network);
networkStore.addNetwork(newNetwork);
networkStore.updateNetwork(id, updates);
networkStore.deleteNetwork(id);
```

## Security & Data Isolation

### Firestore Rules

Required rules for `networks` collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /networks/{networkId} {
      // Users can only read their own networks
      allow read: if request.auth != null 
                  && resource.data.ownerId == request.auth.uid;
      
      // Users can only create networks for themselves
      allow create: if request.auth != null 
                    && request.resource.data.ownerId == request.auth.uid;
      
      // Users can only update their own networks
      allow update: if request.auth != null 
                    && resource.data.ownerId == request.auth.uid;
      
      // Users can only delete their own networks
      allow delete: if request.auth != null 
                    && resource.data.ownerId == request.auth.uid;
    }
  }
}
```

### Data Isolation

- Each network has an `ownerId` field
- Firestore queries filter by `ownerId == currentUser.uid`
- Users can only access their own networks
- No cross-user data leakage

## Use Cases

### Use Case 1: Multi-Market Deployment

Network Engineer managing multiple markets:

```
Networks:
├── NYC Manhattan LTE (120 cells)
├── NYC Brooklyn CBRS (45 cells)
├── Boston Metro LTE (85 cells)
├── Philadelphia Downtown (60 cells)
└── Washington DC Metro (95 cells)
```

Each network:
- Isolated PCI assignments
- Independent conflict analysis
- Market-specific optimization
- Separate reports and exports

### Use Case 2: Planning vs. Production

```
Networks:
├── NYC-Production (250 cells) - Active deployment
├── NYC-Phase2-Planning (80 cells) - Future expansion
├── NYC-Backup-Config (250 cells) - Rollback plan
└── NYC-Optimization-Test (250 cells) - Testing changes
```

### Use Case 3: Multiple Operators

Consultant working with different clients:

```
Networks:
├── Verizon-NYC (200 cells)
├── ATT-NYC (180 cells)
├── TMobile-NYC (220 cells)
└── Private-Network-Hospital (30 cells)
```

## Best Practices

### Network Organization

1. **Naming Convention**
   - `{Operator}-{Market}-{Phase}`
   - Example: "Verizon-NYC-Production"

2. **Market Granularity**
   - City level: "New York Metro"
   - Borough/District: "Manhattan Downtown"
   - Neighborhood: "Chelsea District"

3. **Use Descriptions**
   - Deployment phase
   - Special requirements
   - Contact information

4. **Tags for Filtering**
   - Technology: "LTE", "CBRS", "5G"
   - Phase: "Planning", "Active", "Decommissioned"
   - Priority: "High", "Medium", "Low"

### Data Management

1. **Regular Saves**
   - Auto-saves after imports
   - Auto-saves after optimization
   - Manual save not required

2. **Network Backups**
   - Create duplicate networks for testing
   - Export to CSV/KML before major changes
   - Keep production and planning separate

3. **Cleanup**
   - Delete obsolete networks
   - Archive completed projects
   - Maintain reasonable network count

## Firestore Setup Required

### 1. Enable Authentication

Firebase Console → Authentication → Sign-in methods:
- ✅ Enable Email/Password
- ✅ Enable Google Sign-In (optional)

### 2. Enable Firestore

Firebase Console → Firestore Database:
- Create database (production mode)
- Deploy security rules (see above)

### 3. Set Security Rules

Deploy the Firestore rules to ensure data isolation.

## Performance

### Optimizations Implemented

1. **Lazy Loading**: Networks loaded only when user authenticates
2. **Pagination Ready**: Query structure supports pagination
3. **Indexed Queries**: ownerId + updatedAt indexed
4. **Minimal Data Transfer**: Only current network cells loaded to map
5. **Local State**: Changes cached locally, synced on demand

### Expected Performance

- **Sign in**: < 1 second
- **Load networks**: < 2 seconds (100 networks)
- **Switch network**: < 500ms (local)
- **Save network**: < 1 second (Firestore write)
- **Import cells**: Instant (local) + background save

## Troubleshooting

### Authentication Issues

**Problem**: Can't sign in  
**Solution**: Check Firebase config in `.env` file

**Problem**: Google sign-in fails  
**Solution**: Add authorized domains in Firebase Console

### Network Issues

**Problem**: Networks don't load  
**Solution**: Check Firestore rules, verify user is authenticated

**Problem**: Can't save changes  
**Solution**: Verify user owns the network, check Firestore permissions

**Problem**: Networks not syncing  
**Solution**: Check browser console for errors, verify internet connection

## Future Enhancements

Planned features:

1. **Network Sharing**: Share networks with team members
2. **Network Templates**: Create networks from templates
3. **Bulk Operations**: Copy cells between networks
4. **Network Comparison**: Compare two networks side-by-side
5. **Collaborative Editing**: Multiple users editing same network
6. **Version History**: Track network changes over time
7. **Network Analytics**: Trends and statistics across all networks
8. **Export/Import Networks**: Backup entire network configs

## Summary

PCI Mapper now provides:

✅ **Multi-user support**: Firebase authentication  
✅ **Unlimited networks**: Create networks for different markets  
✅ **Data persistence**: All data saved to Firestore  
✅ **User ownership**: Each network belongs to one user  
✅ **Auto-save**: Changes automatically persisted  
✅ **Network switching**: Quickly change between networks  
✅ **Professional workflow**: Manage complex deployments  
✅ **Scalable architecture**: Ready for enterprise use  

The application has transformed from a **single-session tool** into a **professional network planning platform**! 🚀

---

## Quick Start

1. **Sign Up**: Click "Sign In" → Create account
2. **Create Network**: Click "My Networks" → Create new
3. **Add Cells**: Import CSV/KML or add manually
4. **Analyze**: Run analysis and optimize
5. **Switch Markets**: Create networks for different areas
6. **Auto-saved**: Everything persists automatically

Your network planning data is now **secure, persistent, and organized**!

