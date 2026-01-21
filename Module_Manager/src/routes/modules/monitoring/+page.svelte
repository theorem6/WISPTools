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
  import MikrotikDevicesPanel from './components/MikrotikDevicesPanel.svelte';
  import MonitoringSiteDetailsModal from './components/MonitoringSiteDetailsModal.svelte';
  import EPCDeploymentModal from '../deploy/components/EPCDeploymentModal.svelte';
  
  import { API_CONFIG } from '$lib/config/api';
  import { monitoringService } from '$lib/services/monitoringService';
  import { formatInTenantTimezone } from '$lib/utils/timezone';
  import '$lib/styles/moduleHeaderMenu.css';
  import HelpModal from '$lib/components/modals/HelpModal.svelte';
  import { monitoringDocs } from '$lib/docs/monitoring-docs';
  import TipsModal from '$lib/components/modals/TipsModal.svelte';
  import { getModuleTips } from '$lib/config/moduleTips';
  import { tipsService } from '$lib/services/tipsService';
  import MonitoringSetupWizard from '$lib/components/wizards/MonitoringSetupWizard.svelte';
  
  // Use real backend data now that devices are created
  // Temporarily enable mock data to ensure devices show while debugging backend
  const USE_MOCK_DATA = false; // Use standard API service now
  
  let showSNMPConfig = false;
  let showSetupWizard = false;
  let networkDevices = [];
  let snmpData = [];
  let selectedDevice = null;
  let mapView = 'geographic'; // 'geographic', 'topology', 'epc', or 'graphs'
  let loading = true;
  let showMikrotikCredentialsModal = false;
  let selectedMikrotikDevice: any = null;
  
  // Site devices modal
  let showSiteDevicesModal = false;
  let selectedSite: any = null;
  let selectedSiteDevices: any[] = [];
  
  // Monitoring site details modal (with uptime)
  let showMonitoringSiteDetailsModal = false;
  let selectedSiteForDetails: any = null;
  
  // EPC Monitoring
  let epcDevices: any[] = [];
  let selectedEpcDevice: any = null;
  
  // Help Modal
  let showHelpModal = false;
  const helpContent = monitoringDocs;
  
  // Tips Modal
  let showTipsModal = false;
  const tips = getModuleTips('monitoring');
  
  onMount(() => {
    // Show tips on first visit (if not dismissed)
    if (tips.length > 0 && tipsService.shouldShowTips('monitoring')) {
      // Use requestAnimationFrame for minimal delay (single frame ~16ms)
      requestAnimationFrame(() => {
        showTipsModal = true;
      });
    }
  });
  
  // Deploy Modals
  let showEPCDeploymentModal = false;
  let selectedTowerForEPC: any = null;
  
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
  
  // Watch for tenant changes - but don't auto-load (let onMount handle it)
  let isMounted = false;
  let lastLoadedTenantId: string | null = null;
  
  onMount(async () => {
    isMounted = true;
    lastLoadedTenantId = tenantId;
    
    // Check URL parameters for device selection and tab
    if (browser) {
      const urlParams = new URLSearchParams(window.location.search);
      const deviceIdParam = urlParams.get('deviceId');
      const tabParam = urlParams.get('tab');
      
      if (tabParam === 'graphs') {
        mapView = 'graphs';
      }
      
      // deviceId will be handled by SNMPGraphsPanel after it loads devices
    }
    
    if (tenantId) {
      // Initialize with empty arrays to prevent undefined errors
      epcDevices = [];
      networkDevices = [];
      
      // Load data sequentially to avoid race conditions
      try {
        await Promise.allSettled([
          loadDashboard(),
          loadNetworkDevices(),
          loadSNMPData(),
          loadEPCDevices()
        ]);
      } catch (err) {
        console.error('[Monitoring] Error loading initial data:', err);
      }
    }
    
    // Auto-refresh every 30 seconds - pause when tab is inactive
    const startRefresh = () => {
      if (refreshInterval) clearInterval(refreshInterval);
      refreshInterval = setInterval(() => {
        // Only refresh if tab is visible
        if (document.visibilityState === 'visible' && tenantId) {
          Promise.allSettled([
            loadDashboard(),
            loadNetworkDevices(),
            loadSNMPData(),
            loadEPCDevices()
          ]).catch(err => console.error('[Monitoring] Auto-refresh error:', err));
        }
      }, 30000);
    };
    
    startRefresh();
    
    // Pause refresh when tab becomes hidden, resume when visible
    handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      } else {
        startRefresh();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for storage events (when sites/hardware are deleted in other tabs/modules)
    handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'monitoring-refresh-needed' && tenantId) {
        console.log('[Monitoring] Storage event detected - refreshing data');
        loadDashboard();
        loadNetworkDevices();
        loadSNMPData();
        loadEPCDevices();
        // Clear the flag
        if (typeof window !== 'undefined') {
          localStorage.removeItem('monitoring-refresh-needed');
        }
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
    }
    
    // Also check for refresh flag on focus (for same-tab changes)
    handleFocus = () => {
      if (tenantId && typeof window !== 'undefined') {
        const needsRefresh = localStorage.getItem('monitoring-refresh-needed');
        if (needsRefresh) {
          console.log('[Monitoring] Focus detected with refresh flag - refreshing data');
          loadDashboard();
          loadNetworkDevices();
          loadSNMPData();
          loadEPCDevices();
          localStorage.removeItem('monitoring-refresh-needed');
        }
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
    }
  });
  
  let loadingEPCDevices = false;
  let epcLoadError: string | null = null;
  
  async function loadEPCDevices() {
    if (!tenantId) {
      epcDevices = [];
      epcLoadError = null;
      return;
    }
    
    // Prevent concurrent loads
    if (loadingEPCDevices) {
      console.log('[Monitoring] EPC load already in progress, skipping');
      return;
    }
    
    loadingEPCDevices = true;
    epcLoadError = null;
    
    try {
      const user = auth().currentUser;
      if (!user) {
        epcDevices = [];
        epcLoadError = 'Not authenticated';
        return;
      }
      
      const token = await user.getIdToken();
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(`${API_CONFIG.PATHS.HSS}/epc/remote/list`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          epcDevices = Array.isArray(data.epcs) ? data.epcs : [];
          epcLoadError = null;
          console.log('[Monitoring] Loaded', epcDevices.length, 'EPC devices');
        } else {
          const errorText = await response.text();
          console.error('[Monitoring] Failed to load EPC devices:', response.status, errorText);
          epcLoadError = `Failed to load: ${response.status}`;
          // Don't clear existing devices on HTTP error, just log it
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (err: any) {
      console.error('[Monitoring] Failed to load EPC devices:', err);
      if (err.name === 'AbortError') {
        epcLoadError = 'Request timeout';
        console.warn('[Monitoring] Request timed out, keeping existing EPC device list');
      } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
        epcLoadError = 'Network error';
        console.warn('[Monitoring] Network error, keeping existing EPC device list');
      } else {
        epcLoadError = err.message || 'Unknown error';
        // For other errors, keep existing data
      }
    } finally {
      loadingEPCDevices = false;
    }
  }
  
  function selectEpcDevice(device: any) {
    selectedEpcDevice = device;
  }
  
  // Store event handler references for proper cleanup
  let handleStorageChange: ((e: StorageEvent) => void) | null = null;
  let handleFocus: (() => void) | null = null;
  let handleVisibilityChange: (() => void) | null = null;
  
  onDestroy(() => {
    isMounted = false;
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    // Cleanup event listeners with stored references
    if (typeof window !== 'undefined') {
      if (handleStorageChange) {
        window.removeEventListener('storage', handleStorageChange);
      }
      if (handleFocus) {
        window.removeEventListener('focus', handleFocus);
      }
      if (handleVisibilityChange) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    }
  });
  
  let isLoadingDashboard = false;
  
  async function loadDashboard() {
    // Guard against duplicate concurrent loads
    if (isLoadingDashboard) {
      return;
    }
    
    if (!tenantId) return;

    isLoadingDashboard = true;
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
      isLoadingDashboard = false;
    }
  }

  let isLoadingNetworkDevices = false;
  
  async function loadNetworkDevices() {
    // Guard against duplicate concurrent loads
    if (isLoadingNetworkDevices) {
      return;
    }
    
    isLoadingNetworkDevices = true;
    
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
          // Ensure location structure is preserved for map display
          const deviceData: any = {
            ...device,
            type,
            id: deviceId,
            status: device.status || 'unknown'
          };
          // Ensure location has coordinates structure for map
          if (!deviceData.location?.coordinates && deviceData.location) {
            deviceData.location = {
              coordinates: {
                latitude: deviceData.location.latitude || deviceData.location.coordinates?.latitude || 0,
                longitude: deviceData.location.longitude || deviceData.location.coordinates?.longitude || 0
              },
              address: deviceData.location.address || 'Unknown Location'
            };
          }
          devices.push(deviceData);
        }
      };
      
      // Load all device sources in parallel for faster loading
      const startTime = performance.now();
      const [epcResult, mikrotikResult, snmpResult, discoveredResult, hardwareDeploymentsResult] = await Promise.allSettled([
        monitoringService.getEPCDevices().catch(e => ({ success: false, error: e })),
        monitoringService.getMikrotikDevices().catch(e => ({ success: false, error: e })),
        monitoringService.getSNMPDevices().catch(e => ({ success: false, error: e })),
        monitoringService.getDiscoveredDevices().catch(e => ({ success: false, error: e })),
        (async () => {
          try {
            const { coverageMapService } = await import('../coverage-map/lib/coverageMapService.mongodb');
            return await coverageMapService.getAllHardwareDeployments(tenantId);
          } catch (e) {
            console.error('[Network Monitoring] Error loading hardware deployments:', e);
            return [];
          }
        })()
      ]);
      
      const loadTime = performance.now() - startTime;
      console.log(`[Network Monitoring] All device sources loaded in ${loadTime.toFixed(0)}ms`);
      
      // Process EPC devices
      if (epcResult.status === 'fulfilled' && epcResult.value.success && epcResult.value.data?.epcs) {
        epcResult.value.data.epcs.forEach((epc: any) => addDevice(epc, 'epc'));
      } else if (epcResult.status === 'rejected') {
        console.log('[Network Monitoring] EPC API not available:', epcResult.reason);
      }
      
      // Process Mikrotik devices
      if (mikrotikResult.status === 'fulfilled' && mikrotikResult.value.success && mikrotikResult.value.data?.devices) {
        mikrotikResult.value.data.devices.forEach((device: any) => addDevice(device, 'mikrotik'));
      } else if (mikrotikResult.status === 'rejected') {
        console.log('[Network Monitoring] Mikrotik API not available:', mikrotikResult.reason);
      }
      
      // Process SNMP devices
      if (snmpResult.status === 'fulfilled' && snmpResult.value.success && snmpResult.value.data?.devices) {
        snmpResult.value.data.devices.forEach((device: any) => {
          // Ensure location structure is correct
          if (!device.location) {
            device.location = {
              coordinates: { latitude: 0, longitude: 0 },
              address: 'SNMP Device - Location Unknown'
            };
          } else if (!device.location.coordinates) {
            device.location = {
              coordinates: {
                latitude: device.location.latitude || 0,
                longitude: device.location.longitude || 0
              },
              address: device.location.address || 'SNMP Device'
            };
          }
          addDevice(device, 'snmp');
        });
        console.log('[Network Monitoring] Loaded SNMP devices:', snmpResult.value.data.devices.length);
      } else if (snmpResult.status === 'rejected') {
        console.error('[Network Monitoring] Error loading SNMP devices:', snmpResult.reason);
      }
      
      // Process discovered devices
      if (discoveredResult.status === 'fulfilled' && discoveredResult.value.success && discoveredResult.value.data?.devices) {
        discoveredResult.value.data.devices.forEach((device: any) => {
          // Add discovered devices - include all of them, not just deployed ones
          if (!device.location) {
            device.location = {
              coordinates: { latitude: 0, longitude: 0 },
              address: 'Discovered Device - Location Unknown'
            };
          } else if (!device.location.coordinates) {
            device.location = {
              coordinates: {
                latitude: device.location.latitude || 0,
                longitude: device.location.longitude || 0
              },
              address: device.location.address || 'Discovered Device'
            };
          }
          addDevice(device, device.type || 'snmp');
        });
        console.log('[Network Monitoring] Loaded discovered devices:', discoveredResult.value.data.devices.length, '(all devices, including undeployed)');
      } else if (discoveredResult.status === 'rejected') {
        console.error('[Network Monitoring] Error loading discovered devices:', discoveredResult.reason);
      }
      
      // Process hardware deployments
      if (hardwareDeploymentsResult.status === 'fulfilled') {
        const allHardwareDeployments = hardwareDeploymentsResult.value;
        console.log('[Network Monitoring] Loaded hardware deployments:', allHardwareDeployments.length);
        
        if (allHardwareDeployments.length > 0) {
          console.log('[Network Monitoring] Sample hardware deployment:', {
            id: allHardwareDeployments[0]._id,
            name: allHardwareDeployments[0].name,
            hardware_type: allHardwareDeployments[0].hardware_type,
            status: allHardwareDeployments[0].status,
            siteId: allHardwareDeployments[0].siteId
          });
        }
        
        allHardwareDeployments.forEach((deployment: any) => {
          // Convert hardware deployment to device format
          const deviceData: any = {
            id: deployment._id || deployment.id,
            name: deployment.name || 'Unnamed Hardware',
            type: deployment.hardware_type || 'other',
            status: deployment.status || 'unknown',
            location: deployment.siteId?.location || deployment.location || {
              coordinates: { latitude: 0, longitude: 0 },
              address: 'Unknown Location'
            },
            siteId: deployment.siteId?._id || deployment.siteId?.id || deployment.siteId,
            config: deployment.config || {},
            ipAddress: deployment.config?.ipAddress || deployment.config?.ip_address || deployment.config?.management_ip || null,
            metrics: {}
          };
          
          // Ensure location has coordinates structure
          if (!deviceData.location.coordinates && deviceData.location) {
            deviceData.location = {
              coordinates: {
                latitude: deviceData.location.latitude || 0,
                longitude: deviceData.location.longitude || 0
              },
              address: deviceData.location.address || 'Unknown Location'
            };
          }
          
          addDevice(deviceData, deployment.hardware_type || 'other');
        });
        console.log('[Network Monitoring] Added hardware deployments to device list');
      } else if (hardwareDeploymentsResult.status === 'rejected') {
        console.error('[Network Monitoring] Error loading hardware deployments:', hardwareDeploymentsResult.reason);
      }
      
      networkDevices = devices;
      console.log('[Network Monitoring] Loaded network devices:', devices.length, '(deduped)');
    } catch (error) {
      console.error('[Network Monitoring] Failed to load network devices:', error);
      networkDevices = [];
    } finally {
      isLoadingNetworkDevices = false;
    }
  }

  let isLoadingSNMPData = false;
  
  async function loadSNMPData() {
    // Guard against duplicate concurrent loads
    if (isLoadingSNMPData) {
      return;
    }
    
    isLoadingSNMPData = true;
    
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
    } finally {
      isLoadingSNMPData = false;
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
    // Refresh all data including sites
    loadNetworkDevices();
    loadSNMPData();
    loadEPCDevices();
    // Sites will be reloaded when MonitoringMap receives updated data
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
  
  function handleSiteRightClick(event: CustomEvent) {
    const { site } = event.detail;
    selectedSiteForDetails = site;
    showMonitoringSiteDetailsModal = true;
    console.log('[Monitoring] Site right-clicked for details:', site);
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
  <!-- Monitoring Setup Wizard -->
  {#if showSetupWizard}
    <MonitoringSetupWizard 
      show={showSetupWizard} 
      autoStart={true}
      on:close={() => showSetupWizard = false}
      on:complete={() => { showSetupWizard = false; loadNetworkDevices(); }}
    />
  {/if}

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
          {#if networkDevices.length === 0 && epcDevices.length === 0}
            <div class="no-devices-overlay">
              <div class="help-message">
                <h3>🗺️ No SNMP/EPC Devices Available</h3>
                <p><strong>Geographic monitoring requires deployed hardware with SNMP or EPC agents.</strong></p>
                <p>To enable monitoring:</p>
                <ol>
                  <li>Deploy hardware with SNMP enabled or EPC agents</li>
                  <li>Configure SNMP credentials for network devices</li>
                  <li>Return here to view device locations and monitoring data</li>
                </ol>
                <p class="note">💡 All hardware shown here is read-only. SNMP and uptime graphs will appear for deployed hardware and devices discovered via SNMP.</p>
                <div class="deploy-actions">
                  <button class="btn btn-primary" onclick={() => showSetupWizard = true}>
                    🚀 Get Started with Setup Wizard
                  </button>
                  <button class="btn btn-secondary" onclick={() => showSNMPConfig = true}>
                    🔧 Configure SNMP
                  </button>
                  <button class="btn btn-secondary" onclick={() => { 
                    selectedTowerForEPC = null;
                    showEPCDeploymentModal = true;
                  }}>
                    📡 Deploy EPC
                  </button>
                </div>
              </div>
            </div>
          {:else}
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
              on:siteRightClick={handleSiteRightClick}
            />
          {/if}
        {:else if mapView === 'topology'}
          {#if networkDevices.length === 0 && epcDevices.length === 0}
            <div class="no-devices-overlay">
              <div class="help-message">
                <h3>🕸️ No SNMP/EPC Devices Available</h3>
                <p><strong>Network topology monitoring requires deployed hardware with SNMP or EPC agents.</strong></p>
                <p>To enable monitoring:</p>
                <ol>
                  <li>Deploy hardware with SNMP enabled or EPC agents</li>
                  <li>Configure SNMP credentials for network devices</li>
                  <li>Return here to view network topology and connections</li>
                </ol>
                <p class="note">💡 All hardware shown here is read-only. Network topology will appear for deployed hardware and devices discovered via SNMP.</p>
                <div class="deploy-actions">
                  <button class="btn btn-primary" onclick={() => showSetupWizard = true}>
                    🚀 Get Started with Setup Wizard
                  </button>
                  <button class="btn btn-secondary" onclick={() => showSNMPConfig = true}>
                    🔧 Configure SNMP
                  </button>
                  <button class="btn btn-secondary" onclick={() => { 
                    selectedTowerForEPC = null;
                    showEPCDeploymentModal = true;
                  }}>
                    📡 Deploy EPC
                  </button>
                </div>
              </div>
            </div>
          {:else}
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
      {/if}
    </div>

    <!-- Floating Header Overlay -->
    <div class="module-header-overlay" style="background: var(--gradient-success);">
      <div class="module-header-left">
        <button class="module-back-btn" onclick={() => goto('/modules')} title="Back to Modules">
          ←
        </button>
        <h1>🗺️ Monitor</h1>
      </div>
      <div class="module-header-controls">
        <button class="help-button" onclick={() => showHelpModal = true} aria-label="Open Help" title="Help">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </button>
        <button class="module-control-btn" onclick={() => showSNMPConfig = true} title="Configuration">
          <span class="control-icon">🔧</span>
          <span class="control-label">Config</span>
        </button>
        <button 
          class="module-control-btn {mapView === 'geographic' ? 'active' : ''}"
          onclick={() => mapView = 'geographic'}
          title="Geographic View"
        >
          <span class="control-icon">🗺️</span>
          <span class="control-label">Geographic</span>
        </button>
        <button 
          class="module-control-btn {mapView === 'topology' ? 'active' : ''}"
          onclick={() => mapView = 'topology'}
          title="Topology View"
        >
          <span class="control-icon">🕸️</span>
          <span class="control-label">Topology</span>
        </button>
        <button 
          class="module-control-btn {mapView === 'epc' ? 'active' : ''}"
          onclick={() => mapView = 'epc'}
          title="EPC Devices"
        >
          <span class="control-icon">📡</span>
          <span class="control-label">EPC ({epcDevices.length})</span>
        </button>
        <button 
          class="module-control-btn {mapView === 'graphs' ? 'active' : ''}"
          onclick={() => mapView = 'graphs'}
          title="SNMP Graphs"
        >
          <span class="control-icon">📈</span>
          <span class="control-label">Graphs</span>
        </button>
        <button 
          class="module-control-btn {mapView === 'mikrotik' ? 'active' : ''}"
          onclick={() => mapView = 'mikrotik'}
          title="Mikrotik Devices"
        >
          <span class="control-icon">🖥️</span>
          <span class="control-label">Mikrotik</span>
        </button>
      </div>
    </div>
  </div>
  
  <!-- SNMP Graphs View -->
  {#if mapView === 'graphs'}
    <div class="graphs-overlay">
      {#if networkDevices.length === 0 && epcDevices.length === 0}
        <div class="no-devices-overlay">
          <div class="help-message">
            <h3>📈 No SNMP/EPC Devices Available</h3>
            <p><strong>SNMP graphs and uptime monitoring require deployed hardware.</strong></p>
            <p>To enable monitoring:</p>
            <ol>
              <li>Deploy hardware with SNMP enabled or EPC agents</li>
              <li>Configure SNMP credentials for network devices</li>
              <li>Return here to view monitoring graphs and uptime data</li>
            </ol>
            <p class="note">💡 All hardware shown here is read-only. SNMP and uptime graphs will appear for deployed hardware and devices discovered via SNMP.</p>
            <div class="deploy-actions">
              <button class="btn btn-primary" onclick={() => showSNMPConfig = true}>
                🔧 Configure SNMP
              </button>
              <button class="btn btn-secondary" onclick={() => { 
                selectedTowerForEPC = null;
                showEPCDeploymentModal = true;
              }}>
                📡 Deploy EPC
              </button>
            </div>
          </div>
        </div>
      {:else if networkDevices.length === 0 && epcDevices.length === 0}
        <div class="no-devices-overlay">
          <div class="help-message">
            <h3>📈 No SNMP/EPC Devices Available</h3>
            <p><strong>SNMP graphs and uptime monitoring require deployed hardware.</strong></p>
            <p>To enable monitoring:</p>
            <ol>
              <li>Deploy hardware with SNMP enabled or EPC agents</li>
              <li>Configure SNMP credentials for network devices</li>
              <li>Return here to view monitoring graphs and uptime data</li>
            </ol>
            <p class="note">💡 All hardware shown here is read-only. SNMP and uptime graphs will appear for deployed hardware and devices discovered via SNMP.</p>
            <div class="deploy-actions">
              <button class="btn btn-primary" onclick={() => showSNMPConfig = true}>
                🔧 Configure SNMP
              </button>
              <button class="btn btn-secondary" onclick={() => { 
                selectedTowerForEPC = null;
                showEPCDeploymentModal = true;
              }}>
                📡 Deploy EPC
              </button>
            </div>
          </div>
        </div>
      {:else}
        <SNMPGraphsPanel />
      {/if}
    </div>
  {/if}
  
  <!-- Mikrotik Devices View -->
  {#if mapView === 'mikrotik'}
    <div class="mikrotik-overlay">
      {#if networkDevices.length === 0}
        <div class="no-devices-overlay">
          <div class="help-message">
            <h3>🖥️ No Mikrotik Devices Available</h3>
            <p><strong>Mikrotik device monitoring requires SNMP configuration.</strong></p>
            <p>To enable monitoring:</p>
            <ol>
              <li>Configure SNMP credentials for network devices</li>
              <li>Devices will be discovered via SNMP/CDP/LLDP</li>
              <li>Return here to view Mikrotik devices</li>
            </ol>
            <p class="note">💡 Mikrotik devices are discovered automatically when SNMP is configured.</p>
            <div class="deploy-actions">
              <button class="btn btn-primary" onclick={() => showSNMPConfig = true}>
                🔧 Configure SNMP
              </button>
            </div>
          </div>
        </div>
      {:else}
        <MikrotikDevicesPanel {tenantId} />
      {/if}
    </div>
  {/if}
  
  <!-- EPC Devices View -->
  {#if mapView === 'epc'}
    <div class="epc-devices-overlay">
      <div class="epc-devices-container">
        {#if loadingEPCDevices}
          <div class="no-devices">
            <p>⏳ Loading EPC devices...</p>
          </div>
        {:else if epcLoadError}
          <div class="no-devices">
            <p>⚠️ Error loading EPC devices: {epcLoadError}</p>
            <button onclick={loadEPCDevices} class="btn btn-primary">Retry</button>
          </div>
        {:else if !epcDevices || epcDevices.length === 0}
          <div class="no-devices">
            <div class="help-message">
              <h3>📡 No EPC/SNMP Devices Deployed</h3>
              <p><strong>Monitoring requires deployed hardware with SNMP or EPC agents.</strong></p>
              <p>To enable monitoring:</p>
              <ol>
                <li>Deploy hardware with SNMP enabled or EPC agents</li>
                <li>Configure SNMP credentials for network devices</li>
                <li>Return here to view monitoring graphs and uptime data</li>
              </ol>
              <p class="note">💡 <strong>Note:</strong> All hardware shown here is read-only. SNMP and uptime graphs will appear for deployed hardware and devices discovered via SNMP.</p>
              <div class="deploy-actions">
                <button class="btn btn-primary" onclick={() => showSNMPConfig = true}>
                  🔧 Configure SNMP
                </button>
                <button class="btn btn-secondary" onclick={() => { 
                  selectedTowerForEPC = null;
                  showEPCDeploymentModal = true;
                }}>
                  📡 Deploy EPC
                </button>
              </div>
            </div>
          </div>
        {:else}
          <div class="epc-devices-sidebar">
            <h3>EPC Devices ({epcDevices.length})</h3>
            {#each epcDevices as device (device.epc_id || device.epcId || device.id)}
              <div 
                class="epc-device-card {selectedEpcDevice?.epc_id === device.epc_id ? 'selected' : ''}" 
                onclick={() => selectEpcDevice(device)}
              >
                <div class="device-header">
                  <span class="device-status status-{device.status}">
                    {device.status === 'online' ? '🟢' : '🔴'}
                  </span>
                  <h4>{device.site_name || device.name || 'Remote EPC Device'}</h4>
                </div>
                <div class="device-info-compact">
                  <div class="info-row">
                    <span class="label">IP:</span>
                    <span>{device.ip_address || device.ipAddress || 'Unknown'}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Code:</span>
                    <code>{device.device_code || 'N/A'}</code>
                  </div>
                </div>
              </div>
            {/each}
          </div>
          <div class="epc-monitoring-main">
            {#if selectedEpcDevice}
              <EPCMonitoringPanel 
                epc={selectedEpcDevice}
                onClose={() => selectedEpcDevice = null}
              />
            {:else}
              <div class="no-selection">
                <p>📡 Select an EPC device from the list to view monitoring details</p>
              </div>
            {/if}
          </div>
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

  <!-- Help Modal -->
  <HelpModal 
    show={showHelpModal}
    title="Network Monitoring Help"
    content={helpContent}
    on:close={() => showHelpModal = false}
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

<!-- EPC Deployment Modal -->
<EPCDeploymentModal
  bind:show={showEPCDeploymentModal}
  site={selectedTowerForEPC}
  on:close={() => {
    showEPCDeploymentModal = false;
    selectedTowerForEPC = null;
  }}
  on:deployed={() => {
    showEPCDeploymentModal = false;
    selectedTowerForEPC = null;
    loadEPCDevices();
  }}
/>

<!-- Alert Details Modal -->
{#if showAlertDetailsModal && selectedAlert}
  <div class="modal-overlay" onclick={closeAlertDetailsModal}>
    <div class="modal-content alert-details-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>🚨 Alert Details</h3>
        <button class="modal-close" onclick={closeAlertDetailsModal}>×</button>
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
            <button class="btn btn-primary" onclick={() => createTicketFromAlert(selectedAlert)}>
              🎫 Create Ticket
            </button>
            <button class="btn btn-secondary" onclick={closeAlertDetailsModal}>
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
  <div class="modal-overlay" onclick={closeCreateTicketModal}>
    <div class="modal-content create-ticket-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>🎫 Create Ticket from Alert</h3>
        <button class="modal-close" onclick={closeCreateTicketModal}>×</button>
      </div>
      
      <div class="modal-body">
        <form onsubmit={(e) => { e.preventDefault(); handleTicketCreated(e); }}>
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
            <button type="button" class="btn btn-secondary" onclick={closeCreateTicketModal}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Monitoring Site Details Modal (right-click on sites) -->
<!-- Monitoring Site Details Modal (right-click on sites) -->
{#if showMonitoringSiteDetailsModal && selectedSiteForDetails}
  <MonitoringSiteDetailsModal
    show={showMonitoringSiteDetailsModal}
    site={selectedSiteForDetails}
    {networkDevices}
    tenantId={tenantId}
    on:close={() => {
      showMonitoringSiteDetailsModal = false;
      selectedSiteForDetails = null;
    }}
  />
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
    top: 80px; /* Start below the module header menu */
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    padding: 0;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    overflow-y: auto;
  }
  
  .no-devices-overlay {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
  }
  
  .help-message {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    background: var(--card-bg, #1e293b);
    border-radius: 8px;
    border: 2px solid var(--primary-color, #3b82f6);
    color: var(--text-primary, #ffffff);
  }
  
  .help-message h3 {
    margin-top: 0;
    color: var(--primary-color, #3b82f6);
  }
  
  .help-message ol {
    text-align: left;
    margin: 1rem 0;
    padding-left: 1.5rem;
  }
  
  .help-message ol li {
    margin: 0.5rem 0;
  }
  
  .help-message .note {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 4px;
    border-left: 3px solid var(--primary-color, #3b82f6);
  }
  
  .help-message .btn {
    margin-top: 1rem;
  }
  
  .no-devices {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
  }
  
  .no-devices .help-message {
    background: var(--card-bg, #1e293b);
    color: var(--text-primary, #ffffff);
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
  }

  .snmp-overlay {
    position: absolute;
    top: 140px;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--card-bg, var(--bg-primary, #ffffff));
    color: var(--text-primary, #111827);
    overflow-y: auto;
    padding: 0;
    z-index: 5;
  }

  .mikrotik-overlay {
    position: absolute;
    top: 140px;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--card-bg, var(--bg-primary, #ffffff));
    color: var(--text-primary, #111827);
    overflow-y: auto;
    padding: 2rem;
    z-index: 5;
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

  .help-button {
    position: fixed;
    bottom: 2rem;
    left: 2rem;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    z-index: 999;
  }
  
  .help-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15);
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  }
  
  .help-button:active {
    transform: translateY(0);
  }
  
  .help-button svg {
    width: 24px;
    height: 24px;
    stroke: white;
    fill: none;
    stroke-width: 2.5;
  }

  .deploy-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .deploy-actions .btn {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    border-radius: 8px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .deploy-actions .btn-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
  }

  .deploy-actions .btn-primary:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .deploy-actions .btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .deploy-actions .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
  }
</style>