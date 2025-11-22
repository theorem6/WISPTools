<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { auth } from '$lib/firebase';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import MonitoringMap from './components/MonitoringMap.svelte';
  import SNMPConfigurationPanel from './components/SNMPConfigurationPanel.svelte';
  import NetworkTopologyMap from './components/NetworkTopologyMap.svelte';
  
  import { API_CONFIG } from '$lib/config/api';
  
  // Use GCE backend for monitoring APIs (port 3003 per memory)
  // Note: Using HTTP for now, should be HTTPS in production
  const GCE_BACKEND = 'http://136.112.111.167:3003';
  const MONITORING_API = GCE_BACKEND;
  
  // Use real backend data now that devices are created
  const USE_MOCK_DATA = false;
  
  let showSNMPConfig = false;
  let networkDevices = [];
  let snmpData = [];
  let selectedDevice = null;
  let mapView = 'geographic'; // 'geographic' or 'topology'
  let loading = true;
  
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
    }
    
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(() => {
      if (tenantId) {
        loadDashboard();
        loadNetworkDevices();
        loadSNMPData();
      }
    }, 30000);
  });
  
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
        // Use mock data for now to avoid CORS issues
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
        const response = await fetch(`${GCE_BACKEND}/health`, {
          headers: {
            'x-tenant-id': tenantId
          }
        });
        
        if (response.ok) {
          const healthData = await response.json();
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
      
      // Real API calls (will be blocked by CORS for now)
      const devices = [];
      
      try {
        const epcResponse = await fetch(`${GCE_BACKEND}/api/epc/list`, {
          headers: { 'x-tenant-id': tenantId }
        });
        if (epcResponse.ok) {
          const epcData = await epcResponse.json();
          devices.push(...(epcData.epcs || []).map(epc => ({
            ...epc,
            type: 'epc',
            id: epc.epcId || epc.id,
            status: epc.status || 'unknown'
          })));
        }
      } catch (e) { console.log('EPC API not available:', e.message); }
      
      try {
        const mikrotikResponse = await fetch(`${GCE_BACKEND}/api/mikrotik/devices`, {
          headers: { 'x-tenant-id': tenantId }
        });
        if (mikrotikResponse.ok) {
          const mikrotikData = await mikrotikResponse.json();
          devices.push(...(mikrotikData.devices || []).map(device => ({
            ...device,
            type: 'mikrotik',
            status: device.status || 'unknown'
          })));
        }
      } catch (e) { console.log('Mikrotik API not available:', e.message); }
      
      try {
        const snmpResponse = await fetch(`${GCE_BACKEND}/api/snmp/devices`, {
          headers: { 'x-tenant-id': tenantId }
        });
        if (snmpResponse.ok) {
          const snmpDeviceData = await snmpResponse.json();
          devices.push(...(snmpDeviceData.devices || []).map(device => ({
            ...device,
            type: 'snmp',
            status: device.status || 'unknown'
          })));
        }
      } catch (e) { console.log('SNMP API not available:', e.message); }
      
      networkDevices = devices;
      console.log('[Network Monitoring] Loaded network devices:', devices.length);
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
      
      const response = await fetch(`${GCE_BACKEND}/api/snmp/metrics/latest`, {
        headers: { 'x-tenant-id': tenantId }
      });
      
      if (response.ok) {
        snmpData = await response.json();
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

<div class="monitoring-module">
  <TenantGuard>
    <div class="module-container">
      <!-- Module Header -->
      <div class="module-header">
        <div class="header-info">
          <h1>🗺️ Network Monitoring</h1>
          <p>Real-time network monitoring and device management for {tenantName}</p>
        </div>
        <div class="header-actions">
          <a href="/modules" class="btn btn-outline">
            ← Back to Modules
          </a>
          <button class="btn btn-secondary" on:click={() => showSNMPConfig = true}>
            🔧 Configuration
          </button>
          <div class="view-toggle">
            <button 
              class="btn {mapView === 'geographic' ? 'btn-primary' : 'btn-secondary'}"
              on:click={() => mapView = 'geographic'}
            >
              🗺️ Geographic
            </button>
            <button 
              class="btn {mapView === 'topology' ? 'btn-primary' : 'btn-secondary'}"
              on:click={() => mapView = 'topology'}
            >
              🕸️ Topology
            </button>
          </div>
        </div>
      </div>
      
      <!-- Status Header -->
      <div class="status-header">
        <div class="status-cards">
          <div class="status-card critical">
            <div class="status-icon">🚨</div>
            <div class="status-content">
              <div class="status-value">{dashboardData?.summary?.critical_alerts || 0}</div>
              <div class="status-label">Critical Faults</div>
            </div>
          </div>
          
          <div class="status-card warning">
            <div class="status-icon">⚠️</div>
            <div class="status-content">
              <div class="status-value">{dashboardData?.summary?.total_alerts || 0}</div>
              <div class="status-label">Active Alerts</div>
            </div>
          </div>
          
          <div class="status-card success">
            <div class="status-icon">✅</div>
            <div class="status-content">
              <div class="status-value">{networkDevices.filter(d => d.status === 'online').length}</div>
              <div class="status-label">Online Devices</div>
            </div>
          </div>
          
          <div class="status-card info">
            <div class="status-icon">📊</div>
            <div class="status-content">
              <div class="status-value">{calculateUptime()}%</div>
              <div class="status-label">Network Uptime</div>
            </div>
          </div>
          
          <div class="status-card">
            <div class="status-icon">🌐</div>
            <div class="status-content">
              <div class="status-value">{networkDevices.length}</div>
              <div class="status-label">Total Devices</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content - Map Based -->
      {#if loading}
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Loading network monitoring data...</p>
        </div>
      {:else}
        <div class="map-container">
          {#if mapView === 'geographic'}
            <div class="map-wrapper">
              <MonitoringMap 
                devices={networkDevices}
                height="calc(100vh - 280px)"
                on:deviceSelected={handleDeviceSelected}
                on:viewDeviceDetails={handleViewDeviceDetails}
                on:configureDevice={handleConfigureDevice}
              />
            </div>
          {:else if mapView === 'topology'}
            <div class="map-wrapper">
              <NetworkTopologyMap 
                devices={networkDevices}
                {snmpData}
                height="calc(100vh - 280px)"
                on:nodeSelected={handleDeviceSelected}
                on:viewDeviceDetails={handleViewDeviceDetails}
                on:configureDevice={handleConfigureDevice}
                on:refreshData={handleRefreshData}
              />
            </div>
          {/if}
        </div>
      {/if}

      <!-- Active Alerts Sidebar - Full Height -->
      <div class="alerts-sidebar">
        <div class="alerts-header">
          <h3>🚨 Active Alerts</h3>
          <span class="alerts-count">{activeAlerts.length}</span>
        </div>
        <div class="alerts-list">
          {#if activeAlerts.length > 0}
            {#each activeAlerts as alert, index}
              <div 
                class="alert-item clickable" 
                style="border-left-color: {getAlertSeverityColor(alert.severity)}"
                on:click={() => handleAlertClick(alert)}
                on:keydown={(e) => e.key === 'Enter' && handleAlertClick(alert)}
                tabindex="0"
                role="button"
              >
                <div class="alert-content">
                  <div class="alert-header">
                    <div class="alert-severity {alert.severity?.toLowerCase()}">{alert.severity}</div>
                    <div class="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <div class="alert-message">{alert.message}</div>
                  <div class="alert-actions">
                    <button 
                      class="alert-action-btn details"
                      on:click|stopPropagation={() => showAlertDetails(alert)}
                    >
                      📋 Details
                    </button>
                    <button 
                      class="alert-action-btn ticket"
                      on:click|stopPropagation={() => createTicketFromAlert(alert)}
                    >
                      🎫 Create Ticket
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          {:else}
            <div class="no-alerts">
              <div class="no-alerts-icon">✅</div>
              <div class="no-alerts-text">No active alerts</div>
              <div class="no-alerts-subtext">All systems operating normally</div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </TenantGuard>
</div>

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
              <span>{new Date(selectedAlert.timestamp).toLocaleString()}</span>
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
              placeholder="Alert Details:&#10;Severity: {selectedAlert.severity}&#10;Time: {new Date(selectedAlert.timestamp).toLocaleString()}&#10;Message: {selectedAlert.message}"
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

<style>
  .monitoring-module {
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }

  .module-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #ffffff);
    margin-right: 350px; /* Account for alerts sidebar */
  }

  .module-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    background: var(--card-bg, white);
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .header-info h1 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary, #111827);
    font-size: 1.75rem;
    font-weight: 700;
  }

  .header-info p {
    margin: 0;
    color: var(--text-secondary, #6b7280);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .view-toggle {
    display: flex;
    gap: 0.5rem;
  }

  .status-header {
    padding: 1.5rem 2rem;
    background: var(--bg-secondary, #f9fafb);
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .status-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .status-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--card-bg, white);
    border-radius: 8px;
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
    font-size: 1.5rem;
  }

  .status-content {
    flex: 1;
  }

  .status-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary, #111827);
    margin-bottom: 0.25rem;
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

  .alerts-sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 350px;
    height: 100vh;
    background: var(--card-bg, white);
    border-left: 1px solid var(--border-color, #e5e7eb);
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }

  .alerts-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    background: var(--bg-secondary, #f9fafb);
    flex-shrink: 0;
  }

  .alerts-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary, #111827);
  }

  .alerts-count {
    background: #ef4444;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .alerts-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
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

  .no-alerts-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .no-alerts-text {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin-bottom: 0.5rem;
  }

  .no-alerts-subtext {
    font-size: 0.875rem;
    color: var(--text-secondary, #6b7280);
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

    .alerts-sidebar {
      position: fixed;
      top: 0;
      right: -350px;
      transition: right 0.3s ease;
    }

    .alerts-sidebar.mobile-open {
      right: 0;
    }

    .modal-content {
      width: 95%;
      max-height: 90vh;
    }
  }
</style>