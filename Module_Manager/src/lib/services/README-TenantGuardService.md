# TenantGuardService Usage Guide

The `TenantGuardService` provides a robust, isolated API for modules to handle tenant validation and authentication without needing to know internal implementation details.

## Key Benefits

- **Isolation**: Modules don't need to know about internal tenant store implementation
- **Consistency**: All modules use the same tenant validation logic
- **Event-driven**: Automatic updates when tenant state changes
- **Error handling**: Built-in error handling and redirect logic
- **Flexibility**: Configurable options for different use cases

## Basic Usage

### 1. Import the Service

```typescript
import { tenantGuardService, type TenantGuardResult } from '$lib/services/tenantGuardService';
```

### 2. Ensure Tenant is Available

```typescript
// In your component's onMount or when needed
const result = await tenantGuardService.ensureTenant({
  requireTenant: true,
  autoSelectSingleTenant: true,
  createDefaultTenant: true
});

if (result.success && result.tenant) {
  // Tenant is available, proceed with your logic
  console.log('Tenant ID:', result.tenant.id);
} else {
  // Handle error or redirect
  console.error('Tenant error:', result.error);
}
```

### 3. Subscribe to Tenant State Changes

```typescript
let unsubscribeTenantGuard: (() => void) | null = null;

onMount(() => {
  // Subscribe to tenant state changes
  unsubscribeTenantGuard = tenantGuardService.onTenantStateChange((result) => {
    if (result.success && result.tenant) {
      // Tenant is available, reload your data
      loadData();
    } else {
      // Handle tenant loss or error
      handleTenantError(result.error);
    }
  });
});

onDestroy(() => {
  if (unsubscribeTenantGuard) {
    unsubscribeTenantGuard();
  }
});
```

### 4. Use Tenant in API Calls

```typescript
async function loadData() {
  const tenant = tenantGuardService.getCurrentTenant();
  if (!tenant) {
    console.error('No tenant available');
    return;
  }

  const response = await fetch('/api/data', {
    headers: {
      'Authorization': `Bearer ${await authService.getAuthToken()}`,
      'X-Tenant-ID': tenant.id
    }
  });
}
```

## Configuration Options

### TenantGuardOptions

```typescript
interface TenantGuardOptions {
  requireTenant?: boolean;        // Default: true
  requireAdmin?: boolean;         // Default: false
  autoSelectSingleTenant?: boolean; // Default: true
  createDefaultTenant?: boolean;    // Default: false
}
```

### Examples

```typescript
// For regular user modules
await tenantGuardService.ensureTenant({
  requireTenant: true,
  autoSelectSingleTenant: true,
  createDefaultTenant: true
});

// For admin-only modules
await tenantGuardService.ensureTenant({
  requireAdmin: true,
  requireTenant: false
});

// For modules that work with or without tenant
await tenantGuardService.ensureTenant({
  requireTenant: false
});
```

## Complete Example

Here's a complete example of how to use TenantGuardService in a module:

```typescript
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { tenantGuardService, type TenantGuardResult } from '$lib/services/tenantGuardService';
  import { authService } from '$lib/services/authService';

  export let show = false;

  let data: any[] = [];
  let loading = false;
  let error = '';
  let tenantResult: TenantGuardResult | null = null;
  let unsubscribeTenantGuard: (() => void) | null = null;

  onMount(async () => {
    if (show) {
      // Subscribe to tenant state changes
      unsubscribeTenantGuard = tenantGuardService.onTenantStateChange((result) => {
        tenantResult = result;
        if (result.success && result.tenant) {
          loadData();
        }
      });

      // Ensure tenant is available
      const result = await tenantGuardService.ensureTenant({
        requireTenant: true,
        autoSelectSingleTenant: true,
        createDefaultTenant: true
      });
      
      tenantResult = result;
      if (result.success && result.tenant) {
        loadData();
      } else if (result.error) {
        error = result.error;
      }
    }
  });

  onDestroy(() => {
    if (unsubscribeTenantGuard) {
      unsubscribeTenantGuard();
    }
  });

  async function loadData() {
    const tenant = tenantGuardService.getCurrentTenant();
    if (!tenant) {
      error = 'No tenant available';
      return;
    }

    loading = true;
    error = '';

    try {
      const response = await fetch('/api/data', {
        headers: {
          'Authorization': `Bearer ${await authService.getAuthToken()}`,
          'X-Tenant-ID': tenant.id
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      data = await response.json();
    } catch (err: any) {
      error = `Failed to load data: ${err.message}`;
    } finally {
      loading = false;
    }
  }
</script>

{#if loading}
  <div>Loading...</div>
{:else if error}
  <div class="error">{error}</div>
{:else}
  <!-- Your component content -->
{/if}
```

## Migration from Direct Store Usage

### Before (Direct Store Usage)
```typescript
import { currentTenant } from '$lib/stores/tenantStore';

$: if (show && $currentTenant?.id) {
  loadData();
}

async function loadData() {
  if (!$currentTenant?.id) return;
  
  const response = await fetch('/api/data', {
    headers: {
      'X-Tenant-ID': $currentTenant.id
    }
  });
}
```

### After (TenantGuardService Usage)
```typescript
import { tenantGuardService } from '$lib/services/tenantGuardService';

let tenantResult: TenantGuardResult | null = null;

onMount(async () => {
  const result = await tenantGuardService.ensureTenant();
  tenantResult = result;
  if (result.success) {
    loadData();
  }
});

async function loadData() {
  const tenant = tenantGuardService.getCurrentTenant();
  if (!tenant) return;
  
  const response = await fetch('/api/data', {
    headers: {
      'X-Tenant-ID': tenant.id
    }
  });
}
```

## Benefits of Migration

1. **Isolation**: Modules don't depend on internal store implementation
2. **Consistency**: All modules use the same validation logic
3. **Error Handling**: Built-in error handling and user feedback
4. **Flexibility**: Easy to change tenant loading behavior without affecting modules
5. **Testing**: Easier to mock and test module behavior
6. **Maintenance**: Changes to tenant logic only need to be made in one place

## Best Practices

1. **Always unsubscribe**: Clean up subscriptions in `onDestroy`
2. **Handle errors gracefully**: Show user-friendly error messages
3. **Use appropriate options**: Configure `ensureTenant` based on your module's needs
4. **Check tenant availability**: Always verify tenant exists before making API calls
5. **Provide loading states**: Show loading indicators while tenant is being resolved
