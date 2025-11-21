<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let show = false;
  export let deploymentType: 'epc' | 'snmp-only' = 'epc';
  export let initialConfig: any = {};
  
  // SNMP Configuration
  let snmpConfig = {
    enabled: true,
    version: '2c', // '1', '2c', or '3'
    community: 'public',
    port: 161,
    
    // SNMPv3 specific
    username: '',
    authProtocol: 'SHA', // 'MD5' or 'SHA'
    authKey: '',
    privProtocol: 'AES', // 'DES' or 'AES'
    privKey: '',
    
    // Polling configuration
    pollingInterval: 60, // seconds
    enableTraps: true,
    trapPort: 162,
    
    // Custom OIDs
    customOids: [
      { oid: '', name: '', description: '' }
    ]
  };
  
  // APT Repository Configuration
  let aptConfig = {
    enabled: true,
    autoUpdate: false,
    updateSchedule: 'daily', // 'hourly', 'daily', 'weekly'
    updateTime: '02:00',
    allowedPackages: ['wisptools-epc', 'wisptools-snmp'],
    securityUpdatesOnly: false
  };
  
  // Network Configuration
  let networkConfig = {
    staticIP: false,
    ipAddress: '',
    netmask: '255.255.255.0',
    gateway: '',
    dns1: '8.8.8.8',
    dns2: '8.8.4.4',
    hostname: ''
  };
  
  // Initialize with provided config
  $: if (initialConfig && Object.keys(initialConfig).length > 0) {
    snmpConfig = { ...snmpConfig, ...initialConfig.snmp };
    aptConfig = { ...aptConfig, ...initialConfig.apt };
    networkConfig = { ...networkConfig, ...initialConfig.network };
  }
  
  let activeTab = 'snmp';
  let testingConnection = false;
  let connectionTestResult: any = null;
  
  function addCustomOid() {
    snmpConfig.customOids = [...snmpConfig.customOids, { oid: '', name: '', description: '' }];
  }
  
  function removeCustomOid(index: number) {
    snmpConfig.customOids = snmpConfig.customOids.filter((_, i) => i !== index);
  }
  
  async function testSNMPConnection() {
    if (!networkConfig.ipAddress) {
      alert('Please enter an IP address first');
      return;
    }
    
    testingConnection = true;
    connectionTestResult = null;
    
    try {
      const response = await fetch('/api/snmp/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ipAddress: networkConfig.ipAddress,
          snmpVersion: snmpConfig.version,
          community: snmpConfig.community,
          username: snmpConfig.username,
          authKey: snmpConfig.authKey,
          privKey: snmpConfig.privKey
        })
      });
      
      connectionTestResult = await response.json();
    } catch (error) {
      connectionTestResult = {
        success: false,
        error: 'Test failed',
        details: error.message
      };
    } finally {
      testingConnection = false;
    }
  }
  
  function generateRandomKeys() {
    snmpConfig.authKey = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    snmpConfig.privKey = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  function handleSave() {
    const config = {
      snmp: snmpConfig,
      apt: aptConfig,
      network: networkConfig,
      deploymentType
    };
    
    dispatch('save', config);
    show = false;
  }
  
  function handleCancel() {
    dispatch('cancel');
    show = false;
  }
</script>

{#if show}
<div class="modal-backdrop">
  <div class="modal-content">
    <div class="modal-header">
      <h2>
        {#if deploymentType === 'snmp-only'}
          🔍 SNMP Monitoring Configuration
        {:else}
          ⚙️ EPC Deployment Configuration
        {/if}
      </h2>
      <button class="close-btn" on:click={handleCancel}>✕</button>
    </div>
    
    <div class="modal-body">
      <!-- Tab Navigation -->
      <div class="tabs">
        <button 
          class="tab {activeTab === 'snmp' ? 'active' : ''}"
          on:click={() => activeTab = 'snmp'}
        >
          📊 SNMP Monitoring
        </button>
        <button 
          class="tab {activeTab === 'apt' ? 'active' : ''}"
          on:click={() => activeTab = 'apt'}
        >
          📦 Updates & Packages
        </button>
        <button 
          class="tab {activeTab === 'network' ? 'active' : ''}"
          on:click={() => activeTab = 'network'}
        >
          🌐 Network Settings
        </button>
      </div>
      
      <!-- SNMP Configuration Tab -->
      {#if activeTab === 'snmp'}
        <div class="tab-content">
          <div class="form-section">
            <h3>SNMP Configuration</h3>
            
            <div class="form-group">
              <label>
                <input type="checkbox" bind:checked={snmpConfig.enabled} />
                Enable SNMP Monitoring
              </label>
            </div>
            
            {#if snmpConfig.enabled}
              <div class="form-row">
                <div class="form-group">
                  <label for="snmp-version">SNMP Version</label>
                  <select id="snmp-version" bind:value={snmpConfig.version}>
                    <option value="1">SNMP v1</option>
                    <option value="2c">SNMP v2c</option>
                    <option value="3">SNMP v3 (Recommended)</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label for="snmp-port">SNMP Port</label>
                  <input type="number" id="snmp-port" bind:value={snmpConfig.port} min="1" max="65535" />
                </div>
              </div>
              
              {#if snmpConfig.version === '1' || snmpConfig.version === '2c'}
                <div class="form-group">
                  <label for="community">Community String</label>
                  <input type="text" id="community" bind:value={snmpConfig.community} placeholder="public" />
                </div>
              {:else}
                <!-- SNMPv3 Configuration -->
                <div class="snmpv3-config">
                  <h4>SNMPv3 Security Configuration</h4>
                  
                  <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" bind:value={snmpConfig.username} placeholder="snmpuser" />
                  </div>
                  
                  <div class="form-row">
                    <div class="form-group">
                      <label for="auth-protocol">Authentication Protocol</label>
                      <select id="auth-protocol" bind:value={snmpConfig.authProtocol}>
                        <option value="MD5">MD5</option>
                        <option value="SHA">SHA (Recommended)</option>
                      </select>
                    </div>
                    
                    <div class="form-group">
                      <label for="auth-key">Authentication Key</label>
                      <input type="password" id="auth-key" bind:value={snmpConfig.authKey} placeholder="Minimum 8 characters" />
                    </div>
                  </div>
                  
                  <div class="form-row">
                    <div class="form-group">
                      <label for="priv-protocol">Privacy Protocol</label>
                      <select id="priv-protocol" bind:value={snmpConfig.privProtocol}>
                        <option value="DES">DES</option>
                        <option value="AES">AES (Recommended)</option>
                      </select>
                    </div>
                    
                    <div class="form-group">
                      <label for="priv-key">Privacy Key</label>
                      <input type="password" id="priv-key" bind:value={snmpConfig.privKey} placeholder="Minimum 8 characters" />
                    </div>
                  </div>
                  
                  <button type="button" class="btn btn-secondary" on:click={generateRandomKeys}>
                    🔑 Generate Random Keys
                  </button>
                </div>
              {/if}
              
              <div class="form-section">
                <h4>Polling Configuration</h4>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="polling-interval">Polling Interval (seconds)</label>
                    <input type="number" id="polling-interval" bind:value={snmpConfig.pollingInterval} min="10" max="3600" />
                  </div>
                  
                  <div class="form-group">
                    <label>
                      <input type="checkbox" bind:checked={snmpConfig.enableTraps} />
                      Enable SNMP Traps
                    </label>
                  </div>
                </div>
                
                {#if snmpConfig.enableTraps}
                  <div class="form-group">
                    <label for="trap-port">Trap Port</label>
                    <input type="number" id="trap-port" bind:value={snmpConfig.trapPort} min="1" max="65535" />
                  </div>
                {/if}
              </div>
              
              <div class="form-section">
                <h4>Custom OIDs</h4>
                
                {#each snmpConfig.customOids as oid, index}
                  <div class="custom-oid-row">
                    <input type="text" bind:value={oid.oid} placeholder="1.3.6.1.4.1...." />
                    <input type="text" bind:value={oid.name} placeholder="Metric name" />
                    <input type="text" bind:value={oid.description} placeholder="Description" />
                    <button type="button" class="btn btn-danger btn-sm" on:click={() => removeCustomOid(index)}>
                      Remove
                    </button>
                  </div>
                {/each}
                
                <button type="button" class="btn btn-secondary" on:click={addCustomOid}>
                  + Add Custom OID
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- APT Configuration Tab -->
      {#if activeTab === 'apt'}
        <div class="tab-content">
          <div class="form-section">
            <h3>APT Repository & Updates</h3>
            
            <div class="form-group">
              <label>
                <input type="checkbox" bind:checked={aptConfig.enabled} />
                Enable APT Repository Integration
              </label>
              <small>Allows remote updates via APT package manager</small>
            </div>
            
            {#if aptConfig.enabled}
              <div class="form-group">
                <label>
                  <input type="checkbox" bind:checked={aptConfig.autoUpdate} />
                  Enable Automatic Updates
                </label>
                <small>Automatically install updates on schedule</small>
              </div>
              
              {#if aptConfig.autoUpdate}
                <div class="form-row">
                  <div class="form-group">
                    <label for="update-schedule">Update Schedule</label>
                    <select id="update-schedule" bind:value={aptConfig.updateSchedule}>
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                  
                  <div class="form-group">
                    <label for="update-time">Update Time</label>
                    <input type="time" id="update-time" bind:value={aptConfig.updateTime} />
                  </div>
                </div>
              {/if}
              
              <div class="form-group">
                <label>
                  <input type="checkbox" bind:checked={aptConfig.securityUpdatesOnly} />
                  Security Updates Only
                </label>
                <small>Only install security-related updates automatically</small>
              </div>
              
              <div class="form-section">
                <h4>Allowed Packages</h4>
                <small>Packages that can be updated automatically</small>
                
                {#each aptConfig.allowedPackages as pkg, index}
                  <div class="package-row">
                    <input type="text" bind:value={aptConfig.allowedPackages[index]} placeholder="package-name" />
                    <button type="button" class="btn btn-danger btn-sm" 
                            on:click={() => aptConfig.allowedPackages = aptConfig.allowedPackages.filter((_, i) => i !== index)}>
                      Remove
                    </button>
                  </div>
                {/each}
                
                <button type="button" class="btn btn-secondary" 
                        on:click={() => aptConfig.allowedPackages = [...aptConfig.allowedPackages, '']}>
                  + Add Package
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- Network Configuration Tab -->
      {#if activeTab === 'network'}
        <div class="tab-content">
          <div class="form-section">
            <h3>Network Configuration</h3>
            
            <div class="form-group">
              <label for="hostname">Hostname</label>
              <input type="text" id="hostname" bind:value={networkConfig.hostname} placeholder="epc-site-01" />
            </div>
            
            <div class="form-group">
              <label>
                <input type="checkbox" bind:checked={networkConfig.staticIP} />
                Use Static IP Configuration
              </label>
            </div>
            
            {#if networkConfig.staticIP}
              <div class="form-row">
                <div class="form-group">
                  <label for="ip-address">IP Address</label>
                  <input type="text" id="ip-address" bind:value={networkConfig.ipAddress} placeholder="192.168.1.100" />
                </div>
                
                <div class="form-group">
                  <label for="netmask">Netmask</label>
                  <input type="text" id="netmask" bind:value={networkConfig.netmask} placeholder="255.255.255.0" />
                </div>
              </div>
              
              <div class="form-group">
                <label for="gateway">Gateway</label>
                <input type="text" id="gateway" bind:value={networkConfig.gateway} placeholder="192.168.1.1" />
              </div>
            {/if}
            
            <div class="form-row">
              <div class="form-group">
                <label for="dns1">Primary DNS</label>
                <input type="text" id="dns1" bind:value={networkConfig.dns1} placeholder="8.8.8.8" />
              </div>
              
              <div class="form-group">
                <label for="dns2">Secondary DNS</label>
                <input type="text" id="dns2" bind:value={networkConfig.dns2} placeholder="8.8.4.4" />
              </div>
            </div>
            
            {#if networkConfig.staticIP && networkConfig.ipAddress}
              <div class="connection-test">
                <button type="button" class="btn btn-secondary" on:click={testSNMPConnection} disabled={testingConnection}>
                  {#if testingConnection}
                    🔄 Testing...
                  {:else}
                    🔍 Test SNMP Connection
                  {/if}
                </button>
                
                {#if connectionTestResult}
                  <div class="test-result {connectionTestResult.success ? 'success' : 'error'}">
                    {#if connectionTestResult.success}
                      ✅ Connection successful
                      {#if connectionTestResult.systemDescription}
                        <br><small>System: {connectionTestResult.systemDescription}</small>
                      {/if}
                    {:else}
                      ❌ Connection failed: {connectionTestResult.error}
                      {#if connectionTestResult.details}
                        <br><small>{connectionTestResult.details}</small>
                      {/if}
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
    
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" on:click={handleCancel}>
        Cancel
      </button>
      <button type="button" class="btn btn-primary" on:click={handleSave}>
        {#if deploymentType === 'snmp-only'}
          Generate SNMP ISO
        {:else}
          Save Configuration
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
    width: 90vw;
    max-width: 800px;
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
  }
  
  .tab {
    flex: 1;
    padding: 1rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    font-weight: 500;
    transition: all 0.2s;
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
  
  .form-section {
    margin-bottom: 2rem;
  }
  
  .form-section h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary, #111827);
  }
  
  .form-section h4 {
    margin: 1.5rem 0 1rem 0;
    color: var(--text-primary, #111827);
    font-size: 1rem;
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
  
  .form-group small {
    display: block;
    margin-top: 0.25rem;
    color: var(--text-secondary, #6b7280);
    font-size: 0.875rem;
  }
  
  .snmpv3-config {
    background: var(--bg-secondary, #f9fafb);
    padding: 1.5rem;
    border-radius: 8px;
    margin: 1rem 0;
  }
  
  .custom-oid-row,
  .package-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    align-items: center;
  }
  
  .connection-test {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--bg-secondary, #f9fafb);
    border-radius: 8px;
  }
  
  .test-result {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
  }
  
  .test-result.success {
    background: rgba(34, 197, 94, 0.1);
    color: #166534;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  
  .test-result.error {
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
  
  .btn-danger {
    background: #ef4444;
    color: white;
  }
  
  .btn-danger:hover {
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
</style>
