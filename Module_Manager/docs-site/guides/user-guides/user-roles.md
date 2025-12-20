# 👥 User Role & Permission System - Implementation Plan

**Date:** October 21, 2025  
**Status:** 📋 Design Complete - Ready for Implementation

---

## 🎯 Overview

Comprehensive user management system with role-based access control (RBAC) for multi-tenant WISP platform.

### **Key Requirements:**
1. ✅ **User Database with Frontend** - Tenant admin can create users with different roles
2. ✅ **Push Notifications** - App users get notified of new work orders
3. ✅ **Help Desk Module** - Browser-based ticketing for support staff
4. ✅ **Role-Based Module Access** - Tenant admin controls which modules each role can access

---

## 📊 User Roles Hierarchy

### **1. Platform Admin** (Super Admin)
- **Email:** `david@david.com` (hard-coded)
- **Access:** ALL tenants, ALL modules
- **Special Powers:**
  - Create/delete tenants
  - View all tenant data
  - Access Tenant Management module
  - Override any permission
- **Cannot be created by tenants**

### **2. Tenant Owner**
- **Creation:** Auto-assigned when tenant is created
- **Access:** ALL modules in their tenant (unless explicitly disabled)
- **Powers:**
  - Full user management
  - Module configuration
  - Billing settings
  - Delete tenant
- **Cannot be changed to another role**

### **3. Tenant Admin**
- **Creation:** Invited by Owner or another Admin
- **Access:** Configurable per tenant
- **Default Powers:**
  - User management (create/edit/delete users)
  - Module configuration
  - View all work orders
  - Access all enabled modules
- **Cannot:** Delete tenant, change Owner role

### **4. Engineer** (Field Engineer / Network Engineer)
- **Creation:** Invited by Admin/Owner
- **Access:** Technical modules only
- **Default Powers:**
  - PCI Resolution
  - CBRS Management
  - HSS Management
  - Coverage Map
  - Inventory (view/edit)
  - Work Orders (all tickets)
  - Distributed EPC
  - Monitoring
- **Cannot:** User management, billing, tenant settings

### **5. Installer** (Field Technician)
- **Creation:** Invited by Admin/Owner
- **Access:** Field operation modules
- **Default Powers:**
  - Coverage Map (view only)
  - Inventory (checkout/deploy)
  - Work Orders (assigned to them only)
  - Mobile App full access
- **Cannot:** Network configuration, user management, view other techs' tickets

### **6. Help Desk**
- **Creation:** Invited by Admin/Owner
- **Access:** Customer support modules
- **Default Powers:**
  - Work Orders (create, view all, assign)
  - Help Desk Module (full access)
  - ACS CPE Management (view/troubleshoot)
  - Coverage Map (view only)
  - Inventory (view only)
- **Cannot:** Deploy equipment, change network config, user management

### **7. Viewer** (Read-Only / Auditor)
- **Creation:** Invited by Admin/Owner
- **Access:** View-only across all modules
- **Default Powers:**
  - View reports
  - View dashboards
  - Export data (if enabled)
- **Cannot:** Make any changes

---

## 🔐 Permission System

### **A. Module Permissions**

