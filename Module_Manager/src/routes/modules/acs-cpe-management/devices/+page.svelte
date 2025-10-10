<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../components/MainMenu.svelte';
  
  // Sample devices data
  let devices = [
    {
      id: 'CPE-001',
      manufacturer: 'Nokia',
      model: 'FastMile 4G Gateway',
      serialNumber: 'NM123456789',
      status: 'Online',
      lastContact: '2025-01-05T10:30:00Z',
      ipAddress: '192.168.1.100',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        address: 'New York, NY'
      },
      parameters: {
        'InternetGatewayDevice.DeviceInfo.HardwareVersion': '1.0',
        'InternetGatewayDevice.DeviceInfo.SoftwareVersion': '2.1.3',
        'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Enable': true
      },
      tags: ['nokia', '4g', 'gateway'],
      firmware: '2.1.3',
      uptime: '15 days, 8 hours'
    },
    {
      id: 'CPE-002',
      manufacturer: 'Huawei',
      model: '5G CPE Pro 2',
      serialNumber: 'HW987654321',
      status: 'Online',
      lastContact: '2025-01-05T10:25:00Z',
      ipAddress: '192.168.1.101',
      location: {
        latitude: 40.7589,
        longitude: -73.9851,
        address: 'Times Square, NY'
      },
      parameters: {
        'InternetGatewayDevice.DeviceInfo.HardwareVersion': '2.0',
        'InternetGatewayDevice.DeviceInfo.SoftwareVersion': '3.0.1',
        'InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.DHCPEnabled': true
      },
      tags: ['huawei', '5g', 'pro'],
      firmware: '3.0.1',
      uptime: '22 days, 12 hours'
    },
    {
      id: 'CPE-003',
      manufacturer: 'ZTE',
      model: 'MF920U 4G LTE',
      serialNumber: 'ZT555666777',
      status: 'Offline',
      lastContact: '2025-01-04T14:20:00Z',
      ipAddress: '192.168.1.102',
      location: {
        latitude: 40.6892,
        longitude: -74.0445,
        address: 'Brooklyn, NY'
      },
      parameters: {
        'InternetGatewayDevice.DeviceInfo.HardwareVersion': '1.5',
        'InternetGatewayDevice.DeviceInfo.SoftwareVersion': '1.8.2'
      },
      tags: ['zte', '4g', 'lte'],
      firmware: '1.8.2',
      uptime: 'Unknown'
    }
  ];

  let isLoading = false;
  let selectedDevice = null;
  let showDeviceModal = false;
  let searchTerm = '';
  let statusFilter = 'all';
  let manufacturerFilter = 'all';

  onMount(async () => {
    console.log('Devices page loaded');
    await loadDevices();
  });

  async function loadDevices() {
    isLoading = true;
    try {
      console.log('Loading devices from Firebase Functions...');
      
      // Use SvelteKit API route (no Firebase Functions needed!)
      const response = await fetch('/api/cpe/devices', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.devices.length > 0) {
          console.log(`Loaded ${data.devices.length} devices from Firebase Functions`);
          devices = data.devices;
          isLoading = false;
          return;
        }
      }
      
      console.log('Firebase Functions not available, using sample data');
      // Fallback to sample data
      loadSampleDevices();
      
    } catch (err) {
      console.error('Failed to load devices from Firebase Functions:', err);
      console.log('Using sample data as fallback');
      loadSampleDevices();
    }
    isLoading = false;
  }

  function loadSampleDevices() {
    // Load sample devices (fallback)
    devices = [
      {
        id: 'CPE-001',
        manufacturer: 'Nokia',
        model: 'FastMile 4G Gateway',
        status: 'Online',
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          address: 'New York, NY'
        },
        lastContact: new Date(),
        parameters: {
          SoftwareVersion: '1.2.3',
          HardwareVersion: 'HW-2.1'
        },
        tags: ['nokia', '4g', 'gateway']
      }
    ];
    console.log(`Loaded ${devices.length} sample devices (fallback)`);
  }

  function viewDevice(device) {
    selectedDevice = device;
    showDeviceModal = true;
  }

  function getStatusClass(status) {
    switch (status) {
      case 'Online': return 'status-online';
      case 'Offline': return 'status-offline';
      case 'Connecting': return 'status-connecting';
      default: return 'status-unknown';
    }
  }

  function getFilteredDevices() {
    return devices.filter(device => {
      const matchesSearch = device.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           device.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           device.model.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
      const matchesManufacturer = manufacturerFilter === 'all' || device.manufacturer === manufacturerFilter;
      
      return matchesSearch && matchesStatus && matchesManufacturer;
    });
  }

  function refreshDevices() {
    loadDevices();
  }
</script>

<svelte:head>
  <title>Devices - ACS CPE Management</title>
  <meta name="description" content="CPE device management and monitoring" />
</svelte:head>

