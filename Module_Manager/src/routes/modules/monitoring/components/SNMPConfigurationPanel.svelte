<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  const dispatch = createEventDispatcher();
  
  export let show = false;
  
  // SNMP Configuration State
  let snmpConfig = {
    // Global SNMP Settings
    defaultCommunity: 'public',
    defaultPort: 161,
    defaultTimeout: 5000,
    defaultRetries: 3,
    
    // SNMPv3 Global Settings
    defaultAuthProtocol: 'SHA',
    defaultPrivProtocol: 'AES',
    
    // Network Subnets for Auto-Discovery
    discoverySubnets: [
      { subnet: '192.168.1.0/24', enabled: true, description: 'Management Network' },
      { subnet: '10.0.0.0/8', enabled: false, description: 'Private Network' },
      { subnet: '172.16.0.0/12', enabled: false, description: 'Private Network' }
    ],
    
    // Community String Profiles
    communityProfiles: [
      { 
        name: 'default', 
        community: 'public', 
        access: 'read-only',
        description: 'Default read-only community',
        subnets: ['0.0.0.0/0']
      },
      { 
        name: 'monitoring', 
        community: 'monitor123', 
        access: 'read-only',
        description: 'Monitoring systems',
        subnets: ['192.168.1.0/24']
      }
    ],
    
    // SNMPv3 User Profiles
    v3UserProfiles: [
      {
        name: 'admin',
        username: 'snmpadmin',
        authProtocol: 'SHA',
        authKey: '',
        privProtocol: 'AES',
        privKey: '',
        access: 'read-write',
        description: 'Administrative access',
        subnets: ['192.168.1.0/24']
      },
      {
        name: 'monitor',
        username: 'snmpmonitor',
        authProtocol: 'SHA',
        authKey: '',
        privProtocol: 'AES',
        privKey: '',
        access: 'read-only',
        description: 'Monitoring access',
        subnets: ['0.0.0.0/0']
      }
    ],
    
    // Device-Specific Overrides
    deviceOverrides: [],
    
    // Auto-Discovery Settings
    autoDiscovery: {
      enabled: true,
      scanInterval: 3600000, // 1 hour
      scanPorts: [161, 1161],
      scanCommunities: ['public', 'private', 'monitor'],
      maxConcurrent: 50,
      excludeRanges: ['127.0.0.0/8', '169.254.0.0/16']
    }
  };
  
  let activeTab = 'communities';
  let loading = false;
  let saving = false;
  let testingConnection = false;
  let testResults = null;
  
  // New item forms
  let newCommunity = {
    name: '',
    community: '',
    access: 'read-only',
    description: '',
    subnets: ['']
  };
  
  let newV3User = {
    name: '',
    username: '',
    authProtocol: 'SHA',
    authKey: '',
    privProtocol: 'AES',
    privKey: '',
    access: 'read-only',
    description: '',
    subnets: ['']
  };
  
  let newSubnet = {
    subnet: '',
    enabled: true,
    description: ''
  };
  
  let newDeviceOverride = {
    deviceId: '',
    ipAddress: '',
    snmpVersion: '2c',
    community: '',
    username: '',
    authKey: '',
    privKey: '',
    port: 161,
    description: ''
  };
  
  onMount(async () => {
    if ($currentTenant) {
      await loadSNMPConfiguration();
    }
  });
  
  async function loadSNMPConfiguration() {
    loading = true;
    try {
      const response = await fetch('/api/snmp/configuration', {
        headers: {
          'x-tenant-id': $currentTenant?.id || ''
        }
      });
      
      if (response.ok) {
        const config = await response.json();
        snmpConfig = { ...snmpConfig, ...config };
      } else {
        const errorBody = await response.json().catch(() => ({}));
        console.warn('SNMP configuration load failed:', errorBody);
      }
    } catch (error) {
      console.error('Failed to load SNMP configuration:', error);
    } finally {
      loading = false;
    }
  }
  
  async function saveSNMPConfiguration() {
    saving = true;
    try {
      const response = await fetch('/api/snmp/configuration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': $currentTenant?.id || ''
        },
        body: JSON.stringify(snmpConfig)
      });
      
      if (response.ok) {
        dispatch('configurationSaved');
        alert('SNMP configuration saved successfully');
      } else {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save SNMP configuration:', error);
      alert(error.message || 'Failed to save SNMP configuration');
    } finally {
      saving = false;
    }
  }
  
  function addCommunityProfile() {
    if (newCommunity.name && newCommunity.community) {
      snmpConfig.communityProfiles = [...snmpConfig.communityProfiles, { ...newCommunity }];
      newCommunity = {
        name: '',
        community: '',
        access: 'read-only',
        description: '',
        subnets: ['']
      };
    }
  }
  
  function removeCommunityProfile(index) {
    snmpConfig.communityProfiles = snmpConfig.communityProfiles.filter((_, i) => i !== index);
  }
  
  function addV3UserProfile() {
    if (newV3User.name && newV3User.username) {
      snmpConfig.v3UserProfiles = [...snmpConfig.v3UserProfiles, { ...newV3User }];
      newV3User = {
        name: '',
        username: '',
        authProtocol: 'SHA',
        authKey: '',
        privProtocol: 'AES',
        privKey: '',
        access: 'read-only',
        description: '',
        subnets: ['']
      };
    }
  }
  
  function removeV3UserProfile(index) {
    snmpConfig.v3UserProfiles = snmpConfig.v3UserProfiles.filter((_, i) => i !== index);
  }
  
  function addDiscoverySubnet() {
    if (newSubnet.subnet) {
      snmpConfig.discoverySubnets = [...snmpConfig.discoverySubnets, { ...newSubnet }];
      newSubnet = {
        subnet: '',
        enabled: true,
        description: ''
      };
    }
  }
  
  function removeDiscoverySubnet(index) {
    snmpConfig.discoverySubnets = snmpConfig.discoverySubnets.filter((_, i) => i !== index);
  }
  
  function addDeviceOverride() {
    if (newDeviceOverride.ipAddress) {
      snmpConfig.deviceOverrides = [...snmpConfig.deviceOverrides, { ...newDeviceOverride }];
      newDeviceOverride = {
        deviceId: '',
        ipAddress: '',
        snmpVersion: '2c',
        community: '',
        username: '',
        authKey: '',
        privKey: '',
        port: 161,
        description: ''
      };
    }
  }
  
  function removeDeviceOverride(index) {
    snmpConfig.deviceOverrides = snmpConfig.deviceOverrides.filter((_, i) => i !== index);
  }
  
  function generateRandomKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }
  
  async function testSNMPConnection(testConfig) {
    testingConnection = true;
    testResults = null;
    
    try {
      const response = await fetch('/api/snmp/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': $currentTenant?.id || ''
        },
        body: JSON.stringify(testConfig)
      });
      
      testResults = await response.json();
    } catch (error) {
      testResults = {
        success: false,
        error: 'Test failed',
        details: error.message
      };
    } finally {
      testingConnection = false;
    }
  }
  
  async function discoverDevices() {
    try {
      const response = await fetch('/api/snmp/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': $currentTenant?.id || ''
        },
        body: JSON.stringify({
          subnets: snmpConfig.discoverySubnets.filter(s => s.enabled).map(s => s.subnet),
          communities: snmpConfig.communityProfiles.map(c => c.community),
          settings: snmpConfig.autoDiscovery
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Discovery started. Found ${result.devicesFound || 0} devices.`);
        dispatch('discoveryStarted', result);
      }
    } catch (error) {
      console.error('Failed to start device discovery:', error);
      alert('Failed to start device discovery');
    }
  }
  
  function handleClose() {
    show = false;
    dispatch('close');
  }
</script>

{#if show}
<div class="modal-backdrop">
  <div class="modal-content">
    <div class="modal-header">
      <h2>🔧 SNMP Configuration</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    <div class="modal-body">
      <!-- Tab Navigation -->
      <div class="tabs">
        <button 
          class="tab {activeTab === 'communities' ? 'active' : ''}"
          on:click={() => activeTab = 'communities'}
        >
          🔑 Community Strings
        </button>
        <button 
          class="tab {activeTab === 'v3users' ? 'active' : ''}"
          on:click={() => activeTab = 'v3users'}
        >
          👤 SNMPv3 Users
        </button>
        <button 
          class="tab {activeTab === 'subnets' ? 'active' : ''}"
          on:click={() => activeTab = 'subnets'}
        >
          🌐 Network Subnets
        </button>
        <button 
          class="tab {activeTab === 'devices' ? 'active' : ''}"
          on:click={() => activeTab = 'devices'}
        >
          📱 Device Overrides
        </button>
        <button 
          class="tab {activeTab === 'discovery' ? 'active' : ''}"
          on:click={() => activeTab = 'discovery'}
        >
          🔍 Auto-Discovery
        </button>
      </div>
      
      <!-- Community Strings Tab -->
      {#if activeTab === 'communities'}
        <div class="tab-content">
          <div class="section-header">
            <h3>Community String Profiles</h3>
            <p>Configure SNMP community strings for device access control</p>
          </div>
          
          <!-- Existing Community Profiles -->
          <div class="profiles-list">
            {#each snmpConfig.communityProfiles as profile, index}
              <div class="profile-card">
                <div class="profile-header">
                  <h4>{profile.name}</h4>
                  <div class="profile-actions">
                    <span class="access-badge {profile.access}">{profile.access}</span>
                    <button class="btn btn-danger btn-sm" on:click={() => removeCommunityProfile(index)}>
                      Remove
                    </button>
                  </div>
                </div>
                <div class="profile-details">
                  <div class="detail-row">
                    <label>Community String:</label>
                    <code>{profile.community}</code>
                  </div>
                  <div class="detail-row">
                    <label>Description:</label>
                    <span>{profile.description}</span>
                  </div>
                  <div class="detail-row">
                    <label>Allowed Subnets:</label>
                    <span>{profile.subnets.join(', ')}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
          
          <!-- Add New Community Profile -->
          <div class="add-profile-form">
            <h4>Add New Community Profile</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="new-community-name">Profile Name</label>
                <input type="text" id="new-community-name" bind:value={newCommunity.name} placeholder="e.g., monitoring" />
              </div>
              <div class="form-group">
                <label for="new-community-string">Community String</label>
                <input type="text" id="new-community-string" bind:value={newCommunity.community} placeholder="e.g., monitor123" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="new-community-access">Access Level</label>
                <select id="new-community-access" bind:value={newCommunity.access}>
                  <option value="read-only">Read Only</option>
                  <option value="read-write">Read Write</option>
                </select>
              </div>
              <div class="form-group">
                <label for="new-community-description">Description</label>
                <input type="text" id="new-community-description" bind:value={newCommunity.description} placeholder="Purpose of this community" />
              </div>
            </div>
            <div class="form-group">
              <label for="new-community-subnets">Allowed Subnets (comma-separated)</label>
              <input type="text" id="new-community-subnets" bind:value={newCommunity.subnets[0]} placeholder="192.168.1.0/24, 10.0.0.0/8" />
            </div>
            <button class="btn btn-primary" on:click={addCommunityProfile}>
              Add Community Profile
            </button>
          </div>
        </div>
      {/if}
      
      <!-- SNMPv3 Users Tab -->
      {#if activeTab === 'v3users'}
        <div class="tab-content">
          <div class="section-header">
            <h3>SNMPv3 User Profiles</h3>
            <p>Configure SNMPv3 users with authentication and privacy settings</p>
          </div>
          
          <!-- Existing V3 User Profiles -->
          <div class="profiles-list">
            {#each snmpConfig.v3UserProfiles as profile, index}
              <div class="profile-card">
                <div class="profile-header">
                  <h4>{profile.name}</h4>
                  <div class="profile-actions">
                    <span class="access-badge {profile.access}">{profile.access}</span>
                    <button class="btn btn-danger btn-sm" on:click={() => removeV3UserProfile(index)}>
                      Remove
                    </button>
                  </div>
                </div>
                <div class="profile-details">
                  <div class="detail-row">
                    <label>Username:</label>
                    <code>{profile.username}</code>
                  </div>
                  <div class="detail-row">
                    <label>Authentication:</label>
                    <span>{profile.authProtocol} / {profile.privProtocol}</span>
                  </div>
                  <div class="detail-row">
                    <label>Description:</label>
                    <span>{profile.description}</span>
                  </div>
                  <div class="detail-row">
                    <label>Allowed Subnets:</label>
                    <span>{profile.subnets.join(', ')}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
          
          <!-- Add New V3 User Profile -->
          <div class="add-profile-form">
            <h4>Add New SNMPv3 User</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="new-v3-name">Profile Name</label>
                <input type="text" id="new-v3-name" bind:value={newV3User.name} placeholder="e.g., admin" />
              </div>
              <div class="form-group">
                <label for="new-v3-username">Username</label>
                <input type="text" id="new-v3-username" bind:value={newV3User.username} placeholder="e.g., snmpadmin" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="new-v3-auth-protocol">Auth Protocol</label>
                <select id="new-v3-auth-protocol" bind:value={newV3User.authProtocol}>
                  <option value="MD5">MD5</option>
                  <option value="SHA">SHA (Recommended)</option>
                </select>
              </div>
              <div class="form-group">
                <label for="new-v3-auth-key">Auth Key</label>
                <div class="key-input">
                  <input type="password" id="new-v3-auth-key" bind:value={newV3User.authKey} placeholder="Minimum 8 characters" />
                  <button type="button" class="btn btn-sm" on:click={() => newV3User.authKey = generateRandomKey()}>
                    🎲
                  </button>
                </div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="new-v3-priv-protocol">Privacy Protocol</label>
                <select id="new-v3-priv-protocol" bind:value={newV3User.privProtocol}>
                  <option value="DES">DES</option>
                  <option value="AES">AES (Recommended)</option>
                </select>
              </div>
              <div class="form-group">
                <label for="new-v3-priv-key">Privacy Key</label>
                <div class="key-input">
                  <input type="password" id="new-v3-priv-key" bind:value={newV3User.privKey} placeholder="Minimum 8 characters" />
                  <button type="button" class="btn btn-sm" on:click={() => newV3User.privKey = generateRandomKey()}>
                    🎲
                  </button>
                </div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="new-v3-access">Access Level</label>
                <select id="new-v3-access" bind:value={newV3User.access}>
                  <option value="read-only">Read Only</option>
                  <option value="read-write">Read Write</option>
                </select>
              </div>
              <div class="form-group">
                <label for="new-v3-description">Description</label>
                <input type="text" id="new-v3-description" bind:value={newV3User.description} placeholder="Purpose of this user" />
              </div>
            </div>
            <div class="form-group">
              <label for="new-v3-subnets">Allowed Subnets (comma-separated)</label>
              <input type="text" id="new-v3-subnets" bind:value={newV3User.subnets[0]} placeholder="192.168.1.0/24, 10.0.0.0/8" />
            </div>
            <button class="btn btn-primary" on:click={addV3UserProfile}>
              Add SNMPv3 User
            </button>
          </div>
        </div>
      {/if}
      
      <!-- Network Subnets Tab -->
      {#if activeTab === 'subnets'}
        <div class="tab-content">
          <div class="section-header">
            <h3>Network Subnets</h3>
            <p>Configure network subnets for SNMP device discovery and monitoring</p>
          </div>
          
          <!-- Existing Subnets -->
          <div class="subnets-list">
            {#each snmpConfig.discoverySubnets as subnet, index}
              <div class="subnet-card">
                <div class="subnet-header">
                  <div class="subnet-info">
                    <h4>{subnet.subnet}</h4>
                    <span class="subnet-description">{subnet.description}</span>
                  </div>
                  <div class="subnet-actions">
                    <label class="toggle-switch">
                      <input type="checkbox" bind:checked={subnet.enabled} />
                      <span class="toggle-slider"></span>
                    </label>
                    <button class="btn btn-danger btn-sm" on:click={() => removeDiscoverySubnet(index)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
          
          <!-- Add New Subnet -->
          <div class="add-subnet-form">
            <h4>Add New Subnet</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="new-subnet">Subnet (CIDR)</label>
                <input type="text" id="new-subnet" bind:value={newSubnet.subnet} placeholder="192.168.1.0/24" />
              </div>
              <div class="form-group">
                <label for="new-subnet-description">Description</label>
                <input type="text" id="new-subnet-description" bind:value={newSubnet.description} placeholder="Network description" />
              </div>
            </div>
            <button class="btn btn-primary" on:click={addDiscoverySubnet}>
              Add Subnet
            </button>
          </div>
        </div>
      {/if}
      
      <!-- Device Overrides Tab -->
      {#if activeTab === 'devices'}
        <div class="tab-content">
          <div class="section-header">
            <h3>Device-Specific Overrides</h3>
            <p>Configure custom SNMP settings for specific devices</p>
          </div>
          
          <!-- Existing Device Overrides -->
          <div class="devices-list">
            {#each snmpConfig.deviceOverrides as device, index}
              <div class="device-card">
                <div class="device-header">
                  <h4>{device.ipAddress}</h4>
                  <div class="device-actions">
                    <span class="version-badge">SNMP v{device.snmpVersion}</span>
                    <button class="btn btn-secondary btn-sm" on:click={() => testSNMPConnection(device)}>
                      Test
                    </button>
                    <button class="btn btn-danger btn-sm" on:click={() => removeDeviceOverride(index)}>
                      Remove
                    </button>
                  </div>
                </div>
                <div class="device-details">
                  <div class="detail-row">
                    <label>Device ID:</label>
                    <span>{device.deviceId || 'Auto-detected'}</span>
                  </div>
                  <div class="detail-row">
                    <label>Port:</label>
                    <span>{device.port}</span>
                  </div>
                  <div class="detail-row">
                    <label>Description:</label>
                    <span>{device.description}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
          
          <!-- Add New Device Override -->
          <div class="add-device-form">
            <h4>Add Device Override</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="new-device-ip">IP Address</label>
                <input type="text" id="new-device-ip" bind:value={newDeviceOverride.ipAddress} placeholder="192.168.1.100" />
              </div>
              <div class="form-group">
                <label for="new-device-version">SNMP Version</label>
                <select id="new-device-version" bind:value={newDeviceOverride.snmpVersion}>
                  <option value="1">v1</option>
                  <option value="2c">v2c</option>
                  <option value="3">v3</option>
                </select>
              </div>
            </div>
            
            {#if newDeviceOverride.snmpVersion === '2c' || newDeviceOverride.snmpVersion === '1'}
              <div class="form-group">
                <label for="new-device-community">Community String</label>
                <input type="text" id="new-device-community" bind:value={newDeviceOverride.community} placeholder="public" />
              </div>
            {:else}
              <div class="form-row">
                <div class="form-group">
                  <label for="new-device-username">Username</label>
                  <input type="text" id="new-device-username" bind:value={newDeviceOverride.username} placeholder="snmpuser" />
                </div>
                <div class="form-group">
                  <label for="new-device-port">Port</label>
                  <input type="number" id="new-device-port" bind:value={newDeviceOverride.port} min="1" max="65535" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="new-device-auth-key">Auth Key</label>
                  <input type="password" id="new-device-auth-key" bind:value={newDeviceOverride.authKey} />
                </div>
                <div class="form-group">
                  <label for="new-device-priv-key">Privacy Key</label>
                  <input type="password" id="new-device-priv-key" bind:value={newDeviceOverride.privKey} />
                </div>
              </div>
            {/if}
            
            <div class="form-group">
              <label for="new-device-description">Description</label>
              <input type="text" id="new-device-description" bind:value={newDeviceOverride.description} placeholder="Device description" />
            </div>
            
            <button class="btn btn-primary" on:click={addDeviceOverride}>
              Add Device Override
            </button>
          </div>
        </div>
      {/if}
      
      <!-- Auto-Discovery Tab -->
      {#if activeTab === 'discovery'}
        <div class="tab-content">
          <div class="section-header">
            <h3>Auto-Discovery Settings</h3>
            <p>Configure automatic SNMP device discovery across your networks</p>
          </div>
          
          <div class="discovery-settings">
            <div class="form-group">
              <label>
                <input type="checkbox" bind:checked={snmpConfig.autoDiscovery.enabled} />
                Enable Auto-Discovery
              </label>
            </div>
            
            {#if snmpConfig.autoDiscovery.enabled}
              <div class="form-row">
                <div class="form-group">
                  <label for="scan-interval">Scan Interval (minutes)</label>
                  <input type="number" id="scan-interval" bind:value={snmpConfig.autoDiscovery.scanInterval} min="5" max="1440" />
                </div>
                <div class="form-group">
                  <label for="max-concurrent">Max Concurrent Scans</label>
                  <input type="number" id="max-concurrent" bind:value={snmpConfig.autoDiscovery.maxConcurrent} min="1" max="100" />
                </div>
              </div>
              
              <div class="form-group">
                <label for="scan-ports">SNMP Ports to Scan</label>
                <input type="text" id="scan-ports" value={snmpConfig.autoDiscovery.scanPorts.join(', ')} 
                       on:input={(e) => snmpConfig.autoDiscovery.scanPorts = e.target.value.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p))} />
              </div>
              
              <div class="form-group">
                <label for="scan-communities">Communities to Try</label>
                <input type="text" id="scan-communities" value={snmpConfig.autoDiscovery.scanCommunities.join(', ')} 
                       on:input={(e) => snmpConfig.autoDiscovery.scanCommunities = e.target.value.split(',').map(c => c.trim()).filter(c => c)} />
              </div>
              
              <div class="discovery-actions">
                <button class="btn btn-primary" on:click={discoverDevices}>
                  🔍 Start Discovery Now
                </button>
                <button class="btn btn-secondary" on:click={() => dispatch('viewDiscoveredDevices')}>
                  📋 View Discovered Devices
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- Test Results -->
      {#if testResults}
        <div class="test-results {testResults.success ? 'success' : 'error'}">
          {#if testResults.success}
            ✅ Connection successful
            {#if testResults.systemDescription}
              <br><small>System: {testResults.systemDescription}</small>
            {/if}
          {:else}
            ❌ Connection failed: {testResults.error}
            {#if testResults.details}
              <br><small>{testResults.details}</small>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
    
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" on:click={handleClose}>
        Cancel
      </button>
      <button type="button" class="btn btn-primary" on:click={saveSNMPConfiguration} disabled={saving}>
        {#if saving}
          💾 Saving...
        {:else}
          💾 Save Configuration
        {/if}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--card-bg, white);
    border-radius: 12px;
    width: 95vw;
    max-width: 1200px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }
  
  .modal-header h2 {
    margin: 0;
    color: var(--text-primary, #111827);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    padding: 0.5rem;
    border-radius: 4px;
  }
  
  .close-btn:hover {
    background: var(--bg-hover, #f3f4f6);
  }
  
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }
  
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    background: var(--bg-secondary, #f9fafb);
    overflow-x: auto;
  }
  
  .tab {
    flex: 1;
    min-width: 150px;
    padding: 1rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    font-weight: 500;
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .tab:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }
  
  .tab.active {
    background: var(--card-bg, white);
    color: var(--primary, #3b82f6);
    border-bottom: 2px solid var(--primary, #3b82f6);
  }
  
  .tab-content {
    padding: 2rem;
  }
  
  .section-header {
    margin-bottom: 2rem;
  }
  
  .section-header h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary, #111827);
  }
  
  .section-header p {
    margin: 0;
    color: var(--text-secondary, #6b7280);
  }
  
  .profiles-list, .subnets-list, .devices-list {
    margin-bottom: 2rem;
  }
  
  .profile-card, .subnet-card, .device-card {
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    background: var(--card-bg, white);
  }
  
  .profile-header, .subnet-header, .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .profile-header h4, .device-header h4 {
    margin: 0;
    color: var(--text-primary, #111827);
  }
  
  .subnet-info h4 {
    margin: 0;
    color: var(--text-primary, #111827);
    font-family: monospace;
  }
  
  .subnet-description {
    color: var(--text-secondary, #6b7280);
    font-size: 0.875rem;
  }
  
  .profile-actions, .subnet-actions, .device-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .access-badge, .version-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }
  
  .access-badge.read-only, .version-badge {
    background: rgba(34, 197, 94, 0.1);
    color: #166534;
  }
  
  .access-badge.read-write {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }
  
  .profile-details, .device-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  
  .detail-row {
    display: flex;
    gap: 0.5rem;
  }
  
  .detail-row label {
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
    min-width: 100px;
  }
  
  .detail-row code {
    background: var(--bg-secondary, #f3f4f6);
    padding: 0.125rem 0.25rem;
    border-radius: 3px;
    font-size: 0.875rem;
  }
  
  .add-profile-form, .add-subnet-form, .add-device-form {
    background: var(--bg-secondary, #f9fafb);
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color, #e5e7eb);
  }
  
  .add-profile-form h4, .add-subnet-form h4, .add-device-form h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary, #111827);
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary, #111827);
  }
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 6px;
    background: var(--card-bg, white);
    color: var(--text-primary, #111827);
  }
  
  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .key-input {
    display: flex;
    gap: 0.5rem;
  }
  
  .key-input input {
    flex: 1;
  }
  
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 24px;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.4s;
    border-radius: 24px;
  }
  
  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.4s;
    border-radius: 50%;
  }
  
  input:checked + .toggle-slider {
    background-color: var(--primary, #3b82f6);
  }
  
  input:checked + .toggle-slider:before {
    transform: translateX(26px);
  }
  
  .discovery-settings {
    background: var(--bg-secondary, #f9fafb);
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color, #e5e7eb);
  }
  
  .discovery-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  .test-results {
    margin: 1rem 2rem;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
  }
  
  .test-results.success {
    background: rgba(34, 197, 94, 0.1);
    color: #166534;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  
  .test-results.error {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
    background: var(--bg-secondary, #f9fafb);
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary, #3b82f6);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }
  
  .btn-secondary {
    background: var(--bg-tertiary, #6b7280);
    color: white;
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: #4b5563;
  }
  
  .btn-danger {
    background: #ef4444;
    color: white;
  }
  
  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }
  
  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }
  
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
    
    .profile-details, .device-details {
      grid-template-columns: 1fr;
    }
    
    .tabs {
      flex-wrap: wrap;
    }
    
    .tab {
      flex: none;
      min-width: auto;
    }
  }
</style>
