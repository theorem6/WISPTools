# 📋 User Role System - Implementation Checklist

**Project:** LTE WISP Management Platform  
**Date Started:** October 21, 2025  
**Status:** 🟡 Design Complete - Implementation Pending

---

## 🎯 Quick Reference

### **What We're Building:**
1. ✅ User database with frontend for tenant admin
2. ✅ Push notifications for mobile app work orders
3. ✅ Help desk module for browser-based ticketing
4. ✅ Role-based module access control

### **User Roles:**
- **Platform Admin** (david@david.com) - Super admin
- **Owner** - Tenant creator, full access
- **Admin** - Full management, configurable modules
- **Engineer** - Technical modules, all tickets
- **Installer** - Field ops, assigned tickets only
- **Help Desk** - Support, create/assign tickets
- **Viewer** - Read-only everything

---

## ✅ Implementation Checklist

### **Phase 1: Backend Foundation** (Week 1)

#### Database Schema
- [ ] Create `Module_Manager/src/lib/models/userRole.ts`
  - [ ] Define `UserRole` type
  - [ ] Define `ModuleAccess` interface
  - [ ] Define `WorkOrderPermissions` interface
  - [ ] Create `DEFAULT_MODULE_ACCESS` constants
  - [ ] Create `WORK_ORDER_PERMISSIONS` constants

- [ ] Update Firestore structure
  - [ ] Extend `users/{userId}` collection
    - [ ] Add `primaryRole` field
    - [ ] Add `fcmTokens` map
    - [ ] Add `notifications` preferences
    - [ ] Add `isPlatformAdmin` field
  - [ ] Extend `user_tenants/{userId}_{tenantId}`
    - [ ] Add `moduleAccess` field (optional override)
    - [ ] Add `workOrderPermissions` field
    - [ ] Add invitation tracking fields
  - [ ] Extend `tenants/{tenantId}/config`
    - [ ] Add `roleModuleAccess` map
    - [ ] Add `limits` object
    - [ ] Add `subscriptionTier` field

#### Backend API
- [ ] Create `backend-services/user-management-api.js`
  - [ ] `POST /api/users/invite` - Invite user to tenant
  - [ ] `GET /api/users/tenant/:tenantId` - List tenant users
  - [ ] `PUT /api/users/:userId/role` - Update user role
  - [ ] `PUT /api/users/:userId/modules` - Update module access
  - [ ] `DELETE /api/users/:userId/tenant/:tenantId` - Remove from tenant
  - [ ] `POST /api/users/:userId/suspend` - Suspend user
  - [ ] `POST /api/users/:userId/activate` - Activate user

- [ ] Create `backend-services/role-auth-middleware.js`
  - [ ] `requireRole([roles])` - Check user has required role
  - [ ] `requireModule(moduleName)` - Check module access
  - [ ] `requireWorkOrderPermission(action)` - Check WO permissions
  - [ ] `getUserTenantRole(userId, tenantId)` - Helper function

- [ ] Update existing APIs with role checks
  - [ ] Apply `requireModule()` to all module routes
  - [ ] Apply `requireWorkOrderPermission()` to work order routes
  - [ ] Add installer-specific filters to work order queries

#### Security Rules
- [ ] Update `firestore.rules`
  - [ ] Add role helper functions
  - [ ] Update `user_tenants` rules
  - [ ] Update `work_orders` rules with role checks
  - [ ] Update `tenants/config` rules

#### Testing
- [ ] Create test users for each role
- [ ] Test API endpoints with different roles
- [ ] Verify Firestore rules block unauthorized access
- [ ] Load test with 100+ users

---

### **Phase 2: User Management Frontend** (Week 2)

#### Core Components
- [ ] Create `Module_Manager/src/routes/modules/user-management/+page.svelte`
  - [ ] User list table with sorting/filtering
  - [ ] Search bar (by name/email)
  - [ ] Role filter dropdown
  - [ ] Status filter (active/suspended)
  - [ ] "Invite User" button

- [ ] Create `Module_Manager/src/routes/modules/user-management/components/`
  - [ ] `UserListTable.svelte`
    - [ ] Columns: Avatar, Name, Email, Role, Status, Last Login, Actions
    - [ ] Sortable columns
    - [ ] Action menu (Edit, Suspend, Delete)
  - [ ] `InviteUserModal.svelte`
    - [ ] Email input with validation
    - [ ] Role selector dropdown
    - [ ] Optional: Custom module access checkboxes
    - [ ] Send invitation button
  - [ ] `EditUserModal.svelte`
    - [ ] User info display
    - [ ] Role selector (cannot change Owner)
    - [ ] Module access checkboxes
    - [ ] Suspend/Activate toggle
    - [ ] Save changes button
  - [ ] `UserActivityLog.svelte`
    - [ ] Timeline of user actions
    - [ ] Login history
    - [ ] Module access logs

