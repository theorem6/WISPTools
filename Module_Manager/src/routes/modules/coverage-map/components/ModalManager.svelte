<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TowerSite } from '../lib/models';
  
  export let currentTenantId: string;
  
  // Modal states
  export let showAddSiteModal = false;
  export let showAddNOCModal = false;
  export let showAddWarehouseModal = false;
  export let showAddVehicleModal = false;
  export let showAddRMAModal = false;
  export let showAddSectorModal = false;
  export let showAddCPEModal = false;
  export let showAddBackhaulModal = false;
  export let showAddInventoryModal = false;
  export let showTowerActionsMenu = false;
  export let showContextMenu = false;
  export let showEPCDeploymentModal = false;
  export let showHSSRegistrationModal = false;
  export let showHardwareDeploymentModal = false;
  
  // Modal data
  export let selectedTowerForEPC: TowerSite | null = null;
  export let selectedSiteForSector: TowerSite | null = null;
  export let selectedSiteForBackhaul: TowerSite | null = null;
  export let selectedSiteForInventory: TowerSite | null = null;
  export let selectedTowerForMenu: TowerSite | null = null;
  export let towerMenuX = 0;
  export let towerMenuY = 0;
  export let contextMenuX = 0;
  export let contextMenuY = 0;
  export let contextMenuLat = 0;
  export let contextMenuLon = 0;
  
  const dispatch = createEventDispatcher();
  
  function closeAllModals() {
    showAddSiteModal = false;
    showAddNOCModal = false;
    showAddWarehouseModal = false;
    showAddVehicleModal = false;
    showAddRMAModal = false;
    showAddSectorModal = false;
    showAddCPEModal = false;
    showAddBackhaulModal = false;
    showAddInventoryModal = false;
    showTowerActionsMenu = false;
    showContextMenu = false;
    showEPCDeploymentModal = false;
    showHSSRegistrationModal = false;
    showHardwareDeploymentModal = false;
    
    // Clear modal data
    selectedTowerForEPC = null;
    selectedSiteForSector = null;
    selectedSiteForBackhaul = null;
    selectedSiteForInventory = null;
    selectedTowerForMenu = null;
  }
  
  // Expose closeAllModals for parent
  dispatch('register', { closeAllModals });
  
  export function openHardwareDeploymentModal(tower: TowerSite) {
    if (!tower) {
      console.error('Cannot open hardware deployment modal without tower');
      return;
    }
    
    selectedTowerForEPC = tower;
    showHardwareDeploymentModal = true;
  }
  
  export function openTowerActionsMenu(tower: TowerSite, x: number, y: number) {
    if (!tower) {
      console.error('Cannot open tower actions menu without tower');
      return;
    }
    
    selectedTowerForMenu = tower;
    towerMenuX = x;
    towerMenuY = y;
    showTowerActionsMenu = true;
  }
</script>

