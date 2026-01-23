<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import TR069RSSIChart from './TR069RSSIChart.svelte';
  import TR069SINRChart from './TR069SINRChart.svelte';
  import TR069PCIChart from './TR069PCIChart.svelte';
  import TR069EARFCNChart from './TR069EARFCNChart.svelte';
  import { 
    getRSSIQuality,
    getRSRPQuality,
    getSINRQuality,
    formatUptime,
    type TR069CellularMetrics 
  } from '../lib/tr069MetricsService';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { customerService } from '$lib/services/customerService';
  
  export let device: any = null;
  export let show: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let deviceMetrics: TR069CellularMetrics[] = [];
  let currentSignal = { rssi: -65, rsrp: -75, rsrq: -10, sinr: 15, pci: 156, earfcn: 5230, uptime: 0 };
  let linkedCustomer: any = null;
  let showCustomerLinkModal = false;
  let customerSearchTerm = '';
  let searchResults: any[] = [];
  let isSearchingCustomers = false;
  let isLinkingCustomer = false;
  let customerLinkError = '';
  let customerLinkSuccess = '';

  $: if (show && device) {
    loadDeviceMetrics();
    loadLinkedCustomer();
  }

  async function loadDeviceMetrics() {
    if (!$currentTenant?.id) {
      console.error('No tenant selected');
      deviceMetrics = [];
      return;
    }
    
    try {
      // Get auth token
      const { authService } = await import('$lib/services/authService');
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      const token = await user.getIdToken();
      
      const response = await fetch(`/api/tr069/device-metrics?deviceId=${device.id}&hours=6`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data?.success && data?.metrics) {
        console.log(`✅ Loaded ${data.metrics.length} real metrics for device ${device.id}`);
        deviceMetrics = data.metrics;
      } else {
        console.warn('⚠️ No metrics available from GenieACS');
        deviceMetrics = []; // Empty array instead of fake data
      }
    } catch (error) {
      console.error('Failed to load device metrics:', error);
      deviceMetrics = []; // Empty array on error
    }
    
    // Get current signal values (last metric)
    if (deviceMetrics.length > 0) {
      const latest = deviceMetrics[deviceMetrics.length - 1];
      currentSignal = {
        rssi: latest.rssi,
        rsrp: latest.rsrp,
        rsrq: latest.rsrq,
        sinr: latest.sinr,
        pci: latest.pci,
        earfcn: latest.earfcn,
        uptime: latest.uptime
      };
    }
  }

  function handleClose() {
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  async function loadLinkedCustomer() {
    // Check if device has customer metadata
    if (device._customerId || device.customerId) {
      try {
        const customerId = device._customerId || device.customerId;
        const customer = await customerService.getCustomer(customerId);
        linkedCustomer = customer;
      } catch (err) {
        console.warn('Failed to load linked customer:', err);
        linkedCustomer = null;
      }
    } else {
      linkedCustomer = null;
    }
  }

  async function searchCustomers() {
    if (customerSearchTerm.length < 2) {
      searchResults = [];
      return;
    }

    isSearchingCustomers = true;
    try {
      // Use customer service to search
      const customers = await customerService.getCustomers({ 
        search: customerSearchTerm,
        limit: 10 
      });
      searchResults = customers || [];
    } catch (err) {
      console.error('Customer search failed:', err);
      searchResults = [];
    } finally {
      isSearchingCustomers = false;
    }
  }

  async function linkCustomer(customer: any) {
    if (!$currentTenant?.id || !device?.id) {
      customerLinkError = 'Missing tenant or device information';
      return;
    }

    isLinkingCustomer = true;
    customerLinkError = '';
    customerLinkSuccess = '';

    try {
      const { authService } = await import('$lib/services/authService');
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      
      const response = await fetch(`/api/tr069/devices/${device.id}/customer`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId: customer.customerId
        })
      });

      const data = await response.json();
      if (data.success) {
        customerLinkSuccess = 'Customer linked successfully! Device location updated.';
        linkedCustomer = customer;
        // Update device location if provided
        if (data.device?.location) {
          device.location = data.device.location;
        }
        setTimeout(() => {
          showCustomerLinkModal = false;
          customerLinkSuccess = '';
          customerSearchTerm = '';
          searchResults = [];
        }, 2000);
      } else {
        customerLinkError = data.error || 'Failed to link customer';
      }
    } catch (err: any) {
      console.error('Failed to link customer:', err);
      customerLinkError = err.message || 'Failed to link customer';
    } finally {
      isLinkingCustomer = false;
    }
  }

  async function unlinkCustomer() {
    if (!confirm('Unlink customer from this device? Device location will not be updated automatically.')) {
      return;
    }

    linkedCustomer = null;
    // Note: Backend doesn't have unlink endpoint yet, but we can clear the UI
    // In a full implementation, you'd call DELETE /api/tr069/devices/:deviceId/customer
  }

  $: rssiQuality = getRSSIQuality(currentSignal.rssi);
  $: rsrpQuality = getRSRPQuality(currentSignal.rsrp);
  $: sinrQuality = getSINRQuality(currentSignal.sinr);
