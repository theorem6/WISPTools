<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/firebase';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import MonitoringMap from './components/MonitoringMap.svelte';
  import SNMPConfigurationPanel from './components/SNMPConfigurationPanel.svelte';
  import NetworkTopologyMap from './components/NetworkTopologyMap.svelte';
  import MikrotikCredentialsModal from './components/MikrotikCredentialsModal.svelte';
  import EPCMonitoringPanel from '$lib/components/EPCMonitoringPanel.svelte';
  import SNMPGraphsPanel from '$lib/components/SNMPGraphsPanel.svelte';
  
  import { API_CONFIG } from '$lib/config/api';
  import { monitoringService } from '$lib/services/monitoringService';
  import { formatInTenantTimezone } from '$lib/utils/timezone';
  import '$lib/styles/moduleHeaderMenu.css';
  
  // Use real backend data now that devices are created
  // Temporarily enable mock data to ensure devices show while debugging backend
  const USE_MOCK_DATA = false; // Use standard API service now
  
  let showSNMPConfig = false;
  let networkDevices = [];
  let snmpData = [];
  let selectedDevice = null;
  let mapView = 'geographic'; // 'geographic', 'topology', or 'epc'
  let loading = true;
  let showMikrotikCredentialsModal = false;
  let selectedMikrotikDevice: any = null;
  
  // EPC Monitoring
  let epcDevices: any[] = [];
  let selectedEpcDevice: any = null;
  let showEpcPanel = false;
  
  // Tenant info - use currentTenant store
  $: tenantId = $currentTenant?.id || '';
  $: tenantName = $currentTenant?.displayName || 'No Tenant Selected';
  
  // Dashboard data
  let dashboardData: any = null;
  let metrics: any = {};
  let serviceHealth: any[] = [];
  let activeAlerts: any[] = [];
  let alertRules: any[] = [];
  
  // Auto-refresh
  let refreshInterval: any = null;
  
  // Watch for tenant changes and reload data
  $: if (browser && tenantId) {
    console.log('[Network Monitoring] Tenant loaded:', tenantId);
    loadDashboard();
  }
  
  onMount(async () => {
    if (tenantId) {
      await loadDashboard();
      await loadNetworkDevices();
      await loadSNMPData();
      await loadEPCDevices();
    }
    
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(() => {
      if (tenantId) {
        loadDashboard();
        loadNetworkDevices();
        loadSNMPData();
        loadEPCDevices();
      }
    }, 30000);
  });
  
  async function loadEPCDevices() {
    if (!tenantId) return;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch(`${API_CONFIG.PATHS.HSS}/epc/remote/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        epcDevices = data.epcs || [];
        console.log('[Monitoring] Loaded', epcDevices.length, 'EPC devices');
      }
    } catch (err) {
      console.error('[Monitoring] Failed to load EPC devices:', err);
    }
  }
  
  function openEpcMonitoring(device: any) {
    selectedEpcDevice = device;
    showEpcPanel = true;
  }
  
  function closeEpcPanel() {
    showEpcPanel = false;
    selectedEpcDevice = null;
  }
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
  
  async function loadDashboard() {
    if (!tenantId) return;
    
    loading = true;
    try {
      if (USE_MOCK_DATA) {
        // Use mock data for now
        dashboardData = {
          summary: {
            critical_alerts: 1,
            total_alerts: 3,
            services_down: 0
          },
          metrics: {
            uptime: 99.8,
            latency: 45,
            throughput: 1250
          },
          service_health: [
            { name: 'SNMP Collector', status: 'healthy' },
            { name: 'Mikrotik Integration', status: 'healthy' },
            { name: 'EPC Management', status: 'healthy' },
            { name: 'APT Repository', status: 'healthy' }
          ],
          active_alerts: [
            {
              id: 'alert-1',
              severity: 'warning',
              message: 'High CPU usage on Router MT-001',
              timestamp: new Date(Date.now() - 300000).toISOString()
            },
            {
              id: 'alert-2', 
              severity: 'info',
              message: 'New device discovered: AP-045',
              timestamp: new Date(Date.now() - 600000).toISOString()
            },
            {
              id: 'alert-3',
              severity: 'critical',
              message: 'EPC connectivity lost: EPC-Core-01',
              timestamp: new Date(Date.now() - 900000).toISOString()
            }
          ]
        };
        metrics = dashboardData.metrics;
        serviceHealth = dashboardData.service_health;
        activeAlerts = dashboardData.active_alerts;
      } else {
        const result = await monitoringService.getHealth();
        if (result.success && result.data) {
          const healthData = result.data;
          // Create dashboard data from health response
          dashboardData = {
            summary: {
              critical_alerts: 0,
              total_alerts: 0,
              services_down: 0
            },
            metrics: {},
            service_health: Object.keys(healthData.services || {}).map(service => ({
              name: service,
              status: healthData.services[service] === 'ready' ? 'healthy' : 'unhealthy'
            })),
            active_alerts: []
          };
          metrics = dashboardData.metrics;
          serviceHealth = dashboardData.service_health;
          activeAlerts = dashboardData.active_alerts;
        }
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      // Set default values for offline mode
      dashboardData = {
        summary: {
          critical_alerts: 0,
          total_alerts: 0,
          services_down: 0
        }
      };
      activeAlerts = [];
    } finally {
      loading = false;
    }
  }

  async function loadNetworkDevices() {
    try {
      if (USE_MOCK_DATA) {
        // Use comprehensive mock data for demonstration
        networkDevices = [
          {
            id: 'epc-core-01',
            name: 'EPC Core 01',
            type: 'epc',
            status: 'online',
            ipAddress: '10.0.1.10',
            location: {
              coordinates: { latitude: 40.7128, longitude: -74.0060 },
              address: 'New York Data Center'
            },
            metrics: { cpuUsage: 45, memoryUsage: 60, activeUsers: 150, uptime: 99.9 }
          },
          {
            id: 'epc-core-02',
            name: 'EPC Core 02',
            type: 'epc',
            status: 'offline',
            ipAddress: '10.0.1.11',
            location: {
              coordinates: { latitude: 40.7589, longitude: -73.9851 },
              address: 'Manhattan Backup Site'
            },
            metrics: { cpuUsage: 0, memoryUsage: 0, activeUsers: 0, uptime: 0 }
          },
          {
            id: 'mt-router-01',
            name: 'Main Router MT-001',
            type: 'mikrotik',
            deviceType: 'router',
            status: 'online',
            ipAddress: '10.0.2.1',
            location: {
              coordinates: { latitude: 40.7505, longitude: -73.9934 },
              address: 'Times Square Hub'
            },
            metrics: { cpuUsage: 85, memoryUsage: 40, throughput: 850 }
          },
          {
            id: 'mt-ap-01',
            name: 'Access Point AP-045',
            type: 'mikrotik',
            deviceType: 'ap',
            status: 'online',
            ipAddress: '10.0.3.45',
            location: {
              coordinates: { latitude: 40.7614, longitude: -73.9776 },
              address: 'Central Park South'
            },
            metrics: { cpuUsage: 25, memoryUsage: 30, connectedClients: 12 }
          },
          {
            id: 'mt-cpe-01',
            name: 'Customer CPE CPE-123',
            type: 'mikrotik',
            deviceType: 'cpe',
            status: 'online',
            ipAddress: '10.0.4.123',
            location: {
              coordinates: { latitude: 40.7282, longitude: -73.9942 },
              address: 'Customer Site A'
            },
            metrics: { signalStrength: -65, throughput: 45 }
          },
          {
            id: 'snmp-switch-01',
            name: 'Core Switch SW-001',
            type: 'snmp',
            deviceType: 'switch',
            status: 'online',
            ipAddress: '10.0.5.1',
            location: {
              coordinates: { latitude: 40.7411, longitude: -74.0018 },
              address: 'Network Operations Center'
            },
            metrics: { portUtilization: 65, temperature: 42 }
          }
        ];
        console.log('[Network Monitoring] Loaded mock network devices:', networkDevices.length);
        return;
      }
      
      // Use standard monitoring service API calls
      const devices: any[] = [];
      const seenIds = new Set<string>();
      
      // Helper to add device with deduplication
      const addDevice = (device: any, type: string) => {
        const deviceId = device.epcId || device.id || device._id;
        if (deviceId && !seenIds.has(deviceId)) {
          seenIds.add(deviceId);
          devices.push({
            ...device,
            type,
            id: deviceId,
            status: device.status || 'unknown'
          });
        }
      };
      
      try {
        const epcResult = await monitoringService.getEPCDevices();
        if (epcResult.success && epcResult.data?.epcs) {
          epcResult.data.epcs.forEach((epc: any) => addDevice(epc, 'epc'));
        }
      } catch (e) { console.log('EPC API not available:', e); }
      
      try {
        const mikrotikResult = await monitoringService.getMikrotikDevices();
        if (mikrotikResult.success && mikrotikResult.data?.devices) {
          mikrotikResult.data.devices.forEach((device: any) => addDevice(device, 'mikrotik'));
        }
      } catch (e) { console.log('Mikrotik API not available:', e); }
      
      try {
        const snmpResult = await monitoringService.getSNMPDevices();
        if (snmpResult.success && snmpResult.data?.devices) {
          snmpResult.data.devices.forEach((device: any) => addDevice(device, 'snmp'));
        }
      } catch (e) { console.log('SNMP API not available:', e); }
      
      networkDevices = devices;
      console.log('[Network Monitoring] Loaded network devices:', devices.length, '(deduped)');
    } catch (error) {
      console.error('[Network Monitoring] Failed to load network devices:', error);
      networkDevices = [];
    }
  }

  async function loadSNMPData() {
    try {
      if (USE_MOCK_DATA) {
        // Mock SNMP data for demonstration
        snmpData = [
          {
            deviceId: 'mt-router-01',
            timestamp: new Date().toISOString(),
            metrics: {
              'cpu-usage': 85,
              'memory-usage': 40,
              'interface-1-in-octets': 1250000,
              'interface-1-out-octets': 980000,
              'uptime': 2592000
            }
          },
          {
            deviceId: 'snmp-switch-01',
            timestamp: new Date().toISOString(),
            metrics: {
              'cpu-usage': 25,
              'memory-usage': 35,
              'port-utilization': 65,
              'temperature': 42
            }
          }
        ];
        console.log('[Network Monitoring] Loaded mock SNMP data:', snmpData.length);
        return;
      }
      
      const result = await monitoringService.getSNMPMetrics();
      
      if (result.success && result.data) {
        snmpData = Array.isArray(result.data) ? result.data : [result.data];
        console.log('[Network Monitoring] Loaded SNMP data:', snmpData.length);
      }
    } catch (error) {
      console.error('[Network Monitoring] Failed to load SNMP data:', error);
      snmpData = [];
    }
  }

  function handleDeviceSelected(event) {
    selectedDevice = event.detail;
    console.log('[Network Monitoring] Device selected:', selectedDevice);
  }

  function handleViewDeviceDetails(event) {
    const device = event.detail;
    // Navigate to device details page or open modal
    console.log('[Network Monitoring] View device details:', device);
  }

  function handleConfigureDevice(event) {
    const device = event.detail;
    // Open device configuration modal
    console.log('[Network Monitoring] Configure device:', device);
  }

  function handleRefreshData() {
    loadNetworkDevices();
    loadSNMPData();
  }

  function calculateUptime() {
    if (networkDevices.length === 0) return 100;
    const onlineDevices = networkDevices.filter(d => d.status === 'online').length;
    return Math.round((onlineDevices / networkDevices.length) * 100);
  }

  function getAlertSeverityColor(severity: string) {
    switch (severity?.toLowerCase()) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  }

  // Alert interaction functions
  let showAlertDetailsModal = false;
  let showCreateTicketModal = false;
  let selectedAlert = null;

  function handleAlertClick(alert) {
    console.log('[Monitoring] Alert clicked:', alert);
    showAlertDetails(alert);
  }

  function showAlertDetails(alert) {
    selectedAlert = alert;
    showAlertDetailsModal = true;
    console.log('[Monitoring] Showing alert details for:', alert.id);
  }

  function createTicketFromAlert(alert) {
    selectedAlert = alert;
    showCreateTicketModal = true;
    console.log('[Monitoring] Creating ticket from alert:', alert.id);
  }

  function closeAlertDetailsModal() {
    showAlertDetailsModal = false;
    selectedAlert = null;
  }

  function closeCreateTicketModal() {
    showCreateTicketModal = false;
    selectedAlert = null;
  }

  function handleTicketCreated(event) {
    console.log('[Monitoring] Ticket created:', event.detail);
    closeCreateTicketModal();
    // Optionally update the alert status or show success message
  }
</script>

<TenantGuard>
  <div class="app">
    <!-- Full Screen Map -->
    <div class="map-fullscreen">
      {#if loading}
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Loading network monitoring data...</p>
        </div>
      {:else}
        {#if mapView === 'geographic'}
          <MonitoringMap 
            devices={networkDevices}
            alerts={activeAlerts}
            {dashboardData}
            {networkDevices}
            height="100vh"
            on:deviceSelected={handleDeviceSelected}
            on:viewDeviceDetails={handleViewDeviceDetails}
            on:configureDevice={handleConfigureDevice}
            on:alertClick={handleAlertClick}
            on:showAlertDetails={showAlertDetails}
            on:createTicketFromAlert={createTicketFromAlert}
            on:refreshData={loadDashboard}
          />
        {:else if mapView === 'topology'}
          <NetworkTopologyMap 
            devices={networkDevices}
            {snmpData}
            height="100vh"
            on:nodeSelected={handleDeviceSelected}
            on:viewDeviceDetails={handleViewDeviceDetails}
            on:configureDevice={handleConfigureDevice}
            on:refreshData={handleRefreshData}
          />
        {/if}
      {/if}
    </div>

    <!-- Floating Header Overlay -->
    <div class="module-header-overlay" style="background: var(--gradient-success);">
      <div class="module-header-left">
        <button class="module-back-btn" on:click={() => goto('/modules')} title="Back to Modules">
          ←
        </button>
        <h1>🗺️ Monitor</h1>
      </div>
      <div class="module-header-controls">
        <button class="module-control-btn" on:click={() => showSNMPConfig = true} title="Configuration">
          <span class="control-icon">🔧</span>
          <span class="control-label">Config</span>
        </button>
        <button 
          class="module-control-btn {mapView === 'geographic' ? 'active' : ''}"
          on:click={() => mapView = 'geographic'}
          title="Geographic View"
        >
          <span class="control-icon">🗺️</span>
          <span class="control-label">Geographic</span>
        </button>
        <button 
          class="module-control-btn {mapView === 'topology' ? 'active' : ''}"
          on:click={() => mapView = 'topology'}
          title="Topology View"
        >
          <span class="control-icon">🕸️</span>
          <span class="control-label">Topology</span>
        </button>
        <button 
          class="module-control-btn {mapView === 'epc' ? 'active' : ''}"
          on:click={() => mapView = 'epc'}
          title="EPC Devices"
        >
          <span class="control-icon">📡</span>
          <span class="control-label">EPC ({epcDevices.length})</span>
        </button>
        <button 
          class="module-control-btn {mapView === 'graphs' ? 'active' : ''}"
          on:click={() => mapView = 'graphs'}
          title="SNMP Graphs"
        >
          <span class="control-icon">📈</span>
          <span class="control-label">Graphs</span>
        </button>
      </div>
    </div>
  </div>
  
  <!-- SNMP Graphs View -->
  {#if mapView === 'graphs'}
    <div class="graphs-overlay">
      <SNMPGraphsPanel />
    </div>
  {/if}
  
  <!-- EPC Devices View -->
  {#if mapView === 'epc'}
    <div class="epc-devices-overlay">
      <div class="epc-devices-grid">
        {#if epcDevices.length === 0}
          <div class="no-devices">
            <p>📡 No EPC devices found</p>
            <p class="hint">Link EPC devices via the Deploy module</p>
          </div>
        {:else}
          {#each epcDevices as device}
            <div class="epc-device-card" on:click={() => openEpcMonitoring(device)}>
              <div class="device-header">
                <span class="device-status status-{device.status}">
                  {device.status === 'online' ? '🟢' : '🔴'}
                </span>
                <h3>{device.site_name || device.name || 'EPC Device'}</h3>
              </div>
              <div class="device-info">
                <div class="info-row">
                  <span class="label">Device Code:</span>
                  <code>{device.device_code || 'N/A'}</code>
                </div>
                <div class="info-row">
                  <span class="label">IP Address:</span>
                  <span>{device.ip_address || device.ipAddress || 'Unknown'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Last Seen:</span>
                  <span>
                    {#if device.last_seen}
                      {formatInTenantTimezone(device.last_seen)}
                    {:else}
                      Never
                    {/if}
                  </span>
                </div>
              </div>
              <div class="device-metrics">
                <div class="metric">
                  <span class="metric-label">CPU</span>
                  <span class="metric-value">{device.metrics?.cpuUsage ?? 'N/A'}%</span>
                </div>
                <div class="metric">
                  <span class="metric-label">MEM</span>
                  <span class="metric-value">{device.metrics?.memoryUsage ?? 'N/A'}%</span>
                </div>
                <div class="metric">
                  <span class="metric-label">Uptime</span>
                  <span class="metric-value">{device.metrics?.uptime || 'N/A'}</span>
                </div>
              </div>
              <button class="view-details-btn">View Details →</button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}

<!-- Mikrotik Credentials Modal -->
<MikrotikCredentialsModal
  device={selectedMikrotikDevice}
  open={showMikrotikCredentialsModal}
  on:close={() => {
    showMikrotikCredentialsModal = false;
    selectedMikrotikDevice = null;
  }}
  on:saved={async () => {
    // Reload devices after credentials are saved
    await loadNetworkDevices();
  }}
/>
</TenantGuard>

<!-- SNMP Configuration Modal -->
<SNMPConfigurationPanel 
  bind:show={showSNMPConfig}
  on:configurationSaved={() => {
    showSNMPConfig = false;
    loadNetworkDevices();
    loadSNMPData();
  }}
  on:close={() => showSNMPConfig = false}
/>

<!-- Alert Details Modal -->
{#if showAlertDetailsModal && selectedAlert}
  <div class="modal-overlay" on:click={closeAlertDetailsModal}>
    <div class="modal-content alert-details-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>🚨 Alert Details</h3>
        <button class="modal-close" on:click={closeAlertDetailsModal}>×</button>
      </div>
      
      <div class="modal-body">
        <div class="alert-detail-section">
          <h4>Alert Information</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>Severity:</label>
              <span class="alert-severity {selectedAlert.severity?.toLowerCase()}">{selectedAlert.severity}</span>
            </div>
            <div class="detail-item">
              <label>Timestamp:</label>
              <span>{formatInTenantTimezone(selectedAlert.timestamp)}</span>
            </div>
            <div class="detail-item">
              <label>Message:</label>
              <span>{selectedAlert.message}</span>
            </div>
            <div class="detail-item">
              <label>Alert ID:</label>
              <span>{selectedAlert.id}</span>
            </div>
          </div>
        </div>

        {#if selectedAlert.deviceId}
          <div class="alert-detail-section">
            <h4>Affected Device</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <label>Device ID:</label>
                <span>{selectedAlert.deviceId}</span>
              </div>
              <div class="detail-item">
                <label>Device Type:</label>
                <span>{selectedAlert.deviceType || 'Unknown'}</span>
              </div>
            </div>
          </div>
        {/if}

        <div class="alert-detail-section">
          <h4>Actions</h4>
          <div class="alert-actions-grid">
            <button class="btn btn-primary" on:click={() => createTicketFromAlert(selectedAlert)}>
              🎫 Create Ticket
            </button>
            <button class="btn btn-secondary" on:click={closeAlertDetailsModal}>
              ✓ Acknowledge
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Create Ticket from Alert Modal -->
{#if showCreateTicketModal && selectedAlert}
  <div class="modal-overlay" on:click={closeCreateTicketModal}>
    <div class="modal-content create-ticket-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>🎫 Create Ticket from Alert</h3>
        <button class="modal-close" on:click={closeCreateTicketModal}>×</button>
      </div>
      
      <div class="modal-body">
        <form on:submit|preventDefault={handleTicketCreated}>
          <div class="form-group">
            <label>Ticket Title:</label>
            <input 
              type="text" 
              value="Alert: {selectedAlert.message}"
              class="form-input"
              required
            />
          </div>
          
          <div class="form-group">
            <label>Priority:</label>
            <select class="form-select" required>
              <option value="critical" selected={selectedAlert.severity === 'critical'}>Critical</option>
              <option value="high" selected={selectedAlert.severity === 'warning'}>High</option>
              <option value="medium" selected={selectedAlert.severity === 'info'}>Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Category:</label>
            <select class="form-select" required>
              <option value="infrastructure">Infrastructure</option>
              <option value="network">Network</option>
              <option value="monitoring">Monitoring</option>
              <option value="hardware">Hardware</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Description:</label>
            <textarea 
              class="form-textarea"
              rows="4"
              placeholder="Alert Details:&#10;Severity: {selectedAlert.severity}&#10;Time: {formatInTenantTimezone(selectedAlert.timestamp)}&#10;Message: {selectedAlert.message}"
              required
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Create Ticket</button>
            <button type="button" class="btn btn-secondary" on:click={closeCreateTicketModal}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- EPC Monitoring Panel Modal -->
{#if showEpcPanel && selectedEpcDevice}
  <div class="modal-overlay" on:click={closeEpcPanel}>
    <div class="epc-modal-content" on:click|stopPropagation>
      <EPCMonitoringPanel 
        epc={selectedEpcDevice}
        onClose={closeEpcPanel}
      />
    </div>
  </div>
{/if}

<style>
  /* App Container - Full Screen */
  .app {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-primary);
  }

  /* Full Screen Map */
  .map-fullscreen {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  
  /* SNMP Graphs View */
  .graphs-overlay {
    position: absolute;
    top: 80px;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
  }
  
  /* EPC Devices View */
  .epc-devices-overlay {
    position: absolute;
    top: 80px;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    overflow-y: auto;
    padding: 2rem;
    z-index: 5;
  }
  
  .epc-devices-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
    max-width: 1600px;
    margin: 0 auto;
  }
  
  .epc-device-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .epc-device-card:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(59, 130, 246, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }
  
  .epc-device-card .device-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .epc-device-card .device-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #f1f5f9;
    flex: 1;
  }
  
  .epc-device-card .device-status {
    font-size: 1rem;
  }
  
  .epc-device-card .device-info {
    margin-bottom: 1rem;
  }
  
  .epc-device-card .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.35rem 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 0.875rem;
  }
  
  .epc-device-card .info-row .label {
    color: #94a3b8;
  }
  
  .epc-device-card .info-row code {
    background: rgba(59, 130, 246, 0.2);
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
    color: #60a5fa;
    font-size: 0.8rem;
  }
  
  .epc-device-card .device-metrics {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
  }
  
  .epc-device-card .metric {
    flex: 1;
    text-align: center;
  }
  
  .epc-device-card .metric-label {
    display: block;
    font-size: 0.7rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .epc-device-card .metric-value {
    display: block;
    font-size: 1rem;
    font-weight: 600;
    color: #e2e8f0;
  }
  
  .epc-device-card .view-details-btn {
    width: 100%;
    padding: 0.75rem;
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
    color: #60a5fa;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .epc-device-card .view-details-btn:hover {
    background: rgba(59, 130, 246, 0.3);
    border-color: #3b82f6;
  }
  
  .no-devices {
    grid-column: 1 / -1;
    text-align: center;
    padding: 4rem 2rem;
    color: #64748b;
  }
  
  .no-devices p {
    margin: 0.5rem 0;
  }
  
  .no-devices .hint {
    font-size: 0.875rem;
  }
  
  /* EPC Modal */
  .epc-modal-content {
    width: 90%;
    max-width: 1200px;
    max-height: 90vh;
    overflow: hidden;
    border-radius: 12px;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
  }

  /* Floating Header Overlay */
  /* Header Overlay - Using common styles from moduleHeaderMenu.css */
  /* Additional module-specific overrides can go here */

  /* Global Button Styles */
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--border-radius-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    font-size: 0.875rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-hover);
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--hover-bg);
  }

  .btn-outline {
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-outline:hover {
    background: var(--hover-bg);
  }

  /* Loading Styles */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }


  .status-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); /* 30% narrower: 200px -> 140px */
    gap: 0.75rem; /* Slightly smaller gap */
    max-width: 70%; /* Limit total width to make it 30% narrower */
  }

  .status-card {
    display: flex;
    align-items: center;
    gap: 0.75rem; /* Smaller gap */
    padding: 0.75rem; /* Smaller padding */
    background: var(--card-bg, white);
    border-radius: 6px; /* Slightly smaller radius */
    border: 1px solid var(--border-color, #e5e7eb);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .status-card.critical {
    border-left: 4px solid #ef4444;
  }

  .status-card.warning {
    border-left: 4px solid #f59e0b;
  }

  .status-card.success {
    border-left: 4px solid #10b981;
  }

  .status-card.info {
    border-left: 4px solid #3b82f6;
  }

  .status-icon {
    font-size: 1.25rem; /* Smaller icon */
  }

  .status-content {
    flex: 1;
  }

  .status-value {
    font-size: 1.25rem; /* Smaller font */
    font-weight: 700;
    color: var(--text-primary, #111827);
    margin-bottom: 0.125rem; /* Smaller margin */
  }

  .status-label {
    font-size: 0.875rem;
    color: var(--text-secondary, #6b7280);
    font-weight: 500;
  }

  .map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .map-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
    background: #f9fafb;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    margin: 1rem;
  }

  .map-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    color: white;
  }

  .placeholder-content {
    text-align: center;
  }

  .placeholder-content h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
  }

  .placeholder-content p {
    margin: 0 0 1rem 0;
    opacity: 0.9;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    color: var(--text-secondary, #6b7280);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color, #e5e7eb);
    border-top: 4px solid var(--primary, #3b82f6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }



  .alert-item {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    border-left: 4px solid transparent;
    transition: all 0.2s ease;
  }

  .alert-item.clickable {
    cursor: pointer;
  }

  .alert-item.clickable:hover {
    background: var(--bg-secondary, #f9fafb);
    border-left-width: 6px;
  }

  .alert-item.clickable:focus {
    outline: 2px solid var(--primary, #3b82f6);
    outline-offset: -2px;
  }

  .alert-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .alert-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .alert-severity {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }

  .alert-severity.critical {
    color: #ef4444;
  }

  .alert-severity.warning {
    color: #f59e0b;
  }

  .alert-severity.info {
    color: #3b82f6;
  }

  .alert-message {
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
    margin-bottom: 0.25rem;
  }

  .alert-time {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .alert-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .alert-action-btn {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 4px;
    background: var(--bg-primary, white);
    color: var(--text-secondary, #6b7280);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .alert-action-btn:hover {
    background: var(--bg-secondary, #f9fafb);
    border-color: var(--primary, #3b82f6);
    color: var(--primary, #3b82f6);
  }

  .alert-action-btn.details:hover {
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .alert-action-btn.ticket:hover {
    border-color: #10b981;
    color: #10b981;
  }

  .no-alerts {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
  }


  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
  }

  .btn-primary {
    background: var(--primary, #3b82f6);
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: var(--bg-tertiary, #6b7280);
    color: white;
  }

  .btn-secondary:hover {
    background: #4b5563;
  }

  .btn-outline {
    background: transparent;
    color: var(--primary, #3b82f6);
    border: 1px solid var(--primary, #3b82f6);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-outline:hover {
    background: var(--primary, #3b82f6);
    color: white;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal-content {
    background: var(--card-bg, white);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    background: var(--bg-secondary, #f9fafb);
  }

  .modal-header h3 {
    margin: 0;
    color: var(--text-primary, #111827);
    font-size: 1.25rem;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    padding: 0.25rem;
    border-radius: 4px;
  }

  .modal-close:hover {
    background: var(--bg-tertiary, #e5e7eb);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .alert-detail-section {
    margin-bottom: 1.5rem;
  }

  .alert-detail-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary, #111827);
    font-size: 1rem;
    font-weight: 600;
  }

  .detail-grid {
    display: grid;
    gap: 0.75rem;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .detail-item label {
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
  }

  .alert-actions-grid {
    display: flex;
    gap: 1rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary, #111827);
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--bg-primary, white);
    color: var(--text-primary, #111827);
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  @media (max-width: 768px) {
    .module-container {
      margin-right: 0;
    }

    .module-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .header-actions {
      justify-content: space-between;
    }

    .status-cards {
      grid-template-columns: 1fr;
    }


    .modal-content {
      width: 95%;
      max-height: 90vh;
    }
  }
</style>
</style>