<div class="devices-page">
  <!-- Exit Button -->
  <a href="/modules/acs-cpe-management" class="exit-button" aria-label="Exit to ACS CPE Management">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </a>

  <!-- Main Navigation -->
  <MainMenu />
  
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-content">
      <h1 class="page-title">
        <span class="page-icon">📱</span>
        CPE Devices
      </h1>
      <p class="page-description">
        Manage and monitor TR-069 enabled CPE devices
      </p>
    </div>
    <div class="header-actions">
      <button class="btn btn-primary" on:click={refreshDevices}>
        <span class="btn-icon">🔄</span>
        Refresh
      </button>
    </div>
  </div>

  <!-- Filters -->
  <div class="filters-section">
    <div class="filter-group">
      <input 
        type="text" 
        placeholder="Search devices..." 
        bind:value={searchTerm}
        class="search-input"
      />
    </div>
    <div class="filter-group">
      <select bind:value={statusFilter} class="filter-select">
        <option value="all">All Status</option>
        <option value="Online">Online</option>
        <option value="Offline">Offline</option>
        <option value="Connecting">Connecting</option>
      </select>
    </div>
    <div class="filter-group">
      <select bind:value={manufacturerFilter} class="filter-select">
        <option value="all">All Manufacturers</option>
        <option value="Nokia">Nokia</option>
        <option value="Huawei">Huawei</option>
        <option value="ZTE">ZTE</option>
      </select>
    </div>
  </div>

  <!-- Devices List -->
  <div class="devices-container">
    {#if isLoading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading devices...</p>
      </div>
    {:else}
      <div class="devices-grid">
        {#each getFilteredDevices() as device}
          <div class="device-card">
            <div class="device-header">
              <div class="device-info">
                <h3 class="device-name">{device.id}</h3>
                <p class="device-model">{device.manufacturer} {device.model}</p>
              </div>
              <div class="device-status">
                <span class="status-indicator" class:status-online={device.status === 'Online'} class:status-offline={device.status === 'Offline'}></span>
                <span class="status-text">{device.status}</span>
              </div>
            </div>
            
            <div class="device-details">
              <div class="detail-row">
                <span class="detail-label">Serial:</span>
                <span class="detail-value">{device.serialNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">IP Address:</span>
                <span class="detail-value">{device.ipAddress}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Firmware:</span>
                <span class="detail-value">{device.firmware}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Uptime:</span>
                <span class="detail-value">{device.uptime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Last Contact:</span>
                <span class="detail-value">{new Date(device.lastContact).toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Location:</span>
                <span class="detail-value">{device.location.address}</span>
              </div>
            </div>
            
            <div class="device-footer">
              <div class="device-tags">
                {#each device.tags as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
              <div class="device-actions">
                <button class="btn btn-sm btn-primary" on:click={() => viewDevice(device)}>
                  View Details
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Device Details Modal -->
{#if showDeviceModal && selectedDevice}
  <div class="modal-overlay" on:click={() => showDeviceModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Device Details - {selectedDevice.id}</h2>
        <button class="modal-close" on:click={() => showDeviceModal = false}>×</button>
      </div>
      <div class="modal-body">
        <div class="device-info-grid">
          <div class="info-section">
            <h3>Basic Information</h3>
            <div class="info-item">
              <span class="info-label">Manufacturer:</span>
              <span class="info-value">{selectedDevice.manufacturer}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Model:</span>
              <span class="info-value">{selectedDevice.model}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Serial Number:</span>
              <span class="info-value">{selectedDevice.serialNumber}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Status:</span>
              <span class="info-value" class:status-online={selectedDevice.status === 'Online'} class:status-offline={selectedDevice.status === 'Offline'}>{selectedDevice.status}</span>
            </div>
          </div>
          
          <div class="info-section">
            <h3>Network Information</h3>
            <div class="info-item">
              <span class="info-label">IP Address:</span>
              <span class="info-value">{selectedDevice.ipAddress}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Last Contact:</span>
              <span class="info-value">{new Date(selectedDevice.lastContact).toLocaleString()}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Uptime:</span>
              <span class="info-value">{selectedDevice.uptime}</span>
            </div>
          </div>
          
          <div class="info-section">
            <h3>Location</h3>
            <div class="info-item">
              <span class="info-label">Address:</span>
              <span class="info-value">{selectedDevice.location.address}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Coordinates:</span>
              <span class="info-value">{selectedDevice.location.latitude}, {selectedDevice.location.longitude}</span>
            </div>
          </div>
          
          <div class="info-section">
            <h3>TR-069 Parameters</h3>
            <div class="parameters-list">
              {#each Object.entries(selectedDevice.parameters) as [path, value]}
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
  .devices-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .exit-button {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 1000;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    border: 2px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
  }

  .exit-button:hover {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
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

  .devices-container {
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

  .devices-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .device-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    transition: all 0.2s ease;
  }

  .device-card:hover {
    border-color: var(--accent-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .device-info {
    flex: 1;
  }

  .device-name {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: var(--text-primary);
  }

  .device-model {
    color: var(--text-secondary);
    margin: 0;
    font-size: 0.875rem;
  }

  .device-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-indicator {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: #ef4444;
  }

  .status-indicator.status-online {
    background: #10b981;
  }

  .status-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .device-details {
    margin-bottom: 1rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
    font-size: 0.875rem;
  }

  .detail-label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .detail-value {
    color: var(--text-primary);
    font-family: monospace;
  }

  .device-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .device-tags {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .tag {
    background: var(--accent-color);
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .device-actions {
    display: flex;
    gap: 0.5rem;
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

  .device-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .info-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .info-label {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .info-value {
    color: var(--text-primary);
    font-family: monospace;
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

    .filters-section {
      flex-direction: column;
      gap: 0.5rem;
      align-items: stretch;
    }

    .devices-container {
      padding: 1rem;
    }

    .devices-grid {
      grid-template-columns: 1fr;
    }

    .device-header {
      flex-direction: column;
      gap: 0.5rem;
      align-items: stretch;
    }

    .device-footer {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .device-actions {
      justify-content: flex-end;
    }

    .modal-content {
      width: 95%;
      max-height: 90vh;
    }

    .device-info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
