// Full Deployment Script Helper Functions
// Isolated utilities for EPC deployment script generation - DO NOT MODIFY unless fixing deployment issues
// 
// NOTE: Octal escape sequences (\1, \2, etc.) must be double-escaped (\\1, \\2)
//       in JavaScript template strings to avoid syntax errors

/**
 * Generate full EPC deployment script with Open5GS installation
 * This installs all EPC components and dependencies automatically
 */
function generateFullDeploymentScript(epc_id, gce_ip, hss_port) {
  // Default network config (can be fetched from database later)
  const defaultMcc = '001';
  const defaultMnc = '01';
  const defaultTac = '1';
  const defaultApn = 'internet';
  const defaultDnsPrimary = '8.8.8.8';
  const defaultDnsSecondary = '8.8.4.4';
  
  return `#!/bin/bash
# WISPTools.io Full EPC Deployment Script
# EPC: ${epc_id}
# This script automatically installs and configures Open5GS EPC

set -e

# Color codes for output
CYAN='\\033[0;36m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

print_status() {
    echo -e "\${CYAN}→\${NC} \$1"
}

print_success() {
    echo -e "\${GREEN}✓\${NC} \$1"
}

print_error() {
    echo -e "\${RED}✗\${NC} \$1"
}

print_header() {
    echo ""
    echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
    echo -e "\${CYAN}  \$1\${NC}"
    echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
    echo ""
}

# Load credentials
source /etc/wisptools/credentials.env

# Use ORIGIN_HOST_FQDN as S6a Identity (unique per EPC)
# This was generated during ISO creation: mme-{epc-id}.wisptools.io
S6A_IDENTITY="\${ORIGIN_HOST_FQDN:-mme.\$EPC_ID.wisptools.local}"
if [ -z "\$ORIGIN_HOST_FQDN" ]; then
    print_status "ORIGIN_HOST_FQDN not found, using fallback: \$S6A_IDENTITY"
else
    print_success "Using unique S6a Identity: \$S6A_IDENTITY"
fi

print_header "WISPTools.io EPC Deployment"
echo "EPC ID: \$EPC_ID"
echo "Tenant ID: \$TENANT_ID"
echo "S6a Identity: \$S6A_IDENTITY"
echo "Cloud HSS: ${gce_ip}:${hss_port}"
echo ""

# Auto-detect network configuration
print_header "Network Configuration (Auto-Detected)"
MME_IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{print \$7; exit}' || hostname -I | awk '{print \$1}')
if [ -z "\$MME_IP" ]; then
    print_error "Could not detect IP address"
    exit 1
fi

SGWC_IP="\$MME_IP"
SGWU_IP="\$MME_IP"
SMF_IP="\$MME_IP"
UPF_IP="\$MME_IP"

print_success "Auto-detected Primary IP: \$MME_IP"
print_status "All EPC components will use: \$MME_IP"
echo ""

# Persist framebuffer/console settings in GRUB to avoid graphics initialization
# ⚠️  Permanently disable framebuffer using nomodeset and nofb (modern approach, not deprecated vga=normal)
# nomodeset disables Kernel Mode Setting (KMS) - prevents graphics drivers from setting high-res modes early
# nofb disables framebuffer device completely
print_header "Configuring GRUB for headless/text-only operation"
if [ -f /etc/default/grub ]; then
  print_status "Updating /etc/default/grub kernel parameters"
  # Ensure GRUB_CMDLINE_LINUX_DEFAULT exists
  if ! grep -q '^GRUB_CMDLINE_LINUX_DEFAULT=' /etc/default/grub; then
    echo 'GRUB_CMDLINE_LINUX_DEFAULT="quiet"' >> /etc/default/grub
  fi
  # Update kernel parameters: nomodeset (disables KMS) nofb (disables framebuffer), text mode, serial console
  # Remove any existing nomodeset/nofb to avoid duplicates, then add them
  sed -i 's/ nomodeset//g; s/ nofb//g' /etc/default/grub
  sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT="\\(.*\\)"/GRUB_CMDLINE_LINUX_DEFAULT="\\1 nomodeset nofb text console=ttyS0,115200n8 console=tty1"/g' /etc/default/grub
  # Configure GRUB graphics mode for VirtualBox compatibility
  if ! grep -q '^GRUB_GFXMODE=' /etc/default/grub; then
    echo 'GRUB_GFXMODE=1024x768' >> /etc/default/grub
  fi
  if ! grep -q '^GRUB_GFXPAYLOAD_LINUX=' /etc/default/grub; then
    echo 'GRUB_GFXPAYLOAD_LINUX=keep' >> /etc/default/grub
  fi
  print_status "Running update-grub (or grub-mkconfig fallback)"
  if command -v update-grub >/dev/null 2>&1; then
    update-grub >/dev/null 2>&1 || true
  else
    grub-mkconfig -o /boot/grub/grub.cfg >/dev/null 2>&1 || true
  fi
  print_success "GRUB updated: framebuffer disabled (nomodeset nofb), text-only boot"
else
  print_status "/etc/default/grub not found, skipping persistent framebuffer disable"
fi

# Network configuration
MCC="${defaultMcc}"
MNC="${defaultMnc}"
TAC="${defaultTac}"
APN_NAME="${defaultApn}"
APN_POOL="10.45.0.0/16"
DNS_PRIMARY="${defaultDnsPrimary}"
DNS_SECONDARY="${defaultDnsSecondary}"
HSS_ADDR="${gce_ip}"
HSS_PORT="${hss_port}"

print_header "Installing Dependencies"
print_status "Updating package lists..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

print_status "Installing essential build tools and dependencies..."
# Install all required packages for EPC deployment - explicitly exclude GUI dependencies
# Using --no-install-recommends to prevent pulling in GUI packages
apt-get install -y --no-install-recommends \\
    wget curl gnupg software-properties-common apt-transport-https ca-certificates \\
    build-essential git make gcc g++ autoconf automake libtool pkg-config \\
    cmake flex bison \\
    libssl-dev libpcre3-dev zlib1g-dev libncurses5-dev libreadline-dev \\
    libyaml-dev libffi-dev python3 python3-pip \\
    systemd networkd-dispatcher net-tools iproute2 iputils-ping \\
    dbus dbus-user-session \\
    logrotate rsyslog cron \\
    vim nano less \\
    jq \\
    bash-completion || print_warning "Some packages may have failed (continuing...)"

print_header "Installing Node.js"
if ! command -v node &> /dev/null; then
    print_status "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_success "Node.js \$(node --version) installed"
else
    print_success "Node.js \$(node --version) already installed"
fi

print_status "Installing monitoring tools..."
apt-get install -y sysstat net-tools iftop vnstat htop

print_header "Installing Open5GS"
print_status "Adding Open5GS repository..."
add-apt-repository -y ppa:open5gs/latest
apt-get update -qq

print_status "Installing Open5GS EPC components..."
apt-get install -y open5gs-mme open5gs-sgwc open5gs-sgwu open5gs-smf open5gs-upf open5gs-pcrf freeDiameter

print_header "Configuring EPC Components"

# Configure MME
print_status "Configuring MME..."
cat > /etc/open5gs/mme.yaml <<EOF
mme:
  freeDiameter: /etc/freeDiameter/mme.conf
  s1ap:
    - addr: \$MME_IP
  gtpc:
    - addr: \$SGWC_IP
  gummei:
    plmn_id:
      mcc: \${MCC}
      mnc: \${MNC}
    mme_gid: 2
    mme_code: 1
  tai:
    plmn_id:
      mcc: \${MCC}
      mnc: \${MNC}
    tac: \${TAC}
  security:
    integrity_order: [EIA2, EIA1, EIA0]
    ciphering_order: [EEA0, EEA1, EEA2]
  network_name:
    full: "WISPTools.io EPC"
    short: "WISPTools"
  guami:
    plmn_id:
      mcc: \${MCC}
      mnc: \${MNC}
    amf_id:
      region: 2
      set: 1
EOF

# Configure SGW-C
print_status "Configuring SGW-C..."
cat > /etc/open5gs/sgwc.yaml <<EOF
sgwc:
  gtpc:
    - addr: \$SGWC_IP
  pfcp:
    - addr: \$SGWC_IP
  sgwu:
    - addr: \$SGWU_IP
EOF

# Configure SGW-U
print_status "Configuring SGW-U..."
cat > /etc/open5gs/sgwu.yaml <<EOF
sgwu:
  gtpu:
    - addr: \$SGWU_IP
  pfcp:
    - addr: \$SGWU_IP
  sgwc:
    - addr: \$SGWC_IP
EOF

# Configure SMF
print_status "Configuring SMF..."
cat > /etc/open5gs/smf.yaml <<EOF
smf:
  gtpc:
    - addr: \$SMF_IP
  pfcp:
    - addr: \$SMF_IP
  upf:
    - addr: \$UPF_IP
  dns:
    - \$DNS_PRIMARY
    - \$DNS_SECONDARY
  subnet:
    - addr: \$APN_POOL
  ue_pool:
    - addr: \$APN_POOL
EOF

# Configure UPF
print_status "Configuring UPF..."
cat > /etc/open5gs/upf.yaml <<EOF
upf:
  gtpu:
    - addr: \$UPF_IP
  pfcp:
    - addr: \$UPF_IP
  smf:
    - addr: \$SMF_IP
EOF

# Configure PCRF
print_status "Configuring PCRF..."
cat > /etc/open5gs/pcrf.yaml <<EOF
pcrf:
  freeDiameter: /etc/freeDiameter/pcrf.conf
  gtpc:
    - addr: 127.0.0.1
EOF

print_header "Configuring Diameter Connection to Cloud HSS"
print_status "Setting up FreeDiameter MME configuration..."

# Create FreeDiameter MME configuration
cat > /etc/freeDiameter/mme.conf <<EOF
# FreeDiameter MME Configuration for Cloud HSS
# EPC: \$EPC_ID / Tenant: \$TENANT_ID
# S6a Identity (unique per EPC): \$S6A_IDENTITY
Identity = "\$S6A_IDENTITY";
Realm = "wisptools.local";

# Listening configuration
ListenOn = "\$MME_IP";
Port = 3868;

# Connect to Cloud HSS
ConnectPeer = "hss.wisptools.cloud" { ConnectTo = "\$HSS_ADDR"; No_TLS; Port = \$HSS_PORT; };

# Application configuration
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_s6a.fdx";

# Security and performance
No_IPv6;
No_SCTP;
EOF

# Create FreeDiameter PCRF configuration
print_status "Setting up FreeDiameter PCRF configuration..."
# Use same unique ID pattern for PCRF (derived from MME identity)
PCRF_IDENTITY=$(echo \$S6A_IDENTITY | sed 's/^mme-/pcrf-/')
cat > /etc/freeDiameter/pcrf.conf <<EOF
# FreeDiameter PCRF Configuration for Cloud HSS
# EPC: \$EPC_ID / Tenant: \$TENANT_ID
# PCRF Identity (matches MME): \$PCRF_IDENTITY
Identity = "\$PCRF_IDENTITY";
Realm = "wisptools.local";

# Listening configuration
ListenOn = "\$MME_IP";
Port = 3869;

# Connect to Cloud HSS
ConnectPeer = "hss.wisptools.cloud" { ConnectTo = "\$HSS_ADDR"; No_TLS; Port = \$HSS_PORT; };

# Application configuration
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_gx.fdx";
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_rx.fdx";

# Security and performance
No_IPv6;
No_SCTP;
EOF

print_success "FreeDiameter configured to connect to Cloud HSS at \$HSS_ADDR:\$HSS_PORT"

print_header "Installing SNMP Monitoring Agent"
print_status "Installing Node.js and SNMP dependencies..."

# Install Node.js if not already installed (check if already done earlier)
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_success "Node.js \$(node --version) installed"
else
    print_success "Node.js \$(node --version) already installed"
fi

# Install SNMP tools, libraries, and network scanning tools
print_status "Installing SNMP tools and network scanning utilities..."
apt-get install -y snmp snmp-mibs-downloader libsnmp-dev nmap iputils-ping

# Create SNMP agent directory
print_status "Setting up SNMP monitoring agent..."
mkdir -p /opt/epc-snmp-agent
cd /opt/epc-snmp-agent

# Initialize npm project and install dependencies
print_status "Installing Node.js dependencies..."
npm init -y > /dev/null 2>&1
npm install net-snmp node-routeros

# Create SNMP agent script
print_status "Creating SNMP agent script..."
cat > epc-snmp-agent.js << 'SNMPAGENTEOF'
const snmp = require('net-snmp');
const { RouterOSAPI } = require('node-routeros');
const os = require('os');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const http = require('http');

const execAsync = promisify(exec);

// Helper to calculate network CIDR from IP and subnet mask
function getNetworkRange(ip, netmask) {
  const ipParts = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  const networkParts = ipParts.map((part, i) => part & maskParts[i]);
  const network = networkParts.join('.');
  const prefixLength = maskParts.reduce((acc, octet) => {
    return acc + octet.toString(2).split('1').length - 1;
  }, 0);
  return \`\${network}/\${prefixLength}\`;
}

class EPCSNMPAgent {
  constructor(config = {}) {
    this.config = {
      epcId: config.epcId || process.env.EPC_ID,
      tenantId: config.tenantId || process.env.TENANT_ID,
      authCode: config.authCode || process.env.EPC_AUTH_CODE,
      cloudApiUrl: config.cloudApiUrl || process.env.GCE_SERVER ? \`http://\${process.env.GCE_SERVER}:\${process.env.HSS_PORT || 3001}\` : 'http://136.112.111.167:3001',
      apiKey: config.apiKey || process.env.EPC_API_KEY,
      snmpPort: config.snmpPort || 161,
      snmpCommunity: config.snmpCommunity || 'public',
      reportingInterval: config.reportingInterval || 60000,
      enableSNMPAgent: config.enableSNMPAgent !== false,
      enableCloudReporting: config.enableCloudReporting !== false,
      healthCheckInterval: config.healthCheckInterval || 30000
    };
    this.agent = null;
    this.reportingTimer = null;
    this.healthCheckTimer = null;
    this.networkScanTimer = null;
    this.discoveredDevices = new Map(); // ip -> device info
    this.mikrotikDevices = new Map(); // ip -> mikrotik device info
    this.isRunning = false;
  }

  async initialize() {
    try {
      console.log('[EPC SNMP Agent] Initializing...');
      if (!this.config.epcId || !this.config.tenantId) {
        throw new Error('EPC ID and Tenant ID are required');
      }
      if (this.config.enableSNMPAgent) {
        await this.startSNMPAgent();
      }
      if (this.config.enableCloudReporting) {
        await this.startCloudReporting();
      }
      await this.startHealthMonitoring();
      await this.startNetworkScanning();
      this.isRunning = true;
      console.log('[EPC SNMP Agent] Initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('[EPC SNMP Agent] Initialization failed:', error);
      throw error;
    }
  }

  async startSNMPAgent() {
    try {
      this.agent = snmp.createAgent({
        port: this.config.snmpPort,
        disableAuthorization: false
      });
      const mib = this.agent.getMib();
      const epcSystemOID = '1.3.6.1.4.1.99999.1.1';
      
      mib.registerProvider({
        name: 'epcSystem',
        type: snmp.MibProviderType.Scalar,
        oid: \`\${epcSystemOID}.1.0\`,
        scalarType: snmp.ObjectType.OctetString,
        handler: (mibRequest) => {
          mibRequest.done(snmp.ErrorStatus.NoError, this.config.epcId);
        }
      });

      mib.registerProvider({
        name: 'epcUptime',
        type: snmp.MibProviderType.Scalar,
        oid: \`\${epcSystemOID}.3.0\`,
        scalarType: snmp.ObjectType.TimeTicks,
        handler: async (mibRequest) => {
          const uptime = Math.floor(os.uptime());
          mibRequest.done(snmp.ErrorStatus.NoError, uptime);
        }
      });

      console.log(\`[EPC SNMP Agent] SNMP agent started on port \${this.config.snmpPort}\`);
    } catch (error) {
      console.error('[EPC SNMP Agent] Failed to start SNMP agent:', error);
      throw error;
    }
  }

  async startCloudReporting() {
    await this.reportToCloud();
    this.reportingTimer = setInterval(async () => {
      try {
        await this.reportToCloud();
      } catch (error) {
        console.error('[EPC SNMP Agent] Cloud reporting failed:', error);
      }
    }, this.config.reportingInterval);
    console.log(\`[EPC SNMP Agent] Cloud reporting started (interval: \${this.config.reportingInterval}ms)\`);
  }

  async startHealthMonitoring() {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('[EPC SNMP Agent] Health check failed:', error);
      }
    }, this.config.healthCheckInterval);
    console.log(\`[EPC SNMP Agent] Health monitoring started (interval: \${this.config.healthCheckInterval}ms)\`);
  }

  async startNetworkScanning() {
    // Initial scan after 30 seconds (give network time to stabilize)
    setTimeout(async () => {
      await this.scanNetwork();
    }, 30000);
    
    // Periodic scans every 5 minutes
    this.networkScanTimer = setInterval(async () => {
      try {
        await this.scanNetwork();
      } catch (error) {
        console.error('[EPC SNMP Agent] Network scan failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
    console.log('[EPC SNMP Agent] Network scanning started (interval: 5 minutes)');
  }

  async scanNetwork() {
    try {
      console.log('[EPC SNMP Agent] Scanning network for SNMP devices...');
      
      // Get local network interface and IP
      const interfaces = os.networkInterfaces();
      const localIPs = [];
      
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (name === 'lo') continue; // Skip loopback
        
        for (const addr of addrs) {
          if (addr.family === 'IPv4' && !addr.internal) {
            localIPs.push({ ip: addr.address, netmask: addr.netmask });
          }
        }
      }

      if (localIPs.length === 0) {
        console.warn('[EPC SNMP Agent] No network interfaces found for scanning');
        return;
      }

      // Use first non-loopback interface
      const localIP = localIPs[0];
      const networkRange = getNetworkRange(localIP.ip, localIP.netmask);
      
      console.log(\`[EPC SNMP Agent] Scanning network: \${networkRange}\`);
      
      // Scan network for hosts using nmap (ping scan)
      let hostIPs = [];
      try {
        const { stdout } = await execAsync(\`nmap -sn \${networkRange} 2>/dev/null | grep -E 'Nmap scan report|for .*' | grep -A1 'scan report' | grep 'for' | awk '{print \\$5}'\`);
        hostIPs = stdout.trim().split('\\n').filter(ip => ip && ip !== localIP.ip && ip.match(/^[0-9.]+$/));
      } catch (error) {
        // If nmap fails, try manual ping scan of common ranges
        console.warn('[EPC SNMP Agent] Nmap scan failed, using alternative method:', error.message);
        const ipParts = localIP.ip.split('.');
        for (let i = 1; i <= 254; i++) {
          if (i !== parseInt(ipParts[3])) {
            hostIPs.push(\`\${ipParts[0]}.\${ipParts[1]}.\${ipParts[2]}.\${i}\`);
          }
        }
      }
      
      console.log(\`[EPC SNMP Agent] Found \${hostIPs.length} potential hosts on network\`);
      
      // Test each host for SNMP (limit to first 50 for performance)
      const testIPs = hostIPs.slice(0, 50);
      const snmpDevices = [];
      
      for (const ip of testIPs) {
        try {
          // Quick SNMP test - try common community strings
          const communities = ['public', 'private', 'community'];
          let foundCommunity = null;
          let deviceInfo = null;
          
          for (const community of communities) {
            try {
              const session = snmp.createSession(ip, community);
              const oids = ['1.3.6.1.2.1.1.1.0']; // sysDescr
              
              await new Promise((resolve, reject) => {
                session.get(oids, (error, varbinds) => {
                  session.close();
                  if (error || !varbinds || varbinds.length === 0) {
                    reject(error || new Error('No response'));
                  } else {
                    foundCommunity = community;
                    resolve(varbinds);
                  }
                });
                
                // Timeout after 2 seconds
                setTimeout(() => {
                  session.close();
                  reject(new Error('Timeout'));
                }, 2000);
              });
              
              // Get full device info
              deviceInfo = await this.getDeviceInfo(ip, foundCommunity);
              break; // Found working community
            } catch (e) {
              // Try next community
              continue;
            }
          }
          
          if (foundCommunity && deviceInfo) {
            const deviceData = {
              ...deviceInfo,
              community: foundCommunity,
              lastSeen: new Date(),
              discoveredAt: this.discoveredDevices.has(ip) ? this.discoveredDevices.get(ip).discoveredAt : new Date(),
              status: 'online'
            };
            
            this.discoveredDevices.set(ip, deviceData);
            snmpDevices.push(ip);
            console.log(\`[EPC SNMP Agent] Discovered SNMP device: \${ip} (\${deviceInfo.name || 'Unknown'})\`);
            
            // Check if device is Mikrotik
            const description = (deviceInfo.description || '').toLowerCase();
            if (description.includes('mikrotik') || description.includes('routeros')) {
              console.log(\`[EPC SNMP Agent] Detected Mikrotik device: \${ip}, attempting RouterOS API connection...\`);
              await this.registerMikrotikDevice(ip, deviceInfo);
            }
          }
        } catch (error) {
          // Host doesn't have SNMP or unreachable, skip
        }
      }
      
      console.log(\`[EPC SNMP Agent] Network scan complete: \${snmpDevices.length} SNMP devices found\`);
      
    } catch (error) {
      console.error('[EPC SNMP Agent] Network scan error:', error.message);
    }
  }

  async getDeviceInfo(ip, community) {
    return new Promise((resolve, reject) => {
      const session = snmp.createSession(ip, community);
      const oids = [
        '1.3.6.1.2.1.1.1.0', // sysDescr
        '1.3.6.1.2.1.1.3.0', // sysUpTime
        '1.3.6.1.2.1.1.5.0'  // sysName
      ];
      
      session.get(oids, (error, varbinds) => {
        session.close();
        if (error) {
          return reject(error);
        }
        
        const info = {
          ip: ip,
          description: varbinds[0]?.value?.toString() || 'Unknown',
          uptime: varbinds[1]?.value || 0,
          name: varbinds[2]?.value?.toString() || ip
        };
        
        resolve(info);
      });
    });
  }

  async registerMikrotikDevice(ip, deviceInfo) {
    try {
      // Try common Mikrotik credentials
      const credentials = [
        { username: 'admin', password: '' },
        { username: 'admin', password: 'admin' },
        { username: 'admin', password: 'password' }
      ];
      
      for (const cred of credentials) {
        try {
          const connection = await this.connectMikrotikAPI(ip, cred.username, cred.password);
          if (connection) {
            // Get Mikrotik device info
            const identity = await this.getMikrotikIdentity(connection);
            const systemInfo = await this.getMikrotikSystemInfo(connection);
            
            const mikrotikDevice = {
              ip: ip,
              name: identity.name || deviceInfo.name || ip,
              description: deviceInfo.description || 'Mikrotik RouterOS',
              identity: identity,
              systemInfo: systemInfo,
              credentials: {
                username: cred.username,
                // Don't store password in device info - it will be used from credentials env
                hasPassword: !!cred.password
              },
              lastSeen: new Date(),
              discoveredAt: new Date(),
              status: 'online',
              apiPort: 8728
            };
            
            this.mikrotikDevices.set(ip, mikrotikDevice);
            connection.close();
            
            console.log(\`[EPC SNMP Agent] Registered Mikrotik device: \${ip} (\${identity.name})\`);
            
            // Register with cloud API
            await this.reportMikrotikDevice(mikrotikDevice);
            
            return mikrotikDevice;
          }
        } catch (error) {
          // Try next credential set
          continue;
        }
      }
      
      console.warn(\`[EPC SNMP Agent] Could not connect to Mikrotik device \${ip} with default credentials\`);
    } catch (error) {
      console.error(\`[EPC SNMP Agent] Failed to register Mikrotik device \${ip}:\`, error.message);
    }
  }

  async connectMikrotikAPI(ip, username, password) {
    return new Promise((resolve, reject) => {
      const conn = new RouterOSAPI({
        host: ip,
        user: username,
        password: password,
        port: 8728,
        timeout: 5000
      });
      
      conn.connect().then(() => {
        resolve(conn);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  async getMikrotikIdentity(connection) {
    try {
      const result = await connection.write('/system/identity/print');
      return {
        name: result[0]?.name || 'Unknown',
        comment: result[0]?.comment || ''
      };
    } catch (error) {
      return { name: 'Unknown', comment: '' };
    }
  }

  async getMikrotikSystemInfo(connection) {
    try {
      const [resource, routerboard] = await Promise.all([
        connection.write('/system/resource/print').catch(() => [{}]),
        connection.write('/system/routerboard/print').catch(() => [{}])
      ]);
      
      return {
        version: resource[0]?.version || 'Unknown',
        architecture: resource[0]?.architecture || 'Unknown',
        model: routerboard[0]?.model || 'Unknown',
        serialNumber: routerboard[0]?.['serial-number'] || 'Unknown',
        firmwareVersion: routerboard[0]?.['firmware-version'] || 'Unknown',
        uptime: resource[0]?.uptime || '0s',
        cpuLoad: resource[0]?.['cpu-load'] || 0,
        freeMemory: resource[0]?.['free-memory'] || 0,
        totalMemory: resource[0]?.['total-memory'] || 0
      };
    } catch (error) {
      return {};
    }
  }

  async reportMikrotikDevice(mikrotikDevice) {
    try {
      const payload = {
        epcId: this.config.epcId,
        tenantId: this.config.tenantId,
        authCode: this.config.authCode,
        device: {
          type: 'mikrotik',
          ip: mikrotikDevice.ip,
          name: mikrotikDevice.name,
          description: mikrotikDevice.description,
          identity: mikrotikDevice.identity,
          systemInfo: mikrotikDevice.systemInfo,
          discoveredAt: mikrotikDevice.discoveredAt.toISOString()
        },
        timestamp: new Date().toISOString()
      };
      
      await this.sendToCloudAPI('/api/mikrotik/discover', payload);
      console.log(\`[EPC SNMP Agent] Reported Mikrotik device to cloud: \${mikrotikDevice.ip}\`);
    } catch (error) {
      console.error('[EPC SNMP Agent] Failed to report Mikrotik device:', error.message);
    }
  }

  async pollMikrotikDevices() {
    if (this.mikrotikDevices.size === 0) {
      return [];
    }
    
    const mikrotikMetrics = [];
    
    for (const [ip, device] of this.mikrotikDevices.entries()) {
      try {
        // Try to connect and get metrics
        const credentials = [
          { username: 'admin', password: '' },
          { username: 'admin', password: 'admin' }
        ];
        
        let connection = null;
        for (const cred of credentials) {
          try {
            connection = await this.connectMikrotikAPI(ip, cred.username, cred.password);
            if (connection) break;
          } catch (e) {
            continue;
          }
        }
        
        if (!connection) {
          device.status = 'offline';
          continue;
        }
        
        // Get current metrics
        const resource = await connection.write('/system/resource/print').catch(() => [{}]);
        const interfaces = await connection.write('/interface/print').catch(() => []);
        
        const metrics = {
          ip: ip,
          name: device.name,
          type: 'mikrotik',
          uptime: resource[0]?.uptime || '0s',
          cpuLoad: resource[0]?.['cpu-load'] || 0,
          freeMemory: resource[0]?.['free-memory'] || 0,
          totalMemory: resource[0]?.['total-memory'] || 0,
          interfaceCount: interfaces.length || 0,
          timestamp: new Date().toISOString()
        };
        
        mikrotikMetrics.push(metrics);
        device.lastPolled = new Date();
        device.status = 'online';
        device.lastSeen = new Date();
        
        connection.close();
      } catch (error) {
        device.status = 'offline';
        device.lastPolled = new Date();
        console.warn(\`[EPC SNMP Agent] Failed to poll Mikrotik device \${ip}:\`, error.message);
      }
    }
    
    return mikrotikMetrics;
  }

  async pollDiscoveredDevices() {
    if (this.discoveredDevices.size === 0) {
      return [];
    }
    
    const devicesMetrics = [];
    
    // Skip Mikrotik devices here - they're handled separately
    for (const [ip, device] of this.discoveredDevices.entries()) {
      // Skip if this is a Mikrotik device (handled in pollMikrotikDevices)
      if (this.mikrotikDevices.has(ip)) {
        continue;
      }
      try {
        const session = snmp.createSession(ip, device.community);
        const oids = [
          '1.3.6.1.2.1.1.3.0',  // sysUpTime
          '1.3.6.1.2.1.1.5.0'   // sysName
        ];
        
        const metrics = await new Promise((resolve, reject) => {
          session.get(oids, (error, varbinds) => {
            session.close();
            if (error) {
              return reject(error);
            }
            
            resolve({
              ip: ip,
              name: device.name,
              description: device.description,
              uptime: varbinds[0]?.value || 0,
              sysName: varbinds[1]?.value?.toString() || ip,
              timestamp: new Date().toISOString()
            });
          });
          
          // Timeout
          setTimeout(() => {
            session.close();
            reject(new Error('Timeout'));
          }, 2000);
        });
        
        devicesMetrics.push(metrics);
        device.lastPolled = new Date();
        device.status = 'online';
        device.lastSeen = new Date();
      } catch (error) {
        // Device unreachable or SNMP failed
        device.lastPolled = new Date();
        device.status = 'offline';
        console.warn(\`[EPC SNMP Agent] Failed to poll device \${ip}:\`, error.message);
      }
    }
    
    return devicesMetrics;
  }

  async collectMetrics() {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        epcId: this.config.epcId,
        tenantId: this.config.tenantId,
        system: {
          uptime: os.uptime(),
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch(),
          release: os.release()
        },
        resources: {
          cpuUsage: await this.getCPUUsage(),
          memoryUsage: await this.getMemoryUsage(),
          diskUsage: await this.getDiskUsage(),
          loadAverage: os.loadavg(),
          freeMemory: os.freemem(),
          totalMemory: os.totalmem()
        },
        network: {
          interfaces: os.networkInterfaces()
        },
        epc: {
          serviceStatus: await this.getServiceStatus()
        },
        discoveredDevices: await this.pollDiscoveredDevices(),
        mikrotikDevices: await this.pollMikrotikDevices()
      };
      return metrics;
    } catch (error) {
      console.error('[EPC SNMP Agent] Failed to collect metrics:', error);
      throw error;
    }
  }

  async reportToCloud() {
    try {
      const metrics = await this.collectMetrics();
      const payload = {
        epcId: this.config.epcId,
        tenantId: this.config.tenantId,
        authCode: this.config.authCode,
        metrics: metrics,
        timestamp: new Date().toISOString()
      };
      await this.sendToCloudAPI('/api/epc/metrics', payload);
      console.log('[EPC SNMP Agent] Metrics reported to cloud successfully');
    } catch (error) {
      console.error('[EPC SNMP Agent] Failed to report to cloud:', error);
    }
  }

  async performHealthCheck() {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        epcId: this.config.epcId,
        tenantId: this.config.tenantId,
        cpuHealth: await this.checkCPUHealth(),
        memoryHealth: await this.checkMemoryHealth(),
        diskHealth: await this.checkDiskHealth(),
        overallStatus: 'healthy'
      };
      if (health.cpuHealth.status === 'critical' || health.memoryHealth.status === 'critical' || health.diskHealth.status === 'critical') {
        health.overallStatus = 'critical';
      } else if (health.cpuHealth.status === 'warning' || health.memoryHealth.status === 'warning' || health.diskHealth.status === 'warning') {
        health.overallStatus = 'warning';
      }
      if (health.overallStatus !== 'healthy') {
        await this.sendHealthAlert(health);
      }
      return health;
    } catch (error) {
      console.error('[EPC SNMP Agent] Health check failed:', error);
      return { overallStatus: 'error', error: error.message };
    }
  }

  async getCPUUsage() {
    try {
      const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print \$2}' | sed 's/%us,//'");
      return parseFloat(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  async getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    return ((total - free) / total) * 100;
  }

  async getDiskUsage() {
    try {
      const { stdout } = await execAsync("df -h / | awk 'NR==2 {print \$5}' | sed 's/%//'");
      return parseFloat(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  async getServiceStatus() {
    try {
      const services = ['open5gs-mmed', 'open5gs-sgwcd', 'open5gs-sgwud', 'open5gs-smfd', 'open5gs-upfd', 'open5gs-pcrfd'];
      const status = {};
      for (const service of services) {
        try {
          const { stdout } = await execAsync(\`systemctl is-active \${service}\`);
          status[service] = stdout.trim() === 'active';
        } catch (error) {
          status[service] = false;
        }
      }
      return status;
    } catch (error) {
      return {};
    }
  }

  async checkCPUHealth() {
    const cpuUsage = await this.getCPUUsage();
    return {
      metric: 'cpu',
      value: cpuUsage,
      status: cpuUsage > 90 ? 'critical' : cpuUsage > 70 ? 'warning' : 'healthy',
      threshold: { warning: 70, critical: 90 }
    };
  }

  async checkMemoryHealth() {
    const memUsage = await this.getMemoryUsage();
    return {
      metric: 'memory',
      value: memUsage,
      status: memUsage > 95 ? 'critical' : memUsage > 80 ? 'warning' : 'healthy',
      threshold: { warning: 80, critical: 95 }
    };
  }

  async checkDiskHealth() {
    const diskUsage = await this.getDiskUsage();
    return {
      metric: 'disk',
      value: diskUsage,
      status: diskUsage > 95 ? 'critical' : diskUsage > 85 ? 'warning' : 'healthy',
      threshold: { warning: 85, critical: 95 }
    };
  }

  async sendHealthAlert(health) {
    try {
      const alert = {
        epcId: this.config.epcId,
        tenantId: this.config.tenantId,
        authCode: this.config.authCode,
        alertType: 'health',
        severity: health.overallStatus,
        health: health,
        timestamp: new Date().toISOString()
      };
      await this.sendToCloudAPI('/api/epc/alerts', alert);
      console.log(\`[EPC SNMP Agent] Health alert sent: \${health.overallStatus}\`);
    } catch (error) {
      console.error('[EPC SNMP Agent] Failed to send health alert:', error);
    }
  }

  async sendToCloudAPI(endpoint, data) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.config.cloudApiUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      const postData = JSON.stringify(data);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': \`Bearer \${this.config.apiKey}\`,
          'x-tenant-id': this.config.tenantId
        }
      };
      
      const req = client.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(responseData || '{}'));
          } else {
            reject(new Error(\`HTTP \${res.statusCode}: \${responseData}\`));
          }
        });
      });
      
      req.on('error', (error) => { reject(error); });
      req.write(postData);
      req.end();
    });
  }

  async shutdown() {
    try {
      console.log('[EPC SNMP Agent] Shutting down...');
      this.isRunning = false;
      if (this.reportingTimer) clearInterval(this.reportingTimer);
      if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
      if (this.networkScanTimer) clearInterval(this.networkScanTimer);
      if (this.agent) this.agent.close();
      console.log('[EPC SNMP Agent] Shutdown complete');
    } catch (error) {
      console.error('[EPC SNMP Agent] Shutdown error:', error);
    }
  }
}

const agent = new EPCSNMPAgent();

process.on('SIGINT', async () => {
  await agent.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await agent.shutdown();
  process.exit(0);
});

agent.initialize().catch((error) => {
  console.error('Failed to start EPC SNMP Agent:', error);
  process.exit(1);
});
SNMPAGENTEOF

# Create systemd service for SNMP agent
print_status "Creating systemd service..."
cat > /etc/systemd/system/epc-snmp-agent.service << 'SNMPSERVICEEOF'
[Unit]
Description=EPC SNMP Monitoring Agent
Documentation=https://github.com/theorem6/lte-pci-mapper
After=network-online.target open5gs-mmed.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/epc-snmp-agent
EnvironmentFile=/etc/wisptools/credentials.env
Environment=CLOUD_API_URL=http://$GCE_SERVER:$HSS_PORT
ExecStart=/usr/bin/node epc-snmp-agent.js
Restart=always
RestartSec=30
StartLimitInterval=300
StartLimitBurst=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=epc-snmp-agent

[Install]
WantedBy=multi-user.target
SNMPSERVICEEOF

# Set permissions
chmod +x epc-snmp-agent.js

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable epc-snmp-agent

print_success "SNMP monitoring agent installed and configured"

print_header "Starting Open5GS Services"
print_status "Enabling and starting all EPC components..."

systemctl enable open5gs-mmed
systemctl enable open5gs-sgwcd
systemctl enable open5gs-sgwud
systemctl enable open5gs-smfd
systemctl enable open5gs-upfd
systemctl enable open5gs-pcrfd
systemctl enable epc-snmp-agent

systemctl start open5gs-mmed
systemctl start open5gs-sgwcd
systemctl start open5gs-sgwud
systemctl start open5gs-smfd
systemctl start open5gs-upfd
systemctl start open5gs-pcrfd

sleep 3

# Start SNMP agent after EPC services are running
print_status "Starting SNMP monitoring agent..."
systemctl start epc-snmp-agent
sleep 2

# Check service status
print_status "Checking service status..."
if systemctl is-active --quiet open5gs-mmed && \\
   systemctl is-active --quiet open5gs-sgwcd && \\
   systemctl is-active --quiet open5gs-sgwud && \\
   systemctl is-active --quiet open5gs-smfd && \\
   systemctl is-active --quiet open5gs-upfd && \\
   systemctl is-active --quiet open5gs-pcrfd; then
    print_success "All Open5GS services are running"
else
    print_error "Some services failed to start. Check logs: journalctl -u open5gs-*"
fi

# Check SNMP agent status
if systemctl is-active --quiet epc-snmp-agent; then
    print_success "SNMP monitoring agent is running"
else
    print_error "SNMP agent failed to start. Check logs: journalctl -u epc-snmp-agent"
fi

print_header "Deployment Complete"
print_success "EPC \$EPC_ID has been deployed successfully!"
echo ""
echo "Configuration Summary:"
echo "  MME IP: \$MME_IP"
echo "  Cloud HSS: \$HSS_ADDR:\$HSS_PORT"
echo "  MCC/MNC: \${MCC}/\${MNC}"
echo "  TAC: \${TAC}"
echo "  APN: \$APN_NAME"
echo ""
echo "Services running:"
systemctl list-units --type=service --state=running | grep -E "open5gs|epc-snmp-agent" || true
echo ""
echo "Monitoring:"
echo "  SNMP Agent: Collecting metrics every 60 seconds"
echo "  Reporting to: http://\$HSS_ADDR:\$HSS_PORT/api/epc/metrics"
echo ""
print_success "EPC is ready to accept connections!"
echo ""

exit 0
`;
}

module.exports = {
  generateFullDeploymentScript
};

