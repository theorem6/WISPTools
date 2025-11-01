<script lang="ts">
  import { onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { coverageMapService } from '../coverage-map/lib/coverageMapService.mongodb';
  import SiteEditModal from '../coverage-map/components/SiteEditModal.svelte';
  import EPCDeploymentModal from '../deploy/components/EPCDeploymentModal.svelte';
  import AddSectorModal from '../coverage-map/components/AddSectorModal.svelte';
  import AddCPEModal from '../coverage-map/components/AddCPEModal.svelte';
  import AddBackhaulLinkModal from '../coverage-map/components/AddBackhaulLinkModal.svelte';
  
  let sites: any[] = [];
  let loading = true;
  let error = '';
  let searchQuery = '';
  let typeFilter: string = 'all';
  let statusFilter: string = 'all';
  
  // Modals
  let showEditModal = false;
  let showDeployModal = false;
  let showSectorModal = false;
  let showCPEModal = false;
  let showBackhaulModal = false;
  let selectedSite: any = null;
  let selectedSiteForEPC: any = null;
  let selectedSiteForSector: any = null;
  let selectedSiteForCPE: any = null;
  let selectedSiteForBackhaul: any = null;
  let allSites: any[] = [];  // For backhaul endpoint selection
  
  $: filteredSites = sites.filter(site => {
    const matchesSearch = !searchQuery || 
      site.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.location?.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.location?.city?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || site.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || site.status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });
  
  onMount(async () => {
    await loadSites();
    // Load all sites for backhaul selection
    if ($currentTenant?.id) {
      try {
        allSites = await coverageMapService.getTowerSites($currentTenant.id);
      } catch (err) {
        console.error('Failed to load all sites for backhaul:', err);
      }
    }
  });
  
  async function loadSites() {
    if (!$currentTenant?.id) return;
    
    loading = true;
    error = '';
    
    try {
      sites = await coverageMapService.getTowerSites($currentTenant.id);
    } catch (err: any) {
      error = err.message || 'Failed to load sites';
      console.error('[Sites] Error loading sites:', err);
    } finally {
      loading = false;
    }
  }
  
  function handleEdit(site: any) {
    selectedSite = site;
    showEditModal = true;
  }
  
  function handleCreateNew() {
    selectedSite = null;
    showEditModal = true;
  }
  
  function handleDeployEPC(site: any) {
    selectedSiteForEPC = site;
    showDeployModal = true;
  }
  
  function handleDeploySector(site: any) {
    selectedSiteForSector = site;
    showSectorModal = true;
  }
  
  function handleDeployCPE(site: any) {
    selectedSiteForCPE = site;
    showCPEModal = true;
  }
  
  function handleDeployBackhaul(site: any) {
    selectedSiteForBackhaul = site;
    showBackhaulModal = true;
  }
  
  function handleSiteSaved() {
    showEditModal = false;
    selectedSite = null;
    loadSites();
  }
  
  function getSiteTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'tower': '📡',
      'building': '🏢',
      'noc': '🖥️',
      'warehouse': '🏭',
      'pole': '📡',
      'other': '📍'
    };
    return icons[type] || '📍';
  }
  
  function getStatusBadge(status: string): string {
    const badges: Record<string, string> = {
      'active': '✅',
      'inactive': '❌',
      'maintenance': '🔧',
      'planned': '📅'
    };
    return badges[status] || '❓';
  }
  
  function getContactInfo(site: any): string {
    if (site.towerContact?.name) {
      return `${site.towerContact.name}${site.towerContact.phone ? ` (${site.towerContact.phone})` : ''}`;
    }
    if (site.buildingContact?.name) {
      return `${site.buildingContact.name}${site.buildingContact.phone ? ` (${site.buildingContact.phone})` : ''}`;
    }
    if (site.siteContact?.name) {
      return `${site.siteContact.name}${site.siteContact.phone ? ` (${site.siteContact.phone})` : ''}`;
    }
    if (site.contact?.name) {
      return `${site.contact.name}${site.contact.phone ? ` (${site.contact.phone})` : ''}`;
    }
    return 'No contact';
  }
</script>

