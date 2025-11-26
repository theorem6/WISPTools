<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';

  export let show = false;
  export let tenantId: string;
  export let siteData: any = null;

  const dispatch = createEventDispatcher();

  let currentStep = 1;
  let totalSteps = 7; // Will be calculated based on deployment type
  let deploymentScript = '';
  let deploymentOption: 'script' | 'iso' | null = null; // Set at final step
  let loading = false;
  let error = '';
  let success = '';
  // deploymentScript and deploymentOption moved above
  let deploymentType: 'epc' | 'snmp' | 'both' = 'epc'; // Deployment type selection
  type TenantContactKey = 'contactName' | 'contactEmail' | 'contactPhone';
  type TenantContactRecord = Partial<Record<TenantContactKey, string>>;

  function getTenantContactField(field: TenantContactKey): string {
    const tenant = $currentTenant as unknown as TenantContactRecord | null;
    const value = tenant?.[field];
    return typeof value === 'string' ? value : '';
  }


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
      hssPort: '3001',
      diameterRealm: 'wisptools.io'
    },
    // SNMP Configuration
    snmpConfig: {
      enabled: true,
      version: '2c', // '1', '2c', or '3'
      community: 'public',
      port: 161,
      // SNMPv3 specific
      username: '',
      authProtocol: 'SHA',
      authKey: '',
      privProtocol: 'AES',
      privKey: '',
      // Cloud reporting
      cloudApiUrl: 'http://136.112.111.167:3003',
      reportingInterval: 60,
      enableTraps: true,
      trapPort: 162
    },
    // APT Repository Configuration
    aptConfig: {
      enabled: true,
      repositoryUrl: 'http://136.112.111.167:3003/apt',
      autoUpdate: false,
      updateSchedule: 'daily', // 'hourly', 'daily', 'weekly'
      updateTime: '02:00',
      securityUpdatesOnly: false
    }
  };

  onMount(async () => {
    if (show) {
      if (siteData) {
        // Initialize with site data
        console.log(`[EPCDeployment] Initializing for site: ${siteData.name}`);
        epcConfig.siteName = siteData.name || '';
        epcConfig.location.address = siteData.location?.address || '';
        epcConfig.location.city = siteData.location?.city || '';
        epcConfig.location.state = siteData.location?.state || '';
        epcConfig.location.coordinates.latitude = siteData.location?.latitude || 0;
        epcConfig.location.coordinates.longitude = siteData.location?.longitude || 0;
        
        if (siteData.siteContact) {
          epcConfig.contact.name = siteData.siteContact.name || '';
          epcConfig.contact.email = siteData.siteContact.email || '';
          epcConfig.contact.phone = siteData.siteContact.phone || '';
        }
      } else if ($currentTenant?.id) {
        // Initialize with tenant data if available
        console.log(`[EPCDeployment] Initializing for tenant: ${$currentTenant.id}`);
        epcConfig.siteName = $currentTenant.name || '';
        epcConfig.contact.name = getTenantContactField('contactName');
        epcConfig.contact.email = getTenantContactField('contactEmail');
        epcConfig.contact.phone = getTenantContactField('contactPhone');
      }
    }
  });

  $: if (show && siteData) {
    console.log(`[EPCDeployment] Site data loaded: ${siteData.name}`);
    epcConfig.siteName = siteData.name || '';
    epcConfig.location.address = siteData.location?.address || '';
    epcConfig.location.city = siteData.location?.city || '';
    epcConfig.location.state = siteData.location?.state || '';
    epcConfig.location.coordinates.latitude = siteData.location?.latitude || 0;
    epcConfig.location.coordinates.longitude = siteData.location?.longitude || 0;
    
    if (siteData.siteContact) {
      epcConfig.contact.name = siteData.siteContact.name || '';
      epcConfig.contact.email = siteData.siteContact.email || '';
      epcConfig.contact.phone = siteData.siteContact.phone || '';
    }
  }

  // Update SNMP enabled state based on deployment type
  $: if (show) {
    epcConfig.snmpConfig.enabled = deploymentType === 'snmp' || deploymentType === 'both';
  }

  $: if (show && $currentTenant?.id && $currentTenant.id.trim() !== '') {
    console.log(`[EPCDeployment] Tenant loaded: ${$currentTenant.id}`);
    if (!siteData) {
      epcConfig.contact.name = getTenantContactField('contactName');
      epcConfig.contact.email = getTenantContactField('contactEmail');
      epcConfig.contact.phone = getTenantContactField('contactPhone');
    }
  }

  function handleClose() {
    show = false;
    error = '';
    success = '';
      currentStep = 1;
      deploymentOption = null;
    deploymentScript = '';
    dispatch('close');
  }

  // Removed step-based navigation, using tabs instead

  function validateConfig(): boolean {
    if (!epcConfig.siteName || !epcConfig.siteName.trim()) {
      return false;
    }
    if (!epcConfig.location.address || !epcConfig.location.address.trim()) {
      return false;
    }
    if (!epcConfig.contact.name || !epcConfig.contact.name.trim()) {
      return false;
    }
    if (!epcConfig.contact.email || !epcConfig.contact.email.trim()) {
      return false;
    }
    // EPC network validation (only when EPC is selected)
    if (deploymentType === 'epc' || deploymentType === 'both') {
      if (!epcConfig.networkConfig.mcc || !epcConfig.networkConfig.mcc.trim()) {
        return false;
      }
      if (!epcConfig.networkConfig.mnc || !epcConfig.networkConfig.mnc.trim()) {
        return false;
      }
      if (!epcConfig.networkConfig.tac || !epcConfig.networkConfig.tac.trim()) {
        return false;
      }
    }
    return true;
  }

  function getValidationErrors(): string[] {
    const errors: string[] = [];
    if (!epcConfig.siteName || !epcConfig.siteName.trim()) {
      errors.push('Site Name is required');
    }
    if (!epcConfig.location.address || !epcConfig.location.address.trim()) {
      errors.push('Address is required');
    }
    if (!epcConfig.contact.name || !epcConfig.contact.name.trim()) {
      errors.push('Contact Name is required');
    }
    if (!epcConfig.contact.email || !epcConfig.contact.email.trim()) {
      errors.push('Contact Email is required');
    }
    // EPC network validation (only when EPC is selected)
    if (deploymentType === 'epc' || deploymentType === 'both') {
      if (!epcConfig.networkConfig.mcc || !epcConfig.networkConfig.mcc.trim()) {
        errors.push('MCC is required for EPC deployment');
      }
      if (!epcConfig.networkConfig.mnc || !epcConfig.networkConfig.mnc.trim()) {
        errors.push('MNC is required for EPC deployment');
      }
      if (!epcConfig.networkConfig.tac || !epcConfig.networkConfig.tac.trim()) {
        errors.push('TAC is required for EPC deployment');
      }
    }
    return errors;
  }

  // Calculate total steps based on deployment type
  $: {
    let steps = 2; // Step 1: Deployment Type, Step 2: Site Info
    if (deploymentType === 'epc' || deploymentType === 'both') {
      steps += 2; // Network Config, HSS Config
    }
    if (deploymentType === 'snmp' || deploymentType === 'both') {
      steps += 1; // SNMP Config
    }
    steps += 1; // APT Config
    steps += 1; // Review
    steps += 1; // Download (script/ISO selection)
    totalSteps = steps;
  }

  // Helper function to get step number for each section
  function getStepNumber(section: 'deployment' | 'site' | 'network' | 'hss' | 'snmp' | 'apt' | 'review' | 'download'): number {
    let step = 1;
    if (section === 'deployment') return step;
    step++; // site
    if (section === 'site') return step;
    if (deploymentType === 'epc' || deploymentType === 'both') {
      step++; // network
      if (section === 'network') return step;
      step++; // hss
      if (section === 'hss') return step;
    }
    if (deploymentType === 'snmp' || deploymentType === 'both') {
      step++; // snmp
      if (section === 'snmp') return step;
    }
    step++; // apt
    if (section === 'apt') return step;
    step++; // review
    if (section === 'review') return step;
    step++; // download
    if (section === 'download') return step;
    return step;
  }

  function nextStep() {
    // Validate current step before proceeding
    if (currentStep === getStepNumber('deployment')) {
      // Step 1: Deployment Type - no validation needed
      currentStep++;
    } else if (currentStep === getStepNumber('site')) {
      // Site Info
      if (!epcConfig.siteName || !epcConfig.location.address || !epcConfig.contact.name || !epcConfig.contact.email) {
        error = 'Please fill in all required fields';
        return;
      }
      currentStep++;
    } else if (currentStep === getStepNumber('network')) {
      // Network Config (if EPC)
      if (!epcConfig.networkConfig.mcc || !epcConfig.networkConfig.mnc || !epcConfig.networkConfig.tac) {
        error = 'Please fill in all network configuration fields';
        return;
      }
      currentStep++;
    } else if (currentStep === getStepNumber('hss')) {
      // HSS Config (if EPC)
      currentStep++;
    } else if (currentStep === getStepNumber('snmp')) {
      // SNMP Config (if SNMP)
      currentStep++;
    } else if (currentStep === getStepNumber('apt')) {
      // APT Config
      currentStep++;
    } else if (currentStep === getStepNumber('review')) {
      // Review step - generate script
      generateDeploymentScript();
      currentStep++;
    } else if (currentStep === getStepNumber('download')) {
      // Download step - handled by download button
      return;
    }
    error = '';
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      error = '';
    }
  }

  function handleNextClick() {
    nextStep();
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
      success = 'Deployment script generated successfully';
    } catch (err: any) {
      console.error('[EPCDeployment] Failed to generate script:', err);
      error = `Failed to generate script: ${err.message || 'Unknown error'}`;
    } finally {
      loading = false;
    }
  }

  function generateScript(): string {
    const deploymentTypes = deploymentType === 'both' ? ['epc', 'snmp'] : [deploymentType];
    const includeEPC = deploymentTypes.includes('epc');
    const includeSNMP = deploymentTypes.includes('snmp');
    
    const script = `#!/bin/bash
# Ubuntu Deployment Script - ${deploymentType.toUpperCase()}
# Generated for ${epcConfig.siteName}
# Date: ${new Date().toISOString()}
# Deployment Type: ${deploymentType}

set -e

echo "🚀 Starting deployment for ${epcConfig.siteName}..."
echo "📦 Deployment Components: ${deploymentTypes.join(' + ').toUpperCase()}"

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

# Configure APT Repository (for remote updates)
${epcConfig.aptConfig.enabled ? `# Setup APT Repository for remote updates
echo "📦 Configuring APT repository for remote updates..."
APT_REPO_URL="${epcConfig.aptConfig.repositoryUrl}"

# Create APT source list entry
sudo tee /etc/apt/sources.list.d/wisptools.list > /dev/null <<APTSOURCE
deb ${epcConfig.aptConfig.repositoryUrl}/${$currentTenant?.id || 'default'} / 
APTSOURCE

# Download and add GPG key (if available)
echo "🔑 Setting up APT repository GPG key..."
curl -fsSL ${epcConfig.aptConfig.repositoryUrl}/gpg.asc | sudo apt-key add - || echo "⚠️  GPG key not available, continuing..."

# Update package lists with new repository
sudo apt update || echo "⚠️  APT repository not accessible, continuing..."

${epcConfig.aptConfig.autoUpdate ? `# Setup automatic updates
echo "⏰ Configuring automatic updates (${epcConfig.aptConfig.updateSchedule} at ${epcConfig.aptConfig.updateTime})..."
sudo apt install -y unattended-upgrades

# Configure unattended-upgrades
sudo tee /etc/apt/apt.conf.d/50unattended-upgrades > /dev/null <<UNATTENDED
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
${epcConfig.aptConfig.securityUpdatesOnly ? '' : `    "\${distro_id}:\${distro_codename}-updates";
    "wisptools:${$currentTenant?.id || 'default'}";`}
};
Unattended-Upgrade::Package-Blacklist {
};
Unattended-Upgrade::DevRelease "false";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
UNATTENDED

# Enable automatic updates
echo 'APT::Periodic::Update-Package-Lists "1";' | sudo tee /etc/apt/apt.conf.d/20auto-updates > /dev/null
echo 'APT::Periodic::Unattended-Upgrade "1";' | sudo tee -a /etc/apt/apt.conf.d/20auto-updates > /dev/null
` : ''}
` : '# APT Repository disabled - remote updates not configured'}

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

${includeSNMP ? `# Install SNMP Agent
echo "📊 Installing SNMP Agent and Mikrotik monitoring modules..."
sudo apt install -y snmpd snmp snmp-mibs-downloader nodejs npm

# Create SNMP agent configuration
echo "📝 Configuring SNMP agent..."
sudo tee /etc/snmp/snmpd.conf > /dev/null <<SNMPCONF
# SNMP Agent Configuration
agentAddress udp:${epcConfig.snmpConfig.port || 161},udp6:${epcConfig.snmpConfig.port || 161}
${epcConfig.snmpConfig.version === '3' ? `
# SNMPv3 Configuration
createUser ${epcConfig.snmpConfig.username || 'snmpuser'} ${epcConfig.snmpConfig.authProtocol || 'SHA'} "${epcConfig.snmpConfig.authKey || ''}" ${epcConfig.snmpConfig.privProtocol || 'AES'} "${epcConfig.snmpConfig.privKey || ''}"
rwuser ${epcConfig.snmpConfig.username || 'snmpuser'}
` : `# SNMPv${epcConfig.snmpConfig.version || '2c'} Configuration
rocommunity ${epcConfig.snmpConfig.community || 'public'} default
rwcommunity ${epcConfig.snmpConfig.community || 'public'} default
`}
# System information
sysLocation "${epcConfig.location.address || 'Unknown'}"
sysContact "${epcConfig.contact.email || 'admin@wisptools.io'}"
sysName "${epcConfig.siteName || 'WISP-Tools-Device'}"

# Allow SNMP access
${epcConfig.snmpConfig.enableTraps ? `# SNMP Traps
trapsink localhost ${epcConfig.snmpConfig.trapPort || 162}
` : ''}
SNMPCONF

# Install Node.js if not present (required for SNMP agent)
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js for SNMP agent..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Create SNMP agent service for cloud reporting
echo "⚙️ Creating SNMP cloud reporting service..."
sudo mkdir -p /opt/wisptools/snmp-agent
sudo tee /opt/wisptools/snmp-agent/agent.js > /dev/null <<SNMPAGENT
#!/usr/bin/env node
// WISP Tools SNMP Agent - Cloud Reporting Service
const snmp = require('net-snmp');
const http = require('http');

const CLOUD_API_URL = "${epcConfig.snmpConfig.cloudApiUrl || 'http://136.112.111.167:3003'}";
const REPORTING_INTERVAL = ${epcConfig.snmpConfig.reportingInterval || 60} * 1000;
const SITE_NAME = "${epcConfig.siteName}";

// SNMP session configuration
const session = snmp.createSession("127.0.0.1", "${epcConfig.snmpConfig.community || 'public'}", {
    port: ${epcConfig.snmpConfig.port || 161}
});

async function collectMetrics() {
    const oids = [
        "1.3.6.1.2.1.1.3.0",  // sysUpTime
        "1.3.6.1.2.1.1.1.0",  // sysDescr
        "1.3.6.1.2.1.25.3.3.1.2", // hrProcessorLoad
        "1.3.6.1.2.1.25.2.3.1.5", // hrStorageSize
        "1.3.6.1.2.1.25.2.3.1.6", // hrStorageUsed
    ];
    
    return new Promise((resolve, reject) => {
        session.get(oids, (error, varbinds) => {
            if (error) {
                console.error("SNMP Error:", error);
                reject(error);
            } else {
                const metrics = {
                    site: SITE_NAME,
                    timestamp: new Date().toISOString(),
                    uptime: varbinds[0].value,
                    description: varbinds[1].value.toString(),
                    cpuLoad: varbinds[2]?.value || 0,
                    storageSize: varbinds[3]?.value || 0,
                    storageUsed: varbinds[4]?.value || 0
                };
                resolve(metrics);
            }
        });
    });
}

async function reportToCloud(metrics) {
    try {
        const data = JSON.stringify(metrics);
        const url = new URL(CLOUD_API_URL + "/api/epc/metrics");
        
        const options = {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        
        const req = http.request(options, (res) => {
            console.log(\`Status: \${res.statusCode}\`);
        });
        
        req.on('error', (error) => {
            console.error("Cloud reporting error:", error);
        });
        
        req.write(data);
        req.end();
    } catch (error) {
        console.error("Failed to report metrics:", error);
    }
}

// Start reporting loop
async function startReporting() {
    console.log("📊 Starting SNMP cloud reporting service...");
    console.log(\`   Cloud API: \${CLOUD_API_URL}\`);
    console.log(\`   Interval: \${REPORTING_INTERVAL / 1000}s\`);
    
    setInterval(async () => {
        try {
            const metrics = await collectMetrics();
            await reportToCloud(metrics);
            console.log("✅ Metrics reported:", new Date().toISOString());
        } catch (error) {
            console.error("❌ Failed to collect/report metrics:", error);
        }
    }, REPORTING_INTERVAL);
}

startReporting();
SNMPAGENT

# Install npm dependencies for SNMP agent
cd /opt/wisptools/snmp-agent
sudo npm init -y
sudo npm install net-snmp --save

# Create systemd service for SNMP cloud reporting agent
sudo tee /etc/systemd/system/wisptools-snmp-agent.service > /dev/null <<SNMPSERVICE
[Unit]
Description=WISP Tools SNMP Cloud Reporting Agent
After=network.target snmpd.service
Requires=snmpd.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/wisptools/snmp-agent
ExecStart=/usr/bin/node /opt/wisptools/snmp-agent/agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SNMPSERVICE

sudo chmod +x /opt/wisptools/snmp-agent/agent.js
sudo systemctl daemon-reload
sudo systemctl enable wisptools-snmp-agent.service
sudo systemctl start wisptools-snmp-agent.service

echo "✅ SNMP Agent installed and configured"
` : ''}

${includeEPC ? `# Install Open5GS
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

# Load Origin-Host FQDN (from credentials.env for ISO deployments, or use default)
ORIGIN_HOST_FQDN=\${ORIGIN_HOST_FQDN:-mme.\${DIAMETER_REALM}}
if [ -f /etc/wisptools/credentials.env ]; then
  source /etc/wisptools/credentials.env
  ORIGIN_HOST_FQDN=\${ORIGIN_HOST_FQDN:-mme.\${DIAMETER_REALM}}
fi

# MME configuration
sudo tee /etc/open5gs/mme.yaml > /dev/null <<EOF
mme:
  freeDiameter:
    identity: \${ORIGIN_HOST_FQDN}
    realm: \${DIAMETER_REALM}
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
      - identity: hss.\${DIAMETER_REALM}
        realm: \${DIAMETER_REALM}
        port: \${HSS_PORT}
        host: \${HSS_HOST}
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
        mcc: \${MCC}
        mnc: \${MNC}
      amf_id:
        region: 2
        set: 1
  tai:
    - plmn_id:
        mcc: \${MCC}
        mnc: \${MNC}
      tac: \${TAC}
  plmn_support:
    - plmn_id:
        mcc: \${MCC}
        mnc: \${MNC}
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
    full: \${SITE_NAME} EPC
    short: \${SITE_NAME}
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
    identity: pcrf.\${DIAMETER_REALM}
    realm: \${DIAMETER_REALM}
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
      - identity: hss.\${DIAMETER_REALM}
        realm: \${DIAMETER_REALM}
        port: \${HSS_PORT}
        host: \${HSS_HOST}
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
` : ''}

${includeEPC ? `# Enable EPC services
echo "🔧 Enabling EPC services..."
sudo systemctl enable open5gs-mmed
sudo systemctl enable open5gs-sgwd
sudo systemctl enable open5gs-pgwd
sudo systemctl enable open5gs-pcrfd

# Start EPC services
echo "🚀 Starting EPC services..."
sudo systemctl start open5gs-mmed
sudo systemctl start open5gs-sgwd
sudo systemctl start open5gs-pgwd
sudo systemctl start open5gs-pcrfd

# Check EPC service status
echo "📊 Checking EPC service status..."
sudo systemctl status open5gs-mmed --no-pager || true
sudo systemctl status open5gs-sgwd --no-pager || true
sudo systemctl status open5gs-pgwd --no-pager || true
sudo systemctl status open5gs-pcrfd --no-pager || true
` : ''}

${includeSNMP ? `# Enable SNMP services
echo "🔧 Enabling SNMP services..."
sudo systemctl enable snmpd
sudo systemctl enable wisptools-snmp-agent.service

# Start SNMP services
echo "🚀 Starting SNMP services..."
sudo systemctl start snmpd
sudo systemctl start wisptools-snmp-agent.service

# Check SNMP service status
echo "📊 Checking SNMP service status..."
sudo systemctl status snmpd --no-pager || true
sudo systemctl status wisptools-snmp-agent.service --no-pager || true
` : ''}

echo "✅ Deployment completed for $SITE_NAME!"
echo "📍 Site: $SITE_NAME"
${includeEPC ? `echo "🌐 Network: MCC=$MCC, MNC=$MNC, TAC=$TAC"
echo "📡 HSS: $HSS_HOST:$HSS_PORT"` : ''}
echo "📍 Location: $ADDRESS, $CITY, $STATE, $COUNTRY"
echo "📞 Contact: $CONTACT_NAME ($CONTACT_EMAIL)"
echo ""
echo "🔧 Service Management:"
${includeEPC ? `echo "  # EPC Services:"
echo "  sudo systemctl status open5gs-mmed"
echo "  sudo systemctl status open5gs-sgwd"
echo "  sudo systemctl status open5gs-pgwd"
echo "  sudo systemctl status open5gs-pcrfd"
` : ''}
${includeSNMP ? `echo "  # SNMP Services:"
echo "  sudo systemctl status snmpd"
echo "  sudo systemctl status wisptools-snmp-agent.service"
` : ''}
echo ""
echo "📋 Logs:"
${includeEPC ? `echo "  # EPC Logs:"
echo "  sudo journalctl -u open5gs-mmed -f"
echo "  sudo journalctl -u open5gs-sgwd -f"
echo "  sudo journalctl -u open5gs-pgwd -f"
echo "  sudo journalctl -u open5gs-pcrfd -f"
` : ''}
${includeSNMP ? `echo "  # SNMP Logs:"
echo "  sudo journalctl -u snmpd -f"
echo "  sudo journalctl -u wisptools-snmp-agent.service -f"
` : ''}
echo ""
${epcConfig.aptConfig.enabled ? `echo "📦 APT Repository configured for remote updates"
echo "  Repository: ${epcConfig.aptConfig.repositoryUrl}"
${epcConfig.aptConfig.autoUpdate ? `echo "  Auto-update: ${epcConfig.aptConfig.updateSchedule} at ${epcConfig.aptConfig.updateTime}"` : 'echo "  Auto-update: Disabled"'}
` : ''}
echo "🎉 Deployment successful!";
`;

    return script;
  }

  // Download ISO file programmatically through backend proxy
  async function downloadISOFile(isoUrl: string) {
    try {
      console.log('[EPCDeployment] Downloading ISO through proxy:', isoUrl);
      
      // Extract the filename from URL
      const filename = 'wisptools-epc-generic-netinstall.iso';
      
      // The isoUrl should already be a proxy URL from the backend
      // If it's a direct URL, convert it to proxy format
      let downloadUrl = isoUrl;
      if (isoUrl.startsWith('http://') || isoUrl.startsWith('https://')) {
        // Convert direct URL to proxy URL
        downloadUrl = `/api/deploy/download-iso?url=${encodeURIComponent(isoUrl)}`;
      }
      
      // Get auth token if available
      let authToken: string | null = null;
      try {
        authToken = await authService.getAuthToken();
      } catch (authErr) {
        console.warn('[EPCDeployment] Could not get auth token:', authErr);
      }
      
      // Try relative URL first (goes through Firebase hosting rewrite to isoProxy)
      let response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/octet-stream',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        }
      });
      
      // If relative URL fails, try isoProxy Cloud Function
      if (!response.ok) {
        console.warn('[EPCDeployment] Relative URL failed, trying isoProxy...');
        const isoProxyBase = 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/isoProxy';
        const proxyUrl = `${isoProxyBase}/downloads/isos/${filename}`;
        
        response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/octet-stream',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          }
        });
      }
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }
      
      // Get the blob
      const blob = await response.blob();
      
      // Create download link and trigger download automatically
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      console.log('[EPCDeployment] ISO download started automatically');
    } catch (err: any) {
      console.error('[EPCDeployment] ISO download error:', err);
      // Don't throw - just log the error, user can download manually
      error = `ISO download failed: ${err.message}. You can download manually from the device configuration page.`;
    }
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
      const deployType = deploymentType === 'both' ? 'epc-snmp' : deploymentType;
      a.download = `${deployType}-deploy-${epcConfig.siteName.replace(/[^a-zA-Z0-9]/g, '-')}.sh`;
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

  async function generateISO() {
    loading = true;
    error = '';
    
    try {
      console.log('[EPCDeployment] Generating ISO...');
      
      // Get authentication token
      let authToken: string | null = null;
      try {
        authToken = await authService.getAuthToken();
      } catch (authErr) {
        console.warn('[EPCDeployment] Could not get auth token:', authErr);
      }
      
      // Get tenant ID from store if not provided as prop
      const effectiveTenantId = tenantId || $currentTenant?.id || '';
      if (!effectiveTenantId) {
        throw new Error('Tenant ID is required. Please ensure you are logged in and have a tenant selected.');
      }
      
      // Use new registration endpoint (device code not required - added later in device config)
      const relativeUrl = '/api/deploy/register-epc';

      const makeRequest = async (url: string) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Tenant-ID': effectiveTenantId
        };
        
        // Add Authorization header if we have a token
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        return fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            siteName: epcConfig.siteName,
            location: epcConfig.location,
            networkConfig: epcConfig.networkConfig,
            contact: epcConfig.contact,
            hssConfig: epcConfig.hssConfig,
            // Deployment configuration
            deploymentType: deploymentType,
            snmpConfig: epcConfig.snmpConfig,
            aptConfig: epcConfig.aptConfig
          })
        });
      };

      let response = await makeRequest(relativeUrl);
      
      // Check content type to avoid displaying HTML error pages
      const contentType = response.headers.get('content-type') || '';
      const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');
      
      // If Hosting returned HTML/404, retry via direct Cloud Function (isoProxy) base
      if (!response.ok && (response.status === 404 || isHtml)) {
        console.warn('[EPCDeployment] Relative URL failed, retrying via Cloud Function isoProxy...');
        // When calling Cloud Function directly, the path should NOT include /isoProxy prefix
        // Firebase Functions 2nd gen auto-routes based on the function name in the URL
        const isoProxyBase = 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/isoProxy';
        response = await makeRequest(`${isoProxyBase}/api/deploy/register-epc`);
      }

      const finalContentType = response.headers.get('content-type') || '';
      const finalIsHtml = finalContentType.includes('text/html') || finalContentType.includes('application/xhtml');

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        if (finalIsHtml) {
          // If response is HTML (404 page), show user-friendly message
          errorMessage = `Backend endpoint not found (${response.status}). Please verify the backend is deployed and the route is registered.`;
        } else {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // If not JSON, try text but limit length
            const errorText = await response.text();
            if (errorText && errorText.length < 200 && !errorText.trim().startsWith('<')) {
              errorMessage = errorText;
            }
          }
        }
        
        throw new Error(errorMessage);
      }
      
      // Only try to parse as JSON if it's not HTML
      if (finalIsHtml) {
        throw new Error('Backend returned HTML instead of JSON. Please verify the endpoint is correct.');
      }
      
      // Backend returns JSON with registration info
      const result = await response.json();
      
      if (result.success) {
        console.log('[EPCDeployment] EPC registered:', result.epc_id);
        console.log('[EPCDeployment] Generic ISO URL:', result.iso_download_url);
        
        // Automatically download the ISO file internally (proxied through backend)
        if (result.iso_download_url) {
          await downloadISOFile(result.iso_download_url);
        }
        
        // Show success message with instructions
        success = `EPC configuration created successfully!\n\nEPC ID: ${result.epc_id}\n\n${result.message}\n\nNext steps:\n1. Download the generic ISO (download started automatically)\n2. Boot hardware from ISO\n3. Get device code from http://<device-ip>/device-status.html\n4. Enter device code in device configuration page to link hardware to this EPC`;
      } else {
        throw new Error(result.error || 'Failed to generate ISO');
      }
    } catch (err: any) {
      console.error('[EPCDeployment] ISO generation failed:', err);
      error = `Failed to generate ISO: ${err.message || 'Unknown error'}`;
    } finally {
      loading = false;
    }
  }

  function downloadDeployment() {
    if (!deploymentOption) {
      error = 'Please select Script or ISO';
      return;
    }
    if (deploymentOption === 'script') {
      downloadScript();
    } else {
      generateISO();
    }
  }

  // Removed step titles/descriptions - using tabs instead
</script>

{#if show}
  <div class="modal-overlay" onclick={handleClose}>
    <div class="modal-content epc-deployment-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>🚀 Server Deployment</h2>
        <button class="close-btn" onclick={handleClose}>✕</button>
      </div>

      {#if error}
        <div class="error-banner">{error}</div>
      {/if}

      {#if success}
        <div class="success-banner">{success}</div>
      {/if}

      <div class="modal-body">
        <!-- Step Progress Indicator -->
        <div class="step-indicator">
          {#each Array(totalSteps) as _, i}
            {@const stepNum = i + 1}
            <div class="step-indicator-item" class:active={currentStep === stepNum} class:completed={currentStep > stepNum}>
              <div class="step-indicator-number">{stepNum}</div>
              <div class="step-indicator-line" class:last={stepNum === totalSteps}></div>
            </div>
          {/each}
        </div>

        <!-- Step Content -->
        <div class="step-content">
          <!-- Step 1: Deployment Type -->
          {#if currentStep === 1}
            <div class="step-panel">
              <h3>Step 1: Select Deployment Type</h3>
              <p class="step-description">Choose what components to deploy on the server</p>
              <div class="deployment-type-options">
                <label class="deployment-option">
                  <input type="radio" name="deploymentType" value="epc" bind:group={deploymentType} />
                  <div class="option-content">
                    <div class="option-icon">📡</div>
                    <div class="option-info">
                      <strong>EPC Core Only</strong>
                      <p>Deploy Open5GS EPC components (MME, SGW, PGW, PCRF)</p>
                    </div>
                  </div>
                </label>
                <label class="deployment-option">
                  <input type="radio" name="deploymentType" value="snmp" bind:group={deploymentType} />
                  <div class="option-content">
                    <div class="option-icon">📊</div>
                    <div class="option-info">
                      <strong>SNMP/Mikrotik Agent Only</strong>
                      <p>Deploy SNMP agent and Mikrotik monitoring modules</p>
                    </div>
                  </div>
                </label>
                <label class="deployment-option">
                  <input type="radio" name="deploymentType" value="both" bind:group={deploymentType} />
                  <div class="option-content">
                    <div class="option-icon">🔄</div>
                    <div class="option-info">
                      <strong>Both EPC + SNMP</strong>
                      <p>Deploy both EPC Core and SNMP/Mikrotik monitoring agents</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

          <!-- Step 2: Site Information -->
          {:else if currentStep === 2}
            <div class="step-panel">
              <h3>Step 2: Site Information</h3>
              <p class="step-description">Enter basic site details</p>
              <div class="form-section">
                <div class="form-group">
                  <label for="siteName">Site Name *</label>
                  <input id="siteName" type="text" bind:value={epcConfig.siteName} placeholder="Enter site name" required />
                </div>
                <div class="form-group">
                  <label for="address">Address *</label>
                  <input id="address" type="text" bind:value={epcConfig.location.address} placeholder="Enter address" required />
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="city">City</label>
                    <input id="city" type="text" bind:value={epcConfig.location.city} placeholder="Enter city" />
                  </div>
                  <div class="form-group">
                    <label for="state">State</label>
                    <input id="state" type="text" bind:value={epcConfig.location.state} placeholder="Enter state" />
                  </div>
                  <div class="form-group">
                    <label for="country">Country</label>
                    <input id="country" type="text" bind:value={epcConfig.location.country} placeholder="Enter country" />
                  </div>
                </div>
                <div class="form-group">
                  <label for="contactName">Contact Name *</label>
                  <input id="contactName" type="text" bind:value={epcConfig.contact.name} placeholder="Enter contact name" required />
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="contactEmail">Email *</label>
                    <input id="contactEmail" type="email" bind:value={epcConfig.contact.email} placeholder="Enter email" required />
                  </div>
                  <div class="form-group">
                    <label for="contactPhone">Phone</label>
                    <input id="contactPhone" type="tel" bind:value={epcConfig.contact.phone} placeholder="Enter phone" />
                  </div>
                </div>
              </div>
            </div>

          <!-- Step 3: EPC Network Configuration (if EPC selected) -->
          {:else if currentStep === getStepNumber('network')}
            <div class="step-panel">
              <h3>Step 3: EPC Network Configuration</h3>
              <p class="step-description">Configure network parameters for EPC</p>
              <div class="form-section">
                <div class="form-row">
                  <div class="form-group">
                    <label for="mcc">MCC *</label>
                    <input id="mcc" type="text" bind:value={epcConfig.networkConfig.mcc} placeholder="001" required />
                  </div>
                  <div class="form-group">
                    <label for="mnc">MNC *</label>
                    <input id="mnc" type="text" bind:value={epcConfig.networkConfig.mnc} placeholder="01" required />
                  </div>
                  <div class="form-group">
                    <label for="tac">TAC *</label>
                    <input id="tac" type="text" bind:value={epcConfig.networkConfig.tac} placeholder="1" required />
                  </div>
                </div>
              </div>
            </div>

          <!-- Step 4: HSS Configuration (if EPC selected) -->
          {:else if currentStep === getStepNumber('hss')}
            <div class="step-panel">
              <h3>Step 4: HSS Configuration</h3>
              <p class="step-description">Configure HSS connection settings</p>
              <div class="form-section">
                <div class="form-row">
                  <div class="form-group">
                    <label for="hssHost">HSS Host</label>
                    <input id="hssHost" type="text" bind:value={epcConfig.hssConfig.hssHost} placeholder="HSS host" />
                  </div>
                  <div class="form-group">
                    <label for="hssPort">HSS Port</label>
                    <input id="hssPort" type="text" bind:value={epcConfig.hssConfig.hssPort} placeholder="3868" />
                  </div>
                </div>
                <div class="form-group">
                  <label for="diameterRealm">Diameter Realm</label>
                  <input id="diameterRealm" type="text" bind:value={epcConfig.hssConfig.diameterRealm} placeholder="example.com" />
                </div>
              </div>
            </div>

          <!-- SNMP Configuration (if SNMP selected) -->
          {:else if currentStep === getStepNumber('snmp')}
            <div class="step-panel">
              <h3>Step {currentStep}: SNMP/Mikrotik Configuration</h3>
              <p class="step-description">Configure SNMP agent and monitoring</p>
              <div class="form-section">
                <div class="form-row">
                  <div class="form-group">
                    <label for="snmpVersion">SNMP Version</label>
                    <select id="snmpVersion" bind:value={epcConfig.snmpConfig.version}>
                      <option value="2c">SNMPv2c (Recommended)</option>
                      <option value="1">SNMPv1</option>
                      <option value="3">SNMPv3 (Secure)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="snmpCommunity">Community String</label>
                    <input id="snmpCommunity" type="text" bind:value={epcConfig.snmpConfig.community} placeholder="public" />
                  </div>
                  <div class="form-group">
                    <label for="snmpPort">SNMP Port</label>
                    <input id="snmpPort" type="number" bind:value={epcConfig.snmpConfig.port} placeholder="161" />
                  </div>
                </div>
                {#if epcConfig.snmpConfig.version === '3'}
                  <div class="form-row">
                    <div class="form-group">
                      <label for="snmpUsername">SNMPv3 Username</label>
                      <input id="snmpUsername" type="text" bind:value={epcConfig.snmpConfig.username} placeholder="Enter username" />
                    </div>
                    <div class="form-group">
                      <label for="snmpAuthProtocol">Auth Protocol</label>
                      <select id="snmpAuthProtocol" bind:value={epcConfig.snmpConfig.authProtocol}>
                        <option value="SHA">SHA</option>
                        <option value="MD5">MD5</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="snmpAuthKey">Auth Key</label>
                      <input id="snmpAuthKey" type="password" bind:value={epcConfig.snmpConfig.authKey} placeholder="Enter auth key" />
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="snmpPrivProtocol">Privacy Protocol</label>
                      <select id="snmpPrivProtocol" bind:value={epcConfig.snmpConfig.privProtocol}>
                        <option value="AES">AES</option>
                        <option value="DES">DES</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="snmpPrivKey">Privacy Key</label>
                      <input id="snmpPrivKey" type="password" bind:value={epcConfig.snmpConfig.privKey} placeholder="Enter privacy key" />
                    </div>
                  </div>
                {/if}
                <div class="form-row">
                  <div class="form-group">
                    <label for="snmpReportingInterval">Reporting Interval (seconds)</label>
                    <input id="snmpReportingInterval" type="number" bind:value={epcConfig.snmpConfig.reportingInterval} placeholder="60" />
                  </div>
                  <div class="form-group">
                    <label for="snmpCloudApiUrl">Cloud API URL</label>
                    <input id="snmpCloudApiUrl" type="text" bind:value={epcConfig.snmpConfig.cloudApiUrl} placeholder="http://136.112.111.167:3003" />
                  </div>
                  <div class="form-group checkbox-group">
                    <label>
                      <input type="checkbox" bind:checked={epcConfig.snmpConfig.enableTraps} />
                      Enable SNMP Traps
                    </label>
                  </div>
                </div>
              </div>
            </div>

          <!-- APT Repository Configuration -->
          {:else if currentStep === getStepNumber('apt')}
            <div class="step-panel">
              <h3>Step {currentStep}: APT Repository Configuration</h3>
              <p class="step-description">Configure remote updates repository</p>
              <div class="form-section">
                <div class="form-row">
                  <div class="form-group">
                    <label for="aptRepositoryUrl">Repository URL</label>
                    <input id="aptRepositoryUrl" type="text" bind:value={epcConfig.aptConfig.repositoryUrl} placeholder="http://136.112.111.167:3003/apt" />
                  </div>
                  <div class="form-group checkbox-group">
                    <label>
                      <input type="checkbox" bind:checked={epcConfig.aptConfig.enabled} />
                      Enable APT Repository
                    </label>
                  </div>
                  <div class="form-group checkbox-group">
                    <label>
                      <input type="checkbox" bind:checked={epcConfig.aptConfig.autoUpdate} />
                      Auto-update Enabled
                    </label>
                  </div>
                </div>
                {#if epcConfig.aptConfig.autoUpdate}
                  <div class="form-row">
                    <div class="form-group">
                      <label for="aptUpdateSchedule">Update Schedule</label>
                      <select id="aptUpdateSchedule" bind:value={epcConfig.aptConfig.updateSchedule}>
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="aptUpdateTime">Update Time (HH:MM)</label>
                      <input id="aptUpdateTime" type="text" bind:value={epcConfig.aptConfig.updateTime} placeholder="02:00" pattern="[0-9]{2}:[0-9]{2}" />
                    </div>
                    <div class="form-group checkbox-group">
                      <label>
                        <input type="checkbox" bind:checked={epcConfig.aptConfig.securityUpdatesOnly} />
                        Security Updates Only
                      </label>
                    </div>
                  </div>
                {/if}
              </div>
            </div>

          <!-- Review Step -->
          {:else if currentStep === getStepNumber('review')}
            <div class="step-panel">
              <h3>Step {currentStep}: Review Configuration</h3>
              <p class="step-description">Review your deployment configuration</p>
              <div class="review-section">
                <div class="review-item">
                  <strong>Deployment Type:</strong>
                  <span>{deploymentType === 'both' ? 'EPC + SNMP' : deploymentType.toUpperCase()}</span>
                </div>
                <div class="review-item">
                  <strong>Site Name:</strong>
                  <span>{epcConfig.siteName}</span>
                </div>
                <div class="review-item">
                  <strong>Device Code:</strong>
                  <span style="color: #999; font-style: italic;">Will be entered in device configuration after hardware boots</span>
                </div>
                {#if deploymentType === 'epc' || deploymentType === 'both'}
                  <div class="review-item">
                    <strong>EPC Network:</strong>
                    <span>MCC: {epcConfig.networkConfig.mcc}, MNC: {epcConfig.networkConfig.mnc}, TAC: {epcConfig.networkConfig.tac}</span>
                  </div>
                  <div class="review-item">
                    <strong>HSS:</strong>
                    <span>{epcConfig.hssConfig.hssHost}:{epcConfig.hssConfig.hssPort}</span>
                  </div>
                {/if}
                {#if deploymentType === 'snmp' || deploymentType === 'both'}
                  <div class="review-item">
                    <strong>SNMP Version:</strong>
                    <span>SNMPv{epcConfig.snmpConfig.version}</span>
                  </div>
                  <div class="review-item">
                    <strong>SNMP Community:</strong>
                    <span>{epcConfig.snmpConfig.community}</span>
                  </div>
                {/if}
                <div class="review-item">
                  <strong>Location:</strong>
                  <span>{epcConfig.location.address}, {epcConfig.location.city}, {epcConfig.location.state}</span>
                </div>
                <div class="review-item">
                  <strong>Contact:</strong>
                  <span>{epcConfig.contact.name} ({epcConfig.contact.email})</span>
                </div>
                {#if epcConfig.aptConfig.enabled}
                  <div class="review-item">
                    <strong>APT Repository:</strong>
                    <span>{epcConfig.aptConfig.repositoryUrl}</span>
                  </div>
                {/if}
              </div>
            </div>

          <!-- Final Step: Download (Script/ISO Selection) -->
          {:else if currentStep === getStepNumber('download')}
            <div class="step-panel">
              <h3>Step {currentStep}: Download Deployment Package</h3>
              <p class="step-description">Choose your deployment method</p>
              <div class="download-options">
                <label class="download-option">
                  <input type="radio" name="deploymentOption" value="script" bind:group={deploymentOption} />
                  <div class="option-content">
                    <div class="option-icon">📜</div>
                    <div class="option-info">
                      <strong>Deployment Script</strong>
                      <p>Download a bash script to install and configure on an existing Ubuntu server</p>
                    </div>
                  </div>
                </label>
                <label class="download-option">
                  <input type="radio" name="deploymentOption" value="iso" bind:group={deploymentOption} />
                  <div class="option-content">
                    <div class="option-icon">💿</div>
                    <div class="option-info">
                      <strong>ISO Image</strong>
                      <p>Download a pre-configured ISO image ready to burn to USB or DVD</p>
                    </div>
                  </div>
                </label>
              </div>
              {#if deploymentOption === 'script' && deploymentScript}
                <div class="script-preview">
                  <h5>Script Preview:</h5>
                  <pre><code>{deploymentScript.substring(0, 300)}...</code></pre>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Action Buttons -->
        <div class="modal-actions">
          {#if currentStep > 1}
            <button class="btn btn-secondary" onclick={prevStep}>
              ← Previous
            </button>
          {/if}
          
          {#if currentStep < totalSteps}
            <button class="btn btn-primary" onclick={handleNextClick} disabled={loading}>
              {#if loading}
                <span class="spinner"></span>
                Generating...
              {:else}
                Next →
              {/if}
            </button>
          {:else}
            <button class="btn btn-primary" onclick={downloadDeployment} disabled={loading || !deploymentOption}>
              {#if loading}
                <span class="spinner"></span>
                {deploymentOption === 'script' ? 'Preparing Script...' : 'Generating ISO...'}
              {:else if deploymentOption === 'script'}
                📥 Download Script
              {:else if deploymentOption === 'iso'}
                💿 Download ISO
              {:else}
                Select Script or ISO
              {/if}
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
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    max-width: 90vw;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .epc-deployment-modal {
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xl);
    border-bottom: 1px solid var(--color-gray-200);
    flex-shrink: 0;
  }

  .modal-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: var(--spacing-xs);
    border-radius: var(--radius-sm);
    transition: all 0.2s ease;
    line-height: 1;
  }

  .close-btn:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-xl);
  }

  .epc-deployment-modal {
    /* Inherits width from .modal-content (800px) */
    box-sizing: border-box;
  }

  .error-banner {
    background: var(--danger);
    color: white;
    padding: var(--spacing-md);
    margin: var(--spacing-md) 0;
    border-radius: var(--radius-md);
    text-align: center;
  }

  .success-banner {
    background: var(--success);
    color: white;
    padding: var(--spacing-md);
    margin: var(--spacing-md) 0;
    border-radius: var(--radius-md);
    text-align: center;
  }

  .step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--spacing-xl);
    padding: var(--spacing-md) 0;
  }

  .step-indicator-item {
    display: flex;
    align-items: center;
    position: relative;
  }

  .step-indicator-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    border: 2px solid var(--border-color);
  }

  .step-indicator-item.active .step-indicator-number {
    background: var(--brand-primary);
    color: white;
    border-color: var(--brand-primary);
  }

  .step-indicator-item.completed .step-indicator-number {
    background: var(--success);
    color: white;
    border-color: var(--success);
  }

  .step-indicator-line {
    width: 60px;
    height: 2px;
    background: var(--border-color);
    margin: 0 var(--spacing-sm);
    transition: all 0.2s ease;
  }

  .step-indicator-item.completed .step-indicator-line {
    background: var(--success);
  }

  .step-indicator-line.last {
    display: none;
  }

  .step-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 550px;
    padding: var(--spacing-lg) 0;
  }
  
  .step-content > * {
    margin-bottom: var(--spacing-lg);
  }
  
  .step-content > *:last-child {
    margin-bottom: 0;
  }
  
  .form-group,
  .form-field,
  .input-group {
    margin-bottom: var(--spacing-md);
  }

  .step-panel {
    padding: var(--spacing-lg);
  }

  .step-panel h3 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: 600;
  }

  .step-description {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0 0 var(--spacing-lg) 0;
  }

  .config-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .form-section {
    background: var(--bg-secondary);
    padding: var(--spacing-lg);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    margin-bottom: var(--spacing-lg);
  }

  .form-section h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
    font-size: 1.1rem;
    font-weight: 600;
  }

  .section-description {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0 0 var(--spacing-md) 0;
  }

  .deployment-type-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
    margin-top: var(--spacing-md);
  }

  .deployment-option {
    display: flex;
    flex-direction: column;
    cursor: pointer;
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    transition: all 0.2s ease;
    background: var(--bg-secondary);
  }

  .deployment-option:hover {
    border-color: var(--brand-primary);
    box-shadow: var(--shadow-md);
  }

  .deployment-option input[type="radio"] {
    display: none;
  }

  .deployment-option:has(input[type="radio"]:checked) {
    border-color: var(--brand-primary);
    background: var(--bg-tertiary);
    box-shadow: var(--shadow-md);
  }

  .option-content {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-md);
  }

  .option-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .option-info {
    flex: 1;
  }

  .option-info strong {
    display: block;
    font-size: 0.9375rem;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
    font-weight: 600;
  }

  .option-info p {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.5;
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
    font-weight: 600;
    font-size: 0.875rem;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: border-color 0.2s;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--brand-primary);
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid var(--color-gray-200);
  }

  .review-item:last-child {
    border-bottom: none;
  }

  .review-item strong {
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .review-item span {
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .deploy-info {
    background: var(--bg-secondary);
    padding: var(--spacing-lg);
    border-radius: var(--radius-md);
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
    border-radius: var(--radius-sm);
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
    border-radius: var(--radius-md);
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
    border-radius: var(--radius-sm);
    font-family: monospace;
    font-size: 0.9rem;
  }

  .download-options {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .download-option {
    display: flex;
    flex-direction: column;
    cursor: pointer;
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    transition: all 0.2s ease;
    background: var(--bg-secondary);
  }

  .download-option:hover {
    border-color: var(--brand-primary);
    box-shadow: var(--shadow-md);
  }

  .download-option input[type="radio"] {
    display: none;
  }

  .download-option:has(input[type="radio"]:checked) {
    border-color: var(--brand-primary);
    background: var(--bg-tertiary);
    box-shadow: var(--shadow-md);
  }

  .review-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    background: var(--bg-secondary);
    padding: var(--spacing-lg);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
  }

  .modal-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    margin-top: var(--spacing-lg);
    gap: var(--spacing-md);
  }

  .modal-actions .btn-secondary {
    margin-right: auto;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    text-decoration: none;
  }

  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-hover, var(--color-primary-hover));
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-tertiary);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }

  .btn-secondary .spinner {
    border: 2px solid var(--border-color);
    border-top: 2px solid var(--text-primary);
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .modal-content {
      width: 95vw;
      max-width: 95vw;
    }
    
    .epc-deployment-modal {
      /* Inherits width from .modal-content */
    }

    .step-indicator {
      flex-wrap: wrap;
      gap: var(--spacing-xs);
    }

    .step-indicator-line {
      width: 30px;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .review-grid {
      grid-template-columns: 1fr;
    }

    .modal-actions {
      flex-direction: column;
      gap: var(--spacing-md);
    }
  }
</style>
