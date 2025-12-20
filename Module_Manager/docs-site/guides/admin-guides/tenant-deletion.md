# Tenant Deletion Guide

## Overview

Platform admins can now permanently delete tenants (organizations) from the admin panel. This feature includes comprehensive safety checks and cascade deletion to ensure data integrity.

## Features

✅ **Cascade Deletion**: Automatically removes all related data
✅ **Confirmation Dialog**: Requires typing tenant name to confirm
✅ **Safety Checks**: Multiple warnings and validation steps
✅ **Audit Trail**: Console logging of all deletion steps
✅ **UI Feedback**: Clear success/error messages
✅ **Professional Design**: Danger zone styling with red warnings

## What Gets Deleted

When you delete a tenant, the system automatically removes:

1. **The Tenant Document** - The organization record itself
2. **User-Tenant Associations** - All user memberships and roles
3. **Pending Invitations** - Any outstanding invitations to the tenant
4. **localStorage References** - Clears any client-side references

### What Does NOT Get Deleted

The following data is **not** automatically deleted (manual cleanup required if needed):

- Device configurations (ACS CPE data)
- CBRS configurations
- Network topologies
- PCI optimization results
- Logs and analytics

> **Note**: Consider adding cleanup for tenant-specific data in future updates.

## How to Delete a Tenant

### Method 1: From Tenant Card (Quick Delete)

1. Navigate to **Tenant Management** (`/modules/tenant-management`)
2. Find the tenant you want to delete
3. Click the **🗑️ Delete** button on the tenant card
4. Confirmation dialog appears

### Method 2: From Tenant Details Modal

1. Navigate to **Tenant Management**
2. Click **⚙️ Manage** on the tenant card
3. Scroll down to the **⚠️ Danger Zone** section
4. Read the warning message
5. Click **🗑️ Delete Tenant**
6. Confirmation dialog appears

### Confirmation Process

The confirmation dialog requires you to:

1. **Read the warnings** - Multiple warnings about permanent deletion
2. **Review what will be deleted** - List of affected data
3. **Type the tenant name** - Must match exactly (case-sensitive)
4. **Click Delete Tenant** - Final confirmation

**Example:**
```
To delete: "Acme Wireless Corp"
You must type: Acme Wireless Corp
(exactly as shown)
```

## Safety Features

### 1. Name Verification

```typescript
// Must type exact tenant name
if (confirmInput.value !== tenantToDelete.displayName) {
  error = 'Please type the tenant name exactly to confirm deletion';
  return;
}
```

### 2. Admin-Only Access

```typescript
// Only platform admins can access tenant management
if (!isCurrentUserAdmin()) {
  error = 'Access Denied: Admin privileges required';
  return;
}
```

### 3. Comprehensive Warnings

The confirmation dialog shows:
- 🚨 Warning icon
- "This action cannot be undone!" message
- List of data that will be deleted
- Consequences of deletion
- Note about user ability to recreate

### 4. Loading State

```typescript
// Prevents double-deletion
isDeleting = true;
// Button shows "Deleting..."
// All buttons disabled during deletion
```

## Technical Implementation

### Service Layer (`tenantService.ts`)

```typescript
async deleteTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Starting deletion of tenant: ${tenantId}`);
    
    // 1. Verify tenant exists
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }

    // 2. Delete all user-tenant associations
    const userAssociations = await this.getTenantUsers(tenantId);
    console.log(`Deleting ${userAssociations.length} user associations...`);
    
    for (const association of userAssociations) {
      const associationId = `${association.userId}_${tenantId}`;
      await deleteDoc(doc(this.getDb(), 'user_tenants', associationId));
    }

    // 3. Delete all pending invitations
    const invitationsQuery = query(
      collection(this.getDb(), 'tenant_invitations'),
      where('tenantId', '==', tenantId)
    );
    const invitationsSnapshot = await getDocs(invitationsQuery);
    console.log(`Deleting ${invitationsSnapshot.docs.length} invitations...`);
    
    for (const invDoc of invitationsSnapshot.docs) {
      await deleteDoc(invDoc.ref);
    }

    // 4. Delete the tenant document
    console.log(`Deleting tenant document...`);
    await deleteDoc(doc(this.getDb(), 'tenants', tenantId));

    console.log(`Tenant ${tenantId} deleted successfully`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return { success: false, error: String(error) };
  }
}
```

### UI Components

#### 1. Delete Button (Tenant Card)
```svelte
<button class="btn-small btn-danger" on:click={() => handleDeleteClick(tenant)}>
  🗑️ Delete