#### Services
- [ ] Create `Module_Manager/src/lib/services/userManagementService.ts`
  - [ ] `inviteUser(email, role, tenantId)`
  - [ ] `getTenanUsers(tenantId)`
  - [ ] `updateUserRole(userId, role)`
  - [ ] `updateUserModuleAccess(userId, moduleAccess)`
  - [ ] `suspendUser(userId, tenantId)`
  - [ ] `activateUser(userId, tenantId)`
  - [ ] `deleteUserFromTenant(userId, tenantId)`
  - [ ] `getUserActivity(userId)`

#### Permissions
- [ ] Add User Management to module permissions store
- [ ] Create permission check component
- [ ] Add role-based UI hiding (installers don't see user mgmt)

#### Integration
- [ ] Add User Management to dashboard module list
- [ ] Add to navigation menu (Settings → Users)
- [ ] Add notification on successful invitation
- [ ] Add email sending (Cloud Function)

#### Testing
- [ ] Test user invitation flow
- [ ] Test role changes with live users
- [ ] Verify permission checks work
- [ ] Test with different tenant roles

---

### **Phase 3: Role-Based Module Configuration** (Week 2-3)

#### UI Components
- [ ] Create `Module_Manager/src/routes/settings/module-access/+page.svelte`
  - [ ] Matrix table (Roles × Modules)
  - [ ] Checkboxes for each role-module combination
  - [ ] Save configuration button
  - [ ] Reset to defaults button
  - [ ] Preview changes before saving

- [ ] Create permission level selector (Future)
  - [ ] View only
  - [ ] Edit
  - [ ] Full access

#### Backend
- [ ] Create `functions/src/tenantConfig.ts` functions
  - [ ] `updateRoleModuleAccess(tenantId, role, moduleAccess)`
  - [ ] `getRoleModuleAccess(tenantId, role)`
  - [ ] `resetToDefaults(tenantId)`

#### Frontend Store
- [ ] Update `Module_Manager/src/lib/stores/modulePermissions.ts`
  - [ ] Read from `tenants/{tenantId}/config/roleModuleAccess`
  - [ ] Merge with default permissions
  - [ ] Cache configuration

#### Testing
- [ ] Test custom role configurations
- [ ] Verify changes take effect immediately
- [ ] Test reset to defaults
- [ ] Verify backend enforces restrictions

---

### **Phase 4: Help Desk Module** (Week 3)

#### Core Module
- [ ] Create `Module_Manager/src/routes/modules/help-desk/+page.svelte`
  - [ ] Ticket queue section
  - [ ] Filters (status, priority, assigned)
  - [ ] Search (ticket number, customer)
  - [ ] Create ticket button
  - [ ] Stats dashboard (open, resolved, avg time)

#### Components
- [ ] Create `Module_Manager/src/routes/modules/help-desk/components/`
  - [ ] `TicketQueue.svelte`
    - [ ] List of tickets with priority colors
    - [ ] Quick actions (assign, escalate)
    - [ ] Click to open details
  - [ ] `CreateTicketModal.svelte`
    - [ ] Customer lookup (by phone, email, IMSI)
    - [ ] Issue type selector
    - [ ] Priority selector
    - [ ] Description textarea
    - [ ] Affected equipment (optional)
    - [ ] Assign to (optional)
  - [ ] `TicketDetailsModal.svelte`
    - [ ] Full ticket information
    - [ ] Work log entries
    - [ ] Assignment section
    - [ ] Status update
    - [ ] Add note/comment
    - [ ] Escalate priority
    - [ ] Close ticket
  - [ ] `CustomerLookup.svelte`
    - [ ] Search input (phone, email, IMSI)
    - [ ] Customer info display
    - [ ] Equipment list
    - [ ] Service status
  - [ ] `QuickActions.svelte`
    - [ ] Reboot CPE
    - [ ] View signal strength
    - [ ] Check subscriber status
    - [ ] View recent logs

#### Backend (Already Exists)
- [x] Work order schema exists (`backend-services/work-order-schema.js`)
- [x] Work order API exists (`backend-services/work-order-api.js`)
- [ ] Add customer lookup endpoint
- [ ] Add equipment quick actions endpoint

#### Integration
- [ ] Add Help Desk to module permissions
- [ ] Add to dashboard (only for helpdesk/admin/owner roles)
- [ ] Integrate with HSS for subscriber lookup
- [ ] Integrate with ACS for CPE actions

#### Testing
- [ ] Test ticket creation flow
- [ ] Test assignment to installers
- [ ] Test customer lookup
- [ ] Test quick actions
- [ ] Verify role restrictions

---

### **Phase 5: Push Notifications** (Week 4)

#### Mobile App Setup
- [ ] Add Firebase Cloud Messaging dependencies
  - [ ] Already installed: `@react-native-firebase/app`, `@react-native-firebase/auth`
  - [ ] Install: `@react-native-firebase/messaging`
  - [ ] Update `android/app/build.gradle`
  - [ ] Update `AndroidManifest.xml` with permissions

- [ ] Create `wisp-field-app/src/services/notificationService.ts`
  - [ ] `requestPermission()` - Ask for notification permission
  - [ ] `registerDevice()` - Save FCM token to Firestore
  - [ ] `unregisterDevice()` - Remove FCM token on logout
  - [ ] `setupForegroundHandler()` - Handle foreground notifications
  - [ ] `setupBackgroundHandler()` - Handle background notifications
  - [ ] `setupNotificationOpenedListener()` - Handle taps

- [ ] Update `wisp-field-app/App.tsx`
  - [ ] Call `requestPermission()` on app start
  - [ ] Setup notification handlers
  - [ ] Pass navigation reference

#### Backend Cloud Functions
- [ ] Create `functions/src/notifications.ts`
  - [ ] `onWorkOrderAssigned()` - Trigger on work order update
  - [ ] `sendWorkOrderNotification()` - Send FCM message
  - [ ] `cleanupInvalidTokens()` - Remove expired tokens

- [ ] Create notification templates
  - [ ] New work order assigned
  - [ ] Work order status changed
  - [ ] Work order escalated
  - [ ] Work order commented

#### UI Components
- [ ] Create `wisp-field-app/src/screens/NotificationSettingsScreen.tsx`
  - [ ] Toggle for work order notifications
  - [ ] Toggle for system alerts
  - [ ] Toggle for email notifications
  - [ ] Test notification button

- [ ] Update work order screens
  - [ ] Badge count on tab bar
  - [ ] Notification indicator
  - [ ] Deep link handling

#### Testing
- [ ] Test foreground notifications
- [ ] Test background notifications
- [ ] Test notification tap navigation
- [ ] Test with app in quit state
- [ ] Test on multiple devices
- [ ] Test notification preferences
- [ ] Load test (100 notifications)

---

### **Phase 6: Integration & Testing** (Week 5)

#### End-to-End Flows
- [ ] **Flow 1: Invite New Installer**
  1. Admin invites installer via email
  2. Installer signs up and accepts invitation
  3. Installer logs into mobile app
  4. Installer grants notification permissions
  5. Installer can see only assigned work orders

- [ ] **Flow 2: Help Desk Creates Ticket**
  1. Help desk receives customer call
  2. Looks up customer by phone/IMSI
  3. Creates ticket with issue details
  4. Assigns to available installer
  5. Installer receives push notification
  6. Installer accepts and completes ticket
  7. Help desk closes ticket

- [ ] **Flow 3: Admin Configures Role Access**
  1. Admin goes to Module Access settings
  2. Disables PCI Resolution for installers
  3. Changes saved
  4. Installer logs in - PCI module hidden
  5. Installer cannot access `/modules/pci` URL

- [ ] **Flow 4: Engineer Escalates Ticket**
  1. Engineer views ticket queue
  2. Sees low priority ticket not progressing
  3. Escalates to high priority
  4. Assigned installer receives notification
  5. Ticket moves to top of queue

#### Security Testing
- [ ] Test unauthorized access attempts
- [ ] Test role elevation attempts
- [ ] Test cross-tenant data access
- [ ] Test API authentication bypass
- [ ] Penetration testing

#### Performance Testing
- [ ] Load test with 1000 users
- [ ] Test notification delivery at scale
- [ ] Test concurrent work order updates
- [ ] Test database query performance

#### Documentation
- [ ] Admin user guide
- [ ] Help desk training materials
- [ ] Mobile app user guide
- [ ] API documentation
- [ ] Security best practices

---

## 📂 Files to Create/Modify

### **New Files**
```
Module_Manager/
├─ src/
│  ├─ lib/
│  │  ├─ models/
│  │  │  └─ userRole.ts                    ← NEW
│  │  └─ services/
│  │     └─ userManagementService.ts       ← NEW
│  └─ routes/
│     ├─ modules/
│     │  ├─ user-management/               ← NEW DIRECTORY
│     │  │  ├─ +page.svelte
│     │  │  └─ components/
│     │  │     ├─ UserListTable.svelte
│     │  │     ├─ InviteUserModal.svelte
│     │  │     ├─ EditUserModal.svelte
│     │  │     └─ UserActivityLog.svelte
│     │  └─ help-desk/                     ← NEW DIRECTORY
│     │     ├─ +page.svelte
│     │     └─ components/
│     │        ├─ TicketQueue.svelte
│     │        ├─ CreateTicketModal.svelte
│     │        ├─ TicketDetailsModal.svelte
│     │        ├─ CustomerLookup.svelte
│     │        └─ QuickActions.svelte
│     └─ settings/
│        └─ module-access/                 ← NEW DIRECTORY
│           └─ +page.svelte

backend-services/
├─ user-management-api.js                  ← NEW
├─ role-auth-middleware.js                 ← NEW
└─ customer-lookup-api.js                  ← NEW

functions/
└─ src/
   └─ notifications.ts                     ← NEW

wisp-field-app/
└─ src/
   ├─ services/
   │  └─ notificationService.ts            ← NEW
   └─ screens/
      └─ NotificationSettingsScreen.tsx    ← NEW
```

### **Files to Modify**
```
Module_Manager/
├─ src/
│  ├─ lib/
│  │  └─ stores/
│  │     └─ modulePermissions.ts           ← UPDATE (add userManagement, helpDesk)
│  └─ routes/
│     └─ dashboard/
│        └─ +page.svelte                   ← UPDATE (add new modules)

backend-services/
├─ work-order-api.js                       ← UPDATE (add role filters)
└─ acs-api.js                              ← UPDATE (add quick actions)

wisp-field-app/
├─ App.tsx                                 ← UPDATE (notification setup)
├─ package.json                            ← UPDATE (add FCM dependency)
└─ android/
   ├─ app/build.gradle                     ← UPDATE (FCM config)
   └─ app/src/main/AndroidManifest.xml     ← UPDATE (permissions)

firestore.rules                            ← UPDATE (role-based rules)
firebase.json                              ← UPDATE (functions config)
```

---

## 🚀 Deployment Plan

### **Phase 1: Backend (Week 1)**
1. Deploy updated Firestore rules
2. Deploy user management API to GCE VM
3. Deploy role auth middleware
4. Test with Postman

### **Phase 2: Web Frontend (Week 2-3)**
1. Deploy User Management module
2. Deploy Module Access settings
3. Deploy Help Desk module
4. Test in staging

### **Phase 3: Mobile App (Week 4)**
1. Build new APK with FCM
2. Test on internal devices
3. Deploy to beta testers
4. Collect feedback

### **Phase 4: Cloud Functions (Week 4)**
1. Deploy notification Cloud Functions
2. Test notification delivery
3. Monitor logs

### **Phase 5: Production (Week 5)**
1. Full end-to-end testing
2. Security audit
3. Performance testing
4. Deploy to production
5. Monitor metrics

---

## 📊 Success Metrics

### **User Management**
- ✅ Time to invite user: < 30 seconds
- ✅ Users can accept invitation and login: 100% success rate
- ✅ Role changes take effect: < 5 seconds
- ✅ Unauthorized access blocked: 100%

### **Push Notifications**
- ✅ Notification delivery rate: > 95%
- ✅ Time to deliver: < 10 seconds
- ✅ Notification open rate: > 40%
- ✅ Deep link success rate: > 98%

### **Help Desk Module**
- ✅ Ticket creation time: < 2 minutes
- ✅ Customer lookup time: < 3 seconds
- ✅ Assignment time: < 10 seconds
- ✅ Average ticket resolution: < 24 hours

### **Role-Based Access**
- ✅ Module visibility updates: Immediate
- ✅ API requests blocked: < 1ms
- ✅ Audit log accuracy: 100%
- ✅ Configuration save time: < 2 seconds

---

## 🎯 Next Action

**Ready to start?** 

Recommended order:
1. **Phase 1: Backend Foundation** (establishes security and data model)
2. **Phase 2: User Management Frontend** (immediate value for admins)
3. **Phase 3: Role-Based Module Config** (enables customization)
4. **Phase 4: Help Desk Module** (new functionality)
5. **Phase 5: Push Notifications** (mobile enhancement)
6. **Phase 6: Integration & Testing** (polish and deploy)

**Shall we start with Phase 1: Backend Foundation?**

