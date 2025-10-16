# One Tenant Per User Policy

## Overview

The LTE PCI Mapper platform enforces a **one tenant per user account** policy. Each login email address can only create and own one organization (tenant).

## Business Rule

✅ **Allowed:**
- Each user account can create **one** organization
- Users can be **invited** to multiple organizations as members
- Platform admins can create **unlimited** organizations for other users

❌ **Not Allowed:**
- Creating multiple organizations with the same user account
- Deleting and recreating organizations (requires admin intervention)

## Why This Policy?

1. **Simplicity**: Most users need only one organization for their devices
2. **Clarity**: Clear ownership and responsibility structure
3. **Scalability**: Easier to manage licenses and billing per organization
4. **Security**: Prevents account abuse and resource hoarding
5. **User Experience**: Streamlines the tenant selection flow

## Implementation

### 1. Service Layer Enforcement (`tenantService.ts`)

```typescript
async createTenant(...params) {
  // Check if user already has a tenant (unless admin creating for others)
  if (createOwnerAssociation) {
    const userTenants = await this.getUserTenants(createdBy);
    if (userTenants.length > 0) {
      return { 
        success: false, 
        error: 'You already have an organization. Each account can only create one organization.' 
      };
    }
  }
  // ... continue with tenant creation
}
```

**Key Points:**
- Check runs before creating a tenant
- Only enforced when `createOwnerAssociation = true`
- Admins bypass this check (they pass `createOwnerAssociation = false`)
- Returns clear error message to user

### 2. UI Layer Protection (`tenant-setup/+page.svelte`)

```typescript
onMount(async () => {
  // Check if user already has a tenant
  existingTenants = await tenantService.getUserTenants(currentUser.uid);
  
  if (existingTenants.length > 0) {
    // User already has an organization - redirect to dashboard
    localStorage.setItem('selectedTenantId', existingTenants[0].id);
    localStorage.setItem('selectedTenantName', existingTenants[0].displayName);
    await goto('/dashboard', { replaceState: true });
    return;
  }
});
```

**Key Points:**
- Checks on page load if user already has a tenant
- Automatically redirects to dashboard with their tenant selected
- Prevents users from even seeing the create form
- Improves UX by avoiding confusing error messages

### 3. User Notice

The tenant setup page displays a clear notice:

```
ℹ️ Note: Each account can create one organization. You'll be the owner and can invite additional users.
```

This sets proper expectations before users start filling out the form.

## User Flows

### Flow 1: New User First-Time Setup
1. User creates account and logs in
2. Dashboard detects no tenant
3. Redirected to `/tenant-setup`
4. Creates their organization
5. Redirected to dashboard with tenant selected
6. ✅ Can now use all modules

### Flow 2: User Tries to Create Second Tenant
1. User navigates to `/tenant-setup`
2. Page detects existing tenant
3. Automatically redirects to dashboard
4. User never sees the create form
5. ℹ️ Prevented at UI level

### Flow 3: User Submits Form Anyway (Edge Case)
1. User somehow bypasses UI protection
2. Form submits to `tenantService.createTenant()`
3. Service checks for existing tenant
4. Returns error: "You already have an organization..."
5. ❌ Error displayed to user
6. ℹ️ Prevented at service level

### Flow 4: Admin Creates Tenant for User
1. Admin logs in and navigates to Tenant Management
2. Clicks "Create New Tenant"
3. Fills out form for new organization
4. Calls `createTenant()` with `createOwnerAssociation = false`
5. ✅ Tenant created without owner association
6. Admin invites actual user to the tenant
7. User accepts invitation and joins as member
8. ℹ️ Admin is never associated with the tenant

### Flow 5: User Invited to Multiple Organizations
1. User has their own organization (1 tenant owned)
2. Gets invited to Organization A (member role)
3. Gets invited to Organization B (admin role)
4. User can switch between 3 organizations
5. ✅ User can be in multiple tenants as a member
6. ❌ User still cannot create another tenant

## Multi-Organization Access

While users can only **create** one organization, they can **belong** to multiple organizations:

- **Owner**: The organization they created (1 only)
- **Admin**: Organizations where they have admin role (unlimited)
- **Member**: Organizations where they have member role (unlimited)
- **Viewer**: Organizations where they have viewer role (unlimited)

### Tenant Switching

Users with multiple organization memberships will see a tenant selector:

```
📁 Select Organization:
  • My Company (Owner) ✓
  • Client A Network (Admin)
  • Partner Site (Viewer)
```

## Edge Cases Handled

### Case 1: User Deletes Their Organization
**Scenario**: User accidentally deletes their organization and wants to create a new one.

**Current Behavior**: 
- Deleting a tenant removes the `user_tenants` association
- User can create a new organization

**Future Enhancement** (not implemented):
- Could add "soft delete" to prevent immediate recreation
- Would require admin to restore or permanently delete

### Case 2: User Changes Email Address
**Scenario**: User changes their Firebase email address.

**Behavior**:
- Firebase UID remains the same
- Tenant associations remain intact
- No impact on tenant ownership

### Case 3: Multiple Users Same Organization
**Scenario**: Company has 10 employees, all need access.