```typescript
// Module_Manager/src/lib/models/userRole.ts

export type UserRole = 
  | 'platform_admin'  // Super admin (david@david.com)
  | 'owner'           // Tenant owner
  | 'admin'           // Tenant admin
  | 'engineer'        // Network engineer
  | 'installer'       // Field technician
  | 'helpdesk'        // Support staff
  | 'viewer';         // Read-only

export interface ModuleAccess {
  // Core Modules
  pciResolution: boolean;
  cbrsManagement: boolean;
  acsManagement: boolean;
  hssManagement: boolean;
  coverageMap: boolean;
  inventory: boolean;
  workOrders: boolean;
  helpDesk: boolean;        // NEW
  distributedEpc: boolean;
  monitoring: boolean;
  
  // Admin Modules
  userManagement: boolean;  // NEW
  tenantSettings: boolean;
  backendManagement: boolean;
  billing: boolean;         // FUTURE
  
  // Special Access
  tenantManagement: boolean; // Platform admin only
}

export interface ModulePermissionLevel {
  canView: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

// Default module access per role
export const DEFAULT_MODULE_ACCESS: Record<UserRole, ModuleAccess> = {
  platform_admin: {
    // Full access to everything
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: true,
    monitoring: true,
    userManagement: true,
    tenantSettings: true,
    backendManagement: true,
    billing: true,
    tenantManagement: true
  },
  
  owner: {
    // Same as admin but for ALL modules
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: true,
    monitoring: true,
    userManagement: true,
    tenantSettings: true,
    backendManagement: false, // Can enable if needed
    billing: true,
    tenantManagement: false   // Platform admin only
  },
  
  admin: {
    // Configurable by Owner
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: true,
    monitoring: true,
    userManagement: true,
    tenantSettings: true,
    backendManagement: false,
    billing: false,
    tenantManagement: false
  },
  
  engineer: {
    // Technical modules only
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: false,
    distributedEpc: true,
    monitoring: true,
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false
  },
  
  installer: {
    // Field operations only
    pciResolution: false,
    cbrsManagement: false,
    acsManagement: false,
    hssManagement: false,
    coverageMap: true,     // View only
    inventory: true,        // Checkout/deploy
    workOrders: true,       // Assigned tickets only
    helpDesk: false,
    distributedEpc: false,
    monitoring: false,
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false
  },
  
  helpdesk: {
    // Customer support modules
    pciResolution: false,
    cbrsManagement: false,
    acsManagement: true,    // Troubleshoot CPEs
    hssManagement: false,
    coverageMap: true,      // View only
    inventory: true,        // View only
    workOrders: true,       // Create/view/assign
    helpDesk: true,         // Full access
    distributedEpc: false,
    monitoring: true,       // View only
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false
  },
  
  viewer: {
    // Read-only everything
    pciResolution: true,    // View only
    cbrsManagement: true,   // View only
    acsManagement: true,    // View only
    hssManagement: true,    // View only
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: true,
    monitoring: true,
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false
  }
};
```

### **B. Work Order Permissions**

```typescript
export interface WorkOrderPermissions {
  canViewAll: boolean;        // See all tickets
  canViewAssigned: boolean;   // See only assigned tickets
  canCreate: boolean;         // Create new tickets
  canAssign: boolean;         // Assign to others
  canReassign: boolean;       // Change assignments
  canClose: boolean;          // Mark as resolved/closed
  canDelete: boolean;         // Delete tickets
  canEscalate: boolean;       // Escalate priority
}

export const WORK_ORDER_PERMISSIONS: Record<UserRole, WorkOrderPermissions> = {
  platform_admin: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: true,
    canEscalate: true
  },
  
  owner: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: true,
    canEscalate: true
  },
  
  admin: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: true,
    canEscalate: true
  },
  
  engineer: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: false,
    canReassign: false,
    canClose: true,
    canDelete: false,
    canEscalate: true
  },
  
  installer: {
    canViewAll: false,          // Only their tickets
    canViewAssigned: true,
    canCreate: false,           // Cannot self-assign
    canAssign: false,
    canReassign: false,
    canClose: true,             // Mark complete
    canDelete: false,
    canEscalate: false
  },
  
  helpdesk: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: false,
    canEscalate: true
  },
  
  viewer: {
    canViewAll: true,           // View only
    canViewAssigned: true,
    canCreate: false,
    canAssign: false,
    canReassign: false,
    canClose: false,
    canDelete: false,
    canEscalate: false
  }
};
```

---

## 🗄️ Database Schema

### **Firestore Collections**

#### **1. users/{userId}**
```typescript
{
  uid: string,              // Firebase Auth UID
  email: string,
  displayName: string,
  photoURL?: string,
  phoneNumber?: string,
  
  // Role-based access
  primaryRole: UserRole,    // Default role across all tenants
  
  // Push notification tokens
  fcmTokens: {
    [deviceId: string]: {
      token: string,
      platform: 'ios' | 'android' | 'web',
      lastUpdated: Timestamp
    }
  },
  
  // Notification preferences
  notifications: {
    workOrders: boolean,
    systemAlerts: boolean,
    emailNotifications: boolean,
    smsNotifications: boolean
  },
  
  // Metadata
  createdAt: Timestamp,
  lastLoginAt: Timestamp,
  isActive: boolean,
  isPlatformAdmin: boolean  // Only true for david@david.com
}
```

