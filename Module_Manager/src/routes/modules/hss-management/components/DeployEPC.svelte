<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/firebase';
  
  export let tenantId: string;
  export let HSS_API: string;
  
  let deploymentMethod: 'script' | 'iso' = 'script';
  let epcs: any[] = [];
  let sites: any[] = [];
  let loading = true;
  let loadingSites = true;
  let showRegisterModal = false;
  let downloadingScript = false;
  let downloadingISO = false;
  let selectedSiteId = '';
  let registrationError = '';
  
  // HSS and ISO API configuration
  const HSS_IP = '136.112.111.167';
  const HSS_HOSTNAME = 'hss.wisptools.io';
  const HSS_PORT = '3001';
  const ISO_API_PORT = '3002';
  
  // Use Cloud Function proxies for HTTPS (backend has no domain yet)
  const HSS_PROXY = 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy';
  const ISO_PROXY = 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/isoProxy';
  const NETWORK_API = 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/coverageMapProxy';
  
  // Form data for new EPC registration
  let formData = {
    site_name: '',
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
    network_config: {
      mcc: '001',
      mnc: '01',
      tac: '1',
      apn: 'internet'
    },
    contact: {
      name: '',
      email: '',
      phone: ''
    }
  };
  
  onMount(async () => {
    await Promise.all([loadEPCs(), loadSites()]);
  });
  
  async function loadEPCs() {
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch(`${HSS_API}/epc/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        epcs = data.epcs || [];
      }
    } catch (err: any) {
      console.error('Error loading EPCs:', err);
    } finally {
      loading = false;
    }
  }
  
  async function loadSites() {
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch(`${NETWORK_API}/api/network/sites`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        sites = data || [];
        console.log('[DeployEPC] Loaded sites:', sites.length);
      }
    } catch (err: any) {
      console.error('[DeployEPC] Error loading sites:', err);
    } finally {
      loadingSites = false;
    }
  }
  
  function handleSiteSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const siteId = select.value;
    selectedSiteId = siteId;
    
    // Clear any previous errors
    registrationError = '';
    
    if (!siteId) {
      formData.site_name = '';
      return;
    }
    
    const site = sites.find(s => s._id === siteId || s.id === siteId);
    if (site) {
      console.log('[DeployEPC] Selected site:', site);
      formData.site_name = site.name || site.siteName || '';
      
      // Auto-populate location if available
      if (site.location) {
        formData.location.address = site.location.address || site.address || '';
        formData.location.city = site.location.city || site.city || '';
        formData.location.state = site.location.state || site.state || '';
        formData.location.coordinates.latitude = site.location.latitude || site.latitude || 0;
        formData.location.coordinates.longitude = site.location.longitude || site.longitude || 0;
      }
      
      // Auto-populate contact if available
      if (site.contact) {
        formData.contact.name = site.contact.name || '';
        formData.contact.email = site.contact.email || '';
        formData.contact.phone = site.contact.phone || '';
      }
    }
  }
  
  async function registerNewEPC() {
    // Clear previous errors
    registrationError = '';
    
    // Validate
    if (!formData.site_name || formData.site_name.trim() === '') {
      registrationError = 'Site name is required';
      return;
    }
    
    try {
      const user = auth().currentUser;
      if (!user) {
        registrationError = 'You must be logged in to register an EPC';
        return;
      }
      
      const token = await user.getIdToken();
      const response = await fetch(`${HSS_API}/epc/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        alert('✅ EPC registered successfully!');
        showRegisterModal = false;
        registrationError = '';
        await loadEPCs();
        
        // Reset form
        selectedSiteId = '';
        formData = {
          site_name: '',
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
          network_config: {
            mcc: '001',
            mnc: '01',
            tac: '1',
            apn: 'internet'
          },
          contact: {
            name: '',
            email: '',
            phone: ''
          }
        };
      } else {
        const error = await response.json();
        registrationError = `Failed to register EPC: ${error.error || 'Unknown error'}`;
      }
    } catch (err: any) {
      console.error('Error registering EPC:', err);
      registrationError = `Error: ${err.message}`;
    }
  }
  
  function openRegisterModal() {
    registrationError = '';
    showRegisterModal = true;
  }
  
  function closeRegisterModal() {
    registrationError = '';
    showRegisterModal = false;
  }
  
  async function downloadDeploymentScript(epc: any) {
    downloadingScript = true;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch(`${HSS_API}/epc/${epc.epc_id}/deployment-script`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const script = await response.text();
        
        // Create download
        const blob = new Blob([script], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deploy-epc-${epc.epc_id}.sh`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to download deployment script');
      }
    } catch (err: any) {
      console.error('Error downloading script:', err);
      alert(`Error: ${err.message}`);
    } finally {
      downloadingScript = false;
    }
  }
  
  async function downloadBootISO(epc: any = null) {
    if (!epc) {
      alert('Please register an EPC first, then download its ISO');
      return;
    }
    
    downloadingISO = true;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      
      // Call ISO Generation API via Cloud Function proxy
      const response = await fetch(`${ISO_PROXY}/api/epc/${epc.epc_id}/generate-iso`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          auth_code: epc.auth_code,
          api_key: epc.api_key,
          secret_key: epc.secret_key,
          site_name: epc.site_name
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Show download information
        const message = `✅ ISO Generated Successfully!

EPC: ${epc.site_name} (${epc.epc_id})
File: ${data.iso_filename}
Size: ~${data.size_mb}MB

Download URL:
${data.download_url}

Checksum:
${data.checksum_url}

This ISO contains:
• Unique EPC credentials embedded
• Auto-connects to HSS at ${HSS_IP}:${HSS_PORT}
• Downloads full deployment from GCE server on first boot
• Fully automated installation

To use:
1. Download the ISO
2. Burn to USB: dd if=${data.iso_filename} of=/dev/sdX bs=4M
3. Boot target hardware from USB
4. System automatically deploys and connects!

The ISO will download the full deployment script from the GCE server during installation.`;
        
        alert(message);
        
        // Optionally open download URL
        if (confirm('Open download URL in new tab?')) {
          window.open(data.download_url, '_blank');
        }
      } else {
        const error = await response.json();
        alert(`Failed to generate ISO: ${error.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error:', err);
      alert(`Error generating ISO: ${err.message}`);
    } finally {
      downloadingISO = false;
    }
  }
  
  function getStatusColor(status: string) {
    switch (status) {
      case 'online': return 'var(--status-online)';
      case 'offline': return 'var(--status-offline)';
      case 'registered': return 'var(--status-warning)';
      default: return 'var(--text-secondary)';
    }
  }
  
  function formatDate(date: any) {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  }
</script>

<div class="deploy-epc">
  <div class="deploy-header">
    <div class="header-content">
      <div>
        <h2>🚀 Deploy Remote EPC</h2>
        <p class="subtitle">Deploy distributed EPC nodes connected to Cloud HSS ({HSS_IP}:{HSS_PORT})</p>
      </div>
      <button class="btn-primary" on:click={openRegisterModal}>
        ➕ Register New EPC
      </button>
    </div>
  </div>
  
  <!-- Deployment Method Selection -->
  <div class="deployment-methods">
    <div class="method-card" class:active={deploymentMethod === 'script'}>
      <button class="method-button" on:click={() => deploymentMethod = 'script'}>
        <div class="method-icon">📜</div>
        <h3>Deployment Script</h3>
        <p>Download bash script for manual installation on existing Ubuntu system</p>
        <ul class="method-features">
          <li>✅ For existing Ubuntu 24.04 servers</li>
          <li>✅ Quick deployment (10-15 min)</li>
          <li>✅ Per-EPC configuration</li>
          <li>✅ Auto-connects to Cloud HSS</li>
        </ul>
      </button>
    </div>
    
    <div class="method-card" class:active={deploymentMethod === 'iso'}>
      <button class="method-button" on:click={() => deploymentMethod = 'iso'}>
        <div class="method-icon">💿</div>
        <h3>Boot Disc ISO</h3>
        <p>Create bootable USB for zero-touch deployment on bare metal</p>
        <ul class="method-features">
          <li>✅ Boots any x86_64 hardware</li>
          <li>✅ Fully automated (20 min)</li>
          <li>✅ Tenant-specific</li>
          <li>✅ DHCP auto-configuration</li>
        </ul>
      </button>
    </div>
  </div>
  
  <!-- Instructions based on selected method -->
  {#if deploymentMethod === 'script'}
    <div class="instructions-panel">
      <h3>📜 Deployment Script Method</h3>
      <p>Download and run deployment script on your Ubuntu 24.04 server:</p>
      
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4>Register EPC</h4>
            <p>Click "Register New EPC" above to create a new EPC configuration</p>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4>Download Script</h4>
            <p>Download the deployment script from the EPC list below</p>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4>Run on Server</h4>
            <code>
              scp deploy-epc-*.sh root@your-server:/root/<br/>
              ssh root@your-server<br/>
              bash /root/deploy-epc-*.sh
            </code>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">4</div>
          <div class="step-content">
            <h4>Monitor Status</h4>
            <p>Check "Remote EPCs" tab to see your EPC come online</p>
          </div>
        </div>
      </div>
      
      <div class="info-box">
        <strong>ℹ️ HSS Configuration:</strong><br/>
        All EPCs will automatically connect to:<br/>
        • <strong>Hostname:</strong> {HSS_HOSTNAME}<br/>
        • <strong>IP:</strong> {HSS_IP}<br/>
        • <strong>Port:</strong> {HSS_PORT} (HSS Management API)<br/>
        • <strong>Protocol:</strong> Diameter (S6a interface)
      </div>
    </div>
  {:else}
    <div class="instructions-panel">
      <h3>💿 Boot Disc ISO Method</h3>
      <p>Generate small bootable ISO with unique EPC credentials - downloads full deployment on first boot</p>
      
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4>Register EPC</h4>
            <p>Click "Register New EPC" above to create EPC configuration with unique credentials</p>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4>Generate ISO</h4>
            <p>Find your EPC below and click the "💿 ISO" button</p>
            <p>The GCE server ({HSS_IP}) will generate a small ISO (~150MB) with:</p>
            <ul>
              <li>✅ Unique EPC credentials embedded</li>
              <li>✅ Tenant ID included</li>
              <li>✅ Bootstrap script that downloads full deployment</li>
            </ul>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4>Download & Burn to USB</h4>
            <p>Download the generated ISO and burn to USB:</p>
            <code>
              curl -O http://{HSS_IP}/downloads/isos/wisptools-epc-*.iso<br/>
              sudo dd if=wisptools-epc-*.iso of=/dev/sdX bs=4M status=progress && sync
            </code>
            <p class="note">Replace /dev/sdX with your USB device (check with lsblk)</p>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">4</div>
          <div class="step-content">
            <h4>Boot & Auto-Deploy</h4>
            <p>Boot target hardware from USB. System will automatically:</p>
            <ul>
              <li>🔧 Install Ubuntu 24.04 (5-10 min)</li>
              <li>🌐 Get IP via DHCP</li>
              <li>📥 Download full deployment from GCE ({HSS_IP})</li>
              <li>⚙️ Install Open5GS components</li>
              <li>🔌 Connect to Cloud HSS at {HSS_IP}:{HSS_PORT}</li>
              <li>📊 Start reporting metrics</li>
            </ul>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">5</div>
          <div class="step-content">
            <h4>Monitor Status</h4>
            <p>Check dashboard - EPC automatically appears online!</p>
          </div>
        </div>
      </div>
      
      <div class="info-box">
        <strong>💡 How It Works:</strong><br/>
        • Small ISO (~150MB) contains only Ubuntu base + credentials<br/>
        • On first boot, downloads full deployment script from GCE server<br/>
        • Unique code per EPC ensures proper authentication<br/>
        • All files hosted on GCE server ({HSS_IP})<br/>
        • No manual configuration needed!
      </div>
      
      <div class="info-box warning">
        <strong>⚠️ Requirements:</strong><br/>
        • Target: x86_64 hardware, 4GB+ RAM, 20GB+ storage<br/>
        • Network: DHCP-enabled with internet access<br/>
        • Connectivity: Must reach GCE server at {HSS_IP}
      </div>
    </div>
  {/if}
  
  <!-- Registered EPCs List -->
  <div class="epcs-section">
    <h3>📡 Registered EPCs</h3>
    
    {#if loading}
      <div class="loading">Loading EPCs...</div>
    {:else if epcs.length === 0}
      <div class="empty-state">
        <p>No EPCs registered yet.</p>
        <button class="btn-primary" on:click={openRegisterModal}>
          Register Your First EPC
        </button>
      </div>
    {:else}
      <div class="epcs-grid">
        {#each epcs as epc}
          <div class="epc-card">
            <div class="epc-header">
              <div class="epc-info">
                <h4>{epc.site_name}</h4>
                <span class="epc-id">{epc.epc_id}</span>
              </div>
              <div class="epc-status" style="background: {getStatusColor(epc.status)}">
                {epc.status}
              </div>
            </div>
            
            <div class="epc-details">
              <div class="detail-row">
                <span class="label">Location:</span>
                <span>{epc.location?.city || 'Not specified'}, {epc.location?.state || ''}</span>
              </div>
              <div class="detail-row">
                <span class="label">MCC/MNC:</span>
                <span>{epc.network_config?.mcc}/{epc.network_config?.mnc}</span>
              </div>
              <div class="detail-row">
                <span class="label">TAC:</span>
                <span>{epc.network_config?.tac}</span>
              </div>
              <div class="detail-row">
                <span class="label">Last Seen:</span>
                <span>{formatDate(epc.last_heartbeat)}</span>
              </div>
            </div>
            
            <div class="epc-actions">
              <button 
                class="btn-action btn-script"
                on:click={() => downloadDeploymentScript(epc)}
                disabled={downloadingScript}
                title="Download deployment script for existing Ubuntu server"
              >
                {#if downloadingScript}
                  ⏳
                {:else}
                  📜 Script
                {/if}
              </button>
              <button 
                class="btn-action btn-iso"
                on:click={() => downloadBootISO(epc)}
                disabled={downloadingISO}
                title="Generate bootable ISO with embedded credentials"
              >
                {#if downloadingISO}
                  ⏳
                {:else}
                  💿 ISO
                {/if}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Register EPC Modal -->
{#if showRegisterModal}
  <div class="modal-overlay" on:click={closeRegisterModal}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Register New Remote EPC</h3>
        <button class="close-btn" on:click={closeRegisterModal}>✕</button>
      </div>
      
      {#if registrationError}
        <div class="error-banner">
          ⚠️ {registrationError}
        </div>
      {/if}
      
      <div class="modal-body">
        <div class="form-group">
          <label>Select Site *</label>
          {#if loadingSites}
            <p class="loading-text">Loading sites...</p>
          {:else if sites.length === 0}
            <p class="info-text">⚠️ No sites found. Please create a tower site first in the Coverage Map module.</p>
            <input 
              type="text" 
              bind:value={formData.site_name} 
              on:input={() => registrationError = ''}
              placeholder="Or enter site name manually" 
            />
          {:else}
            <select bind:value={selectedSiteId} on:change={handleSiteSelect}>
              <option value="">-- Select a site --</option>
              {#each sites as site}
                <option value={site._id || site.id}>
                  {site.name || site.siteName || 'Unnamed Site'} 
                  {#if site.location?.city}
                    - {site.location.city}, {site.location.state || ''}
                  {/if}
                </option>
              {/each}
            </select>
            <small class="form-hint">Selected site: {formData.site_name || 'None'}</small>
          {/if}
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>City</label>
            <input type="text" bind:value={formData.location.city} placeholder="New York" />
          </div>
          <div class="form-group">
            <label>State</label>
            <input type="text" bind:value={formData.location.state} placeholder="NY" />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Latitude *</label>
            <input type="number" step="0.0001" bind:value={formData.location.coordinates.latitude} placeholder="40.7128" />
          </div>
          <div class="form-group">
            <label>Longitude *</label>
            <input type="number" step="0.0001" bind:value={formData.location.coordinates.longitude} placeholder="-74.0060" />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>MCC</label>
            <input type="text" bind:value={formData.network_config.mcc} placeholder="001" />
          </div>
          <div class="form-group">
            <label>MNC</label>
            <input type="text" bind:value={formData.network_config.mnc} placeholder="01" />
          </div>
          <div class="form-group">
            <label>TAC</label>
            <input type="text" bind:value={formData.network_config.tac} placeholder="1" />
          </div>
        </div>
        
        <div class="info-box">
          <strong>🔒 Cloud HSS Connection:</strong><br/>
          This EPC will automatically connect to:<br/>
          • HSS: {HSS_IP}:{HSS_PORT}<br/>
          • Hostname: {HSS_HOSTNAME}<br/>
          • Protocol: Diameter S6a
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeRegisterModal}>Cancel</button>
        <button class="btn-primary" on:click={registerNewEPC}>Register EPC</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .deploy-epc {
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .deploy-header {
    margin-bottom: 2rem;
  }
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 1rem;
  }
  
  .header-content h2 {
    margin: 0;
    font-size: 1.75rem;
    color: var(--text-primary);
  }
  
  .subtitle {
    margin: 0.5rem 0 0 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }
  
  .deployment-methods {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .method-card {
    border: 2px solid var(--border-color);
    border-radius: 12px;
    transition: all 0.3s;
  }
  
  .method-card.active {
    border-color: var(--brand-primary);
    box-shadow: 0 4px 12px rgba(0, 100, 255, 0.2);
  }
  
  .method-button {
    width: 100%;
    background: none;
    border: none;
    padding: 1.5rem;
    text-align: left;
    cursor: pointer;
  }
  
  .method-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .method-button h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .method-button p {
    margin: 0 0 1rem 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .method-features {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .method-features li {
    padding: 0.25rem 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .instructions-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 2rem;
    margin-bottom: 2rem;
  }
  
  .instructions-panel h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }
  
  .instructions-panel > p {
    margin-bottom: 1.5rem;
    color: var(--text-secondary);
  }
  
  .steps {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .step {
    display: flex;
    gap: 1rem;
  }
  
  .step-number {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    background: var(--brand-primary);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
  }
  
  .step-content h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .step-content p {
    margin: 0.5rem 0;
    color: var(--text-secondary);
  }
  
  .step-content code {
    display: block;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 1rem;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    line-height: 1.6;
    overflow-x: auto;
    margin: 0.5rem 0;
  }
  
  .step-content ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  
  .step-content li {
    margin: 0.25rem 0;
    color: var(--text-secondary);
  }
  
  .note {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .info-box {
    background: #e3f2fd;
    border: 1px solid #90caf9;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    font-size: 0.9rem;
  }
  
  .info-box.warning {
    background: #fff3e0;
    border-color: #ffb74d;
  }
  
  .epcs-section {
    margin-top: 3rem;
  }
  
  .epcs-section h3 {
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .epcs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }
  
  .epc-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
  }
  
  .epc-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 1rem;
  }
  
  .epc-info h4 {
    margin: 0;
    color: var(--text-primary);
  }
  
  .epc-id {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: monospace;
  }
  
  .epc-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    color: white;
    text-transform: uppercase;
    font-weight: 600;
  }
  
  .epc-details {
    margin-bottom: 1rem;
  }
  
  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0;
    font-size: 0.85rem;
  }
  
  .detail-row .label {
    color: var(--text-secondary);
  }
  
  .epc-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-action {
    flex: 1;
    padding: 0.5rem 1rem;
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  
  .btn-action:hover:not(:disabled) {
    background: var(--brand-primary-dark);
  }
  
  .btn-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
  }
  
  .btn-primary:hover {
    background: var(--brand-primary-dark);
  }
  
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
  }
  
  .btn-secondary:hover {
    background: var(--bg-hover);
  }
  
  .btn-large {
    padding: 1rem 2rem;
    font-size: 1.1rem;
  }
  
  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }
  
  .empty-state p {
    margin-bottom: 1rem;
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
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h3 {
    margin: 0;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
  }
  
  .close-btn:hover {
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 1rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .form-hint {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .loading-text {
    color: var(--text-secondary);
    font-style: italic;
    padding: 0.75rem;
    margin: 0;
  }
  
  .info-text {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 0.75rem;
    font-size: 0.9rem;
  }
  
  .error-banner {
    background: #ef4444;
    color: white;
    padding: 1rem;
    margin: 0;
    font-weight: 500;
    text-align: center;
    border-bottom: 1px solid var(--border-color);
  }
  
  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  @media (max-width: 768px) {
    .deployment-methods {
      grid-template-columns: 1fr;
    }
    
    .header-content {
      flex-direction: column;
    }
    
    .epcs-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

