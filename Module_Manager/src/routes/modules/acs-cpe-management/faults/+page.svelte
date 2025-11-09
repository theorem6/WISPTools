<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../components/MainMenu.svelte';
  
  type FaultSeverity = 'Critical' | 'Warning' | 'Info' | string;
  type FaultStatus = 'Open' | 'Resolved' | string;
  
  interface Fault {
    id: string;
    deviceName: string;
    message: string;
    severity: FaultSeverity;
    status: FaultStatus;
    createdAt?: string;
    resolvedAt?: string;
    resolvedBy?: string;
    resolution?: string;
    timestamp?: string;
    parameters?: Record<string, unknown>;
    [key: string]: unknown;
  }
  
  interface FaultResponse extends Omit<Fault, 'id'> {
    _id?: string;
    id?: string;
  }
  
  interface FaultApiResponse {
    success: boolean;
    faults: FaultResponse[];
    error?: string;
  }
  
  // Faults data from database
  let faults: Fault[] = [];
  
  let isLoading = false;
  let selectedFault: Fault | null = null;
  let showFaultModal = false;
  let searchTerm = '';
  let severityFilter = 'all';
  let statusFilter = 'all';

  onMount(async () => {
    console.log('Faults page loaded');
    await loadFaults();
  });

  async function loadFaults(): Promise<void> {
    isLoading = true;
    try {
      console.log('Loading faults from MongoDB...');
      
      // Use SvelteKit API route
      const response = await fetch('/api/faults', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = (await response.json()) as FaultApiResponse;
        if (data.success) {
          console.log(`Loaded ${data.faults.length} faults from MongoDB`);
          faults = data.faults.map((f) => {
            const generatedId =
              f._id ??
              f.id ??
              (typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `fault-${Math.random().toString(36).slice(2)}`);
            const timestampValue = typeof f.timestamp === 'string' ? f.timestamp : undefined;
            const parametersValue = ((): Record<string, unknown> | undefined => {
              if (typeof f.parameters === 'object' && f.parameters !== null) {
                return f.parameters as Record<string, unknown>;
              }
              return undefined;
            })();
            return {
              ...f,
              id: String(generatedId),
              deviceName: typeof f.deviceName === 'string' ? f.deviceName : 'Unknown Device',
              message: typeof f.message === 'string' ? f.message : '',
              severity: (f.severity ?? 'Info') as FaultSeverity,
              status: (f.status ?? 'Open') as FaultStatus,
              timestamp: timestampValue,
              parameters: parametersValue
            };
          });
        } else {
          console.warn('Failed to load faults:', data.error);
          faults = [];
        }
      } else {
        console.warn('Faults API returned error:', response.status);
        faults = [];
      }
      
    } catch (error) {
      console.error('Failed to load faults:', error);
      faults = [];
    }
    isLoading = false;
  }

  function viewFault(fault: Fault): void {
    selectedFault = fault;
    showFaultModal = true;
  }

  async function resolveFault(fault: Fault): Promise<void> {
    const resolution = prompt('Enter resolution notes (optional):') || 'Fault resolved manually';
    
    if (resolution !== null) {
      try {
        console.log(`Resolving fault ${fault.id}...`);
        
        // Use SvelteKit API route
        const response = await fetch('/api/faults', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: fault.id,
            resolution: resolution,
            resolvedBy: 'admin'
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log(`Successfully resolved fault ${fault.id}`);
            // Update local fault
            fault.status = 'Resolved';
            fault.resolvedBy = data.fault.resolvedBy;
            fault.resolvedAt = data.fault.resolvedAt;
            fault.resolution = data.fault.resolution;
            faults = [...faults];
          } else {
            alert('Failed to resolve fault: ' + (data.error || 'Unknown error'));
          }
        } else {
          alert('Failed to resolve fault: API returned ' + response.status);
        }
        
      } catch (error) {
        console.error('Failed to resolve fault:', error);
        alert('Failed to resolve fault. Check console for details.');
      }
    }
  }

  function getSeverityClass(severity: FaultSeverity): string {
    switch (severity) {
      case 'Critical': return 'severity-critical';
      case 'Warning': return 'severity-warning';
      case 'Info': return 'severity-info';
      default: return 'severity-unknown';
    }
  }

  function getStatusClass(status: FaultStatus): string {
    switch (status) {
      case 'Open': return 'status-open';
      case 'Resolved': return 'status-resolved';
      default: return 'status-unknown';
    }
  }

  function getFilteredFaults(): Fault[] {
    const normalizedSearch = searchTerm.toLowerCase();
    return faults.filter((fault) => {
      const matchesSearch =
        fault.id.toLowerCase().includes(normalizedSearch) ||
        fault.deviceName.toLowerCase().includes(normalizedSearch) ||
        fault.message.toLowerCase().includes(normalizedSearch);
      const matchesSeverity = severityFilter === 'all' || fault.severity === severityFilter;
      const matchesStatus = statusFilter === 'all' || fault.status === statusFilter;
      
      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }

  function refreshFaults(): Promise<void> {
    loadFaults();
    return Promise.resolve();
  }

  async function deleteFault(fault: Fault): Promise<void> {
    if (!confirm(`Delete fault ${fault.id}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      console.log(`Deleting fault ${fault.id}...`);
      
      // Use SvelteKit API route
      const response = await fetch('/api/faults', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: fault.id })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`Successfully deleted fault ${fault.id}`);
          // Remove from local array
          faults = faults.filter(f => f.id !== fault.id);
          return;
        }
      }
      
      console.log('API not available, removing locally');
      // Fallback to local delete
      faults = faults.filter(f => f.id !== fault.id);
      
    } catch (error) {
      console.error('Failed to delete fault:', error);
      // Still remove locally
      faults = faults.filter(f => f.id !== fault.id);
    }
  }

  function getFaultStats(): { total: number; open: number; resolved: number; critical: number } {
    const total = faults.length;
    const open = faults.filter(f => f.status === 'Open').length;
    const resolved = faults.filter(f => f.status === 'Resolved').length;
    const critical = faults.filter(f => f.severity === 'Critical').length;
    
    return { total, open, resolved, critical };
  }

</script>

<svelte:head>
  <title>Faults - ACS CPE Management</title>
  <meta name="description" content="Device faults and error management" />
</svelte:head>

<div class="faults-page">
  <!-- Main Navigation -->
  <MainMenu />
  
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-content">
      <div class="header-top">
        <a href="/dashboard" class="back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          ← Back to Dashboard
        </a>
      </div>
      <h1 class="page-title">
        <span class="page-icon">⚠️</span>
        Device Faults
      </h1>
      <p class="page-description">
        Monitor and manage device faults and errors
      </p>
    </div>
    <div class="header-actions">
      <a href="/modules/acs-cpe-management/admin/database" class="btn btn-secondary">
        <span class="btn-icon">🗂️</span>
        Initialize Faults in Database
      </a>
      <button class="btn btn-primary" on:click={refreshFaults}>
        <span class="btn-icon">🔄</span>
        Refresh
      </button>
    </div>
  </div>

  <!-- Fault Statistics -->
  <div class="stats-section">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-number">{getFaultStats().total}</div>
          <div class="stat-label">Total Faults</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">🔴</div>
        <div class="stat-content">
          <div class="stat-number">{getFaultStats().open}</div>
          <div class="stat-label">Open</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">🟢</div>
        <div class="stat-content">
          <div class="stat-number">{getFaultStats().resolved}</div>
          <div class="stat-label">Resolved</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">🚨</div>
        <div class="stat-content">
          <div class="stat-number">{getFaultStats().critical}</div>
          <div class="stat-label">Critical</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="filters-section">
    <div class="filter-group">
      <input 
        type="text" 
        placeholder="Search faults..." 
        bind:value={searchTerm}
        class="search-input"
      />
    </div>
    <div class="filter-group">
      <select bind:value={severityFilter} class="filter-select">
        <option value="all">All Severities</option>
        <option value="Critical">Critical</option>
        <option value="Warning">Warning</option>
        <option value="Info">Info</option>
      </select>
    </div>
    <div class="filter-group">
      <select bind:value={statusFilter} class="filter-select">
        <option value="all">All Status</option>
        <option value="Open">Open</option>
        <option value="Resolved">Resolved</option>
      </select>
    </div>
  </div>

  <!-- Faults List -->
  <div class="faults-container">
    {#if isLoading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading faults...</p>
      </div>
    {:else}
      <div class="faults-list">
        {#each getFilteredFaults() as fault}
          <div class="fault-card">
            <div class="fault-header">
              <div class="fault-info">
                <h3 class="fault-id">{fault.id}</h3>
                <p class="fault-device">{fault.deviceName}</p>
              </div>
              <div class="fault-badges">
                <span class="severity-badge" class:severity-critical={fault.severity === 'Critical'} class:severity-warning={fault.severity === 'Warning'} class:severity-info={fault.severity === 'Info'}>
                  {fault.severity}
                </span>
                <span class="status-badge" class:status-open={fault.status === 'Open'} class:status-resolved={fault.status === 'Resolved'}>
                  {fault.status}
                </span>
              </div>
            </div>
            
            <div class="fault-content">
              <div class="fault-message">
                <strong>Error {fault.code}:</strong> {fault.message}
              </div>
              <div class="fault-description">
                {fault.description}
              </div>
              <div class="fault-meta">
                <span class="meta-item">
                  <strong>Timestamp:</strong> {fault.timestamp ? new Date(fault.timestamp).toLocaleString() : 'N/A'}
                </span>
                {#if fault.resolvedAt}
                  <span class="meta-item">
                    <strong>Resolved:</strong> {new Date(fault.resolvedAt).toLocaleString()}
                  </span>
                  <span class="meta-item">
                    <strong>By:</strong> {fault.resolvedBy}
                  </span>
                {/if}
              </div>
            </div>
            
            <div class="fault-actions">
              <button class="btn btn-sm btn-primary" on:click={() => viewFault(fault)}>
                View Details
              </button>
              {#if fault.status === 'Open'}
                <button class="btn btn-sm btn-success" on:click={() => resolveFault(fault)}>
                  ✅ Mark Resolved
                </button>
              {/if}
              <button class="btn btn-sm btn-danger" on:click={() => deleteFault(fault)}>
                🗑️ Delete
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Fault Details Modal -->
{#if showFaultModal && selectedFault}
  <div class="modal-overlay" on:click={() => showFaultModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Fault Details - {selectedFault.id}</h2>
        <button class="modal-close" on:click={() => showFaultModal = false}>×</button>
      </div>
      <div class="modal-body">
        <div class="fault-details-grid">
          <div class="detail-section">
            <h3>Fault Information</h3>
            <div class="detail-item">
              <span class="detail-label">Fault ID:</span>
              <span class="detail-value">{selectedFault.id}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Device:</span>
              <span class="detail-value">{selectedFault.deviceName}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Severity:</span>
              <span class="detail-value" class:severity-critical={selectedFault.severity === 'Critical'} class:severity-warning={selectedFault.severity === 'Warning'} class:severity-info={selectedFault.severity === 'Info'}>{selectedFault.severity}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Status:</span>
              <span class="detail-value" class:status-open={selectedFault.status === 'Open'} class:status-resolved={selectedFault.status === 'Resolved'}>{selectedFault.status}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Timestamp:</span>
              <span class="detail-value">{selectedFault.timestamp ? new Date(selectedFault.timestamp).toLocaleString() : 'N/A'}</span>
            </div>
          </div>
          
          <div class="detail-section">
            <h3>Error Details</h3>
            <div class="detail-item">
              <span class="detail-label">Error Code:</span>
              <span class="detail-value">{selectedFault.code}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Message:</span>
              <span class="detail-value">{selectedFault.message}</span>
            </div>
            <div class="detail-item full-width">
              <span class="detail-label">Description:</span>
              <div class="detail-description">{selectedFault.description}</div>
            </div>
          </div>
          
          <div class="detail-section">
            <h3>Resolution</h3>
            {#if selectedFault.resolvedAt}
              <div class="detail-item">
                <span class="detail-label">Resolved At:</span>
                <span class="detail-value">{new Date(selectedFault.resolvedAt).toLocaleString()}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Resolved By:</span>
                <span class="detail-value">{selectedFault.resolvedBy}</span>
              </div>
              <div class="detail-item full-width">
                <span class="detail-label">Resolution:</span>
                <div class="detail-description">{selectedFault.resolution}</div>
              </div>
            {:else}
              <div class="detail-item full-width">
                <span class="detail-label">Resolution:</span>
                <div class="detail-description">Not yet resolved</div>
              </div>
            {/if}
          </div>
          
          <div class="detail-section">
            <h3>Device Parameters</h3>
            <div class="parameters-list">
              {#each Object.entries(selectedFault.parameters ?? {}) as [path, value]} 
                <div class="parameter-item">
                  <span class="parameter-path">{path}</span>
                  <span class="parameter-value">{String(value)}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .faults-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
  }

  .back-button:hover {
    color: var(--accent-color);
    background: var(--bg-tertiary);
    border-color: var(--accent-color);
  }

  .back-button svg {
    flex-shrink: 0;
  }

  .header-top {
    margin-bottom: 1rem;
  }

  .page-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-content {
    flex: 1;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-icon {
    font-size: 1.25rem;
  }

  .page-description {
    color: var(--text-secondary);
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 1rem;
  }

  .stats-section {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .stat-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .stat-icon {
    font-size: 1.5rem;
  }

  .stat-number {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--accent-color);
  }

  .stat-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .filters-section {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1rem 2rem;
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .search-input,
  .filter-select {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .search-input {
    min-width: 200px;
  }

  .filter-select {
    min-width: 150px;
  }

  .faults-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    color: var(--text-secondary);
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid var(--border-color);
    border-top: 2px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .faults-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .fault-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    transition: all 0.2s ease;
  }

  .fault-card:hover {
    border-color: var(--accent-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .fault-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .fault-info {
    flex: 1;
  }

  .fault-id {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: var(--text-primary);
  }

  .fault-device {
    color: var(--text-secondary);
    margin: 0;
    font-size: 0.875rem;
  }

  .fault-badges {
    display: flex;
    gap: 0.5rem;
  }

  .severity-badge,
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .severity-critical {
    background: #fecaca;
    color: #991b1b;
  }

  .severity-warning {
    background: #fef3c7;
    color: #92400e;
  }

  .severity-info {
    background: #dbeafe;
    color: #1e40af;
  }

  .status-open {
    background: #fecaca;
    color: #991b1b;
  }

  .status-resolved {
    background: #d1fae5;
    color: #065f46;
  }

  .fault-content {
    margin-bottom: 1rem;
  }

  .fault-message {
    font-size: 1rem;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }

  .fault-description {
    color: var(--text-secondary);
    margin-bottom: 1rem;
    line-height: 1.4;
  }

  .fault-meta {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .fault-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover {
    background: var(--accent-color-hover);
  }

  .btn-success {
    background: #10b981;
    color: white;
  }

  .btn-success:hover {
    background: #059669;
  }

  .btn-sm {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
  }

  .btn-icon {
    font-size: 0.875rem;
  }

  /* Modal Styles */
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
    background: var(--bg-primary);
    border-radius: 0.5rem;
    max-width: 800px;
    max-height: 80vh;
    width: 90%;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close:hover {
    color: var(--text-primary);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    max-height: 60vh;
  }

  .fault-details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .detail-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .detail-item:last-child {
    border-bottom: none;
  }

  .detail-item.full-width {
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-label {
    font-weight: 500;
    color: var(--text-secondary);
    min-width: 120px;
  }

  .detail-value {
    color: var(--text-primary);
    font-family: monospace;
    font-size: 0.875rem;
    text-align: right;
    flex: 1;
  }

  .detail-description {
    color: var(--text-primary);
    line-height: 1.4;
    background: var(--bg-tertiary);
    padding: 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .parameters-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .parameter-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--border-color);
    font-size: 0.75rem;
  }

  .parameter-item:last-child {
    border-bottom: none;
  }

  .parameter-path {
    color: var(--text-secondary);
    font-family: monospace;
    flex: 1;
    margin-right: 1rem;
  }

  .parameter-value {
    color: var(--text-primary);
    font-family: monospace;
    background: var(--bg-tertiary);
    padding: 0.125rem 0.25rem;
    border-radius: 0.125rem;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .filters-section {
      flex-direction: column;
      gap: 0.5rem;
      align-items: stretch;
    }

    .faults-container {
      padding: 1rem;
    }

    .fault-header {
      flex-direction: column;
      gap: 0.5rem;
      align-items: stretch;
    }

    .fault-badges {
      justify-content: flex-start;
    }

    .fault-actions {
      justify-content: flex-start;
    }

    .fault-meta {
      flex-direction: column;
      gap: 0.5rem;
    }

    .modal-content {
      width: 95%;
      max-height: 90vh;
    }

    .fault-details-grid {
      grid-template-columns: 1fr;
    }

    .detail-item {
      flex-direction: column;
      gap: 0.25rem;
    }

    .detail-value {
      text-align: left;
    }
  }
</style>
