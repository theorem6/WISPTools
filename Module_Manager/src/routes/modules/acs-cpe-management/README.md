# ACS CPE Management Module - Refactored Structure

This module has been refactored into smaller, more maintainable components for better code organization and reusability.

## File Structure

### Components (`./components/`)
- **CPEMap.svelte** - ArcGIS map component with CPE device markers
- **CPEStatsCards.svelte** - Statistics cards showing device counts and status
- **CPEPerformanceModal.svelte** - Modal for viewing detailed device information
- **MainMenu.svelte** - Main navigation menu (existing)

### Services (`./lib/`)
- **cpeDataService.ts** - Data service for loading and managing CPE devices
  - `loadCPEDevices()` - Load devices from API or fallback to sample data
  - `syncCPEDevices()` - Sync devices with GenieACS
  - `getCPEStats()` - Calculate device statistics
  - `CPEDevice` TypeScript interface

## Benefits of Refactoring

1. **Smaller Files** - Each file has a single responsibility
2. **Reusability** - Components can be reused across different pages
3. **Maintainability** - Easier to find and fix bugs
4. **Testing** - Individual components can be tested in isolation
5. **Code Protection** - Changes to one component don't affect others
6. **Type Safety** - TypeScript service with proper interfaces

## Usage Example

To use the refactored page, replace the content of `+page.svelte` with the imports:

```svelte
<script lang="ts">
  import CPEMap from './components/CPEMap.svelte';
  import CPEStatsCards from './components/CPEStatsCards.svelte';
  import CPEPerformanceModal from './components/CPEPerformanceModal.svelte';
  import { loadCPEDevices, syncCPEDevices, getCPEStats } from './lib/cpeDataService';
  
  let cpeDevices = [];
  $: stats = getCPEStats(cpeDevices);
  
  onMount(async () => {
    cpeDevices = await loadCPEDevices();
  });
</script>

<CPEStatsCards {stats} />
<CPEMap {cpeDevices} on:cpeClick={handleCPEClick} />
<CPEPerformanceModal {device} {show} on:close={closeModal} />
```

## Migration Notes

- The original `+page.svelte` file remains intact as a backup
- All functionality has been preserved
- Event handlers work the same way via Svelte's event dispatcher
- The refactored version is in `+page-refactored.svelte` for review

## Next Steps

1. Test the new components thoroughly
2. Once verified, replace the original +page.svelte with the refactored version
3. Delete the backup file
4. Apply the same refactoring pattern to other large files

## Component Details

### CPEMap Component
- **Props:** `cpeDevices: CPEDevice[]`
- **Events:** `cpeClick` - Fired when a device marker is clicked
- **Dependencies:** ArcGIS Maps SDK for JavaScript
- **Responsibilities:** 
  - Initialize and manage ArcGIS map
  - Display device markers with status colors
  - Handle map interactions

### CPEStatsCards Component
- **Props:** `stats: { total, online, offline, onlinePercentage }`
- **No Events**
- **Responsibilities:**
  - Display device statistics in cards
  - Provide visual indicators for device status

### CPEPerformanceModal Component
- **Props:** `device: CPEDevice | null`, `show: boolean`
- **Events:** `close` - Fired when modal is closed
- **Responsibilities:**
  - Display detailed device information
  - Show device parameters and location
  - Provide device management actions

### cpeDataService
- **No UI** - Pure TypeScript service
- **Exports:** Functions and types for CPE device management
- **Responsibilities:**
  - API communication
  - Data transformation
  - Fallback data management
  - Statistics calculation