#### **2. user_tenants/{userId}_{tenantId}**
```typescript
{
  userId: string,
  tenantId: string,
  
  // Role in THIS tenant
  role: UserRole,
  
  // Custom module permissions (overrides defaults)
  moduleAccess?: ModuleAccess,
  
  // Work order permissions
  workOrderPermissions?: WorkOrderPermissions,
  
  // Status
  status: 'active' | 'suspended' | 'pending_invitation',
  
  // Invitation
  invitedBy: string,        // userId of inviter
  invitedAt: Timestamp,
  acceptedAt?: Timestamp,
  
  // Metadata
  addedAt: Timestamp,
  lastAccessAt: Timestamp
}
```

#### **3. tenants/{tenantId}/config**
```typescript
{
  // Module configuration
  enabledModules: {
    pciResolution: boolean,
    cbrsManagement: boolean,
    acsManagement: boolean,
    hssManagement: boolean,
    coverageMap: boolean,
    inventory: boolean,
    workOrders: boolean,
    helpDesk: boolean,
    distributedEpc: boolean,
    monitoring: boolean,
    backendManagement: boolean,
    billing: boolean
  },
  
  // Role-specific module access (tenant admin can customize)
  roleModuleAccess?: {
    [role: string]: ModuleAccess
  },
  
  // Feature limits
  limits: {
    maxUsers: number,
    maxSites: number,
    maxSubscribers: number,
    maxCPEs: number,
    maxStorageGB: number
  },
  
  // Subscription
  subscriptionTier: 'free' | 'starter' | 'professional' | 'enterprise',
  subscriptionStatus: 'active' | 'trial' | 'suspended' | 'cancelled',
  
  updatedAt: Timestamp,
  updatedBy: string
}
```

#### **4. work_order_notifications/{notificationId}**
```typescript
{
  notificationId: string,
  tenantId: string,
  
  // Work order reference
  workOrderId: string,
  ticketNumber: string,
  
  // Recipients
  recipientUserId: string,
  recipientRole: UserRole,
  
  // Notification details
  type: 'assigned' | 'reassigned' | 'status_changed' | 'escalated' | 'commented',
  title: string,
  body: string,
  priority: 'low' | 'medium' | 'high' | 'critical',
  
  // Delivery status
  sentAt: Timestamp,
  deliveredAt?: Timestamp,
  readAt?: Timestamp,
  
  // Actions
  actionUrl?: string,       // Deep link to work order
  actionLabel?: string      // "View Ticket"
}
```

---

## 🎨 Frontend Implementation

### **1. User Management UI**

**Location:** `Module_Manager/src/routes/modules/user-management/+page.svelte`

**Features:**
- User list with roles and status
- Invite new users (email + role selection)
- Edit user roles (dropdown)
- Suspend/activate users
- View user activity
- Resend invitations
- Delete users

**UI Components:**
```typescript
// UserListTable.svelte
- Sortable columns: Name, Email, Role, Status, Last Login
- Filter by role
- Search by name/email
- Bulk actions (activate/suspend)

// InviteUserModal.svelte
- Email input (with validation)
- Role selector (dropdown)
- Module access customization (optional)
- Send invitation button

// EditUserModal.svelte
- Change role (dropdown)
- Customize module access (checkboxes)
- Suspend/activate toggle
- Save changes button

// UserActivityLog.svelte
- Timestamps of logins
- Actions performed
- Modules accessed
```

**Permission Check:**
```typescript
// Only Owner/Admin can access
$: canManageUsers = $currentUserRole === 'owner' || $currentUserRole === 'admin';

{#if !canManageUsers}
  <div class="error">Access Denied - User Management requires Owner or Admin role</div>
{/if}
```

### **2. Role-Based Module Configuration**

**Location:** `Module_Manager/src/routes/settings/module-access/+page.svelte`

**Features:**
- Table showing all roles vs. all modules
- Checkboxes to enable/disable modules per role
- Save configuration button
- Reset to defaults button

