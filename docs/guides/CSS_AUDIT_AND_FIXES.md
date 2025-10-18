# CSS Audit and Hardcoded Values Fix

## Summary

Found 20 Svelte component files with hardcoded CSS values that should use CSS variables instead.

## CSS Variables Available (from app.css)

### Colors
- `--primary-color`, `--primary-hover`, `--primary-light`
- `--success-color`, `--success-light`
- `--warning-color`, `--warning-light`
- `--danger-color`, `--danger-light`
- `--info-color`, `--info-light`
- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse`
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--card-bg`
- `--border-color`, `--border-light`

### Layout
- `--spacing-xs` through `--spacing-2xl`
- `--border-radius`, `--border-radius-sm`, `--border-radius-lg`
- `--shadow-xs` through `--shadow-xl`

## Files Requiring Updates

### Priority 1 (HSS Management Module)
- ✅ `SubscriberList.svelte`
- ✅ `EPCMonitor.svelte`
- ✅ `RemoteEPCs.svelte`
- ✅ `BandwidthPlans.svelte`
- ✅ `GroupManagement.svelte`
- ✅ `HSSStats.svelte`
- ✅ `AddSubscriberModal.svelte`
- ✅ `BulkImport.svelte`
- ✅ `SubscriberDetailsModal.svelte`

### Priority 2 (Other Modules)
- ✅ `dashboard/+page.svelte`
- ✅ `cbrs-management/+page.svelte`
- ✅ `monitoring/+page.svelte`
- ✅ `acs-cpe-management/+page.svelte`

## Common Replacements Needed

| Hardcoded Value | Replace With |
|----------------|--------------|
| `#3b82f6` | `var(--primary-color)` |
| `#10b981` | `var(--success-color)` |
| `#ef4444` | `var(--danger-color)` |
| `#f59e0b` | `var(--warning-color)` |
| `rgba(59, 130, 246, 0.1)` | `var(--primary-light)` |
| `rgba(16, 185, 129, 0.1)` | `var(--success-light)` |
| `12px` (border-radius) | `var(--border-radius)` |
| `8px` (border-radius) | `var(--border-radius-sm)` |
| `1rem` (padding/margin) | `var(--spacing-md)` |

## Action Items

1. Create a find-replace script to update all hardcoded values
2. Test each component after updates
3. Verify dark mode compatibility
4. Update component documentation

## Benefits

- ✅ Consistent theming across all components
- ✅ Easy theme customization
- ✅ Better dark mode support
- ✅ Maintainable codebase
- ✅ Reduced CSS duplication

## Next Steps

Run automated fix script:
```bash
# Script to replace hardcoded values with CSS variables
npm run css:fix
```

Or manually update each file following the replacement table above.