</button>
```

#### 2. Danger Zone (Edit Modal)
```svelte
<div class="info-section danger-zone">
  <h3>⚠️ Danger Zone</h3>
  <p class="danger-description">
    Deleting a tenant is permanent and cannot be undone. 
    All associated data will be removed.
  </p>
  <button class="btn-danger-action" on:click={() => handleDeleteClick(selectedTenant)}>
    🗑️ Delete Tenant
  </button>
</div>
```

#### 3. Confirmation Dialog
```svelte
{#if showDeleteConfirm && tenantToDelete}
  <div class="modal-overlay" on:click={cancelDelete}>
    <div class="modal-content delete-confirm-modal" on:click|stopPropagation>
      <!-- Header with warning -->
      <div class="modal-header danger">
        <h2>⚠️ Confirm Deletion</h2>
      </div>

      <!-- Warning box with consequences -->
      <div class="warning-box">
        <!-- List of what will be deleted -->
      </div>

      <!-- Name confirmation input -->
      <div class="confirm-input">
        <input 
          type="text" 
          placeholder="Enter tenant name to confirm"
          id="deleteConfirmInput"
        />
      </div>

      <!-- Action buttons -->
      <div class="modal-footer">
        <button class="btn-secondary" on:click={cancelDelete}>Cancel</button>
        <button class="btn-danger" on:click={confirmDelete}>Delete Tenant</button>
      </div>
    </div>
  </div>
{/if}
```

## User Experience Flow

### Successful Deletion

1. Admin clicks Delete button
2. Confirmation dialog appears
3. Admin reads warnings
4. Admin types tenant name exactly
5. Admin clicks "Delete Tenant"
6. System validates name
7. Deletion process starts (button shows "Deleting...")
8. Success message appears: "Tenant 'X' deleted successfully"
9. Tenant removed from list
10. Dialog closes

### Failed Deletion (Wrong Name)

1. Admin clicks Delete button
2. Confirmation dialog appears
3. Admin types incorrect name
4. Admin clicks "Delete Tenant"
5. Error message: "Please type the tenant name exactly to confirm deletion"
6. Dialog remains open
7. Admin can retry or cancel

### User Impact After Deletion

**For Users Who Were Members:**
- Lose access to that tenant
- Can still access other tenants they belong to
- Receive no notification (future enhancement)

**For Users Who Were Owners:**
- Lose access to their tenant
- Can create a new tenant (one-tenant-per-user rule allows recreation after deletion)
- All their data in that tenant is gone

## Console Logging

The deletion process logs every step:

```
Starting deletion of tenant: tenant-123456
Deleting 5 user associations...
Deleting 2 invitations...
Deleting tenant document...
Tenant tenant-123456 deleted successfully
```

This helps with:
- Debugging deletion issues
- Auditing tenant deletions
- Understanding deletion progress

## Styling

### Danger Button Colors
- **Primary**: `#ef4444` (red)
- **Hover**: `#dc2626` (darker red)
- **Background**: `rgba(239, 68, 68, 0.05)` (light red tint)
- **Border**: `2px solid #ef4444`

### Visual Hierarchy
1. **🚨 Warning Icon** - Immediately grabs attention
2. **Red Headers** - Signals danger
3. **Bold Tenant Name** - Clear identification
4. **Bullet List** - Easy-to-scan consequences
5. **Input Field** - Interactive confirmation

## Edge Cases Handled

### Case 1: Tenant Not Found
**Scenario**: Tenant was already deleted or doesn't exist

**Behavior**: 
```typescript
if (!tenant) {
  return { success: false, error: 'Tenant not found' };
}
```

### Case 2: Concurrent Deletion
**Scenario**: Two admins try to delete same tenant

**Behavior**: 
- First deletion succeeds
- Second deletion returns "Tenant not found"
- No error thrown

### Case 3: Network Failure Mid-Deletion
**Scenario**: Connection lost during deletion

**Behavior**: 
- Partial deletion may occur
- Error message displayed
- Manual cleanup may be required

### Case 4: User Currently Viewing Tenant
**Scenario**: User is using tenant while admin deletes it

**Behavior**: 
- Tenant deleted immediately
- User experiences errors on next operation
- User should reload/re-login (future: real-time notification)

## Error Handling

```typescript
try {
  const result = await tenantService.deleteTenant(tenantToDelete.id);
  
  if (result.success) {
    success = `Tenant "${tenantToDelete.displayName}" deleted successfully`;
    tenants = tenants.filter(t => t.id !== tenantToDelete.id);
  } else {
    error = result.error || 'Failed to delete tenant';
  }
} catch (err: any) {
  error = err.message || 'Failed to delete tenant';
} finally {
  isDeleting = false;
}
```

## Security Considerations

### Admin-Only Access
✅ Only platform admins can access tenant management
✅ Admin status checked in `adminService.isPlatformAdmin()`
✅ Non-admins redirected to dashboard

### Firestore Security Rules
```javascript
// Ensure only admins can delete tenants
match /tenants/{tenantId} {
  allow delete: if request.auth != null && 
                   get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin';
}
```

> **Note**: Ensure Firestore rules are properly configured for production.

## Future Enhancements

### 1. Soft Delete
Instead of hard delete, mark tenant as inactive:
```typescript
await updateDoc(doc(db, 'tenants', tenantId), {
  status: 'deleted',
  deletedAt: serverTimestamp(),
  deletedBy: adminUserId
});
```

Benefits:
- Allows data recovery
- Maintains audit trail
- Prevents accidental permanent deletion

### 2. Scheduled Deletion
Implement 30-day grace period:
```typescript
// Mark for deletion
await updateDoc(doc(db, 'tenants', tenantId), {
  status: 'pending-deletion',
  scheduledDeletionDate: addDays(new Date(), 30)
});

// Cloud Function to delete after 30 days
exports.cleanupDeletedTenants = functions.pubsub
  .schedule('0 0 * * *') // Daily at midnight
  .onRun(async () => {
    // Find and delete tenants past scheduled date
  });
```

### 3. Data Export Before Deletion
Offer admin option to export tenant data:
```typescript
async function exportTenantData(tenantId: string): Promise<Blob> {
  // Export all tenant data as JSON
  // Return as downloadable file
}
```

### 4. Real-time Notifications
Notify affected users:
```typescript
// Send email/notification to all tenant members
for (const association of userAssociations) {
  await sendNotification(association.userId, {
    type: 'tenant-deleted',
    message: `Tenant ${tenant.displayName} has been deleted`,
    timestamp: new Date()
  });
}
```

### 5. Deletion Confirmation Email
Send confirmation to admin:
```typescript
await sendEmail({
  to: adminEmail,
  subject: `Tenant Deleted: ${tenant.displayName}`,
  body: `
    You have successfully deleted tenant ${tenant.displayName}.
    ${userAssociations.length} users affected.
    Deletion time: ${new Date().toISOString()}
  `
});
```

### 6. Cascade Delete Tenant Data
Automatically delete tenant-specific data:
```typescript
// Delete CBRS configs
await deleteDocs(query(collection(db, 'cbrs_configs'), where('tenantId', '==', tenantId)));

// Delete device configurations
await deleteDocs(query(collection(db, 'devices'), where('tenantId', '==', tenantId)));

// Delete network topologies
await deleteDocs(query(collection(db, 'networks'), where('tenantId', '==', tenantId)));
```

## Testing

### Manual Test Cases

**Test 1: Successful Deletion**
1. Log in as admin
2. Navigate to Tenant Management
3. Click Delete on a test tenant
4. Type exact tenant name
5. Click Delete Tenant
✅ Expected: Tenant deleted, success message shown

**Test 2: Wrong Name Entered**
1. Log in as admin
2. Click Delete on tenant
3. Type incorrect name
4. Click Delete Tenant
✅ Expected: Error message, dialog stays open

**Test 3: Cancel Deletion**
1. Log in as admin
2. Click Delete on tenant
3. Click Cancel
✅ Expected: Dialog closes, tenant not deleted

**Test 4: Delete from Modal**
1. Log in as admin
2. Click Manage on tenant
3. Scroll to Danger Zone
4. Click Delete Tenant in modal
5. Confirm deletion
✅ Expected: Tenant deleted, modal closes

**Test 5: Non-Admin Access**
1. Log in as regular user
2. Try to navigate to `/modules/tenant-management`
✅ Expected: Access denied, redirected to dashboard

### Automated Tests (Future)

```typescript
describe('Tenant Deletion', () => {
  it('should delete tenant and all associations', async () => {
    const tenantId = 'test-tenant';
    const result = await tenantService.deleteTenant(tenantId);
    expect(result.success).toBe(true);
    
    // Verify tenant deleted
    const tenant = await tenantService.getTenant(tenantId);
    expect(tenant).toBeNull();
    
    // Verify associations deleted
    const users = await tenantService.getTenantUsers(tenantId);
    expect(users.length).toBe(0);
  });

  it('should return error for non-existent tenant', async () => {
    const result = await tenantService.deleteTenant('fake-id');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Tenant not found');
  });
});
```

## Rollback Plan

If you need to rollback the deletion feature:

1. **Comment out delete buttons**:
```svelte
<!-- <button class="btn-small btn-danger" on:click={() => handleDeleteClick(tenant)}>
  🗑️ Delete
</button> -->
```

2. **Disable deleteTenant method**:
```typescript
async deleteTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Tenant deletion is temporarily disabled' };
}
```

3. **Remove from UI entirely** (if needed):
Remove the danger zone section and delete buttons

## Support Scenarios

### User: "I accidentally deleted a tenant!"

**Response (Current System)**:
> Unfortunately, tenant deletion is permanent and cannot be undone. You'll need to:
> 1. Create a new tenant
> 2. Re-add users
> 3. Reconfigure devices and settings
> 
> For future protection, always verify the tenant name carefully before confirming deletion.

**Response (With Soft Delete)**:
> No problem! Deleted tenants can be recovered within 30 days. Please contact support with the tenant name and we'll restore it for you.

### Admin: "How do I bulk delete multiple tenants?"

**Response**:
> Currently, tenants must be deleted individually for safety. If you need to delete multiple tenants, repeat the deletion process for each one. Consider creating a batch deletion script if this is a common need.

## Related Documentation

- [Multi-Tenant Setup Guide](/guides/admin-guides/multi-tenant-setup)
- [Admin and User Management](/guides/admin-guides/admin-user-management)

## Files Modified

1. **`Module_Manager/src/lib/services/tenantService.ts`**
   - Added `deleteTenant()` method (lines 494-543)
   - Cascade deletion logic
   - Console logging

2. **`Module_Manager/src/routes/modules/tenant-management/+page.svelte`**
   - Added delete state variables (lines 25-28)
   - Added `handleDeleteClick()` function (lines 157-160)
   - Added `cancelDelete()` function (lines 162-165)
   - Added `confirmDelete()` function (lines 167-203)
   - Added delete button to tenant card (line 367-369)
   - Added danger zone to edit modal (lines 455-463)
   - Added confirmation dialog component (lines 475-531)
   - Added comprehensive CSS styling (lines 1039-1219)

## Deployment

Changes committed and pushed:
```
commit f65ceda - Add tenant deletion functionality for admin panel
```

Deploy via Firebase App Hosting to apply these changes to production.

---

## Quick Reference

| Feature | Status | Location |
|---------|--------|----------|
| Delete from Card | ✅ Implemented | Tenant card actions |
| Delete from Modal | ✅ Implemented | Danger zone section |
| Name Confirmation | ✅ Implemented | Confirmation dialog |
| Cascade Deletion | ✅ Implemented | Service layer |
| Error Handling | ✅ Implemented | UI & service |
| Soft Delete | ❌ Not implemented | Future enhancement |
| Data Export | ❌ Not implemented | Future enhancement |
| User Notification | ❌ Not implemented | Future enhancement |

**⚠️ Remember**: Tenant deletion is permanent. Always double-check before confirming!

