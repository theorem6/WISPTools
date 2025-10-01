# Modular Architecture Guide

## Overview

The PCI Mapper application has been refactored to follow a modular, layered architecture that isolates components and protects against destructive changes. This document explains the new structure and how to work with it.

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│         Presentation Layer (UI Components)       │
│  - +page.svelte (Main orchestrator)             │
│  - Modal Components (ActionsModal, etc.)        │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│          Service Layer (Business Logic)          │
│  - pciService.ts (Facade for operations)        │
│  - Error handling & validation                  │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│         State Management Layer (Stores)          │
│  - appState.ts (Centralized state)              │
│  - Reactive stores & derived values             │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│         Core Logic Layer (Domain Models)         │
│  - pciMapper.ts (Conflict detection)            │
│  - pciOptimizer.ts (Optimization algorithms)    │
│  - arcgisMap.ts (Map visualization)             │
└─────────────────────────────────────────────────┘
```

## New File Structure

```
src/
├── lib/
│   ├── stores/
│   │   └── appState.ts           # Centralized state management
│   ├── services/
│   │   └── pciService.ts         # Business logic facade
│   ├── components/
│   │   ├── ActionsModal.svelte   # Extracted modal components
│   │   ├── AnalysisModal.svelte
│   │   ├── ConflictsModal.svelte
│   │   ├── RecommendationsModal.svelte
│   │   ├── OptimizationResultModal.svelte
│   │   ├── ManualImport.svelte
│   │   └── ConflictReportExport.svelte
│   ├── pciMapper.ts              # Core conflict detection
│   ├── pciOptimizer.ts           # Optimization algorithms
│   ├── arcgisMap.ts              # Map visualization
│   ├── geminiService.ts          # AI analysis
│   └── reportGenerator.ts        # Report generation
└── routes/
    └── +page.svelte              # Main app orchestrator
```

## Key Benefits

### 1. **Isolation of Concerns**
- **UI Layer**: Handles only presentation and user interactions
- **Service Layer**: Encapsulates business logic
- **State Layer**: Manages application state
- **Core Layer**: Contains domain-specific algorithms

### 2. **Protection Against Breaking Changes**
- Changes to UI components don't affect business logic
- Business logic changes are isolated in the service layer
- State management is centralized and predictable
- Each layer has clear boundaries and contracts

### 3. **Improved Testability**
- Service layer can be tested independently
- State management can be tested in isolation
- UI components can be tested with mock data
- Core algorithms remain pure and testable

### 4. **Better Maintainability**
- Clear responsibility for each module
- Easier to locate and fix bugs
- Simpler to add new features
- Reduced cognitive load

## Usage Examples

### Working with Stores

```typescript
import { cellsStore, cellsActions } from '$lib/stores/appState';

// Subscribe to store (reactive in Svelte)
$: cells = $cellsStore.items;
$: isLoading = $cellsStore.isLoading;

// Update store via actions
cellsActions.set(newCells);
cellsActions.add(importedCells);
cellsActions.setError('Error message');
```

### Using the Service Layer

```typescript
import { pciService } from '$lib/services/pciService';

// All business operations return ServiceResult<T>
const result = await pciService.performAnalysis(cells);

if (result.success) {
  console.log('Analysis complete:', result.data);
} else {
  console.error('Analysis failed:', result.error);
}
```

### Creating New Modal Components

1. Create the component file in `src/lib/components/`
2. Accept props for data and callbacks
3. Emit events for user actions
4. Keep styling isolated within the component

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let data = null;
  
  const dispatch = createEventDispatcher();
  
  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose}>
    <!-- Modal content -->
  </div>
{/if}

<style>
  /* Component-specific styles */
</style>
```

### Adding New Features

1. **Define State**: Add to `appState.ts` if needed
2. **Implement Logic**: Add methods to `pciService.ts`
3. **Create UI**: Build component in `components/`
4. **Wire Up**: Connect in `+page.svelte`

## State Management

### Store Structure

```typescript
interface CellsState {
  items: Cell[];           // The actual data
  isLoading: boolean;      // Loading state
  error: string | null;    // Error messages
}
```

### Store Actions

All state mutations go through action functions:

```typescript
// ✅ Good - Using actions
cellsActions.set(cells);
cellsActions.setLoading(true);

// ❌ Bad - Direct mutation
$cellsStore.items = cells;  // Don't do this!
```

