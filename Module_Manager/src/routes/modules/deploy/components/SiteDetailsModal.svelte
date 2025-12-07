<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { auth } from '$lib/firebase';
  import { API_CONFIG } from '$lib/config/api';
  import { currentTenant } from '$lib/stores/tenantStore';
  import type { TowerSite } from '../../coverage-map/lib/models';

  export let show = false;
  export let site: TowerSite | null = null;
  export let tenantId: string = '';

  const dispatch = createEventDispatcher();

  let hardwareDeployments: any[] = [];
  let epcDevices: any[] = [];
  let equipment: any[] = [];
  let sectors: any[] = [];
  let isLoading = false;
  let error = '';
  let activeTab: 'hardware' | 'epc' | 'equipment' | 'sectors' = 'hardware';

  $: if (show && site && tenantId) {
    loadSiteDetails();
  }

  async function loadSiteDetails() {
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

      // Load EPC devices at this site
      const user = auth().currentUser;
      if (user) {
        const token = await user.getIdToken();
        try {
          const response = await fetch(`${API_CONFIG.PATHS.HSS}/epc/remote/list`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Tenant-ID': tenantId
            }
          });
          if (response.ok) {
            const data = await response.json();
            const allEPCDevices = data.epcs || [];
            epcDevices = allEPCDevices.filter((device: any) => {
              const deviceSiteId = device.siteId?._id || device.siteId?.id || device.siteId || device.site_id;
              return String(deviceSiteId) === String(siteId) || device.site_name === site.name;
            });
          }
        } catch (err) {
          console.error('Error loading EPC devices:', err);
        }
      }

      // Load equipment at this site
      const allEquipment = await coverageMapService.getEquipment(tenantId);
      equipment = allEquipment.filter((eq: any) => {
        const eqSiteId = eq.siteId?._id || eq.siteId?.id || eq.siteId;
        return String(eqSiteId) === String(siteId);
      });

      // Load sectors at this site
      const allSectors = await coverageMapService.getSectors(tenantId);
      sectors = allSectors.filter((s: any) => {
        const sectorSiteId = s.towerId?._id || s.towerId?.id || s.towerId || s.siteId?._id || s.siteId?.id || s.siteId;
        return String(sectorSiteId) === String(siteId);
      });
    } catch (err: any) {
      console.error('Error loading site details:', err);
      error = err.message || 'Failed to load site details';
    } finally {
      isLoading = false;
    }
  }

  function closeModal() {
    show = false;
    dispatch('close');
  }

  function getDeploymentTypeLabel(type: string) {
    switch(type) {
      case 'epc': return '📡 EPC Only';
      case 'snmp': return '📊 SNMP Only';
      case 'both': return '📡📊 EPC + SNMP';
      default: return '🔧 Hardware';
    }
  }

  function getEPCStatusBadge(status: string) {
    const badges: Record<string, { class: string; label: string }> = {
      'registered': { class: 'status-registered', label: '⏳ Registered' },
      'online': { class: 'status-online', label: '🟢 Online' },
      'offline': { class: 'status-offline', label: '🔴 Offline' },
      'error': { class: 'status-error', label: '⚠️ Error' }
    };
    return badges[status] || badges['registered'];
  }
</script>

