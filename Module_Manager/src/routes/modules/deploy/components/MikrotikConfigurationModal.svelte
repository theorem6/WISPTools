<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let show = false;
  export let initialConfig: any = {};
  
  // Mikrotik Device Configuration
  let mikrotikConfig = {
    enabled: false,
    deviceType: 'router', // 'router', 'switch', 'ap', 'cpe', 'lte'
    
    // Connection settings
    ipAddress: '',
    username: 'admin',
    password: '',
    port: 8728,
    useSSL: false,
    
    // Management settings
    enableAPI: true,
    enableSNMP: true,
    enableWinbox: true,
    enableSSH: true,
    
    // SNMP Configuration
    snmpCommunity: 'public',
    snmpLocation: '',
    snmpContact: '',
    
    // Wireless settings (for AP/CPE)
    wirelessConfig: {
      enabled: false,
      mode: 'ap-bridge', // 'ap-bridge', 'station', 'bridge'
      ssid: '',
      frequency: '2412', // 2.4GHz channel 1
      band: '2ghz-b/g/n',
      security: 'wpa2',
      passphrase: '',
      countryCode: 'united states3',
      txPower: 20
    },
    
    // LTE settings (for LTE devices)
    lteConfig: {
      enabled: false,
      apn: '',
      username: '',
      password: '',
      pinCode: '',
      allowRoaming: false
    },
    
    // Network configuration
    networkConfig: {
      dhcpClient: true,
      staticIP: false,
      ipAddress: '',
      netmask: '255.255.255.0',
      gateway: '',
      dns1: '8.8.8.8',
      dns2: '8.8.4.4'
    },
    
    // Monitoring settings
    monitoringConfig: {
      enableNetwatch: true,
      netwatchHosts: ['8.8.8.8', '1.1.1.1'],
      enableHealthCheck: true,
      enableTrafficMonitoring: true,
      pollingInterval: 30
    },
    
    // Security settings
    securityConfig: {
      changeDefaultPassword: true,
      disableDefaultServices: true,
      enableFirewall: true,
      allowedNetworks: ['192.168.0.0/16', '10.0.0.0/8'],
      enableMacTelnet: false,
      enableNeighborDiscovery: true
    }
  };
  
  // Initialize with provided config
  $: if (initialConfig && Object.keys(initialConfig).length > 0) {
    mikrotikConfig = { ...mikrotikConfig, ...initialConfig };
  }
  
  let activeTab = 'basic';
  let testingConnection = false;
  let connectionTestResult: any = null;
  let generatingConfig = false;
  let generatedScript = '';
  
  // Device type options
  const deviceTypes = [
    { value: 'router', label: '🌐 Router', description: 'Standard router/gateway device' },
    { value: 'switch', label: '🔀 Switch', description: 'Ethernet switch device' },
    { value: 'ap', label: '📡 Access Point', description: 'Wireless access point' },
    { value: 'cpe', label: '📶 CPE', description: 'Customer premises equipment' },
    { value: 'lte', label: '📱 LTE Router', description: 'LTE/cellular router' }
  ];
  
  // Wireless frequency options
  const frequencyOptions = [
    { value: '2412', label: 'Channel 1 (2412 MHz)' },
    { value: '2417', label: 'Channel 2 (2417 MHz)' },
    { value: '2422', label: 'Channel 3 (2422 MHz)' },
    { value: '2427', label: 'Channel 4 (2427 MHz)' },
    { value: '2432', label: 'Channel 5 (2432 MHz)' },
    { value: '2437', label: 'Channel 6 (2437 MHz)' },
    { value: '2442', label: 'Channel 7 (2442 MHz)' },
    { value: '2447', label: 'Channel 8 (2447 MHz)' },
    { value: '2452', label: 'Channel 9 (2452 MHz)' },
    { value: '2457', label: 'Channel 10 (2457 MHz)' },
    { value: '2462', label: 'Channel 11 (2462 MHz)' },
    { value: '5180', label: 'Channel 36 (5180 MHz)' },
    { value: '5200', label: 'Channel 40 (5200 MHz)' },
    { value: '5220', label: 'Channel 44 (5220 MHz)' },
    { value: '5240', label: 'Channel 48 (5240 MHz)' }
  ];
  
  async function testConnection() {
    if (!mikrotikConfig.ipAddress || !mikrotikConfig.username || !mikrotikConfig.password) {
      alert('Please fill in IP address, username, and password');
      return;
    }
    
    testingConnection = true;
    connectionTestResult = null;
    
    try {
      const response = await fetch('/api/mikrotik/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ipAddress: mikrotikConfig.ipAddress,
          username: mikrotikConfig.username,
          password: mikrotikConfig.password,
          port: mikrotikConfig.port,
          useSSL: mikrotikConfig.useSSL
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
  
  function generateRandomPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    mikrotikConfig.password = password;
  }
  
  function generateWirelessPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    mikrotikConfig.wirelessConfig.passphrase = password;
  }
  
  async function generateConfigurationScript() {
    generatingConfig = true;
    
    try {
      // Generate RouterOS configuration script
      let script = `# Mikrotik RouterOS Configuration Script
# Generated for ${mikrotikConfig.deviceType} device
# Generated on: ${new Date().toISOString()}

`;

      // Basic system configuration
      script += `# System Configuration
/system identity set name="${mikrotikConfig.deviceType}-${Date.now()}"
/system clock set time-zone-name=America/New_York
`;

      // User configuration
      if (mikrotikConfig.securityConfig.changeDefaultPassword) {
        script += `/user set admin password="${mikrotikConfig.password}"
`;
      }

      // Network configuration
      if (mikrotikConfig.networkConfig.staticIP) {
        script += `
# Static IP Configuration
/ip address add address=${mikrotikConfig.networkConfig.ipAddress}/${mikrotikConfig.networkConfig.netmask} interface=ether1
/ip route add dst-address=0.0.0.0/0 gateway=${mikrotikConfig.networkConfig.gateway}
/ip dns set servers=${mikrotikConfig.networkConfig.dns1},${mikrotikConfig.networkConfig.dns2}
`;
      } else {
        script += `
# DHCP Client Configuration
/ip dhcp-client add interface=ether1 disabled=no
`;
      }

      // SNMP configuration
      if (mikrotikConfig.enableSNMP) {
        script += `
# SNMP Configuration
/snmp set enabled=yes community="${mikrotikConfig.snmpCommunity}"
/snmp set location="${mikrotikConfig.snmpLocation}"
/snmp set contact="${mikrotikConfig.snmpContact}"
`;
      }

      // Wireless configuration (for AP/CPE)
      if ((mikrotikConfig.deviceType === 'ap' || mikrotikConfig.deviceType === 'cpe') && mikrotikConfig.wirelessConfig.enabled) {
        script += `
# Wireless Configuration
/interface wireless set wlan1 mode=${mikrotikConfig.wirelessConfig.mode}
/interface wireless set wlan1 ssid="${mikrotikConfig.wirelessConfig.ssid}"
/interface wireless set wlan1 frequency=${mikrotikConfig.wirelessConfig.frequency}
/interface wireless set wlan1 band=${mikrotikConfig.wirelessConfig.band}
/interface wireless set wlan1 tx-power=${mikrotikConfig.wirelessConfig.txPower}
/interface wireless set wlan1 country="${mikrotikConfig.wirelessConfig.countryCode}"
/interface wireless security-profiles set default authentication-types=wpa2-psk
/interface wireless security-profiles set default wpa2-pre-shared-key="${mikrotikConfig.wirelessConfig.passphrase}"
/interface wireless set wlan1 security-profile=default
/interface wireless enable wlan1
`;
      }

      // LTE configuration (for LTE devices)
      if (mikrotikConfig.deviceType === 'lte' && mikrotikConfig.lteConfig.enabled) {
        script += `
# LTE Configuration
/interface lte set lte1 apn="${mikrotikConfig.lteConfig.apn}"
`;
        if (mikrotikConfig.lteConfig.username) {
          script += `/interface lte set lte1 user="${mikrotikConfig.lteConfig.username}"
/interface lte set lte1 password="${mikrotikConfig.lteConfig.password}"
`;
        }
        if (mikrotikConfig.lteConfig.pinCode) {
          script += `/interface lte set lte1 pin="${mikrotikConfig.lteConfig.pinCode}"
`;
        }
        script += `/interface lte set lte1 allow-roaming=${mikrotikConfig.lteConfig.allowRoaming ? 'yes' : 'no'}
`;
      }

      // Security configuration
      if (mikrotikConfig.securityConfig.enableFirewall) {
        script += `
# Basic Firewall Configuration
/ip firewall filter add chain=input action=accept connection-state=established,related
/ip firewall filter add chain=input action=accept protocol=icmp
/ip firewall filter add chain=input action=accept src-address=${mikrotikConfig.securityConfig.allowedNetworks.join(',')}
/ip firewall filter add chain=input action=drop
`;
      }

      // Monitoring configuration
      if (mikrotikConfig.monitoringConfig.enableNetwatch) {
        mikrotikConfig.monitoringConfig.netwatchHosts.forEach((host, index) => {
          script += `/tool netwatch add host=${host} interval=30s comment="Monitor ${index + 1}"
`;
        });
      }

      // Service configuration
      script += `
# Service Configuration
/ip service set telnet disabled=yes
/ip service set ftp disabled=yes
/ip service set www disabled=no
/ip service set ssh disabled=${mikrotikConfig.enableSSH ? 'no' : 'yes'}
/ip service set api disabled=${mikrotikConfig.enableAPI ? 'no' : 'yes'}
/ip service set winbox disabled=${mikrotikConfig.enableWinbox ? 'no' : 'yes'}
`;

      // Neighbor discovery
      script += `
# Neighbor Discovery
/ip neighbor discovery-settings set discover-interface-list=${mikrotikConfig.securityConfig.enableNeighborDiscovery ? 'all' : 'none'}
`;

      script += `
# Configuration Complete
/system reboot
`;

      generatedScript = script;
    } catch (error) {
      console.error('Failed to generate configuration:', error);
      alert('Failed to generate configuration script');
    } finally {
      generatingConfig = false;
    }
  }
  
  function downloadScript() {
    const blob = new Blob([generatedScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mikrotik-${mikrotikConfig.deviceType}-config.rsc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  function handleSave() {
    dispatch('save', mikrotikConfig);
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
      <h2>🔧 Mikrotik RouterOS Configuration</h2>
      <button class="close-btn" onclick={handleCancel}>✕</button>
    </div>
    
    <div class="modal-body">
      <!-- Tab Navigation -->
      <div class="tabs">
        <button 
          class="tab {activeTab === 'basic' ? 'active' : ''}"
          onclick={() => activeTab = 'basic'}
        >
          ⚙️ Basic Settings
        </button>
        <button 
          class="tab {activeTab === 'wireless' ? 'active' : ''}"
          onclick={() => activeTab = 'wireless'}
          disabled={mikrotikConfig.deviceType !== 'ap' && mikrotikConfig.deviceType !== 'cpe'}
        >
          📡 Wireless
        </button>
        <button 
          class="tab {activeTab === 'lte' ? 'active' : ''}"
          onclick={() => activeTab = 'lte'}
          disabled={mikrotikConfig.deviceType !== 'lte'}
        >
          📱 LTE
        </button>
        <button 
          class="tab {activeTab === 'monitoring' ? 'active' : ''}"
          onclick={() => activeTab = 'monitoring'}
        >
          📊 Monitoring
        </button>
        <button 
          class="tab {activeTab === 'security' ? 'active' : ''}"
          onclick={() => activeTab = 'security'}
        >
          🔒 Security
        </button>
        <button 
          class="tab {activeTab === 'script' ? 'active' : ''}"
          onclick={() => activeTab = 'script'}
        >
          📝 Script
        </button>
      </div>
      
      <!-- Basic Settings Tab -->
      {#if activeTab === 'basic'}
        <div class="tab-content">
          <div class="form-section">
            <h3>Device Configuration</h3>
            
            <div class="form-group">
              <label>
                <input type="checkbox" bind:checked={mikrotikConfig.enabled} />
                Enable Mikrotik Configuration
              </label>
            </div>
            
            {#if mikrotikConfig.enabled}
              <div class="form-group">
                <label for="device-type">Device Type</label>
                <select id="device-type" bind:value={mikrotikConfig.deviceType}>
                  {#each deviceTypes as type}
                    <option value={type.value}>{type.label}</option>
                  {/each}
                </select>
                <small>{deviceTypes.find(t => t.value === mikrotikConfig.deviceType)?.description}</small>
              </div>
              
              <div class="form-section">
                <h4>Connection Settings</h4>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="ip-address">IP Address</label>
                    <input type="text" id="ip-address" bind:value={mikrotikConfig.ipAddress} placeholder="192.168.88.1" />
                  </div>
                  
                  <div class="form-group">
                    <label for="port">API Port</label>
                    <input type="number" id="port" bind:value={mikrotikConfig.port} min="1" max="65535" />
                  </div>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" bind:value={mikrotikConfig.username} />
                  </div>
                  
                  <div class="form-group">
                    <label for="password">Password</label>
                    <div class="password-input">
                      <input type="password" id="password" bind:value={mikrotikConfig.password} />
                      <button type="button" class="btn btn-sm" onclick={generateRandomPassword}>
                        🎲 Generate
                      </button>
                    </div>
                  </div>
                </div>
                
                <div class="form-group">
                  <label>
                    <input type="checkbox" bind:checked={mikrotikConfig.useSSL} />
                    Use SSL/TLS (Port 8729)
                  </label>
                </div>
                
                <button type="button" class="btn btn-secondary" onclick={testConnection} disabled={testingConnection}>
                  {#if testingConnection}
                    🔄 Testing...
                  {:else}
                    🔍 Test Connection
                  {/if}
                </button>
                
                {#if connectionTestResult}
                  <div class="test-result {connectionTestResult.success ? 'success' : 'error'}">
                    {#if connectionTestResult.success}
                      ✅ Connection successful
                      <br><small>Device: {connectionTestResult.identity?.name}</small>
                      <br><small>Version: {connectionTestResult.systemInfo?.version}</small>
                    {:else}
                      ❌ Connection failed: {connectionTestResult.error}
                      {#if connectionTestResult.details}
                        <br><small>{connectionTestResult.details}</small>
                      {/if}
                    {/if}
                  </div>
                {/if}
              </div>
              
              <div class="form-section">
                <h4>Network Configuration</h4>
                
                <div class="form-group">
                  <label>
                    <input type="checkbox" bind:checked={mikrotikConfig.networkConfig.staticIP} />
                    Use Static IP Configuration
                  </label>
                </div>
                
                {#if mikrotikConfig.networkConfig.staticIP}
                  <div class="form-row">
                    <div class="form-group">
                      <label for="static-ip">IP Address</label>
                      <input type="text" id="static-ip" bind:value={mikrotikConfig.networkConfig.ipAddress} placeholder="192.168.1.100" />
                    </div>
                    
                    <div class="form-group">
                      <label for="netmask">Netmask</label>
                      <input type="text" id="netmask" bind:value={mikrotikConfig.networkConfig.netmask} placeholder="255.255.255.0" />
                    </div>
                  </div>
                  
                  <div class="form-group">
                    <label for="gateway">Gateway</label>
                    <input type="text" id="gateway" bind:value={mikrotikConfig.networkConfig.gateway} placeholder="192.168.1.1" />
                  </div>
                {/if}
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="dns1">Primary DNS</label>
                    <input type="text" id="dns1" bind:value={mikrotikConfig.networkConfig.dns1} />
                  </div>
                  
                  <div class="form-group">
                    <label for="dns2">Secondary DNS</label>
                    <input type="text" id="dns2" bind:value={mikrotikConfig.networkConfig.dns2} />
                  </div>
                </div>
              </div>
              
              <div class="form-section">
                <h4>Services</h4>
                
                <div class="form-row">
                  <div class="form-group">
                    <label>
                      <input type="checkbox" bind:checked={mikrotikConfig.enableAPI} />
                      Enable RouterOS API
                    </label>
                  </div>
                  
                  <div class="form-group">
                    <label>
                      <input type="checkbox" bind:checked={mikrotikConfig.enableSNMP} />
                      Enable SNMP
                    </label>
                  </div>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label>
                      <input type="checkbox" bind:checked={mikrotikConfig.enableWinbox} />
                      Enable Winbox
                    </label>
                  </div>
                  
                  <div class="form-group">
                    <label>
                      <input type="checkbox" bind:checked={mikrotikConfig.enableSSH} />
                      Enable SSH
                    </label>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- Wireless Tab -->
      {#if activeTab === 'wireless'}
        <div class="tab-content">
          <div class="form-section">
            <h3>Wireless Configuration</h3>
            
            <div class="form-group">
              <label>
                <input type="checkbox" bind:checked={mikrotikConfig.wirelessConfig.enabled} />
                Enable Wireless Configuration
              </label>
            </div>
            
            {#if mikrotikConfig.wirelessConfig.enabled}
              <div class="form-row">
                <div class="form-group">
                  <label for="wireless-mode">Mode</label>
                  <select id="wireless-mode" bind:value={mikrotikConfig.wirelessConfig.mode}>
                    <option value="ap-bridge">AP Bridge</option>
                    <option value="station">Station</option>
                    <option value="bridge">Bridge</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label for="band">Band</label>
                  <select id="band" bind:value={mikrotikConfig.wirelessConfig.band}>
                    <option value="2ghz-b/g/n">2.4GHz B/G/N</option>
                    <option value="5ghz-a/n/ac">5GHz A/N/AC</option>
                    <option value="2ghz-onlyn">2.4GHz N Only</option>
                    <option value="5ghz-onlyac">5GHz AC Only</option>
                  </select>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="ssid">SSID</label>
                  <input type="text" id="ssid" bind:value={mikrotikConfig.wirelessConfig.ssid} placeholder="MyWiFiNetwork" />
                </div>
                
                <div class="form-group">
                  <label for="frequency">Frequency/Channel</label>
                  <select id="frequency" bind:value={mikrotikConfig.wirelessConfig.frequency}>
                    {#each frequencyOptions as freq}
                      <option value={freq.value}>{freq.label}</option>
                    {/each}
                  </select>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="security">Security</label>
                  <select id="security" bind:value={mikrotikConfig.wirelessConfig.security}>
                    <option value="none">None (Open)</option>
                    <option value="wep">WEP</option>
                    <option value="wpa">WPA</option>
                    <option value="wpa2">WPA2</option>
                    <option value="wpa3">WPA3</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label for="tx-power">TX Power (dBm)</label>
                  <input type="number" id="tx-power" bind:value={mikrotikConfig.wirelessConfig.txPower} min="1" max="30" />
                </div>
              </div>
              
              {#if mikrotikConfig.wirelessConfig.security !== 'none'}
                <div class="form-group">
                  <label for="passphrase">Passphrase</label>
                  <div class="password-input">
                    <input type="password" id="passphrase" bind:value={mikrotikConfig.wirelessConfig.passphrase} />
                    <button type="button" class="btn btn-sm" onclick={generateWirelessPassword}>
                      🎲 Generate
                    </button>
                  </div>
                </div>
              {/if}
              
              <div class="form-group">
                <label for="country-code">Country Code</label>
                <select id="country-code" bind:value={mikrotikConfig.wirelessConfig.countryCode}>
                  <option value="united states3">United States</option>
                  <option value="canada">Canada</option>
                  <option value="united kingdom">United Kingdom</option>
                  <option value="germany">Germany</option>
                  <option value="france">France</option>
                  <option value="australia">Australia</option>
                </select>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- LTE Tab -->
      {#if activeTab === 'lte'}
        <div class="tab-content">
          <div class="form-section">
            <h3>LTE Configuration</h3>
            
            <div class="form-group">
              <label>
                <input type="checkbox" bind:checked={mikrotikConfig.lteConfig.enabled} />
                Enable LTE Configuration
              </label>
            </div>
            
            {#if mikrotikConfig.lteConfig.enabled}
              <div class="form-group">
                <label for="apn">APN (Access Point Name)</label>
                <input type="text" id="apn" bind:value={mikrotikConfig.lteConfig.apn} placeholder="internet" />
                <small>Contact your carrier for the correct APN</small>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="lte-username">Username (if required)</label>
                  <input type="text" id="lte-username" bind:value={mikrotikConfig.lteConfig.username} />
                </div>
                
                <div class="form-group">
                  <label for="lte-password">Password (if required)</label>
                  <input type="password" id="lte-password" bind:value={mikrotikConfig.lteConfig.password} />
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="pin-code">PIN Code (if required)</label>
                  <input type="password" id="pin-code" bind:value={mikrotikConfig.lteConfig.pinCode} placeholder="1234" />
                </div>
                
                <div class="form-group">
                  <label>
                    <input type="checkbox" bind:checked={mikrotikConfig.lteConfig.allowRoaming} />
                    Allow Roaming
                  </label>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- Monitoring Tab -->
      {#if activeTab === 'monitoring'}
        <div class="tab-content">
          <div class="form-section">
            <h3>Monitoring Configuration</h3>
            
            {#if mikrotikConfig.enableSNMP}
              <div class="form-section">
                <h4>SNMP Settings</h4>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="snmp-community">Community String</label>
                    <input type="text" id="snmp-community" bind:value={mikrotikConfig.snmpCommunity} />
                  </div>
                  
                  <div class="form-group">
                    <label for="polling-interval">Polling Interval (seconds)</label>
                    <input type="number" id="polling-interval" bind:value={mikrotikConfig.monitoringConfig.pollingInterval} min="10" max="3600" />
                  </div>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="snmp-location">SNMP Location</label>
                    <input type="text" id="snmp-location" bind:value={mikrotikConfig.snmpLocation} placeholder="Site Location" />
                  </div>
                  
                  <div class="form-group">
                    <label for="snmp-contact">SNMP Contact</label>
                    <input type="text" id="snmp-contact" bind:value={mikrotikConfig.snmpContact} placeholder="admin@example.com" />
                  </div>
                </div>
              </div>
            {/if}
            
            <div class="form-section">
              <h4>Health Monitoring</h4>
              
              <div class="form-row">
                <div class="form-group">
                  <label>
                    <input type="checkbox" bind:checked={mikrotikConfig.monitoringConfig.enableNetwatch} />
                    Enable Netwatch
                  </label>
                </div>
                
                <div class="form-group">
                  <label>
                    <input type="checkbox" bind:checked={mikrotikConfig.monitoringConfig.enableHealthCheck} />
                    Enable Health Monitoring
                  </label>
                </div>
              </div>
              
              {#if mikrotikConfig.monitoringConfig.enableNetwatch}
                <div class="form-group">
                  <label>Netwatch Hosts (one per line)</label>
                  <textarea 
                    bind:value={mikrotikConfig.monitoringConfig.netwatchHosts} 
                    rows="3" 
                    placeholder="8.8.8.8&#10;1.1.1.1&#10;google.com"
                    oninput={(e) => {
                      mikrotikConfig.monitoringConfig.netwatchHosts = e.target.value.split('\n').filter(h => h.trim());
                    }}
                  ></textarea>
                </div>
              {/if}
              
              <div class="form-group">
                <label>
                  <input type="checkbox" bind:checked={mikrotikConfig.monitoringConfig.enableTrafficMonitoring} />
                  Enable Traffic Monitoring
                </label>
              </div>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Security Tab -->
      {#if activeTab === 'security'}
        <div class="tab-content">
          <div class="form-section">
            <h3>Security Configuration</h3>
            
            <div class="form-row">
              <div class="form-group">
                <label>
                  <input type="checkbox" bind:checked={mikrotikConfig.securityConfig.changeDefaultPassword} />
                  Change Default Password
                </label>
              </div>
              
              <div class="form-group">
                <label>
                  <input type="checkbox" bind:checked={mikrotikConfig.securityConfig.disableDefaultServices} />
                  Disable Insecure Services
                </label>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>
                  <input type="checkbox" bind:checked={mikrotikConfig.securityConfig.enableFirewall} />
                  Enable Basic Firewall
                </label>
              </div>
              
              <div class="form-group">
                <label>
                  <input type="checkbox" bind:checked={mikrotikConfig.securityConfig.enableNeighborDiscovery} />
                  Enable Neighbor Discovery
                </label>
              </div>
            </div>
            
            {#if mikrotikConfig.securityConfig.enableFirewall}
              <div class="form-group">
                <label>Allowed Networks (CIDR format, one per line)</label>
                <textarea 
                  bind:value={mikrotikConfig.securityConfig.allowedNetworks} 
                  rows="3" 
                  placeholder="192.168.0.0/16&#10;10.0.0.0/8&#10;172.16.0.0/12"
                  oninput={(e) => {
                    mikrotikConfig.securityConfig.allowedNetworks = e.target.value.split('\n').filter(n => n.trim());
                  }}
                ></textarea>
              </div>
            {/if}
            
            <div class="form-group">
              <label>
                <input type="checkbox" bind:checked={mikrotikConfig.securityConfig.enableMacTelnet} />
                Enable MAC Telnet (Not Recommended)
              </label>
              <small>MAC Telnet allows access without IP configuration but is less secure</small>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Script Tab -->
      {#if activeTab === 'script'}
        <div class="tab-content">
          <div class="form-section">
            <h3>Configuration Script</h3>
            
            <button type="button" class="btn btn-primary" onclick={generateConfigurationScript} disabled={generatingConfig}>
              {#if generatingConfig}
                🔄 Generating...
              {:else}
                📝 Generate RouterOS Script
              {/if}
            </button>
            
            {#if generatedScript}
              <div class="script-container">
                <div class="script-header">
                  <span>RouterOS Configuration Script</span>
                  <button type="button" class="btn btn-secondary btn-sm" onclick={downloadScript}>
                    💾 Download
                  </button>
                </div>
                <pre class="script-content">{generatedScript}</pre>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
    
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick={handleCancel}>
        Cancel
      </button>
      <button type="button" class="btn btn-primary" onclick={handleSave}>
        Save Configuration
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
    max-width: 900px;
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
    min-width: 120px;
    padding: 1rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    font-weight: 500;
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .tab:hover:not(:disabled) {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }
  
  .tab:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 6px;
    background: var(--card-bg, white);
    color: var(--text-primary, #111827);
  }
  
  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
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
  
  .password-input {
    display: flex;
    gap: 0.5rem;
  }
  
  .password-input input {
    flex: 1;
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
  
  .script-container {
    margin-top: 1rem;
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .script-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary, #f9fafb);
    border-bottom: 1px solid var(--border-color, #d1d5db);
    font-weight: 500;
  }
  
  .script-content {
    padding: 1rem;
    background: var(--bg-tertiary, #f3f4f6);
    color: var(--text-primary, #111827);
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    max-height: 400px;
    overflow-y: auto;
    margin: 0;
    white-space: pre-wrap;
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
    
    .tabs {
      flex-wrap: wrap;
    }
    
    .tab {
      flex: none;
      min-width: auto;
    }
  }
</style>