### Derived Stores

Use derived stores for computed values:

```typescript
export const cellCount = derived(
  cellsStore,
  ($cellsStore) => $cellsStore.items.length
);

// Use in components
$: count = $cellCount;  // Always up-to-date
```

## Service Layer

### Error Handling

All service methods return a consistent result type:

```typescript
interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Example Service Method

```typescript
async loadCells(cells: Cell[]): Promise<ServiceResult<Cell[]>> {
  try {
    // Validate input
    const validationResult = this.validateCells(cells);
    if (!validationResult.success) {
      return validationResult;
    }
    
    // Perform operation
    cellsActions.set(cells);
    
    // Return success
    return { success: true, data: cells };
  } catch (error) {
    // Handle errors consistently
    const result = handleError(error, 'loadCells');
    cellsActions.setError(result.error);
    return result;
  }
}
```

## Best Practices

### 1. **Keep Components Small**
- Each component should have a single responsibility
- Extract reusable parts into separate components
- Limit component files to ~300 lines

### 2. **Use the Service Layer**
- Don't call core modules directly from UI components
- Let the service layer handle business logic
- Validate inputs at the service layer

### 3. **State Management**
- Always use action functions to modify state
- Use derived stores for computed values
- Keep state shape predictable and normalized

### 4. **Error Handling**
- Always handle errors at the service layer
- Display user-friendly error messages
- Log detailed errors for debugging

### 5. **Type Safety**
- Define interfaces for all data structures
- Use TypeScript strictly
- Avoid `any` types

## Migration from Old Code

### Before (Monolithic)

```svelte
<script>
  let cells = [];
  let conflicts = [];
  
  function performAnalysis() {
    // Business logic mixed with UI
    const analysis = pciMapper.analyzeConflicts(cells);
    conflicts = analysis.conflicts;
    // ... more logic
  }
</script>
```

### After (Modular)

```svelte
<script>
  import { pciService } from '$lib/services/pciService';
  import { cellsStore, conflictsStore } from '$lib/stores/appState';
  
  async function performAnalysis() {
    // Delegate to service layer
    const cells = $cellsStore.items;
    await pciService.performAnalysis(cells);
    // State is automatically updated via stores
  }
</script>
```

## Testing Strategy

### Unit Tests

```typescript
// Test service layer
describe('PCIService', () => {
  it('should validate cell data', async () => {
    const invalidCells = [{ id: '', latitude: 999 }];
    const result = await pciService.loadCells(invalidCells);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid latitude');
  });
});
```

### Component Tests

```typescript
// Test UI components
import { render, fireEvent } from '@testing-library/svelte';
import ActionsModal from './ActionsModal.svelte';

test('closes modal on button click', async () => {
  const { getByRole } = render(ActionsModal, { show: true });
  const closeButton = getByRole('button', { name: /close/i });
  
  await fireEvent.click(closeButton);
  // Assert modal is closed
});
```

## Troubleshooting

### TypeScript Errors

If you see import errors after creating new files:
1. Restart the TypeScript server in your IDE
2. Run `npm run build` to recompile
3. Check that file paths match exactly

### State Not Updating

If UI doesn't reflect state changes:
1. Ensure you're using `$storeName` syntax in Svelte
2. Verify you're using action functions, not direct mutation
3. Check that the component is subscribed to the right store

### Service Layer Errors

If service methods fail silently:
1. Check browser console for detailed error logs
2. Verify error handling in service methods
3. Ensure stores are being updated correctly

## Future Enhancements

Potential improvements to the architecture:

1. **Add Testing Layer**: Unit tests for services and components
2. **Implement Middleware**: For logging, analytics, etc.
3. **Add Caching Layer**: Cache analysis results
4. **Create API Layer**: For backend communication
5. **Add Undo/Redo**: Using state history
6. **Implement Optimistic Updates**: For better UX

## Summary

The new modular architecture provides:

✅ **Isolation**: Changes in one layer don't break others  
✅ **Testability**: Each layer can be tested independently  
✅ **Maintainability**: Clear structure and responsibilities  
✅ **Scalability**: Easy to add new features  
✅ **Type Safety**: Full TypeScript coverage  
✅ **Error Handling**: Consistent error management  
✅ **State Management**: Predictable, reactive state  

This architecture follows industry best practices and makes the codebase more robust, maintainable, and scalable.

