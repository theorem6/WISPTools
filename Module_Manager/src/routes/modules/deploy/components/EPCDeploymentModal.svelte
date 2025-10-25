<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';

  export let show = false;
  export let tenantId: string;

  const dispatch = createEventDispatcher();

  let activeStep: 'configure' | 'deploy' | 'download' = 'configure';
  let loading = false;
  let error = '';
  let success = '';
  let deploymentScript = '';

  // EPC Configuration
  let epcConfig = {
    siteName: '',
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
      hssPort: '3868',
      diameterRealm: 'example.com'
    }
  };

  onMount(async () => {
    if (show && tenantId) {
      // Initialize with tenant data if available
      console.log(`[EPCDeployment] Initializing for tenant: ${tenantId}`);
    }
  });

  $: if (show && tenantId && tenantId.trim() !== '') {
    console.log(`[EPCDeployment] Tenant loaded: ${tenantId}`);
  }

  function handleClose() {
    show = false;
    error = '';
    success = '';
    activeStep = 'configure';
    deploymentScript = '';
    dispatch('close');
  }

  function nextStep() {
    if (activeStep === 'configure') {
      activeStep = 'deploy';
    } else if (activeStep === 'deploy') {
      activeStep = 'download';
    }
  }

  function prevStep() {
    if (activeStep === 'download') {
      activeStep = 'deploy';
    } else if (activeStep === 'deploy') {
      activeStep = 'configure';
    }
  }

  function validateConfig(): boolean {
    if (!epcConfig.siteName.trim()) {
      error = 'Site name is required';
      return false;
    }
    if (!epcConfig.location.address.trim()) {
      error = 'Address is required';
      return false;
    }
    if (!epcConfig.contact.name.trim()) {
      error = 'Contact name is required';
      return false;
    }
    if (!epcConfig.contact.email.trim()) {
      error = 'Contact email is required';
      return false;
    }
    return true;
  }

  async function generateDeploymentScript() {
    if (!validateConfig()) {
      return;
    }

    loading = true;
    error = '';

    try {
      console.log('[EPCDeployment] Generating deployment script...');
      
      // Generate the deployment script
      deploymentScript = generateScript();
      activeStep = 'download';
      success = 'Deployment script generated successfully';
    } catch (err: any) {
      console.error('[EPCDeployment] Failed to generate script:', err);
      error = `Failed to generate script: ${err.message || 'Unknown error'}`;
    } finally {
      loading = false;
    }
  }

  function generateScript(): string {
    const script = `#!/bin/bash
# Open5GS EPC Deployment Script
# Generated for ${epcConfig.siteName}
# Date: ${new Date().toISOString()}

set -e

echo "🚀 Starting Open5GS EPC deployment for ${epcConfig.siteName}..."

# Configuration
SITE_NAME="${epcConfig.siteName}"
MCC="${epcConfig.networkConfig.mcc}"
MNC="${epcConfig.networkConfig.mnc}"
TAC="${epcConfig.networkConfig.tac}"
PLMN="${epcConfig.networkConfig.plmn}"
HSS_HOST="${epcConfig.hssConfig.hssHost}"
HSS_PORT="${epcConfig.hssConfig.hssPort}"
DIAMETER_REALM="${epcConfig.hssConfig.diameterRealm}"

# Contact Information
CONTACT_NAME="${epcConfig.contact.name}"
CONTACT_EMAIL="${epcConfig.contact.email}"
CONTACT_PHONE="${epcConfig.contact.phone}"

# Location
ADDRESS="${epcConfig.location.address}"
CITY="${epcConfig.location.city}"
STATE="${epcConfig.location.state}"
COUNTRY="${epcConfig.location.country}"
LATITUDE="${epcConfig.location.coordinates.latitude}"
LONGITUDE="${epcConfig.location.coordinates.longitude}"

echo "📍 Site: $SITE_NAME"
echo "🌐 Network: MCC=$MCC, MNC=$MNC, TAC=$TAC"
echo "📡 HSS: $HSS_HOST:$HSS_PORT"
echo "📍 Location: $ADDRESS, $CITY, $STATE, $COUNTRY"

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install dependencies
echo "🔧 Installing dependencies..."
sudo apt install -y \\
    build-essential \\
    pkg-config \\
    libssl-dev \\
    libsctp-dev \\
    libgnutls28-dev \\
    libgcrypt20-dev \\
    libidn11-dev \\
    libmongoc-dev \\
    libbson-dev \\
    libyaml-dev \\
    libmicrohttpd-dev \\
    libcurl4-gnutls-dev \\
    libnghttp2-dev \\
    libtins-dev \\
    libtalloc-dev \\
    meson \\
    ninja-build \\
    git \\
    curl \\
    wget \\
    vim \\
    htop

# Install Open5GS
echo "📡 Installing Open5GS..."
cd /opt
if [ ! -d "open5gs" ]; then
    git clone https://github.com/open5gs/open5gs.git
fi
cd open5gs
git checkout v2.7.6
meson build --prefix=/usr/local
ninja -C build
sudo ninja -C build install

# Create systemd service files
echo "⚙️ Creating systemd services..."

# MME service
sudo tee /etc/systemd/system/open5gs-mmed.service > /dev/null <<EOF
[Unit]
Description=Open5GS MME (Mobility Management Entity)
After=network.target

[Service]
Type=simple
User=open5gs
Group=open5gs
ExecStart=/usr/local/bin/open5gs-mmed
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# SGW service
sudo tee /etc/systemd/system/open5gs-sgwd.service > /dev/null <<EOF
[Unit]
Description=Open5GS SGW (Serving Gateway)
After=network.target

[Service]
Type=simple
User=open5gs
Group=open5gs
ExecStart=/usr/local/bin/open5gs-sgwd
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# PGW service
sudo tee /etc/systemd/system/open5gs-pgwd.service > /dev/null <<EOF
[Unit]
Description=Open5GS PGW (Packet Gateway)
After=network.target

[Service]
Type=simple
User=open5gs
Group=open5gs
ExecStart=/usr/local/bin/open5gs-pgwd
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# PCRF service
sudo tee /etc/systemd/system/open5gs-pcrfd.service > /dev/null <<EOF
[Unit]
Description=Open5GS PCRF (Policy and Charging Rules Function)
After=network.target

[Service]
Type=simple
User=open5gs
Group=open5gs
ExecStart=/usr/local/bin/open5gs-pcrfd
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Create open5gs user
echo "👤 Creating open5gs user..."
sudo useradd -r -s /bin/false open5gs || true

# Create configuration directory
sudo mkdir -p /etc/open5gs
sudo chown open5gs:open5gs /etc/open5gs

# Generate configuration files
echo "📝 Generating configuration files..."

# MME configuration
sudo tee /etc/open5gs/mme.yaml > /dev/null <<EOF
mme:
  freeDiameter:
    identity: mme.${DIAMETER_REALM}
    realm: ${DIAMETER_REALM}
    port: 3868
    listen_on: 0.0.0.0
    no_fwd: false
    no_fwd_peer: false
    load_extension:
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dbg_msg_dumps.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_rfc5777.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_mip6i.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_nasreq.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_nas_mipv6.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_dcca.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_3gpp2_avps.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_3gpp_ts29_272.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_3gpp_ts29_273.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_3gpp_ts29_329.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_3gpp_ts29_329_avps.fdx
    connect_peer:
      - identity: hss.${DIAMETER_REALM}
        realm: ${DIAMETER_REALM}
        port: ${HSS_PORT}
        host: ${HSS_HOST}
  s1ap:
    addr: 0.0.0.0
  s11:
    addr: 0.0.0.0
  s6a:
    addr: 0.0.0.0
  s10:
    addr: 0.0.0.0
  s3:
    addr: 0.0.0.0
  s1ap:
    addr: 0.0.0.0
  guami:
    - plmn_id:
        mcc: ${MCC}
        mnc: ${MNC}
      amf_id:
        region: 2
        set: 1
  tai:
    - plmn_id:
        mcc: ${MCC}
        mnc: ${MNC}
      tac: ${TAC}
  plmn_support:
    - plmn_id:
        mcc: ${MCC}
        mnc: ${MNC}
      s_nssai:
        - sst: 1
  security:
    integrity_order:
      - NIA2
      - NIA1
      - NIA0
    ciphering_order:
      - NEA2
      - NEA1
      - NEA0
  network_name:
    full: ${SITE_NAME} EPC
    short: ${SITE_NAME}
  amf:
    addr: 0.0.0.0
  sbi:
    addr: 0.0.0.0
    port: 7777
  ngap:
    addr: 0.0.0.0
  metrics:
    addr: 0.0.0.0
    port: 9090
logger:
  file: /var/log/open5gs/mme.log
  level: info
parameter:
  use_console: true
  use_file: true
  use_syslog: false
  filename: /var/log/open5gs/mme.log
  max_file_size: 10MB
  max_files: 5
EOF

# SGW configuration
sudo tee /etc/open5gs/sgwd.yaml > /dev/null <<EOF
sgw:
  gtpu:
    addr: 0.0.0.0
  s5c:
    addr: 0.0.0.0
  s11:
    addr: 0.0.0.0
  pfcp:
    addr: 0.0.0.0
  metrics:
    addr: 0.0.0.0
    port: 9091
logger:
  file: /var/log/open5gs/sgwd.log
  level: info
parameter:
  use_console: true
  use_file: true
  use_syslog: false
  filename: /var/log/open5gs/sgwd.log
  max_file_size: 10MB
  max_files: 5
EOF

# PGW configuration
sudo tee /etc/open5gs/pgwd.yaml > /dev/null <<EOF
pgw:
  gtpu:
    addr: 0.0.0.0
  s5c:
    addr: 0.0.0.0
  sgi:
    addr: 0.0.0.0
  pfcp:
    addr: 0.0.0.0
  metrics:
    addr: 0.0.0.0
    port: 9092
logger:
  file: /var/log/open5gs/pgwd.log
  level: info
parameter:
  use_console: true
  use_file: true
  use_syslog: false
  filename: /var/log/open5gs/pgwd.log
  max_file_size: 10MB
  max_files: 5
EOF

# PCRF configuration
sudo tee /etc/open5gs/pcrfd.yaml > /dev/null <<EOF
pcrf:
  freeDiameter:
    identity: pcrf.${DIAMETER_REALM}
    realm: ${DIAMETER_REALM}
    port: 3868
    listen_on: 0.0.0.0
    no_fwd: false
    no_fwd_peer: false
    load_extension:
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dbg_msg_dumps.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_rfc5777.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_mip6i.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_nasreq.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_nas_mipv6.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_dcca.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_3gpp2_avps.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_3gpp_ts29_272.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_3gpp_ts29_273.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_3gpp_ts29_329.fdx
      - /usr/local/lib/x86_64-linux-gnu/freeDiameter/dict_3gpp_ts29_329_avps.fdx
    connect_peer:
      - identity: hss.${DIAMETER_REALM}
        realm: ${DIAMETER_REALM}
        port: ${HSS_PORT}
        host: ${HSS_HOST}
  gx:
    addr: 0.0.0.0
  rx:
    addr: 0.0.0.0
  metrics:
    addr: 0.0.0.0
    port: 9093
logger:
  file: /var/log/open5gs/pcrfd.log
  level: info
parameter:
  use_console: true
  use_file: true
  use_syslog: false
  filename: /var/log/open5gs/pcrfd.log
  max_file_size: 10MB
  max_files: 5
EOF

# Create log directory
sudo mkdir -p /var/log/open5gs
sudo chown open5gs:open5gs /var/log/open5gs

# Reload systemd
sudo systemctl daemon-reload

# Enable services
echo "🔧 Enabling services..."
sudo systemctl enable open5gs-mmed
sudo systemctl enable open5gs-sgwd
sudo systemctl enable open5gs-pgwd
sudo systemctl enable open5gs-pcrfd

# Start services
echo "🚀 Starting services..."
sudo systemctl start open5gs-mmed
sudo systemctl start open5gs-sgwd
sudo systemctl start open5gs-pgwd
sudo systemctl start open5gs-pcrfd

# Check service status
echo "📊 Checking service status..."
sudo systemctl status open5gs-mmed --no-pager
sudo systemctl status open5gs-sgwd --no-pager
sudo systemctl status open5gs-pgwd --no-pager
sudo systemctl status open5gs-pcrfd --no-pager

echo "✅ Open5GS EPC deployment completed for $SITE_NAME!"
echo "📍 Site: $SITE_NAME"
echo "🌐 Network: MCC=$MCC, MNC=$MNC, TAC=$TAC"
echo "📡 HSS: $HSS_HOST:$HSS_PORT"
echo "📍 Location: $ADDRESS, $CITY, $STATE, $COUNTRY"
echo "📞 Contact: $CONTACT_NAME ($CONTACT_EMAIL)"
echo ""
echo "🔧 Service Management:"
echo "  sudo systemctl status open5gs-mmed"
echo "  sudo systemctl status open5gs-sgwd"
echo "  sudo systemctl status open5gs-pgwd"
echo "  sudo systemctl status open5gs-pcrfd"
echo ""
echo "📋 Logs:"
echo "  sudo journalctl -u open5gs-mmed -f"
echo "  sudo journalctl -u open5gs-sgwd -f"
echo "  sudo journalctl -u open5gs-pgwd -f"
echo "  sudo journalctl -u open5gs-pcrfd -f"
echo ""
echo "🎉 EPC deployment successful!";
`;

    return script;
  }

  function downloadScript() {
    if (!deploymentScript) {
      error = 'No deployment script available';
      return;
    }

    try {
      const blob = new Blob([deploymentScript], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `epc-deploy-${epcConfig.siteName.replace(/[^a-zA-Z0-9]/g, '-')}.sh`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      success = 'Deployment script downloaded successfully';
    } catch (err: any) {
      console.error('[EPCDeployment] Download failed:', err);
      error = `Download failed: ${err.message || 'Unknown error'}`;
    }
  }

  function getStepTitle(): string {
    switch (activeStep) {
      case 'configure': return 'Configure EPC';
      case 'deploy': return 'Deploy EPC';
      case 'download': return 'Download Script';
      default: return 'Unknown';
    }
  }

  function getStepDescription(): string {
    switch (activeStep) {
      case 'configure': return 'Configure EPC parameters and network settings';
      case 'deploy': return 'Review configuration and generate deployment script';
      case 'download': return 'Download and execute the deployment script';
      default: return '';
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-content epc-deployment-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>🚀 EPC Deployment</h2>
        <button class="close-btn" on:click={handleClose}>✕</button>
      </div>

      {#if error}
        <div class="error-banner">{error}</div>
      {/if}

      {#if success}
        <div class="success-banner">{success}</div>
      {/if}

      <div class="modal-body">
        <!-- Progress Steps -->
        <div class="progress-steps">
          <div class="step" class:active={activeStep === 'configure'} class:completed={activeStep === 'deploy' || activeStep === 'download'}>
            <div class="step-number">1</div>
            <div class="step-title">Configure</div>
          </div>
          <div class="step" class:active={activeStep === 'deploy'} class:completed={activeStep === 'download'}>
            <div class="step-number">2</div>
            <div class="step-title">Deploy</div>
          </div>
          <div class="step" class:active={activeStep === 'download'}>
            <div class="step-number">3</div>
            <div class="step-title">Download</div>
          </div>
        </div>

        <!-- Step Content -->
        <div class="step-content">
          <div class="step-header">
            <h3>{getStepTitle()}</h3>
            <p>{getStepDescription()}</p>
          </div>

          {#if activeStep === 'configure'}
            <div class="config-form">
              <div class="form-section">
                <h4>📍 Site Information</h4>
                <div class="form-group">
                  <label for="siteName">Site Name *</label>
                  <input 
                    id="siteName" 
                    type="text" 
                    bind:value={epcConfig.siteName} 
                    placeholder="Enter site name"
                    required
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
                      bind:value={epcConfig.networkConfig.mcc} 
                      placeholder="001"
                      required
                    />
                  </div>
                  <div class="form-group">
                    <label for="mnc">MNC *</label>
                    <input 
                      id="mnc" 
                      type="text" 
                      bind:value={epcConfig.networkConfig.mnc} 
                      placeholder="01"
                      required
                    />
                  </div>
                  <div class="form-group">
                    <label for="tac">TAC *</label>
                    <input 
                      id="tac" 
                      type="text" 
                      bind:value={epcConfig.networkConfig.tac} 
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
                    bind:value={epcConfig.location.address} 
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
                      bind:value={epcConfig.location.city} 
                      placeholder="Enter city"
                    />
                  </div>
                  <div class="form-group">
                    <label for="state">State</label>
                    <input 
                      id="state" 
                      type="text" 
                      bind:value={epcConfig.location.state} 
                      placeholder="Enter state"
                    />
                  </div>
                  <div class="form-group">
                    <label for="country">Country</label>
                    <input 
                      id="country" 
                      type="text" 
                      bind:value={epcConfig.location.country} 
                      placeholder="Enter country"
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
                    bind:value={epcConfig.contact.name} 
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
                      bind:value={epcConfig.contact.email} 
                      placeholder="Enter email"
                      required
                    />
                  </div>
                  <div class="form-group">
                    <label for="contactPhone">Phone</label>
                    <input 
                      id="contactPhone" 
                      type="tel" 
                      bind:value={epcConfig.contact.phone} 
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
                      bind:value={epcConfig.hssConfig.hssHost} 
                      placeholder="HSS host"
                    />
                  </div>
                  <div class="form-group">
                    <label for="hssPort">HSS Port</label>
                    <input 
                      id="hssPort" 
                      type="text" 
                      bind:value={epcConfig.hssConfig.hssPort} 
                      placeholder="3868"
                    />
                  </div>
                </div>
                <div class="form-group">
                  <label for="diameterRealm">Diameter Realm</label>
                  <input 
                    id="diameterRealm" 
                    type="text" 
                    bind:value={epcConfig.hssConfig.diameterRealm} 
                    placeholder="example.com"
                  />
                </div>
              </div>
            </div>

          {:else if activeStep === 'deploy'}
            <div class="deploy-review">
              <h4>📋 Configuration Review</h4>
              <div class="review-grid">
                <div class="review-item">
                  <strong>Site Name:</strong>
                  <span>{epcConfig.siteName}</span>
                </div>
                <div class="review-item">
                  <strong>Network:</strong>
                  <span>MCC: {epcConfig.networkConfig.mcc}, MNC: {epcConfig.networkConfig.mnc}, TAC: {epcConfig.networkConfig.tac}</span>
                </div>
                <div class="review-item">
                  <strong>Location:</strong>
                  <span>{epcConfig.location.address}, {epcConfig.location.city}, {epcConfig.location.state}, {epcConfig.location.country}</span>
                </div>
                <div class="review-item">
                  <strong>Contact:</strong>
                  <span>{epcConfig.contact.name} ({epcConfig.contact.email})</span>
                </div>
                <div class="review-item">
                  <strong>HSS:</strong>
                  <span>{epcConfig.hssConfig.hssHost}:{epcConfig.hssConfig.hssPort}</span>
                </div>
              </div>

              <div class="deploy-info">
                <h4>🚀 Deployment Information</h4>
                <p>The deployment script will:</p>
                <ul>
                  <li>Install Open5GS EPC components (MME, SGW, PGW, PCRF)</li>
                  <li>Configure network parameters and HSS connection</li>
                  <li>Set up systemd services for automatic startup</li>
                  <li>Create configuration files with your settings</li>
                  <li>Start all EPC services</li>
                </ul>
              </div>
            </div>

          {:else if activeStep === 'download'}
            <div class="download-content">
              <h4>📥 Download Deployment Script</h4>
              <p>The deployment script is ready for download. This script will automatically install and configure Open5GS EPC on your server.</p>
              
              <div class="script-preview">
                <h5>Script Preview:</h5>
                <pre><code>{deploymentScript.substring(0, 500)}...</code></pre>
              </div>

              <div class="download-instructions">
                <h5>📋 Instructions:</h5>
                <ol>
                  <li>Download the script to your server</li>
                  <li>Make it executable: <code>chmod +x epc-deploy-*.sh</code></li>
                  <li>Run the script: <code>sudo ./epc-deploy-*.sh</code></li>
                  <li>Monitor the deployment progress</li>
                  <li>Check service status after completion</li>
                </ol>
              </div>
            </div>
          {/if}
        </div>

        <!-- Navigation -->
        <div class="step-navigation">
          {#if activeStep !== 'configure'}
            <button class="btn-secondary" on:click={prevStep}>
              ← Previous
            </button>
          {/if}
          
          {#if activeStep === 'configure'}
            <button class="btn-primary" on:click={nextStep} disabled={!validateConfig()}>
              Next →
            </button>
          {:else if activeStep === 'deploy'}
            <button 
              class="btn-primary" 
              on:click={generateDeploymentScript}
              disabled={loading}
            >
              {#if loading}
                <div class="loading-spinner small"></div>
                Generating...
              {:else}
                Generate Script →
              {/if}
            </button>
          {:else if activeStep === 'download'}
            <button class="btn-primary" on:click={downloadScript}>
              📥 Download Script
            </button>
          {/if}
        </div>
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

  .epc-deployment-modal {
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

  .progress-steps {
    display: flex;
    justify-content: center;
    margin-bottom: var(--spacing-xl);
    gap: var(--spacing-lg);
  }

  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    opacity: 0.5;
    transition: all 0.3s ease;
  }

  .step.active {
    opacity: 1;
  }

  .step.completed {
    opacity: 1;
  }

  .step-number {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    transition: all 0.3s ease;
  }

  .step.active .step-number {
    background: var(--primary);
    color: white;
  }

  .step.completed .step-number {
    background: var(--success);
    color: white;
  }

  .step-title {
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .step.active .step-title {
    color: var(--text-primary);
  }

  .step-content {
    margin-bottom: var(--spacing-xl);
  }

  .step-header {
    margin-bottom: var(--spacing-lg);
  }

  .step-header h3 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-primary);
  }

  .step-header p {
    margin: 0;
    color: var(--text-secondary);
  }

  .config-form {
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

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }

  .deploy-review {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .review-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-md);
  }

  .review-item {
    background: var(--bg-secondary);
    padding: var(--spacing-md);
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--border-color);
  }

  .review-item strong {
    display: block;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .review-item span {
    color: var(--text-secondary);
  }

  .deploy-info {
    background: var(--bg-secondary);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius-md);
    border: 1px solid var(--border-color);
  }

  .deploy-info h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
  }

  .deploy-info ul {
    margin: var(--spacing-md) 0;
    padding-left: var(--spacing-lg);
  }

  .deploy-info li {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  .download-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .script-preview {
    background: var(--bg-secondary);
    padding: var(--spacing-md);
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--border-color);
  }

  .script-preview h5 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-primary);
  }

  .script-preview pre {
    margin: 0;
    overflow-x: auto;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .download-instructions {
    background: var(--bg-secondary);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius-md);
    border: 1px solid var(--border-color);
  }

  .download-instructions h5 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
  }

  .download-instructions ol {
    margin: 0;
    padding-left: var(--spacing-lg);
  }

  .download-instructions li {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-sm);
  }

  .download-instructions code {
    background: var(--bg-tertiary);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    font-family: monospace;
    font-size: 0.9rem;
  }

  .step-navigation {
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
    .epc-deployment-modal {
      width: 95%;
      max-width: none;
    }

    .progress-steps {
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .review-grid {
      grid-template-columns: 1fr;
    }

    .step-navigation {
      flex-direction: column;
      gap: var(--spacing-md);
    }
  }
</style>
