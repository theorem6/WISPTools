<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import type { TowerSite } from '../../coverage-map/lib/models';

  export let show = false;
  export let site: TowerSite | null = null;
  export let tenantId: string = '';

  const dispatch = createEventDispatcher();

  let hardwareDeployments: any[] = [];
  let equipment: any[] = [];
  let isLoading = false;
  let error = '';

  $: if (show && site && tenantId) {
    console.log('[SiteEquipmentModal] Reactive trigger - show:', show, 'site:', site?.name, 'tenantId:', tenantId);
    loadEquipment();
  }
  
  $: if (show) {
    console.log('[SiteEquipmentModal] Modal show state changed:', show, 'site:', site);
  }

  async function loadEquipment() {
    if (!site || !tenantId) return;

    isLoading = true;
    error = '';

    try {
      const siteId = site.id || site._id;

      // Load all deployed hardware at this site
      const allDeployments = await coverageMapService.getAllHardwareDeployments(tenantId);
      hardwareDeployments = allDeployments.filter((d: any) => {
        const deploymentSiteId = d.siteId?._id || d.siteId?.id || d.siteId;
        return String(deploymentSiteId) === String(siteId);
      });

      // Load equipment at this site
      const allEquipment = await coverageMapService.getEquipment(tenantId);
      equipment = allEquipment.filter((eq: any) => {
        const eqSiteId = eq.siteId?._id || eq.siteId?.id || eq.siteId;
        return String(eqSiteId) === String(siteId);
      });
    } catch (err: any) {
      console.error('Error loading equipment:', err);
      error = err.message || 'Failed to load equipment';
    } finally {
      isLoading = false;
    }
  }

  function closeModal() {
    show = false;
    dispatch('close');
  }
</script>

{#if show && site}
  <div class="modal-overlay" onclick={closeModal}>
    <div class="modal-content large" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>📦 Equipment at {site.name}</h2>
        <button class="close-btn" onclick={closeModal}>✕</button>
      </div>
      
      {#if error}
        <div class="error-banner">{error}</div>
      {/if}
      
      <div class="modal-body">
        {#if isLoading}
          <div class="loading">Loading equipment...</div>
        {:else}
          <!-- Hardware Deployments -->
          <div class="section">
            <h3>🔧 Hardware Deployments ({hardwareDeployments.length})</h3>
            {#if hardwareDeployments.length === 0}
              <div class="empty-state">
                <p>No hardware deployments found at this site</p>
              </div>
            {:else}
              <div class="items-list">
                {#each hardwareDeployments as deployment}
                  <div class="item-card">
                    <div class="item-header">
                      <h4>{deployment.name || 'Unnamed Deployment'}</h4>
                      <span class="status-badge {deployment.status || 'deployed'}">{deployment.status || 'deployed'}</span>
                    </div>
                    <div class="item-details">
                      <div class="detail-row">
                        <span class="label">Type:</span>
                        <span class="value">{deployment.hardware_type || 'Unknown'}</span>
                      </div>
                      {#if deployment.config?.ipAddress || deployment.config?.ip_address}
                        <div class="detail-row">
                          <span class="label">IP Address:</span>
                          <span class="value mono">{deployment.config.ipAddress || deployment.config.ip_address}</span>
                        </div>
                      {/if}
                      {#if deployment.config?.macAddress || deployment.config?.mac_address}
                        <div class="detail-row">
                          <span class="label">MAC Address:</span>
                          <span class="value mono">{deployment.config.macAddress || deployment.config.mac_address}</span>
                        </div>
                      {/if}
                      {#if deployment.deployedAt}
                        <div class="detail-row">
                          <span class="label">Deployed:</span>
                          <span class="value">{new Date(deployment.deployedAt).toLocaleDateString()}</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Network Equipment -->
          <div class="section">
            <h3>📡 Network Equipment ({equipment.length})</h3>
            {#if equipment.length === 0}
              <div class="empty-state">
                <p>No network equipment found at this site</p>
              </div>
            {:else}
              <div class="items-list">
                {#each equipment as eq}
                  <div class="item-card">
                    <div class="item-header">
                      <h4>{eq.name || 'Unnamed Equipment'}</h4>
                      <span class="status-badge {eq.status || 'active'}">{eq.status || 'active'}</span>
                    </div>
                    <div class="item-details">
                      <div class="detail-row">
                        <span class="label">Type:</span>
                        <span class="value">{eq.type || 'Unknown'}</span>
                      </div>
                      {#if eq.manufacturer || eq.model}
                        <div class="detail-row">
                          <span class="label">Model:</span>
                          <span class="value">{[eq.manufacturer, eq.model].filter(Boolean).join(' ')}</span>
                        </div>
                      {/if}
                      {#if eq.ipAddress || eq.networkConfig?.management_ip}
                        <div class="detail-row">
                          <span class="label">IP Address:</span>
                          <span class="value mono">{eq.ipAddress || eq.networkConfig?.management_ip}</span>
                        </div>
                      {/if}
                      {#if eq.macAddress}
                        <div class="detail-row">
                          <span class="label">MAC Address:</span>
                          <span class="value mono">{eq.macAddress}</span>
                        </div>
                      {/if}
                      {#if eq.serialNumber}
                        <div class="detail-row">
                          <span class="label">Serial:</span>
                          <span class="value mono">{eq.serialNumber}</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--card-bg, #ffffff);
    border-radius: 8px;
    padding: 0;
    max-width: 800px;
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-content.large {
    max-width: 1000px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: var(--bg-secondary, #f3f4f6);
  }

  .error-banner {
    background: #fee2e2;
    color: #991b1b;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid #fecaca;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary, #6b7280);
  }

  .section {
    margin-bottom: 2rem;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--text-primary, #111827);
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary, #6b7280);
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .item-card {
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    padding: 1rem;
    background: var(--card-bg, #ffffff);
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .item-header h4 {
    margin: 0;
    font-size: 1rem;
  }

  .item-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-row {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .detail-row .label {
    font-weight: 500;
    min-width: 120px;
    color: var(--text-secondary, #6b7280);
  }

  .detail-row .value {
    color: var(--text-primary, #111827);
  }

  .detail-row .value.mono {
    font-family: monospace;
  }

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-badge.active,
  .status-badge.deployed {
    background: #d1fae5;
    color: #065f46;
  }
</style>

