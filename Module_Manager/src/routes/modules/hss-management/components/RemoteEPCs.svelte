<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { auth, db } from '$lib/firebase';
  import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
  import EPCMonitor from './EPCMonitor.svelte';
  
  export let tenantId: string;
  export let HSS_API: string;
  
  let epcs: any[] = [];
  let loading = true;
  let showAddModal = false;
  let showDetailsModal = false;
  let showMonitorModal = false;
  let showCreateSiteModal = false;
  let selectedEPC: any = null;
  let monitoringEPCId: string = '';
  let statusFilter = 'all';
  let viewMode = 'list'; // 'list' or 'monitor'
  let downloadingISO = false;
  let sites: any[] = [];
  let selectedSiteId = '';
  let loadingSites = true;
  
  // ISO API configuration
  const HSS_IP = '136.112.111.167';
  const ISO_API_PORT = '3002';
  const ISO_PROXY = 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/isoProxy';
  // Use Firebase data directly via Firestore instead of API proxy
  const NETWORK_API = 'https://lte-pci-mapper-65450042-bbf71.firebaseapp.com';
  
  // Form data for new EPC
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
      tac: '1'
    },
    contact: {
      name: '',
      email: '',
      phone: ''
    }
  };
  
  // Auto-refresh interval
  let refreshInterval: any = null;
  
  onMount(async () => {
    await Promise.all([loadEPCs(), loadSites()]);
    
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(loadEPCs, 30000);
    
    // Check for URL parameters from coverage map (one-time check on mount)
    const siteId = $page.url.searchParams.get('siteId');
    const siteName = $page.url.searchParams.get('siteName');
    const lat = $page.url.searchParams.get('lat');
    const lon = $page.url.searchParams.get('lon');
    
    if (siteId && siteName) {
      console.log('[RemoteEPCs] URL params detected:', { siteId, siteName, lat, lon });
      
      formData.site_name = siteName;
      
      // Wait for sites to load, then try to find the site
      setTimeout(() => {
        if (sites.length > 0) {
          const foundSite = sites.find(s => s.name === siteName || s.id === siteId);
          if (foundSite) {
            selectedSiteId = foundSite.id;
            handleSiteSelect(foundSite.id);
          }
        }
        
        // Open the registration modal
        showAddModal = true;
      }, 1000);
    }
  });
  
  async function loadSites() {
    try {
      console.log('[RemoteEPCs] Loading sites from Firestore, Tenant ID:', tenantId);
      
      if (!tenantId) {
        console.log('[RemoteEPCs] No tenant ID, skipping site load');
        loadingSites = false;
        return;
      }
      
      // Query sites from Firestore
      const sitesRef = collection(db(), 'networkSites');
      const q = query(sitesRef, where('tenant_id', '==', tenantId));
      const querySnapshot = await getDocs(q);
      
      sites = querySnapshot.docs.map(doc => ({
        id: doc.id,
        _id: doc.id,
        ...doc.data()
      }));
      
      console.log('[RemoteEPCs] Loaded sites from Firestore:', sites.length);
    } catch (err: any) {
      console.error('[RemoteEPCs] Error loading sites:', err);
    } finally {
      loadingSites = false;
    }
  }
  
  // Site creation data
  let newSiteData = {
    name: '',
    address: '',
    city: '',
    state: '',
    country: 'USA',
    coordinates: {
      latitude: 0,
      longitude: 0
    }
  };
  let creatingSite = false;
  
  function handleSiteSelect() {
    if (selectedSiteId === 'create-new') {
      showCreateSiteModal = true;
      return;
    }
    
    const site = sites.find(s => (s._id || s.id) === selectedSiteId);
    if (site) {
      formData.site_name = site.name || site.siteName || '';
      formData.location.city = site.location?.city || '';
      formData.location.state = site.location?.state || '';
      formData.location.coordinates.latitude = site.location?.coordinates?.latitude || 0;
      formData.location.coordinates.longitude = site.location?.coordinates?.longitude || 0;
    }
  }
  
  async function createNewSite() {
    if (!newSiteData.name || !newSiteData.coordinates.latitude || !newSiteData.coordinates.longitude) {
      alert('Site name and GPS coordinates are required');
      return;
    }
    
    creatingSite = true;
    
    try {
      // Add site to Firestore
      const sitesRef = collection(db(), 'networkSites');
      const newSite = {
        name: newSiteData.name,
        tenant_id: tenantId,
        location: {
          address: newSiteData.address,
          city: newSiteData.city,
          state: newSiteData.state,
          country: newSiteData.country,
          coordinates: {
            latitude: newSiteData.coordinates.latitude,
            longitude: newSiteData.coordinates.longitude
          }
        },
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const docRef = await addDoc(sitesRef, newSite);
      
      // Add to sites list with ID
      const siteWithId = {
        id: docRef.id,
        _id: docRef.id,
        ...newSite
      };
      sites = [...sites, siteWithId];
      
      // Auto-select the new site
      selectedSiteId = docRef.id;
      handleSiteSelect();
      
      // Close modal
      showCreateSiteModal = false;
      
      alert(`✅ Site "${newSiteData.name}" created successfully!`);
    } catch (err: any) {
      console.error('Error creating site:', err);
      alert(`Error: ${err.message}`);
    } finally {
      creatingSite = false;
    }
  }
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
  
  async function loadEPCs() {
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const url = statusFilter === 'all' 
        ? `${HSS_API}/epc/list`
        : `${HSS_API}/epc/list?status=${statusFilter}`;
      
      const response = await fetch(url, {
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
  
  async function registerEPC() {
    console.log('[RemoteEPCs] Registering EPC:', formData);
    console.log('[RemoteEPCs] Selected site ID:', selectedSiteId);
    console.log('[RemoteEPCs] Available sites:', sites);
    
    // Validate required fields
    if (!formData.site_name && !selectedSiteId) {
      alert('Please select a site or enter a site name');
      return;
    }
    
    // Auto-populate site_name from selected site if not already set
    if (!formData.site_name && selectedSiteId) {
      const selectedSite = sites.find(s => (s._id || s.id) === selectedSiteId);
      if (selectedSite) {
        formData.site_name = selectedSite.name || selectedSite.siteName || 'Unknown Site';
      }
    }
    
    if (!formData.location.coordinates.latitude || !formData.location.coordinates.longitude) {
      alert('GPS coordinates (latitude and longitude) are required');
      return;
    }
    
    try {
      // Wait for auth state to be ready (max 5 seconds)
      let user = auth().currentUser;
      if (!user) {
        console.log('[RemoteEPCs] Waiting for auth state...');
        await new Promise(resolve => {
          const unsubscribe = auth().onAuthStateChanged((authUser) => {
            unsubscribe();
            resolve(authUser);
          });
          // Timeout after 5 seconds
          setTimeout(() => {
            unsubscribe();
            resolve(null);
          }, 5000);
        });
        user = auth().currentUser;
      }
      
      if (!user) {
        console.error('[RemoteEPCs] Still not authenticated after waiting');
        alert('Authentication is still loading. Please wait a moment and try again.');
        return;
      }
      
      const token = await user.getIdToken();
      console.log('[RemoteEPCs] Sending registration request...');
      
      const response = await fetch(`${HSS_API}/epc/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      console.log('[RemoteEPCs] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[RemoteEPCs] EPC registered:', data);
        
        showAddModal = false;
        await loadEPCs();
        
        // Show the newly created EPC with credentials
        const newEPC = epcs.find(e => e.epc_id === data.epc_id);
        if (newEPC) {
          selectedEPC = { ...newEPC, ...data };
          showDetailsModal = true;
        }
        
        // Reset form
        resetForm();
        
        alert(`✅ EPC "${formData.site_name}" registered successfully!\n\nYour credentials are displayed in the details modal. Please save them securely.`);
      } else {
        const error = await response.json();
        console.error('[RemoteEPCs] Registration failed:', error);
        alert('Failed to register EPC: ' + (error.error || error.message || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('[RemoteEPCs] Error registering EPC:', err);
      alert('Failed to register EPC: ' + err.message + '\n\nCheck console for details.');
    }
  }
  
  async function downloadDeploymentScript(epc: any) {
    // Show requirement notice before download
    const confirmed = confirm(
      '⚠️ REQUIREMENT NOTICE\n\n' +
      'This deployment script REQUIRES Ubuntu 22.04 LTS Server.\n\n' +
      '• The script will verify Ubuntu 22.04 LTS before proceeding\n' +
      '• Open5GS packages are optimized for Ubuntu 22.04 LTS\n' +
      '• Other versions may not work correctly\n\n' +
      'Do you have Ubuntu 22.04 LTS installed?\n' +
      'Click OK to download, or Cancel to install Ubuntu 22.04 LTS first.'
    );
    
    if (!confirmed) {
      window.open('https://ubuntu.com/download/server', '_blank');
      return;
    }
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
        const blob = new Blob([script], { type: 'text/x-shellscript' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deploy-epc-${epc.site_name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.sh`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to generate deployment script');
      }
    } catch (err: any) {
      console.error('Error downloading script:', err);
      alert('Failed to download script: ' + err.message);
    }
  }
  
  async function downloadBootISO(epc: any) {
    if (!epc) {
      alert('Please register an EPC first');
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
          site_name: epc.site_name,
          hss_id: tenantId // Ensure tenant-specific HSS
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        alert(`✅ ISO Generated Successfully!
        
EPC: ${epc.site_name} (${epc.epc_id})
File: ${data.iso_filename}
Size: ~${data.size_mb}MB

Download: ${data.download_url}

To use:
1. Download the ISO
2. Burn to USB: dd if=${data.iso_filename} of=/dev/sdX bs=4M
3. Boot from USB
4. System will automatically deploy!`);
        
        // Open download URL
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
  
  function viewEPCDetails(epc: any) {
    selectedEPC = epc;
    showDetailsModal = true;
  }
  
  function monitorEPC(epc: any) {
    monitoringEPCId = epc.epc_id;
    viewMode = 'monitor';
  }
  
  function monitorAll() {
    monitoringEPCId = 'all';
    viewMode = 'monitor';
  }
  
  function backToList() {
    viewMode = 'list';
    monitoringEPCId = '';
  }
  
  async function deleteEPC(epc: any) {
    if (!confirm(`Are you sure you want to delete EPC site "${epc.site_name}"?`)) {
      return;
    }
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      
      const response = await fetch(`${HSS_API}/epc/${epc.epc_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        await loadEPCs();
      } else {
        alert('Failed to delete EPC');
      }
    } catch (err: any) {
      console.error('Error deleting EPC:', err);
      alert('Failed to delete EPC: ' + err.message);
    }
  }
  
  function resetForm() {
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
        tac: '1'
      },
      contact: {
        name: '',
        email: '',
        phone: ''
      }
    };
  }
  
  function getStatusBadge(status: string) {
    const badges: Record<string, { class: string; label: string }> = {
      'registered': { class: 'status-registered', label: 'Registered' },
      'online': { class: 'status-online', label: 'Online' },
      'offline': { class: 'status-offline', label: 'Offline' },
      'error': { class: 'status-error', label: 'Error' }
    };
    return badges[status] || badges['offline'];
  }
  
  $: filteredEPCs = statusFilter === 'all' 
    ? epcs 
    : epcs.filter(e => e.status === statusFilter);
</script>

<div class="remote-epcs">
  {#if viewMode === 'monitor'}
    <!-- Monitoring View -->
    <div class="monitor-header">
      <button class="back-btn" on:click={backToList}>
        ← Back to List
      </button>
      <h2>📊 EPC Monitoring Dashboard</h2>
    </div>
    <EPCMonitor {tenantId} {HSS_API} epcId={monitoringEPCId} />
  {:else}
    <!-- List View -->
    <div class="header">
      <div>
        <h2>🌐 Remote EPC Sites</h2>
        <p class="subtitle">Manage distributed EPC deployments</p>
      </div>
      <div class="header-actions">
        <button class="monitor-all-btn" on:click={monitorAll}>
          📊 Monitor All
        </button>
        <button class="add-btn" on:click={() => showAddModal = true}>
          ➕ Register New EPC
        </button>
      </div>
    </div>
  
  <!-- Summary Cards -->
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-value">{epcs.length}</div>
      <div class="summary-label">Total Sites</div>
    </div>
    <div class="summary-card online">
      <div class="summary-value">{epcs.filter(e => e.status === 'online').length}</div>
      <div class="summary-label">Online</div>
    </div>
    <div class="summary-card registered">
      <div class="summary-value">{epcs.filter(e => e.status === 'registered').length}</div>
      <div class="summary-label">Registered</div>
    </div>
    <div class="summary-card offline">
      <div class="summary-value">{epcs.filter(e => e.status === 'offline').length}</div>
      <div class="summary-label">Offline</div>
    </div>
  </div>
  
  <!-- Filters -->
  <div class="filters">
    <label>
      <span>Status:</span>
      <select bind:value={statusFilter} on:change={loadEPCs}>
        <option value="all">All</option>
        <option value="online">Online</option>
        <option value="registered">Registered</option>
        <option value="offline">Offline</option>
        <option value="error">Error</option>
      </select>
    </label>
    <button class="refresh-btn" on:click={loadEPCs}>
      🔄 Refresh
    </button>
  </div>
  
  <!-- EPC List -->
  {#if loading}
    <div class="loading">Loading EPCs...</div>
  {:else if filteredEPCs.length === 0}
    <div class="empty-state">
      <h3>No EPC sites found</h3>
      <p>Register your first remote EPC to get started</p>
      <button class="add-btn" on:click={() => showAddModal = true}>
        ➕ Register New EPC
      </button>
    </div>
  {:else}
    <div class="epc-grid">
      {#each filteredEPCs as epc}
        <div class="epc-card">
          <div class="epc-header">
            <div>
              <h3>{epc.site_name}</h3>
              <div class="epc-id">ID: {epc.epc_id}</div>
            </div>
            <span class="status-badge {getStatusBadge(epc.status).class}">
              {getStatusBadge(epc.status).label}
            </span>
          </div>
          
          <div class="epc-details">
            {#if epc.location?.city}
              <div class="detail-row">
                <span class="icon">📍</span>
                <span>{epc.location.city}, {epc.location.state || ''}</span>
              </div>
            {/if}
            
            {#if epc.location?.coordinates}
              <div class="detail-row">
                <span class="icon">🗺️</span>
                <span>{epc.location.coordinates.latitude.toFixed(4)}, {epc.location.coordinates.longitude.toFixed(4)}</span>
              </div>
            {/if}
            
            {#if epc.network_config}
              <div class="detail-row">
                <span class="icon">📡</span>
                <span>MCC: {epc.network_config.mcc} / MNC: {epc.network_config.mnc}</span>
              </div>
            {/if}
            
            {#if epc.last_seen}
              <div class="detail-row">
                <span class="icon">🕐</span>
                <span>Last seen: {new Date(epc.last_seen).toLocaleString()}</span>
              </div>
            {/if}
            
            {#if epc.minutes_since_heartbeat !== undefined}
              <div class="detail-row">
                <span class="icon">💓</span>
                <span>{epc.minutes_since_heartbeat} min since heartbeat</span>
              </div>
            {/if}
          </div>
          
          <div class="epc-actions">
            <button class="btn-primary" on:click={() => monitorEPC(epc)}>
              📊 Monitor
            </button>
            <button class="btn-secondary" on:click={() => downloadDeploymentScript(epc)}>
              📥 Script
            </button>
            <button class="btn-secondary" on:click={() => downloadBootISO(epc)} disabled={downloadingISO}>
              {#if downloadingISO}⏳{:else}💿 ISO{/if}
            </button>
            <button class="btn-secondary" on:click={() => viewEPCDetails(epc)}>
              ℹ️ Details
            </button>
            <button class="btn-danger" on:click={() => deleteEPC(epc)}>
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
  {/if}
</div>

<!-- Add EPC Modal -->
{#if showAddModal}
  <div class="modal-overlay" on:click|self={() => showAddModal = false}>
    <div class="modal">
      <div class="modal-header">
        <h2>Register New EPC Site</h2>
        <button class="close-btn" on:click={() => showAddModal = false}>✕</button>
      </div>
      
      <div class="modal-body">
        <div class="form-section">
          <h3>Site Information</h3>
          <div class="form-group">
            <label>Select Site *</label>
            {#if loadingSites}
              <p class="loading-text">Loading sites...</p>
            {:else if sites.length === 0}
              <select bind:value={selectedSiteId} on:change={handleSiteSelect}>
                <option value="create-new">➕ Create New Site...</option>
              </select>
              <small class="form-hint">No sites available. Select "Create New Site" to add one.</small>
            {:else}
              <div style="display: flex; gap: 0.5rem;">
                <select bind:value={selectedSiteId} on:change={handleSiteSelect} style="flex: 1;">
                  <option value="">-- Select a site --</option>
                  <option value="create-new">➕ Create New Site...</option>
                  {#each sites as site}
                    <option value={site._id || site.id}>
                      {site.name || site.siteName || 'Unnamed Site'} 
                      {#if site.location?.city}
                        - {site.location.city}, {site.location.state || ''}
                      {/if}
                    </option>
                  {/each}
                </select>
                <button type="button" class="btn-secondary" on:click={loadSites} title="Refresh sites">
                  🔄
                </button>
              </div>
              {#if formData.site_name}
                <small class="form-hint">Selected site: {formData.site_name}</small>
              {/if}
              {#if sites.length > 0}
                <small class="form-hint">Found {sites.length} site(s)</small>
              {/if}
            {/if}
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>City</label>
              <input type="text" bind:value={formData.location.city} placeholder="City" />
            </div>
            <div class="form-group">
              <label>State</label>
              <input type="text" bind:value={formData.location.state} placeholder="State" />
            </div>
          </div>
          
          <div class="form-group">
            <label>Address</label>
            <input type="text" bind:value={formData.location.address} placeholder="Street address" />
          </div>
        </div>
        
        <div class="form-section">
          <h3>GPS Coordinates (for map)</h3>
          <div class="form-row">
            <div class="form-group">
              <label>Latitude *</label>
              <input type="number" step="0.0001" bind:value={formData.location.coordinates.latitude} placeholder="40.7128" required />
            </div>
            <div class="form-group">
              <label>Longitude *</label>
              <input type="number" step="0.0001" bind:value={formData.location.coordinates.longitude} placeholder="-74.0060" required />
            </div>
          </div>
          <small>Get coordinates from <a href="https://www.google.com/maps" target="_blank">Google Maps</a></small>
        </div>
        
        <div class="form-section">
          <h3>Network Configuration</h3>
          <div class="form-row">
            <div class="form-group">
              <label>MCC *</label>
              <input type="text" bind:value={formData.network_config.mcc} placeholder="001" required />
            </div>
            <div class="form-group">
              <label>MNC *</label>
              <input type="text" bind:value={formData.network_config.mnc} placeholder="01" required />
            </div>
            <div class="form-group">
              <label>TAC *</label>
              <input type="text" bind:value={formData.network_config.tac} placeholder="1" required />
            </div>
          </div>
        </div>
        
        <div class="form-section">
          <h3>Contact Information</h3>
          <div class="form-group">
            <label>Contact Name</label>
            <input type="text" bind:value={formData.contact.name} placeholder="Site manager name" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Email</label>
              <input type="email" bind:value={formData.contact.email} placeholder="email@example.com" />
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" bind:value={formData.contact.phone} placeholder="+1 (555) 123-4567" />
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button type="button" class="btn-secondary" on:click={() => showAddModal = false}>Cancel</button>
        <button 
          type="button"
          class="btn-primary" 
          on:click={() => {
            console.log('[Register Button] Clicked!');
            console.log('[Register Button] tenantId:', tenantId);
            console.log('[Register Button] formData:', formData);
            registerEPC();
          }}
        >
          Register EPC
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Create New Site Modal -->
{#if showCreateSiteModal}
  <div class="modal-overlay" on:click|self={() => showCreateSiteModal = false}>
    <div class="modal">
      <div class="modal-header">
        <h2>➕ Create New Site</h2>
        <button class="close-btn" on:click={() => showCreateSiteModal = false}>✕</button>
      </div>
      
      <div class="modal-body">
        <div class="form-section">
          <h3>Site Information</h3>
          <div class="form-group">
            <label>Site Name *</label>
            <input type="text" bind:value={newSiteData.name} placeholder="e.g., Main Tower Site" required />
          </div>
          
          <div class="form-group">
            <label>Address</label>
            <input type="text" bind:value={newSiteData.address} placeholder="Street address" />
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>City *</label>
              <input type="text" bind:value={newSiteData.city} placeholder="City" required />
            </div>
            <div class="form-group">
              <label>State *</label>
              <input type="text" bind:value={newSiteData.state} placeholder="State" required />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Latitude *</label>
              <input type="number" step="0.0001" bind:value={newSiteData.coordinates.latitude} placeholder="40.7128" required />
            </div>
            <div class="form-group">
              <label>Longitude *</label>
              <input type="number" step="0.0001" bind:value={newSiteData.coordinates.longitude} placeholder="-74.0060" required />
            </div>
          </div>
          
          <div class="info-box">
            <strong>💡 Tip:</strong> Enter GPS coordinates or use the Coverage Map module to drop a pin and get exact coordinates.
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={() => showCreateSiteModal = false}>
          Cancel
        </button>
        <button class="btn-primary" on:click={createNewSite} disabled={creatingSite}>
          {#if creatingSite}
            ⏳ Creating...
          {:else}
            ✅ Create Site
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- EPC Details Modal -->
{#if showDetailsModal && selectedEPC}
  <div class="modal-overlay" on:click|self={() => showDetailsModal = false}>
    <div class="modal modal-large">
      <div class="modal-header">
        <h2>📊 {selectedEPC.site_name}</h2>
        <button class="close-btn" on:click={() => showDetailsModal = false}>✕</button>
      </div>
      
      <div class="modal-body">
        <div class="details-grid">
          <div class="detail-section">
            <h3>Status</h3>
            <div class="status-large {getStatusBadge(selectedEPC.status).class}">
              {getStatusBadge(selectedEPC.status).label}
            </div>
            {#if selectedEPC.last_heartbeat}
              <p>Last heartbeat: {new Date(selectedEPC.last_heartbeat).toLocaleString()}</p>
            {/if}
          </div>
          
          {#if selectedEPC.auth_code || selectedEPC.api_key}
            <div class="detail-section credentials">
              <h3>🔐 Credentials (Keep Secure!)</h3>
              <div class="credential-item">
                <label>AUTH CODE:</label>
                <code>{selectedEPC.auth_code}</code>
              </div>
              <div class="credential-item">
                <label>API KEY:</label>
                <code>{selectedEPC.api_key}</code>
              </div>
              {#if selectedEPC.secret_key}
                <div class="credential-item">
                  <label>SECRET KEY:</label>
                  <code>{selectedEPC.secret_key}</code>
                </div>
              {/if}
              <button class="btn-primary" on:click={() => downloadDeploymentScript(selectedEPC)}>
                📥 Download Deployment Script
              </button>
            </div>
          {/if}
          
          <div class="detail-section">
            <h3>Location</h3>
            <p><strong>Address:</strong> {selectedEPC.location?.address || 'N/A'}</p>
            <p><strong>City:</strong> {selectedEPC.location?.city || 'N/A'}, {selectedEPC.location?.state || ''}</p>
            {#if selectedEPC.location?.coordinates}
              <p><strong>Coordinates:</strong> {selectedEPC.location.coordinates.latitude}, {selectedEPC.location.coordinates.longitude}</p>
            {/if}
          </div>
          
          <div class="detail-section">
            <h3>Network Config</h3>
            <p><strong>MCC:</strong> {selectedEPC.network_config?.mcc || 'N/A'}</p>
            <p><strong>MNC:</strong> {selectedEPC.network_config?.mnc || 'N/A'}</p>
            <p><strong>TAC:</strong> {selectedEPC.network_config?.tac || 'N/A'}</p>
          </div>
          
          {#if selectedEPC.version}
            <div class="detail-section">
              <h3>Version Info</h3>
              <p><strong>Open5GS:</strong> {selectedEPC.version.open5gs || 'N/A'}</p>
              <p><strong>Agent:</strong> {selectedEPC.version.metrics_agent || 'N/A'}</p>
              <p><strong>OS:</strong> {selectedEPC.version.os || 'N/A'}</p>
            </div>
          {/if}
          
          {#if selectedEPC.contact?.name || selectedEPC.contact?.email}
            <div class="detail-section">
              <h3>Contact</h3>
              <p><strong>Name:</strong> {selectedEPC.contact.name || 'N/A'}</p>
              <p><strong>Email:</strong> {selectedEPC.contact.email || 'N/A'}</p>
              <p><strong>Phone:</strong> {selectedEPC.contact.phone || 'N/A'}</p>
            </div>
          {/if}
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={() => showDetailsModal = false}>Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .remote-epcs {
    padding: 0;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }
  
  .header-actions {
    display: flex;
    gap: 1rem;
  }
  
  .monitor-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .monitor-header h2 {
    margin: 0;
  }
  
  .back-btn {
    padding: 0.75rem 1.5rem;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
  }
  
  .back-btn:hover {
    background: var(--border-color);
  }
  
  .monitor-all-btn {
    padding: 0.75rem 1.5rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
  }
  
  .monitor-all-btn:hover {
    background: var(--primary-hover);
  }
  
  .header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
  }
  
  .subtitle {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0;
  }
  
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .summary-card {
    background: white;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
  }
  
  .summary-card.online {
    border-left: 4px solid var(--success);
  }
  
  .summary-card.registered {
    border-left: 4px solid var(--primary);
  }
  
  .summary-card.offline {
    border-left: 4px solid var(--danger);
  }
  
  .summary-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
  }
  
  .summary-label {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .filters {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .filters label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  
  .filters select {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
  }
  
  .epc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }
  
  .epc-card {
    background: white;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    transition: box-shadow 0.2s;
  }
  
  .epc-card:hover {
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }
  
  .epc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-light);
  }
  
  .epc-header h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.125rem;
  }
  
  .epc-id {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: monospace;
  }
  
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .status-registered {
    background: var(--primary-light);
    color: var(--primary);
  }
  
  .status-online {
    background: #d1fae5;
    color: #065f46;
  }
  
  .status-offline {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .status-error {
    background: #fef3c7;
    color: #92400e;
  }
  
  .epc-details {
    margin-bottom: 1rem;
  }
  
  .detail-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    color: #4b5563;
  }
  
  .detail-row .icon {
    font-size: 1rem;
  }
  
  .epc-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .epc-actions button {
    flex: 1;
    min-width: 100px;
    padding: 0.5rem;
    font-size: 0.875rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary-hover);
    color: white;
  }
  
  .btn-primary:hover {
    background: #1d4ed8;
  }
  
  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--border-color);
  }
  
  .btn-danger {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .btn-danger:hover {
    background: #fecaca;
  }
  
  .add-btn, .refresh-btn {
    padding: 0.75rem 1.5rem;
    background: var(--primary-hover);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
  }
  
  .add-btn:hover, .refresh-btn:hover {
    background: #1d4ed8;
  }
  
  .refresh-btn {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .refresh-btn:hover {
    background: var(--border-color);
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }
  
  .empty-state h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .empty-state p {
    margin: 0 0 1.5rem 0;
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
    padding: 1rem;
  }
  
  .modal {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .modal-large {
    max-width: 800px;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .close-btn:hover {
    color: #4b5563;
  }
  
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }
  
  .form-section {
    margin-bottom: 2rem;
  }
  
  .form-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: var(--text-primary);
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
  
  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }
  
  .form-section small {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }
  
  .form-section small a {
    color: #2563eb;
    text-decoration: none;
  }
  
  .details-grid {
    display: grid;
    gap: 1.5rem;
  }
  
  .detail-section {
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
  }
  
  .detail-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
  }
  
  .detail-section p {
    margin: 0.5rem 0;
    font-size: 0.875rem;
  }
  
  .status-large {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    text-align: center;
    margin-bottom: 1rem;
  }
  
  .credentials {
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
  }
  
  .credential-item {
    margin-bottom: 1rem;
  }
  
  .credential-item label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: #92400e;
    margin-bottom: 0.25rem;
  }
  
  .credential-item code {
    display: block;
    padding: 0.5rem;
    background: white;
    border: 1px solid #fcd34d;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
    word-break: break-all;
  }
  
  @media (max-width: 768px) {
    .epc-grid {
      grid-template-columns: 1fr;
    }
    
    .summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>