**UI Layout:**
```
Module Access Configuration

              | Owner | Admin | Engineer | Installer | Help Desk | Viewer
--------------|-------|-------|----------|-----------|-----------|-------
PCI Resolution| ✅    | ✅    | ✅       | ❌        | ❌        | ✅ (RO)
CBRS Mgmt     | ✅    | ✅    | ✅       | ❌        | ❌        | ✅ (RO)
ACS Mgmt      | ✅    | ✅    | ✅       | ❌        | ✅        | ✅ (RO)
HSS Mgmt      | ✅    | ✅    | ✅       | ❌        | ❌        | ✅ (RO)
Coverage Map  | ✅    | ✅    | ✅       | ✅ (RO)   | ✅ (RO)   | ✅ (RO)
Inventory     | ✅    | ✅    | ✅       | ✅        | ✅ (RO)   | ✅ (RO)
Work Orders   | ✅    | ✅    | ✅       | ✅ (Own)  | ✅        | ✅ (RO)
Help Desk     | ✅    | ✅    | ❌       | ❌        | ✅        | ✅ (RO)
Monitoring    | ✅    | ✅    | ✅       | ❌        | ✅ (RO)   | ✅ (RO)

[Reset to Defaults]  [Save Configuration]
```

### **3. Help Desk Module**

**Location:** `Module_Manager/src/routes/modules/help-desk/+page.svelte`

**Features:**
- Ticket queue (filterable by status/priority)
- Create new ticket (from customer call/email)
- Assign tickets to installers/engineers
- Add notes/comments
- Escalate priority
- View ticket history
- Customer lookup
- Equipment lookup (IMSI, serial number, etc.)
- Quick actions (reboot CPE, view signal strength)

**UI Sections:**
```svelte
<!-- Ticket Queue -->
<div class="ticket-queue">
  <div class="filters">
    <select bind:value={statusFilter}>
      <option value="all">All Status</option>
      <option value="open">Open</option>
      <option value="assigned">Assigned</option>
      <option value="in-progress">In Progress</option>
    </select>
    
    <select bind:value={priorityFilter}>
      <option value="all">All Priority</option>
      <option value="critical">Critical</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
  </div>
  
  <div class="ticket-list">
    {#each filteredTickets as ticket}
      <TicketCard {ticket} on:click={() => openTicket(ticket)} />
    {/each}
  </div>
</div>

<!-- Ticket Details Modal -->
<Modal bind:open={ticketModalOpen}>
  <TicketDetails {ticket} />
  
  <div class="actions">
    <button on:click={assignTicket}>Assign</button>
    <button on:click={escalate}>Escalate</button>
    <button on:click={addNote}>Add Note</button>
    <button on:click={closeTicket}>Close</button>
  </div>
</Modal>
```

---

## 📱 Mobile App - Push Notifications

### **A. Firebase Cloud Messaging Setup**

**File:** `wisp-field-app/src/services/notificationService.ts`

