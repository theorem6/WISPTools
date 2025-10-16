# Tenant Persistence System

## Overview

The LTE WISP Management Platform uses a centralized tenant store that ensures consistent tenant selection across all modules, page navigations, and browser refreshes.

## Architecture

### 1. Centralized Tenant Store (`$lib/stores/tenantStore.ts`)

The tenant store is the **single source of truth** for tenant state:

```typescript
export const tenantStore = createTenantStore();
export const currentTenant = derived(tenantStore, $store => $store.currentTenant);
```

**Key Features:**
- Stores current tenant in both memory (Svelte store) and localStorage
- Auto-initializes on app load
- Survives page refreshes and navigation
- Provides reactive updates to all subscribed components

### 2. Root Layout Initialization (`src/routes/+layout.svelte`)

The root layout initializes the tenant store when the app loads:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { tenantStore } from '$lib/stores/tenantStore';
  
  onMount(async () => {
    await tenantStore.initialize();
  });
</script>
```

This ensures the tenant is loaded **before** any module or page loads.

### 3. TenantGuard Component (`$lib/components/TenantGuard.svelte`)

Every protected module is wrapped in `<TenantGuard>`:

```svelte
<TenantGuard>
  <div class="module-content">
    <!-- Your module code -->
  </div>
</TenantGuard>
```

**TenantGuard responsibilities:**
1. Checks authentication
2. Initializes tenant store if not already done
3. Loads user's tenants if none selected
4. Auto-selects single tenant (if user has only one)
5. Redirects to tenant selector (if user has multiple)
6. Redirects to tenant setup (if user has none)
7. Validates admin access (if `adminOnly` prop set)

### 4. Module Tenant Usage

All modules should use the reactive `currentTenant` store:

```svelte
<script lang="ts">
  import { currentTenant } from '$lib/stores/tenantStore';
  
  // Reactive tenant ID - auto-updates when tenant changes
  $: tenantId = $currentTenant?.id || '';
  $: tenantName = $currentTenant?.displayName || '';
  
  // Watch for tenant changes and reload data
  $: if (browser && tenantId) {
    console.log('[Module] Tenant loaded:', tenantId);
    loadData();
  }
</script>
```

**❌ DON'T DO THIS:**
```svelte
// Bad: Using auth.currentUser.uid as tenantId
let tenantId = auth.currentUser?.uid;
```

**✅ DO THIS:**
```svelte
// Good: Using currentTenant store
$: tenantId = $currentTenant?.id || '';
```

## Data Flow

```
1. User logs in
   ↓
2. Root layout initializes tenant store
   ↓
3. Tenant store loads from localStorage (if exists)
   ↓
4. User navigates to module
   ↓
5. TenantGuard validates auth + tenant
   ↓
6. Module receives tenantId from currentTenant store
   ↓
7. Module makes API calls with tenantId header
```

## Persistence Mechanism

### localStorage Keys

The tenant store persists three keys in localStorage:

| Key | Value | Purpose |
|-----|-------|---------|
| `selectedTenantId` | `tenant_xxx` | Current tenant's ID |
| `selectedTenantName` | `"Acme WISP"` | Current tenant's display name |
| `tenantSetupCompleted` | `"true"` | Whether user completed initial setup |

### Reactive Updates

When the tenant changes (via tenant selector or admin switching):

1. `tenantStore.setCurrentTenant(newTenant)` is called
2. Store updates in memory
3. localStorage is updated
4. All reactive `$currentTenant` subscriptions fire
5. Modules automatically reload data with new tenantId

## API Integration

All API calls should include the tenant ID:

```typescript
const response = await fetch(`${API_URL}/endpoint`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': tenantId  // ✅ From currentTenant store
  }
});
```

The backend validates the tenant ID and filters data accordingly.

## Troubleshooting

### Problem: Module not loading tenant data

**Symptoms:**
- Module shows "No Tenant Selected"
- API calls fail with tenant validation errors
- Data appears empty

**Solutions:**
1. Check console logs for `[TenantGuard]` and `[TenantStore]` messages
2. Verify module is wrapped in `<TenantGuard>`
3. Verify module uses `$currentTenant` store, not `auth.currentUser.uid`
4. Check localStorage for `selectedTenantId` key
5. Check reactive statement includes `browser` check:
   ```svelte
   $: if (browser && tenantId) { ... }
   ```

### Problem: Tenant not persisting after refresh

**Symptoms:**
- User must re-select tenant after page refresh
- Tenant reverts to empty on navigation

**Solutions:**
1. Check if root layout initializes tenant store
2. Check browser console for localStorage access errors
3. Verify `tenantStore.setCurrentTenant()` is called when selecting tenant
4. Check if localStorage is being cleared somewhere

### Problem: Different tenantId in different modules

**Symptoms:**
- CBRS shows different tenant than HSS
- Data appears mixed between tenants

**Solutions:**
1. All modules **must** use `$currentTenant?.id`, not `auth.currentUser.uid`
2. Check for any hardcoded `tenantId` values
3. Verify no modules are using alternate tenant sources

## Module Checklist

When creating a new module, ensure:

- [ ] Import `currentTenant` from `$lib/stores/tenantStore`
- [ ] Import and use `<TenantGuard>` wrapper
- [ ] Use reactive statement: `$: tenantId = $currentTenant?.id || '';`
- [ ] Add reactive data loader: `$: if (browser && tenantId) { loadData(); }`
- [ ] Include `X-Tenant-ID` header in all API calls
- [ ] Don't use `auth.currentUser.uid` as tenantId

## Current Module Status

| Module | Uses currentTenant | Wrapped in TenantGuard | Status |
|--------|-------------------|------------------------|--------|
| CBRS Management | ✅ Yes | ✅ Yes | ✅ Fixed |
| HSS Management | ✅ Yes | ✅ Yes | ✅ Fixed |
| Monitoring | ✅ Yes | ✅ Yes | ✅ Fixed |
| ACS CPE Management | ✅ Yes | ✅ Yes | ✅ Working |
| PCI Resolution | ✅ Yes | ✅ Yes | ✅ Working |

## Key Benefits

1. **Consistent Experience**: All modules see the same tenant
2. **Persistence**: Tenant selection survives refreshes
3. **Performance**: Single initialization, cached in memory
4. **Debugging**: Centralized logging for tenant state
5. **Multi-tenancy**: Clean separation of tenant data
6. **Security**: TenantGuard validates access before module loads

## Related Documentation

- [Tenant Setup Guide](./TENANT_SETUP.md)
- [Multi-Tenant Architecture](../architecture/MULTI_TENANT.md)
- [API Authentication](./API_AUTHENTICATION.md)