<TenantGuard>
  <div class="sites-page">
    <div class="page-header">
      <div>
        <h1>🏢 Site Management</h1>
        <p class="subtitle">Manage all network sites, towers, buildings, and facilities</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" on:click={handleCreateNew}>
          ➕ Create New Site
        </button>
        <button class="btn-secondary" on:click={loadSites} title="Refresh">
          🔄 Refresh
        </button>
      </div>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    <!-- Filters and Search -->
    <div class="filters-section">
      <div class="search-box">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search sites by name, address, or city..."
          class="search-input"
        />
        <span class="search-icon">🔍</span>
      </div>
      
      <div class="filter-group">
        <label>Type:</label>
        <select bind:value={typeFilter}>
          <option value="all">All Types</option>
          <option value="tower">📡 Tower</option>
          <option value="building">🏢 Building</option>
          <option value="noc">🖥️ NOC</option>
          <option value="warehouse">🏭 Warehouse</option>
          <option value="pole">📡 Pole</option>
          <option value="other">📍 Other</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>Status:</label>
        <select bind:value={statusFilter}>
          <option value="all">All Statuses</option>
          <option value="active">✅ Active</option>
          <option value="inactive">❌ Inactive</option>
          <option value="maintenance">🔧 Maintenance</option>
          <option value="planned">📅 Planned</option>
        </select>
      </div>
    </div>
    
    <!-- Summary Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{sites.length}</div>
        <div class="stat-label">Total Sites</div>
      </div>
      <div class="stat-card active">
        <div class="stat-value">{sites.filter(s => s.status === 'active').length}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{sites.filter(s => s.type === 'tower').length}</div>
        <div class="stat-label">Towers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{sites.filter(s => s.type === 'building').length}</div>
        <div class="stat-label">Buildings</div>
      </div>
    </div>
    
    <!-- Sites Table -->
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading sites...</p>
      </div>
    {:else if filteredSites.length === 0}
      <div class="empty-state">
        <p>No sites found</p>
        {#if sites.length === 0}
          <button class="btn-primary" on:click={handleCreateNew}>
            Create Your First Site
          </button>
        {:else}
          <p class="help-text">Try adjusting your search or filters</p>
        {/if}
      </div>
    {:else}
      <div class="sites-table-container">
        <table class="sites-table">
          <thead>
            <tr>
              <th>Site Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Location</th>
              <th>Contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredSites as site}
              <tr>
                <td>
                  <div class="site-name">
                    <strong>{site.name || 'Unnamed Site'}</strong>
                    {#if site.owner}
                      <small>{site.owner}</small>
                    {/if}
                  </div>
                </td>
                <td>
                  <span class="type-badge">
                    {getSiteTypeIcon(site.type)} {site.type || 'unknown'}
                  </span>
                </td>
                <td>
                  <span class="status-badge status-{site.status}">
                    {getStatusBadge(site.status)} {site.status || 'unknown'}
                  </span>
                </td>
                <td>
                  <div class="location-info">
                    {#if site.location?.address}
                      <div>{site.location.address}</div>
                    {/if}
                    {#if site.location?.city || site.location?.state}
                      <div class="location-secondary">
                        {site.location?.city}{site.location?.city && site.location?.state ? ', ' : ''}{site.location?.state}
                        {#if site.location?.zipCode} {site.location.zipCode}{/if}
                      </div>
                    {/if}
                    {#if site.location?.latitude && site.location?.longitude}
                      <div class="coordinates">
                        {site.location.latitude.toFixed(6)}, {site.location.longitude.toFixed(6)}
                      </div>
                    {/if}
                  </div>
                </td>
                <td>
                  <div class="contact-info">
                    {getContactInfo(site)}
                  </div>
                </td>
                <td>
                  <div class="action-buttons">
                    <button 
                      class="btn-icon" 
                      on:click={() => handleEdit(site)}
                      title="Edit Site"
                    >
                      ✏️
                    </button>
                    <div class="deploy-menu">
                      <button 
                        class="btn-icon btn-deploy" 
                        title="Deploy Equipment"
                      >
                        🚀
                      </button>
                      <div class="deploy-dropdown">
                        <button on:click={() => handleDeployEPC(site)}>
                          🖥️ Deploy EPC
                        </button>
                        <button on:click={() => handleDeploySector(site)}>
                          📡 Deploy LTE/5G Sector
                        </button>
                        <button on:click={() => handleDeployCPE(site)}>
                          📱 Deploy FWA (CPE)
                        </button>
                        <button on:click={() => handleDeployBackhaul(site)}>
                          🔗 Deploy Backhaul (Wireless/Fiber)
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
  
  <!-- Site Edit Modal -->
  <SiteEditModal
    show={showEditModal}
    site={selectedSite}
    tenantId={$currentTenant?.id || ''}
    on:saved={handleSiteSaved}
    on:close={() => { showEditModal = false; selectedSite = null; }}
  />
  
  <!-- EPC Deployment Modal -->
  {#if showDeployModal && selectedSiteForEPC}
    <EPCDeploymentModal
      show={showDeployModal}
      tenantId={$currentTenant?.id || ''}
      siteData={selectedSiteForEPC}
      on:close={() => { showDeployModal = false; selectedSiteForEPC = null; }}
    />
  {/if}
  
  <!-- Sector Deployment Modal -->
  {#if showSectorModal && selectedSiteForSector}
    <AddSectorModal
      show={showSectorModal}
      selectedSite={selectedSiteForSector}
      sites={allSites}
      tenantId={$currentTenant?.id || ''}
      on:saved={async () => {
        showSectorModal = false;
        selectedSiteForSector = null;
        await loadSites();
      }}
      on:close={() => { showSectorModal = false; selectedSiteForSector = null; }}
    />
  {/if}
  
  <!-- CPE/FWA Deployment Modal -->
  {#if showCPEModal && selectedSiteForCPE}
    <AddCPEModal
      show={showCPEModal}
      sites={allSites}
      initialLatitude={selectedSiteForCPE.location?.latitude || null}
      initialLongitude={selectedSiteForCPE.location?.longitude || null}
      tenantId={$currentTenant?.id || ''}
      on:saved={async () => {
        showCPEModal = false;
        selectedSiteForCPE = null;
        await loadSites();
      }}
      on:close={() => { showCPEModal = false; selectedSiteForCPE = null; }}
    />
  {/if}
  
  <!-- Backhaul Deployment Modal -->
  {#if showBackhaulModal && selectedSiteForBackhaul}
    <AddBackhaulLinkModal
      show={showBackhaulModal}
      fromSite={selectedSiteForBackhaul}
      sites={allSites}
      tenantId={$currentTenant?.id || ''}
      on:saved={async () => {
        showBackhaulModal = false;
        selectedSiteForBackhaul = null;
        await loadSites();
      }}
      on:close={() => { showBackhaulModal = false; selectedSiteForBackhaul = null; }}
    />
  {/if}
</TenantGuard>

<style>
  .sites-page {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }
  
  .page-header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    color: var(--text-primary);
  }
  
  .subtitle {
    margin: 0;
    color: var(--text-secondary);
    font-size: 1rem;
  }
  
  .header-actions {
    display: flex;
    gap: 0.75rem;
  }
  
  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
  }
  
  .filters-section {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    align-items: flex-end;
  }
  
  .search-box {
    flex: 1;
    position: relative;
  }
  
  .search-input {
    width: 100%;
    padding: 0.75rem;
    padding-right: 2.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
  }
  
  .search-icon {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }
  
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .filter-group label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .filter-group select {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
    min-width: 150px;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .stat-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
  }
  
  .stat-card.active {
    border-color: var(--brand-primary);
    background: rgba(var(--brand-primary-rgb, 59, 130, 246), 0.1);
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
  
  .stat-label {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--brand-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .sites-table-container {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .sites-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .sites-table thead {
    background: var(--bg-secondary);
  }
  
  .sites-table th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-secondary);
    border-bottom: 2px solid var(--border-color);
  }
  
  .sites-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .sites-table tbody tr:hover {
    background: var(--bg-hover);
  }
  
  .site-name strong {
    display: block;
    margin-bottom: 0.25rem;
  }
  
  .site-name small {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  
  .type-badge,
  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 500;
  }
  
  .type-badge {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  .status-badge {
    background: var(--bg-secondary);
  }
  
  .status-badge.status-active {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }
  
  .status-badge.status-inactive {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }
  
  .status-badge.status-maintenance {
    background: rgba(251, 191, 36, 0.1);
    color: #fbbf24;
  }
  
  .status-badge.status-planned {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }
  
  .location-info {
    font-size: 0.9rem;
  }
  
  .location-secondary {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }
  
  .coordinates {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-family: monospace;
    margin-top: 0.25rem;
  }
  
  .contact-info {
    font-size: 0.9rem;
  }
  
  .action-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  .btn-icon {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.5rem;
    cursor: pointer;
    font-size: 1.2rem;
    transition: all 0.2s;
    position: relative;
  }
  
  .btn-icon:hover {
    background: var(--bg-tertiary);
    border-color: var(--brand-primary);
    transform: translateY(-2px);
  }
  
  .deploy-menu {
    position: relative;
  }
  
  .btn-deploy:hover + .deploy-dropdown,
  .deploy-dropdown:hover {
    display: block;
  }
  
  .deploy-dropdown {
    display: none;
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 0.25rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 220px;
    overflow: hidden;
  }
  
  .deploy-dropdown button {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border-color);
    text-align: left;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 0.9rem;
    transition: background 0.2s;
  }
  
  .deploy-dropdown button:last-child {
    border-bottom: none;
  }
  
  .deploy-dropdown button:hover {
    background: var(--bg-hover);
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--brand-primary-hover);
    transform: translateY(-2px);
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
  
  .help-text {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
</style>