**Solution**:
- One employee creates the organization (owner)
- Owner invites 9 other employees
- All 10 can access and manage the organization
- Each employee could still create their own separate organization if needed

### Case 4: Testing/Development Environments
**Scenario**: Developer wants to test with multiple tenants.

**Solution**:
- Use different Google accounts for testing
- Or have admin create test tenants
- Or temporarily comment out the check in development

## Migration Path (If Needed)

If you need to migrate to a different model in the future:

### Option A: Allow Multiple Tenants Per User
```typescript
// Remove or comment out the check in tenantService.ts
// Lines 62-71 in createTenant()
```

### Option B: Limit Based on Plan
```typescript
if (createOwnerAssociation) {
  const userTenants = await this.getUserTenants(createdBy);
  const userPlan = await getUserPlan(createdBy);
  const maxTenants = PLAN_LIMITS[userPlan].maxTenants;
  
  if (userTenants.length >= maxTenants) {
    return { 
      success: false, 
      error: `Your ${userPlan} plan allows ${maxTenants} organization(s). Upgrade to create more.` 
    };
  }
}
```

### Option C: Charge for Additional Tenants
```typescript
if (createOwnerAssociation) {
  const userTenants = await this.getUserTenants(createdBy);
  
  if (userTenants.length >= 1) {
    // Redirect to payment flow
    return {
      success: false,
      error: 'Additional organizations require a subscription.',
      requiresPayment: true
    };
  }
}
```

## Testing

### Manual Test Cases

**Test 1: First Tenant Creation**
1. Create new Google account
2. Sign up and log in
3. Create organization
✅ Expected: Success

**Test 2: Second Tenant Attempt (UI)**
1. Navigate to `/tenant-setup`
✅ Expected: Redirected to dashboard

**Test 3: Second Tenant Attempt (Service)**
1. Call `tenantService.createTenant()` directly via console
✅ Expected: Error message returned

**Test 4: Admin Creates Multiple Tenants**
1. Log in as platform admin
2. Create Tenant A
3. Create Tenant B
✅ Expected: Both succeed, admin not associated

**Test 5: User Invited to Multiple Tenants**
1. User A creates Tenant A
2. User B creates Tenant B
3. User B invites User A to Tenant B
4. User A accepts invitation
✅ Expected: User A can access both Tenant A (owner) and Tenant B (member)

### Automated Tests (Future)

```typescript
describe('One Tenant Per User Policy', () => {
  it('should allow user to create first tenant', async () => {
    const result = await tenantService.createTenant(...);
    expect(result.success).toBe(true);
  });

  it('should prevent user from creating second tenant', async () => {
    await tenantService.createTenant(...); // First
    const result = await tenantService.createTenant(...); // Second
    expect(result.success).toBe(false);
    expect(result.error).toContain('already have an organization');
  });

  it('should allow admin to create multiple tenants', async () => {
    const result1 = await tenantService.createTenant(..., false);
    const result2 = await tenantService.createTenant(..., false);
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});
```

## Support Scenarios

### User: "I need another organization for a different project"

**Response**: 
> Each account can create one organization. However, you have a few options:
> 1. Create a separate Google account for the new project
> 2. Use your existing organization and organize by folders/tags
> 3. Contact an admin to create a tenant and invite you

### User: "I deleted my organization by mistake"

**Response**:
> Since the organization was deleted, you can create a new one. The one-tenant limit only applies to active organizations.

### User: "Why can't I create multiple organizations?"

**Response**:
> This policy ensures clear ownership and simplifies billing. You can be a member of unlimited organizations - just ask the owner to invite you!

## Related Documentation

- [Multi-Tenant Architecture](./MULTI_TENANT_ARCHITECTURE.md)
- [Tenant Management Guide](./MULTI_TENANT_SETUP_GUIDE.md)
- [Admin and User Management](./ADMIN_AND_USER_MANAGEMENT.md)
- [Tenant Loading Fix](./TENANT_LOADING_FIX.md)

## Files Modified

1. `Module_Manager/src/lib/services/tenantService.ts`
   - Added check in `createTenant()` method (lines 62-71)
   - Validates user doesn't already have a tenant
   - Only enforced for regular users, not admins

2. `Module_Manager/src/routes/tenant-setup/+page.svelte`
   - Added check in `onMount()` (lines 42-57)
   - Redirects users with existing tenant to dashboard
   - Added informational notice (lines 149-152)
   - Added CSS for info message styling (lines 350-367)

## Deployment

Changes committed and pushed:
```
commit 93190a8 - Enforce one tenant per user account
```

Deploy via Firebase App Hosting to apply these changes to production.

---

## Quick Reference

| Action | User (Regular) | User (With Tenant) | Admin |
|--------|----------------|-------------------|-------|
| Create first tenant | ✅ Allowed | N/A | ✅ Allowed |
| Create second tenant | ❌ Blocked | ❌ Blocked | ✅ Allowed* |
| View setup page | ✅ Yes | ❌ Redirected | ✅ Yes |
| Be invited to tenant | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| Switch between tenants | N/A | ✅ Allowed | ✅ Allowed |

*Admins create tenants without being associated (for other users)