```typescript
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class NotificationService {
  
  /**
   * Request notification permissions (iOS requires explicit request)
   */
  async requestPermission(): Promise<boolean> {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ Notification permission granted');
        await this.registerDevice();
      } else {
        console.log('❌ Notification permission denied');
      }

      return enabled;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  /**
   * Register device FCM token with user profile
   */
  async registerDevice() {
    try {
      const user = auth().currentUser;
      if (!user) {
        console.log('No user logged in, skipping FCM registration');
        return;
      }

      // Get FCM token
      const fcmToken = await messaging().getToken();
      if (!fcmToken) {
        console.log('No FCM token available');
        return;
      }

      // Generate unique device ID
      const deviceId = await this.getDeviceId();

      // Save to Firestore
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          fcmTokens: {
            [deviceId]: {
              token: fcmToken,
              platform: Platform.OS,
              lastUpdated: firestore.FieldValue.serverTimestamp()
            }
          }
        }, { merge: true });

      console.log('✅ FCM token registered:', fcmToken.substring(0, 20) + '...');
      
      // Store locally for reference
      await AsyncStorage.setItem('fcmToken', fcmToken);
    } catch (error) {
      console.error('FCM registration error:', error);
    }
  }

  /**
   * Get or generate device ID
   */
  async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await AsyncStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  /**
   * Handle foreground notifications
   */
  setupForegroundHandler() {
    messaging().onMessage(async (remoteMessage) => {
      console.log('📬 Foreground notification:', remoteMessage);
      
      // Show local notification
      if (remoteMessage.notification) {
        // Use react-native-push-notification or similar
        // For now, we'll log it
        console.log('Notification:', remoteMessage.notification.title);
        console.log('Body:', remoteMessage.notification.body);
      }
      
      // Handle data payload
      if (remoteMessage.data) {
        this.handleNotificationData(remoteMessage.data);
      }
    });
  }

  /**
   * Handle background/quit state notifications
   */
  setupBackgroundHandler() {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('📬 Background notification:', remoteMessage);
      
      if (remoteMessage.data) {
        this.handleNotificationData(remoteMessage.data);
      }
    });
  }

  /**
   * Handle notification tap (app opened from notification)
   */
  setupNotificationOpenedListener(navigation: any) {
    // App opened from QUIT state
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened from quit state by notification:', remoteMessage);
          this.navigateToWorkOrder(navigation, remoteMessage.data);
        }
      });

    // App opened from BACKGROUND state
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('App opened from background by notification:', remoteMessage);
      this.navigateToWorkOrder(navigation, remoteMessage.data);
    });
  }

  /**
   * Navigate to work order from notification
   */
  private navigateToWorkOrder(navigation: any, data: any) {
    if (data?.workOrderId) {
      navigation.navigate('WorkOrderDetails', {
        workOrderId: data.workOrderId,
        ticketNumber: data.ticketNumber
      });
    }
  }

  /**
   * Handle notification data (update local state, refresh lists, etc.)
   */
  private handleNotificationData(data: any) {
    console.log('Handling notification data:', data);
    
    // Example: Trigger work order list refresh
    if (data.type === 'work_order_assigned' || data.type === 'work_order_updated') {
      // Emit event to refresh work orders list
      // Use EventEmitter or similar
    }
  }

  /**
   * Unregister device on logout
   */
  async unregisterDevice() {
    try {
      const user = auth().currentUser;
      if (!user) return;

      const deviceId = await this.getDeviceId();

      await firestore()
        .collection('users')
        .doc(user.uid)
        .update({
          [`fcmTokens.${deviceId}`]: firestore.FieldValue.delete()
        });

      console.log('✅ FCM token unregistered');
    } catch (error) {
      console.error('FCM unregister error:', error);
    }
  }
}

export default new NotificationService();
```

### **B. App Integration**

**Update:** `wisp-field-app/App.tsx`

```typescript
import notificationService from './src/services/notificationService';

useEffect(() => {
  // Request notification permissions
  notificationService.requestPermission();
  
  // Setup handlers
  notificationService.setupForegroundHandler();
  notificationService.setupBackgroundHandler();
  notificationService.setupNotificationOpenedListener(navigationRef);
  
  // Cleanup on unmount
  return () => {
    // Optionally unregister on logout
  };
}, []);
```

### **C. Backend - Send Notifications**

