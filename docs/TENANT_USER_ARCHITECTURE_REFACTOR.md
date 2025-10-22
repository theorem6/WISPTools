# Tenant User Architecture - Proper Design

## Core Principles

### 1. **Firebase Authentication = User Identity**
- Firebase Auth is the SINGLE source of truth for user accounts
- Users authenticate with Firebase (email/password, Google, Microsoft)
- Firebase provides the user ID (UID) and email

### 2. **MongoDB = Tenant Membership & Business Data**
- MongoDB stores which users belong to which tenants
- MongoDB stores user roles within each tenant
- MongoDB stores all business data (work orders, inventory, etc.)

### 3. **Tenant Creation Flow**

#### When Platform Admin Creates a Tenant:
```
1. Admin fills in tenant details + owner email
2. Check if owner email exists in Firebase Auth
   - If YES: Use existing Firebase UID
   - If NO: Create Firebase user account (send password reset email)
3. Create tenant in Firestore (metadata)
4. Create UserTenant record in MongoDB:
   - userId: Firebase UID
   - tenantId: Tenant ID
   - role: 'owner'
   - status: 'active'
5. Send welcome email to owner
```

#### When Owner/Admin Invites a User:
```
1. Enter user email + role
2. Check if email exists in Firebase Auth
   - If YES: Use existing Firebase UID
   - If NO: Create Firebase user account (send password reset email)
3. Create UserTenant record in MongoDB
4. Send invitation email with login link
```

## Data Model

### Firebase Auth
```
Users:
  - UID (auto-generated)
  - Email
  - Display Name
  - Photo URL
  - Email Verified
  - Last Sign In
```

### Firestore (Metadata Only)
```
tenants/{tenantId}:
  - id
  - name
  - displayName
  - subdomain
  - contactEmail
  - cwmpUrl
  - settings
  - limits
  - createdAt
  - updatedAt
  - createdBy (Firebase UID)
  - status: 'active' | 'suspended'
```

### MongoDB (Business Logic)
```
userTenants:
  - userId (Firebase UID)
  - tenantId
  - role: 'owner' | 'admin' | 'engineer' | 'installer' | 'helpdesk' | 'viewer'
  - status: 'active' | 'suspended' | 'pending_invitation'
  - addedAt
  - addedBy (Firebase UID)
  - lastAccessAt

All other business collections:
  - workOrders
  - customers
  - inventory
  - etc.
```

## Login Flow

### Current User Logs In:
```
1. User enters email/password → Firebase Auth
2. Firebase returns UID + token
3. Frontend queries MongoDB: getUserTenants(UID)
4. If 0 tenants: Show "Not assigned" error
5. If 1 tenant: Auto-select, load modules
6. If 2+ tenants: Show tenant selector
7. All API calls include:
   - Authorization: Bearer {Firebase Token}
   - X-Tenant-ID: {Selected Tenant}
```

### Backend API Authorization:
```
1. Extract Firebase token from Authorization header
2. Verify token with Firebase Admin SDK → Get UID
3. Extract tenantId from header or request body
4. Query MongoDB: userTenant = findOne({ userId: UID, tenantId })
5. Check: userTenant.status === 'active'
6. Check: userTenant.role has required permission
7. Process request with tenant isolation
```

## Required Changes

### 1. Backend - Add User Creation API
**File**: `backend-services/firebase-user-api.js`
- POST /api/firebase-users/create-or-get
  - Input: email, displayName (optional)
  - Check if user exists in Firebase Auth
  - If not, create with Admin SDK
  - Return: { uid, email, exists: true/false }

### 2. Tenant Creation - Include Owner
**File**: `Module_Manager/src/routes/tenant-setup/+page.svelte`
- Add "Owner Email" field
- Call create-or-get-user API
- Create tenant with createdBy = admin UID
- Create UserTenant with role=owner for returned UID

### 3. User Invitation - Create Firebase User
**File**: `backend-services/user-management-api.js`
- When inviting user, call Firebase Admin SDK
- Create user if doesn't exist
- Send password reset email
- Create UserTenant record

### 4. Remove Firestore user_tenants Collection
- All user-tenant data lives in MongoDB ONLY
- Firestore rules simplified (no membership checks)

### 5. Auto-Owner Assignment (Deprecated)
- Remove all auto-migration logic
- Tenants must have explicit owners assigned during creation
- Platform admin assigns owners through admin panel

## Migration Plan

### Phase 1: Add User Creation
1. Create firebase-user-api.js backend
2. Test user creation flow
3. Deploy to GCE backend

### Phase 2: Update Tenant Creation
1. Modify tenant-setup page to require owner email
2. Update tenantService.createTenant to accept owner UID
3. Create UserTenant record for owner

### Phase 3: Update User Invitation
1. Modify user-management to create Firebase users
2. Send password reset emails
3. Test invitation flow

### Phase 4: Cleanup
1. Remove Firestore user_tenants logic
2. Remove auto-migration code
3. Update documentation

### Phase 5: Data Migration
1. For existing tenants without owners in MongoDB:
   - Use Firestore createdBy to find owner
   - Create MongoDB UserTenant records
2. Verify all users can login

## Security Model

### Firestore Rules (Simplified)
```javascript
// Tenants - read by authenticated users, write by platform admin
match /tenants/{tenantId} {
  allow read: if isAuthenticated();
  allow write: if isPlatformAdmin();
}

// All business data stays in MongoDB
// Firestore is just metadata storage
```

### MongoDB Access Control
```javascript
// Backend middleware checks:
1. Firebase token valid? → Get UID
2. UserTenant exists for (UID, tenantId)?
3. UserTenant.status === 'active'?
4. UserTenant.role has permission?
5. Apply tenant data isolation filters
```

## Benefits of This Architecture

✅ **Single Source of Truth**: Firebase Auth for user identity
✅ **Clear Separation**: Auth vs Business Logic
✅ **Tenant Isolation**: All data filtered by tenantId
✅ **Role-Based Access**: Enforced at backend API level
✅ **Scalable**: Can handle thousands of tenants
✅ **Secure**: Token-based auth + MongoDB validation
✅ **Maintainable**: Clear, predictable data flow

## Implementation Priority

**Critical (Do First):**
1. ✅ Firestore rules (already done)
2. 🔄 Backend user creation API
3. 🔄 Tenant creation with owner assignment
4. 🔄 Fix login flow to properly query MongoDB

**Important (Do Next):**
5. User invitation with Firebase user creation
6. Remove auto-migration logic
7. Admin panel for owner assignment

**Nice to Have:**
8. Bulk user import
9. SSO integration
10. Advanced permission management

