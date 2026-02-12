<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { API_CONFIG } from '$lib/config/api';
  import type { TowerSite } from '../lib/models';

  export let show = false;
  export let tenantId: string;
  export let siteData: TowerSite | null = null;

  const dispatch = createEventDispatcher();

  let loading = false;
  let error = '';
  let success = '';

  // HSS Registration Configuration
  let registrationConfig = {
    siteName: '',
    siteId: '',
    location: {
      address: '',
      city: '',
      state: '',
      country: 'USA',
      coordinates: {
        latitude: 0,
        longitude: 0
      }
    },
    networkConfig: {
      mcc: '001',
      mnc: '01',
      tac: '1',
      plmn: '00101'
    },
    contact: {
      name: '',
      email: '',
      phone: ''
    },
    hssConfig: {
      hssHost: '136.112.111.167',
      hssPort: '3001',
      diameterRealm: 'wisptools.io'
    }
  };

  onMount(async () => {
    if (show && siteData) {
      // Initialize with site data
      registrationConfig.siteName = siteData.name;
      registrationConfig.siteId = siteData.id;
      registrationConfig.location.address = siteData.location?.address || '';
      registrationConfig.location.city = siteData.location?.city || '';
      registrationConfig.location.state = siteData.location?.state || '';
      registrationConfig.location.coordinates.latitude = siteData.location?.latitude || 0;
      registrationConfig.location.coordinates.longitude = siteData.location?.longitude || 0;
      
      // Use site contact if available
      if (siteData.siteContact) {
        registrationConfig.contact.name = siteData.siteContact.name || '';
        registrationConfig.contact.email = siteData.siteContact.email || '';
        registrationConfig.contact.phone = siteData.siteContact.phone || '';
      }
    }
  });

  $: if (show && siteData) {
    registrationConfig.siteName = siteData.name;
    registrationConfig.siteId = siteData.id;
    registrationConfig.location.address = siteData.location?.address || '';
    registrationConfig.location.city = siteData.location?.city || '';
    registrationConfig.location.state = siteData.location?.state || '';
    registrationConfig.location.coordinates.latitude = siteData.location?.latitude || 0;
    registrationConfig.location.coordinates.longitude = siteData.location?.longitude || 0;
    
    if (siteData.siteContact) {
      registrationConfig.contact.name = siteData.siteContact.name || '';
      registrationConfig.contact.email = siteData.siteContact.email || '';
      registrationConfig.contact.phone = siteData.siteContact.phone || '';
    }
  }

  function handleClose() {
    show = false;
    error = '';
    success = '';
    dispatch('close');
  }

  function validateConfig(): boolean {
    if (!registrationConfig.siteName.trim()) {
      error = 'Site name is required';
      return false;
    }
    if (!registrationConfig.contact.name.trim()) {
      error = 'Contact name is required';
      return false;
    }
    if (!registrationConfig.contact.email.trim()) {
      error = 'Contact email is required';
      return false;
    }
    return true;
  }

  async function registerWithHSS() {
    if (!validateConfig()) {
      return;
    }

    loading = true;
    error = '';

    try {
      console.log('[HSSRegistration] Registering site with HSS...');
      
      // Use centralized API configuration
      const HSS_API = API_CONFIG.PATHS.HSS;
      
      const response = await fetch(`${HSS_API}/sites/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({
          siteId: registrationConfig.siteId,
          siteName: registrationConfig.siteName,
          location: registrationConfig.location,
          networkConfig: registrationConfig.networkConfig,
          contact: registrationConfig.contact,
          hssConfig: registrationConfig.hssConfig
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      success = `Site "${registrationConfig.siteName}" successfully registered with HSS!`;
      console.log('[HSSRegistration] Registration successful:', result);
      
      // Close modal after success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      console.error('[HSSRegistration] Registration failed:', err);
      error = `Registration failed: ${err.message || 'Unknown error'}`;
    } finally {
      loading = false;
    }
  }

  async function getAuthToken(): Promise<string> {
    const token = await authService.getAuthTokenForApi();
    if (!token) {
      throw new Error('Not authenticated');
    }
    return token;
  }
</script>

{#if show}
  <div class="modal-overlay" onclick={handleClose}>
    <div class="modal-content hss-registration-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>🏠 Register Site with HSS</h2>
        <button class="close-btn" onclick={handleClose}>✕</button>
      </div>

      {#if error}
        <div class="error-banner">{error}</div>
      {/if}

      {#if success}
        <div class="success-banner">{success}</div>
      {/if}

      <div class="modal-body">
        <div class="registration-form">
          <div class="form-section">
            <h4>📍 Site Information</h4>
            <div class="form-group">
              <label for="siteName">Site Name *</label>
              <input 
                id="siteName" 
                type="text" 
                bind:value={registrationConfig.siteName} 
                placeholder="Enter site name"
                required
              />
            </div>
            <div class="form-group">
              <label for="siteId">Site ID</label>
              <input 
                id="siteId" 
                type="text" 
                bind:value={registrationConfig.siteId} 
                placeholder="Auto-generated from site"
                readonly
              />
            </div>
          </div>

          <div class="form-section">
            <h4>🌐 Network Configuration</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="mcc">MCC *</label>
                <input 
                  id="mcc" 
                  type="text" 
                  bind:value={registrationConfig.networkConfig.mcc} 
                  placeholder="001"
                  required
                />
              </div>
              <div class="form-group">
                <label for="mnc">MNC *</label>
                <input 
                  id="mnc" 
                  type="text" 
                  bind:value={registrationConfig.networkConfig.mnc} 
                  placeholder="01"
                  required
                />
              </div>
              <div class="form-group">
                <label for="tac">TAC *</label>
                <input 
                  id="tac" 
                  type="text" 
                  bind:value={registrationConfig.networkConfig.tac} 
                  placeholder="1"
                  required
                />
              </div>
            </div>
          </div>

          <div class="form-section">
            <h4>📍 Location</h4>
            <div class="form-group">
              <label for="address">Address *</label>
              <input 
                id="address" 
                type="text" 
                bind:value={registrationConfig.location.address} 
                placeholder="Enter address"
                required
              />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="city">City</label>
                <input 
                  id="city" 
                  type="text" 
                  bind:value={registrationConfig.location.city} 
                  placeholder="Enter city"
                />
              </div>
              <div class="form-group">
                <label for="state">State</label>
                <input 
                  id="state" 
                  type="text" 
                  bind:value={registrationConfig.location.state} 
                  placeholder="Enter state"
                />
              </div>
              <div class="form-group">
                <label for="country">Country</label>
                <input 
                  id="country" 
                  type="text" 
                  bind:value={registrationConfig.location.country} 
                  placeholder="Enter country"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="latitude">Latitude</label>
                <input 
                  id="latitude" 
                  type="number" 
                  step="0.000001"
                  bind:value={registrationConfig.location.coordinates.latitude} 
                  placeholder="0.000000"
                />
              </div>
              <div class="form-group">
                <label for="longitude">Longitude</label>
                <input 
                  id="longitude" 
                  type="number" 
                  step="0.000001"
                  bind:value={registrationConfig.location.coordinates.longitude} 
                  placeholder="0.000000"
                />
              </div>
            </div>
          </div>

          <div class="form-section">
            <h4>📞 Contact Information</h4>
            <div class="form-group">
              <label for="contactName">Contact Name *</label>
              <input 
                id="contactName" 
                type="text" 
                bind:value={registrationConfig.contact.name} 
                placeholder="Enter contact name"
                required
              />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="contactEmail">Email *</label>
                <input 
                  id="contactEmail" 
                  type="email" 
                  bind:value={registrationConfig.contact.email} 
                  placeholder="Enter email"
                  required
                />
              </div>
              <div class="form-group">
                <label for="contactPhone">Phone</label>
                <input 
                  id="contactPhone" 
                  type="tel" 
                  bind:value={registrationConfig.contact.phone} 
                  placeholder="Enter phone"
                />
              </div>
            </div>
          </div>

          <div class="form-section">
            <h4>🏠 HSS Configuration</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="hssHost">HSS Host</label>
                <input 
                  id="hssHost" 
                  type="text" 
                  bind:value={registrationConfig.hssConfig.hssHost} 
                  placeholder="HSS host"
                />
              </div>
              <div class="form-group">
                <label for="hssPort">HSS Port</label>
                <input 
                  id="hssPort" 
                  type="text" 
                  bind:value={registrationConfig.hssConfig.hssPort} 
                  placeholder="3868"
                />
              </div>
            </div>
            <div class="form-group">
              <label for="diameterRealm">Diameter Realm</label>
              <input 
                id="diameterRealm" 
                type="text" 
                bind:value={registrationConfig.hssConfig.diameterRealm} 
                placeholder="example.com"
              />
            </div>
          </div>
        </div>

        <!-- Registration Info -->
        <div class="registration-info">
          <h4>ℹ️ Registration Information</h4>
          <p>This will register the site with the HSS (Home Subscriber Server) to enable:</p>
          <ul>
            <li>Subscriber authentication and authorization</li>
            <li>Network access control</li>
            <li>QoS management</li>
            <li>Billing and usage tracking</li>
            <li>MME connection management</li>
          </ul>
        </div>
      </div>

      <!-- Navigation -->
      <div class="modal-footer">
        <button class="btn-secondary" onclick={handleClose}>
          Cancel
        </button>
        <button 
          class="btn-primary" 
          onclick={registerWithHSS}
          disabled={loading || !validateConfig()}
        >
          {#if loading}
            <div class="loading-spinner small"></div>
            Registering...
          {:else}
            🏠 Register with HSS
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
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
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-xl);
    max-width: 95vw;
    max-height: 95vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .modal-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.5rem;
    border-radius: var(--border-radius-sm);
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
  }

  .hss-registration-modal {
    width: 95%;
    max-width: 800px;
    max-height: 95vh;
  }

  .error-banner {
    background: var(--danger);
    color: white;
    padding: var(--spacing-md);
    margin: var(--spacing-md) 0;
    border-radius: var(--border-radius-md);
    text-align: center;
  }

  .success-banner {
    background: var(--success);
    color: white;
    padding: var(--spacing-md);
    margin: var(--spacing-md) 0;
    border-radius: var(--border-radius-md);
    text-align: center;
  }

  .registration-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .form-section {
    background: var(--bg-secondary);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius-md);
    border: 1px solid var(--border-color);
  }

  .form-section h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    color: var(--text-primary);
    font-weight: 500;
  }

  .form-group input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: all 0.2s ease;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
  }

  .form-group input[readonly] {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }

  .registration-info {
    background: var(--bg-secondary);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius-md);
    border: 1px solid var(--border-color);
    margin-top: var(--spacing-lg);
  }

  .registration-info h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
  }

  .registration-info ul {
    margin: var(--spacing-md) 0;
    padding-left: var(--spacing-lg);
  }

  .registration-info li {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
  }

  .btn-primary, .btn-secondary {
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--border-radius-md);
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-tertiary);
  }

  .btn-primary:disabled, .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color);
    border-top: 2px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-spinner.small {
    width: 16px;
    height: 16px;
    border-width: 2px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .hss-registration-modal {
      width: 95%;
      max-width: none;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .modal-footer {
      flex-direction: column;
      gap: var(--spacing-md);
    }
  }
</style>