**File:** `functions/src/notifications.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cloud Function: Send notification when work order is assigned
 */
export const onWorkOrderAssigned = functions.firestore
  .document('work_orders/{workOrderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Check if assignedTo changed
    if (before.assignedTo !== after.assignedTo && after.assignedTo) {
      await sendWorkOrderNotification(
        after.assignedTo,
        after.tenantId,
        context.params.workOrderId,
        after.ticketNumber,
        after.type,
        after.priority,
        'assigned'
      );
    }
    
    // Check if status changed to 'in-progress' or 'resolved'
    if (before.status !== after.status) {
      // Notify creator or admin
      if (after.createdBy) {
        await sendWorkOrderNotification(
          after.createdBy,
          after.tenantId,
          context.params.workOrderId,
          after.ticketNumber,
          after.type,
          after.priority,
          'status_changed',
          `Status changed to ${after.status}`
        );
      }
    }
  });

/**
 * Send work order notification to user
 */
async function sendWorkOrderNotification(
  userId: string,
  tenantId: string,
  workOrderId: string,
  ticketNumber: string,
  workOrderType: string,
  priority: string,
  notificationType: string,
  customMessage?: string
) {
  try {
    // Get user's FCM tokens
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    if (!userDoc.exists) {
      console.log(`User ${userId} not found`);
      return;
    }
    
    const userData = userDoc.data();
    const fcmTokens = userData?.fcmTokens || {};
    
    // Check if notifications enabled
    if (userData?.notifications?.workOrders === false) {
      console.log(`User ${userId} has work order notifications disabled`);
      return;
    }
    
    // Extract tokens
    const tokens = Object.values(fcmTokens)
      .map((device: any) => device.token)
      .filter(Boolean);
    
    if (tokens.length === 0) {
      console.log(`No FCM tokens for user ${userId}`);
      return;
    }
    
    // Build notification message
    const title = notificationType === 'assigned'
      ? `New Work Order: ${ticketNumber}`
      : `Work Order Updated: ${ticketNumber}`;
    
    const body = customMessage || 
      `${workOrderType} - Priority: ${priority}`;
    
    const message = {
      notification: {
        title,
        body,
        sound: 'default',
        badge: '1'
      },
      data: {
        type: `work_order_${notificationType}`,
        workOrderId,
        ticketNumber,
        tenantId,
        priority,
        actionUrl: `/work-orders/${workOrderId}`
      },
      tokens
    };
    
    // Send to all user devices
    const response = await admin.messaging().sendMulticast(message);
    
    console.log(`✅ Sent notification to ${response.successCount} devices`);
    console.log(`❌ Failed: ${response.failureCount}`);
    
    // Remove invalid tokens
    if (response.failureCount > 0) {
      await cleanupInvalidTokens(userId, fcmTokens, response);
    }
    
    // Log notification
    await admin.firestore()
      .collection('work_order_notifications')
      .add({
        notificationId: `${workOrderId}_${Date.now()}`,
        tenantId,
        workOrderId,
        ticketNumber,
        recipientUserId: userId,
        type: notificationType,
        title,
        body,
        priority,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        actionUrl: `/work-orders/${workOrderId}`
      });
    
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

/**
 * Cleanup invalid FCM tokens
 */
async function cleanupInvalidTokens(
  userId: string,
  fcmTokens: any,
  response: admin.messaging.BatchResponse
) {
  const tokensToRemove: string[] = [];
  
  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const error = resp.error;
      if (
        error?.code === 'messaging/invalid-registration-token' ||
        error?.code === 'messaging/registration-token-not-registered'
      ) {
        // Find device ID for this token
        const tokens = Object.entries(fcmTokens);
        if (tokens[idx]) {
          tokensToRemove.push(tokens[idx][0]); // device ID
        }
      }
    }
  });
  
  if (tokensToRemove.length > 0) {
    const updates: any = {};
    tokensToRemove.forEach((deviceId) => {
      updates[`fcmTokens.${deviceId}`] = admin.firestore.FieldValue.delete();
    });
    
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .update(updates);
    
    console.log(`🗑️ Removed ${tokensToRemove.length} invalid tokens`);
  }
}
```

---

## 🔒 Backend Security Rules

### **Firestore Rules**

