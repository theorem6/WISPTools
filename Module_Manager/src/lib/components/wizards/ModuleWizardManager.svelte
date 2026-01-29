<script lang="ts">
  /**
   * Module Wizard Manager
   * 
   * Centralized manager for orchestrating wizards across modules.
   * Provides a unified interface for launching and managing wizards.
   */
  
  import { createEventDispatcher } from 'svelte';
  import DeviceRegistrationWizard from './acs/DeviceRegistrationWizard.svelte';
  import PresetCreationWizard from './acs/PresetCreationWizard.svelte';
  import BulkOperationsWizard from './acs/BulkOperationsWizard.svelte';
  import FirmwareUpdateWizard from './acs/FirmwareUpdateWizard.svelte';
  import TroubleshootingWizard from './acs/TroubleshootingWizard.svelte';
  import DeviceOnboardingWizard from './acs/DeviceOnboardingWizard.svelte';
  import DeploymentWizard from './deployment/DeploymentWizard.svelte';
  import InventoryCheckInWizard from './inventory/InventoryCheckInWizard.svelte';
  import WorkOrderCreationWizard from './workorders/WorkOrderCreationWizard.svelte';
  
  export let moduleId: string = 'acs'; // Module identifier
  export let availableWizards: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    component: any;
  }> = [];
  
  const dispatch = createEventDispatcher();
  
  // Wizard state
  let activeWizard: string | null = null;
  let wizardProps: Record<string, any> = {};
  
  // Default ACS wizards
  const defaultACSWizards = [
    {
      id: 'device-registration',
      name: 'Device Registration',
      description: 'Register CPE devices with GenieACS',
      icon: '📱',
      component: DeviceRegistrationWizard
    },
    {
      id: 'preset-creation',
      name: 'Create Preset',
      description: 'Create a new configuration preset',
      icon: '⚙️',
      component: PresetCreationWizard
    },
    {
      id: 'bulk-operations',
      name: 'Bulk Operations',
      description: 'Perform operations on multiple devices',
      icon: '📦',
      component: BulkOperationsWizard
    },
    {
      id: 'firmware-update',
      name: 'Firmware Update',
      description: 'Update firmware on devices',
      icon: '💾',
      component: FirmwareUpdateWizard
    },
    {
      id: 'troubleshooting',
      name: 'Troubleshooting',
      description: 'Diagnose and fix device issues',
      icon: '🔍',
      component: TroubleshootingWizard
    },
    {
      id: 'device-onboarding',
      name: 'Device Onboarding',
      description: 'Comprehensive device onboarding',
      icon: '👋',
      component: DeviceOnboardingWizard
    },
    {
      id: 'deployment',
      name: 'Deployment',
      description: 'Deploy equipment in the field',
      icon: '🚀',
      component: DeploymentWizard
    },
    {
      id: 'inventory-checkin',
      name: 'Inventory Check-in',
      description: 'Check in inventory items',
      icon: '📦',
      component: InventoryCheckInWizard
    },
    {
      id: 'work-order-creation',
      name: 'Create Work Order',
      description: 'Create a work order or ticket',
      icon: '📋',
      component: WorkOrderCreationWizard
    }
  ];
  
  $: wizards = availableWizards.length > 0 ? availableWizards : defaultACSWizards;
  $: wizards = availableWizards.length > 0 ? availableWizards : defaultACSWizards;
  $: activeWizardComponent = activeWizard 
    ? wizards.find((w: any) => w.id === activeWizard)?.component 
    : null;
  
  function openWizard(wizardId: string, props: Record<string, any> = {}) {
    activeWizard = wizardId;
    wizardProps = { show: true, ...props };
    dispatch('wizardOpen', { wizardId, props });
  }
  
  function closeWizard() {
    const wizardId = activeWizard;
    activeWizard = null;
    wizardProps = {};
    dispatch('wizardClose', { wizardId });
  }
  
  function handleWizardComplete(event: CustomEvent) {
    dispatch('wizardComplete', { wizardId: activeWizard, data: event.detail });
    closeWizard();
  }
  
  // Expose methods for parent components
  export { openWizard, closeWizard };
</script>

<!-- Wizard Launcher UI (optional) -->
{#if false}
  <div class="wizard-launcher">
    <h3>Available Wizards</h3>
    <div class="wizards-grid">
      {#each wizards as wizard}
        <button 
          class="wizard-card"
          on:click={() => openWizard(wizard.id)}
        >
          <div class="wizard-icon">{wizard.icon}</div>
          <h4>{wizard.name}</h4>
          <p>{wizard.description}</p>
        </button>
      {/each}
    </div>
  </div>
{/if}

<!-- Active Wizard -->
{#if activeWizardComponent}
  <svelte:component 
    this={activeWizardComponent} 
    {...wizardProps}
    on:close={closeWizard}
    on:complete={handleWizardComplete}
  />
{/if}

<style>
  .wizard-launcher {
    padding: 1.5rem;
  }
  
  .wizard-launcher h3 {
    margin: 0 0 1rem 0;
  }
  
  .wizards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .wizard-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
    color: var(--text-primary);
  }
  
  .wizard-card:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }
  
  .wizard-icon {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }
  
  .wizard-card h4 {
    margin: 0.5rem 0;
    font-size: 1.1rem;
    color: var(--text-primary);
  }
  
  .wizard-card p {
    margin: 0.5rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
</style>