</script>

{#if show && device}
  <div
    class="modal-overlay"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="cpe-performance-modal-title"
    tabindex="-1"
  >
    <div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation role="document">
      <div class="modal-header">
        <h2 id="cpe-performance-modal-title">CPE Device Performance</h2>
        <button class="close-btn" on:click={handleClose} aria-label="Close">×</button>
      </div>
      
      <div class="modal-body">
        <div class="device-info">
          <div class="info-section">
            <h3>Device Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Device ID:</span>
                <span class="info-value">{device.id}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Manufacturer:</span>
                <span class="info-value">{device.manufacturer}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="info-value status" class:online={device.status === 'Online'} class:offline={device.status === 'Offline'}>
                  {device.status}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Last Contact:</span>
                <span class="info-value">{device.lastContact ? new Date(device.lastContact).toLocaleString() : 'Unknown'}</span>
              </div>
            </div>
          </div>

          {#if device.location}
            <div class="info-section">
              <h3>Location</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Latitude:</span>
                  <span class="info-value">{device.location.latitude.toFixed(6)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Longitude:</span>
                  <span class="info-value">{device.location.longitude.toFixed(6)}</span>
                </div>
                {#if device.location.address}
                  <div class="info-item full-width">
                    <span class="info-label">Address:</span>
                    <span class="info-value">{device.location.address}</span>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Customer Linking -->
          <div class="info-section">
            <div class="section-header">
              <h3>Customer</h3>
              {#if linkedCustomer}
                <button class="btn-link" on:click={unlinkCustomer}>Unlink</button>
              {:else}
                <button class="btn-link" on:click={() => showCustomerLinkModal = true}>Link Customer</button>
              {/if}
            </div>
            {#if linkedCustomer}
              <div class="customer-info">
                <div class="info-item">
                  <span class="info-label">Customer:</span>
                  <span class="info-value">{linkedCustomer.fullName || linkedCustomer.customerId}</span>
                </div>
                {#if linkedCustomer.serviceAddress}
                  <div class="info-item">
                    <span class="info-label">Service Address:</span>
                    <span class="info-value">
                      {linkedCustomer.serviceAddress.street}, {linkedCustomer.serviceAddress.city}, {linkedCustomer.serviceAddress.state}
                    </span>
                  </div>
                {/if}
                {#if linkedCustomer.primaryPhone}
                  <div class="info-item">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">{linkedCustomer.primaryPhone}</span>
                  </div>
                {/if}
              </div>
            {:else}
              <p class="no-customer">No customer linked. Link a customer to geolocate device from service address.</p>
            {/if}
          </div>

          {#if device.parameters && Object.keys(device.parameters).length > 0}
            <div class="info-section">
              <h3>Parameters</h3>
              <div class="parameters-list">
                {#each Object.entries(device.parameters) as [key, value]}
                  <div class="parameter-item">
                    <span class="param-key">{key}:</span>
                    <span class="param-value">{JSON.stringify(value)}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Real-Time TR-069 Metrics -->
          <div class="info-section">
            <h3>Real-Time TR-069 Cellular Metrics</h3>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">RSSI</div>
                <div class="metric-value" style="color: {rssiQuality.color}">
                  {currentSignal.rssi.toFixed(1)} dBm
                </div>
                <div class="metric-quality">{rssiQuality.label}</div>
                <div class="metric-path">Device.Cellular.Interface.1.RSSI</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">RSRP</div>
                <div class="metric-value" style="color: {rsrpQuality.color}">
                  {currentSignal.rsrp.toFixed(1)} dBm
                </div>
                <div class="metric-quality">{rsrpQuality.label}</div>
                <div class="metric-path">Device.Cellular.Interface.1.RSRP</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">SINR</div>
                <div class="metric-value" style="color: {sinrQuality.color}">
                  {currentSignal.sinr.toFixed(1)} dB
                </div>
                <div class="metric-quality">{sinrQuality.label}</div>
                <div class="metric-path">Device.Cellular.Interface.1.SINR</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Physical Cell ID</div>
                <div class="metric-value">{currentSignal.pci}</div>
                <div class="metric-quality">Mod3: {currentSignal.pci % 3}</div>
                <div class="metric-path">X_VENDOR_PhysicalCellID</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">EARFCN</div>
                <div class="metric-value">{currentSignal.earfcn}</div>
                <div class="metric-quality">Frequency Channel</div>
                <div class="metric-path">X_VENDOR_EARFCN</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Uptime</div>
                <div class="metric-value">{formatUptime(currentSignal.uptime)}</div>
                <div class="metric-quality">Connection Time</div>
                <div class="metric-path">Device.DeviceInfo.UpTime</div>
              </div>
            </div>
          </div>

          <!-- TR-069 Performance Charts -->
          {#if deviceMetrics.length > 0}
            <div class="info-section">
              <h3>Last 6 Hours - TR-069 Parameter History</h3>
              <div class="charts-grid">
                <TR069RSSIChart metrics={deviceMetrics} />
                <TR069SINRChart metrics={deviceMetrics} />
                <TR069PCIChart metrics={deviceMetrics} />
                <TR069EARFCNChart metrics={deviceMetrics} />
              </div>
            </div>
          {/if}
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>Close</button>
      </div>
    </div>
  </div>
{/if}

<!-- Customer Link Modal -->
{#if showCustomerLinkModal}
  <div class="modal-overlay" on:click={() => showCustomerLinkModal = false}>
    <div class="modal-content customer-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Link Customer to Device</h2>
        <button class="close-btn" on:click={() => showCustomerLinkModal = false}>×</button>
      </div>
      
      <div class="modal-body">
        {#if customerLinkError}
          <div class="alert alert-error">{customerLinkError}</div>
        {/if}
        {#if customerLinkSuccess}
          <div class="alert alert-success">{customerLinkSuccess}</div>
        {/if}

        <div class="form-group">
          <label>Search Customers</label>
          <input 
            type="text" 
            bind:value={customerSearchTerm}
            on:input={searchCustomers}
            placeholder="Search by name, phone, or customer ID..."
            disabled={isLinkingCustomer}
          />
        </div>

        {#if isSearchingCustomers}
          <div class="loading">Searching...</div>
        {:else if searchResults.length > 0}
          <div class="customer-results">
            {#each searchResults as customer}
              <div class="customer-result-item" on:click={() => linkCustomer(customer)}>
                <div class="customer-name">{customer.fullName || customer.customerId}</div>
                <div class="customer-details">
                  {#if customer.primaryPhone}
                    <span>📞 {customer.primaryPhone}</span>
                  {/if}
                  {#if customer.serviceAddress}
                    <span>📍 {customer.serviceAddress.street}, {customer.serviceAddress.city}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else if customerSearchTerm.length >= 2}
          <div class="empty-state">No customers found</div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => showCustomerLinkModal = false} disabled={isLinkingCustomer}>
          Cancel
        </button>
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
    padding: 1rem;
  }

  .modal-content {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .device-info {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .info-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    color: var(--text-primary);
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .info-item.full-width {
    grid-column: 1 / -1;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--brand-primary);
    cursor: pointer;
    font-size: 0.875rem;
    text-decoration: underline;
    padding: 0;
  }

  .btn-link:hover {
    color: var(--brand-primary-hover);
  }

  .customer-info {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .no-customer {
    color: var(--text-secondary);
    font-style: italic;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 0.375rem;
  }

  .customer-modal {
    max-width: 500px;
  }

  .customer-results {
    max-height: 400px;
    overflow-y: auto;
    margin-top: 1rem;
  }

  .customer-result-item {
    padding: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .customer-result-item:hover {
    background: var(--bg-secondary);
    border-color: var(--brand-primary);
  }

  .customer-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .customer-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .alert {
    padding: 0.75rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .alert-success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }

  .info-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .info-value {
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .info-value.status {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .info-value.status.online {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .info-value.status.offline {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .parameters-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .parameter-item {
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 0.375rem;
    display: flex;
    gap: 0.5rem;
  }

  .param-key {
    font-weight: 600;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .param-value {
    color: var(--text-primary);
    word-break: break-word;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }

  .btn {
    padding: 0.5rem 1.5rem;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--bg-primary);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .metric-card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    padding: 1rem;
    text-align: center;
  }

  .metric-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .metric-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .metric-quality {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .metric-path {
    font-size: 0.65rem;
    color: var(--text-tertiary);
    font-family: monospace;
    margin-top: 0.25rem;
    background: var(--bg-primary);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1rem;
  }

  @media (max-width: 640px) {
    .modal-content {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .metrics-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