**File:** `firestore.rules`

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper: Check user role in tenant
    function getUserRole(userId, tenantId) {
      return get(/databases/$(database)/documents/user_tenants/$(userId + '_' + tenantId)).data.role;
    }
    
    function isOwnerOrAdmin(tenantId) {
      let role = getUserRole(request.auth.uid, tenantId);
      return role in ['owner', 'admin'];
    }
    
    function isEngineer(tenantId) {
      let role = getUserRole(request.auth.uid, tenantId);
      return role == 'engineer';
    }
    
    function isInstaller(tenantId) {
      let role = getUserRole(request.auth.uid, tenantId);
      return role == 'installer';
    }
    
    function isHelpDesk(tenantId) {
      let role = getUserRole(request.auth.uid, tenantId);
      return role == 'helpdesk';
    }
    
    // User management - Owner/Admin only
    match /user_tenants/{userTenantId} {
      allow read: if request.auth != null && (
        userTenantId.matches('^' + request.auth.uid + '_.*') ||  // Own records
        isOwnerOrAdmin(userTenantId.split('_')[1])                // Or tenant admin
      );
      
      allow create, update: if isOwnerOrAdmin(resource.data.tenantId);
      allow delete: if isOwnerOrAdmin(resource.data.tenantId);
    }
    
    // Work orders - Role-based access
    match /work_orders/{workOrderId} {
      allow read: if request.auth != null && (
        isOwnerOrAdmin(resource.data.tenantId) ||
        isEngineer(resource.data.tenantId) ||
        isHelpDesk(resource.data.tenantId) ||
        (isInstaller(resource.data.tenantId) && resource.data.assignedTo == request.auth.uid)
      );
      
      allow create: if request.auth != null && (
        isOwnerOrAdmin(request.resource.data.tenantId) ||
        isEngineer(request.resource.data.tenantId) ||
        isHelpDesk(request.resource.data.tenantId)
      );
      
      allow update: if request.auth != null && (
        isOwnerOrAdmin(resource.data.tenantId) ||
        isEngineer(resource.data.tenantId) ||
        isHelpDesk(resource.data.tenantId) ||
        (isInstaller(resource.data.tenantId) && resource.data.assignedTo == request.auth.uid)
      );
      
      allow delete: if isOwnerOrAdmin(resource.data.tenantId);
    }
    
    // Tenant config - Owner/Admin only
    match /tenants/{tenantId}/config {
      allow read: if isTenantMember(tenantId);
      allow write: if isOwnerOrAdmin(tenantId);
    }
  }
}
```

---

## 📊 Implementation Timeline

### **Week 1: Backend Foundation**
- ✅ Day 1-2: Extend user schema with roles
- ✅ Day 2-3: Implement role-based authentication middleware
- ✅ Day 3-4: Update Firestore security rules
- ✅ Day 4-5: Create user management API endpoints

### **Week 2: User Management Frontend**
- ✅ Day 1-2: Build User Management module UI
- ✅ Day 2-3: Implement invite/edit/delete flows
- ✅ Day 3-4: Build role-based module configuration UI
- ✅ Day 4-5: Add user activity logs

### **Week 3: Help Desk Module**
- ✅ Day 1-2: Design Help Desk UI
- ✅ Day 2-3: Implement ticket queue and filters
- ✅ Day 3-4: Build ticket creation/assignment
- ✅ Day 4-5: Add customer/equipment lookup

### **Week 4: Push Notifications**
- ✅ Day 1-2: Setup FCM in mobile app
- ✅ Day 2-3: Implement notification service
- ✅ Day 3-4: Create Cloud Functions for notifications
- ✅ Day 4-5: Test notification delivery and deep linking

### **Week 5: Testing & Refinement**
- ✅ Day 1-2: End-to-end testing of user flows
- ✅ Day 2-3: Load testing with multiple roles
- ✅ Day 3-4: Security audit and penetration testing
- ✅ Day 4-5: Documentation and training materials

---

## ✅ Success Criteria

1. **User Management**
   - ✅ Tenant admin can create users with different roles
   - ✅ Role changes take effect immediately
   - ✅ Users can only access modules allowed by their role
   - ✅ Invitations sent via email with signup link

2. **Push Notifications**
   - ✅ Installers receive notifications for new assignments
   - ✅ Notifications work in foreground, background, and quit states
   - ✅ Tapping notification opens the work order
   - ✅ Users can disable notifications in settings

3. **Help Desk Module**
   - ✅ Help desk staff can view all tickets
   - ✅ Can create tickets from customer calls
   - ✅ Can assign tickets to field techs
   - ✅ Can lookup customers and equipment
   - ✅ Can escalate priority

4. **Role-Based Access**
   - ✅ Tenant admin can customize module access per role
   - ✅ Changes sync across web and mobile
   - ✅ Unauthorized access blocked at both frontend and backend
   - ✅ Audit log of permission changes

---

## 🚀 Next Steps

Ready to start implementation! Which feature would you like to tackle first?

1. **User Management Frontend** (most visible, immediate value)
2. **Push Notifications** (critical for mobile app UX)
3. **Help Desk Module** (new functionality)
4. **Role-Based Module Access** (foundation for the others)

Recommend starting with **#4 (Role-Based Module Access)** as the foundation, then **#1 (User Management)**, then **#2 (Notifications)**, then **#3 (Help Desk)**.