{#if show && site}
  <div class="modal-overlay" onclick={closeModal}>
    <div class="modal-content large" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>📋 Site Details: {site.name}</h2>
        <button class="close-btn" onclick={closeModal}>✕</button>
      </div>
      
      {#if error}
        <div class="error-banner">{error}</div>
      {/if}
      
      <!-- Site Info -->
      <div class="site-info">
        <div class="info-row">
          <span class="label">Type:</span>
          <span class="value">{site.type || 'tower'}</span>
        </div>
        {#if site.location?.address}
          <div class="info-row">
            <span class="label">Address:</span>
            <span class="value">{site.location.address}</span>
          </div>
        {/if}
        {#if site.location?.latitude && site.location?.longitude}
          <div class="info-row">
            <span class="label">Coordinates:</span>
            <span class="value">{site.location.latitude.toFixed(6)}, {site.location.longitude.toFixed(6)}</span>
          </div>
        {/if}
        <div class="info-row">
          <span class="label">Status:</span>
          <span class="value status-badge {site.status || 'active'}">{site.status || 'active'}</span>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn" class:active={activeTab === 'hardware'} onclick={() => activeTab = 'hardware'}>
          🔧 Hardware ({hardwareDeployments.length})
        </button>
        <button class="tab-btn" class:active={activeTab === 'epc'} onclick={() => activeTab = 'epc'}>
          📡 EPC/SNMP ({epcDevices.length})
        </button>
        <button class="tab-btn" class:active={activeTab === 'equipment'} onclick={() => activeTab = 'equipment'}>
          📦 Equipment ({equipment.length})
        </button>
        <button class="tab-btn" class:active={activeTab === 'sectors'} onclick={() => activeTab = 'sectors'}>
          📶 Sectors ({sectors.length})
        </button>
      </div>
      
      <div class="modal-body">
        {#if isLoading}
          <div class="loading">Loading site details...</div>
        {:else if activeTab === 'hardware'}
          <!-- Hardware Deployments -->
          {#if hardwareDeployments.length === 0}
            <div class="empty-state">
              <p>No hardware deployments found at this site</p>
            </div>
          {:else}
            <div class="items-list">
              {#each hardwareDeployments as deployment}
                <div class="item-card">
                  <div class="item-header">
                    <h3>{deployment.name || 'Unnamed Deployment'}</h3>
                    <span class="status-badge {deployment.status || 'deployed'}">{deployment.status || 'deployed'}</span>
                  </div>
                  <div class="item-details">
                    <div class="detail-row">
                      <span class="label">Type:</span>
                      <span class="value">{deployment.hardware_type || 'Unknown'}</span>
                    </div>
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
        {:else if activeTab === 'epc'}
          <!-- EPC/SNMP Devices -->
          {#if epcDevices.length === 0}
            <div class="empty-state">
              <p>No EPC/SNMP devices found at this site</p>
            </div>
          {:else}
            <div class="items-list">
              {#each epcDevices as device}
                <div class="item-card epc-device">
                  <div class="item-header">
                    <h3>{device.site_name || 'Unnamed Device'}</h3>
                    <span class="status-badge {getEPCStatusBadge(device.status).class}">
                      {getEPCStatusBadge(device.status).label}
                    </span>
                  </div>
                  <div class="item-details">
                    <div class="detail-row">
                      <span class="label">Type:</span>
                      <span class="value">{getDeploymentTypeLabel(device.deployment_type || 'both')}</span>
                    </div>
                    {#if device.device_code}
                      <div class="detail-row">
                        <span class="label">Device Code:</span>
                        <code class="device-code">{device.device_code}</code>
                      </div>
                    {/if}
                    <div class="detail-row">
                      <span class="label">ID:</span>
                      <span class="value mono">{device.epc_id}</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:else if activeTab === 'equipment'}
          <!-- Equipment -->
          {#if equipment.length === 0}
            <div class="empty-state">
              <p>No equipment found at this site</p>
            </div>
          {:else}
            <div class="items-list">
              {#each equipment as eq}
                <div class="item-card">
                  <div class="item-header">
                    <h3>{eq.name || 'Unnamed Equipment'}</h3>
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
        {:else if activeTab === 'sectors'}
          <!-- Sectors -->
          {#if sectors.length === 0}
            <div class="empty-state">
              <p>No sectors found at this site</p>
            </div>
          {:else}
            <div class="items-list">
              {#each sectors as sector}
                <div class="item-card">
                  <div class="item-header">
                    <h3>{sector.name || `Sector ${sector.azimuth}°`}</h3>
                    <span class="status-badge {sector.status || 'active'}">{sector.status || 'active'}</span>
                  </div>
                  <div class="item-details">
                    {#if sector.azimuth}
                      <div class="detail-row">
                        <span class="label">Azimuth:</span>
                        <span class="value">{sector.azimuth}°</span>
                      </div>
                    {/if}
                    {#if sector.band}
                      <div class="detail-row">
                        <span class="label">Band:</span>
                        <span class="value">{sector.band}</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeModal}>Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--card-bg, white);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-content.large {
    width: 800px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.5rem;
    color: var(--text-secondary);
  }

  .close-btn:hover {
    color: var(--text-primary);
  }

  .error-banner {
    background: #fee;
    color: #c00;
    padding: 1rem;
    margin: 0 1.5rem;
    border-radius: 8px;
    border: 1px solid #fcc;
  }

  .site-info {
    padding: 1.5rem;
    background: var(--bg-subtle, #f5f5f5);
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .info-row:last-child {
    margin-bottom: 0;
  }

  .label {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .value {
    color: var(--text-primary);
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    padding: 0 1.5rem;
  }

  .tab-btn {
    background: none;
    border: none;
    padding: 1rem 1.5rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    color: var(--text-secondary);
    font-size: 0.95rem;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover, #f5f5f5);
  }

  .tab-btn.active {
    color: var(--brand-primary, #7c3aed);
    border-bottom-color: var(--brand-primary, #7c3aed);
    font-weight: 500;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .loading,
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .item-card {
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    padding: 1rem;
    background: var(--card-bg, white);
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .item-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .item-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .status-badge.deployed,
  .status-badge.active,
  .status-badge.online {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }

  .status-badge.pending,
  .status-badge.registered {
    background: rgba(234, 179, 8, 0.1);
    color: #ca8a04;
  }

  .status-badge.offline,
  .status-badge.inactive {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }

  .device-code {
    background: var(--bg-subtle, #f5f5f5);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9rem;
  }

  .mono {
    font-family: monospace;
    font-size: 0.9rem;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color, #e0e0e0);
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: var(--bg-secondary, #f5f5f5);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: var(--bg-hover, #e5e5e5);
  }
</style>
