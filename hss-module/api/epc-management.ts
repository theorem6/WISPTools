/**
 * Remote EPC Management API
 * Handles registration, monitoring, and deployment of remote EPC sites
 */

import { Router, Request, Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';

const router = Router();

// MongoDB connection
let mongoClient: MongoClient | null = null;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'hss';

async function getDb() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
  }
  return mongoClient.db(DB_NAME);
}

// Helper: Generate unique EPC ID
function generateEPCId(): string {
  return `epc_${crypto.randomBytes(8).toString('hex')}`;
}

// Helper: Generate authentication credentials
function generateCredentials() {
  return {
    auth_code: crypto.randomBytes(16).toString('hex'),
    api_key: crypto.randomBytes(32).toString('hex'),
    secret_key: crypto.randomBytes(32).toString('hex')
  };
}

/**
 * GET /api/epc/list
 * List all EPCs for tenant
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const status = req.query.status as string;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const db = await getDb();
    const query: any = { tenant_id: tenantId };
    
    if (status) {
      query.status = status;
    }

    const epcs = await db.collection('remote_epcs')
      .find(query)
      .sort({ created_at: -1 })
      .toArray();

    // Calculate time since last heartbeat
    const epcsWithMetrics = epcs.map(epc => {
      const now = new Date();
      const lastHeartbeat = epc.last_heartbeat ? new Date(epc.last_heartbeat) : null;
      const minutesSinceHeartbeat = lastHeartbeat
        ? Math.floor((now.getTime() - lastHeartbeat.getTime()) / 1000 / 60)
        : null;

      return {
        ...epc,
        minutes_since_heartbeat: minutesSinceHeartbeat,
        last_seen: lastHeartbeat?.toISOString()
      };
    });

    res.json({ epcs: epcsWithMetrics });

  } catch (error: any) {
    console.error('Error listing EPCs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/epc/register
 * Register new remote EPC site
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const authHeader = req.headers.authorization as string;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      site_name,
      location,
      network_config,
      contact
    } = req.body;

    // Validate required fields
    if (!site_name) {
      return res.status(400).json({ error: 'Site name is required' });
    }

    if (!location?.coordinates?.latitude || !location?.coordinates?.longitude) {
      return res.status(400).json({ error: 'GPS coordinates are required' });
    }

    // Generate EPC ID and credentials
    const epcId = generateEPCId();
    const credentials = generateCredentials();

    const newEPC = {
      epc_id: epcId,
      tenant_id: tenantId,
      site_name,
      location: {
        address: location.address || '',
        city: location.city || '',
        state: location.state || '',
        country: location.country || 'USA',
        coordinates: {
          latitude: parseFloat(location.coordinates.latitude),
          longitude: parseFloat(location.coordinates.longitude)
        }
      },
      network_config: {
        mcc: network_config?.mcc || '001',
        mnc: network_config?.mnc || '01',
        tac: network_config?.tac || '1'
      },
      contact: contact || {},
      status: 'registered',
      auth_code: credentials.auth_code,
      api_key: credentials.api_key,
      secret_key: credentials.secret_key,
      created_at: new Date(),
      updated_at: new Date(),
      last_heartbeat: null,
      version: null
    };

    const db = await getDb();
    await db.collection('remote_epcs').insertOne(newEPC);

    console.log(`✅ EPC registered: ${epcId} for tenant ${tenantId}`);

    res.status(201).json({
      message: 'EPC registered successfully',
      epc_id: epcId,
      auth_code: credentials.auth_code,
      api_key: credentials.api_key,
      secret_key: credentials.secret_key,
      site_name
    });

  } catch (error: any) {
    console.error('Error registering EPC:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/epc/:epc_id/deployment-script
 * Generate deployment script for EPC
 */
router.get('/:epc_id/deployment-script', async (req: Request, res: Response) => {
  try {
    const { epc_id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const db = await getDb();
    const epc = await db.collection('remote_epcs').findOne({
      epc_id,
      tenant_id: tenantId
    });

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    // Generate deployment script
    const hssApiUrl = process.env.HSS_PROXY_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy';
    
    const script = `#!/bin/bash
# 🚀 Complete EPC Deployment Script - Rapid5GS Style
# Site: ${epc.site_name}
# EPC ID: ${epc.epc_id}
# Generated: ${new Date().toISOString()}

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
PURPLE='\\033[0;35m'
CYAN='\\033[0;36m'
NC='\\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "\\n${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "\\n${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "\\n${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "\\n${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\\n${PURPLE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}     $1${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════${NC}"
}

# Interactive configuration
print_header "Remote EPC Deployment - ${epc.site_name}"
echo -e "${CYAN}EPC ID:${NC} ${epc.epc_id}"
echo -e "${CYAN}Location:${NC} ${epc.location.city}, ${epc.location.state}"
echo -e "${CYAN}Coordinates:${NC} ${epc.location.coordinates.latitude}, ${epc.location.coordinates.longitude}"
echo -e "${CYAN}Network:${NC} MCC=${epc.network_config.mcc} MNC=${epc.network_config.mnc} TAC=${epc.network_config.tac}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  print_error "Please run as root (use sudo)"
  exit 1
fi

# Interactive IP configuration
print_header "Network Configuration"
echo "Please provide the following network information:"
echo ""

# Get MME IP
read -p "MME IP Address (S1AP interface) [default: auto-detect]: " MME_IP
if [ -z "$MME_IP" ]; then
    MME_IP=$(ip route get 8.8.8.8 | awk '{print $7; exit}')
    print_status "Auto-detected MME IP: $MME_IP"
fi

# Get SGW-C IP
read -p "SGW-C IP Address (S11 interface) [default: $MME_IP]: " SGWC_IP
if [ -z "$SGWC_IP" ]; then
    SGWC_IP="$MME_IP"
fi

# Get SGW-U IP
read -p "SGW-U IP Address (S1-U interface) [default: $MME_IP]: " SGWU_IP
if [ -z "$SGWU_IP" ]; then
    SGWU_IP="$MME_IP"
fi

# Get SMF IP
read -p "SMF IP Address (N4 interface) [default: $MME_IP]: " SMF_IP
if [ -z "$SMF_IP" ]; then
    SMF_IP="$MME_IP"
fi

# Get UPF IP
read -p "UPF IP Address (N3 interface) [default: $MME_IP]: " UPF_IP
if [ -z "$UPF_IP" ]; then
    UPF_IP="$MME_IP"
fi

# Get Cloud HSS IP
read -p "Cloud HSS IP Address [default: 136.112.111.167]: " HSS_IP
if [ -z "$HSS_IP" ]; then
    HSS_IP="136.112.111.167"
fi

# Get DNS servers
read -p "Primary DNS Server [default: 8.8.8.8]: " DNS_PRIMARY
if [ -z "$DNS_PRIMARY" ]; then
    DNS_PRIMARY="8.8.8.8"
fi

read -p "Secondary DNS Server [default: 8.8.4.4]: " DNS_SECONDARY
if [ -z "$DNS_SECONDARY" ]; then
    DNS_SECONDARY="8.8.4.4"
fi

# Get APN configuration
read -p "APN Name [default: internet]: " APN_NAME
if [ -z "$APN_NAME" ]; then
    APN_NAME="internet"
fi

read -p "APN IP Pool (CIDR) [default: 10.45.0.0/16]: " APN_POOL
if [ -z "$APN_POOL" ]; then
    APN_POOL="10.45.0.0/16"
fi

echo ""
print_status "Configuration Summary:"
echo "  MME IP: $MME_IP"
echo "  SGW-C IP: $SGWC_IP"
echo "  SGW-U IP: $SGWU_IP"
echo "  SMF IP: $SMF_IP"
echo "  UPF IP: $UPF_IP"
echo "  Cloud HSS IP: $HSS_IP"
echo "  DNS: $DNS_PRIMARY, $DNS_SECONDARY"
echo "  APN: $APN_NAME ($APN_POOL)"
echo ""

read -p "Continue with installation? [Y/n]: " CONFIRM
if [[ $CONFIRM =~ ^[Nn]$ ]]; then
    print_warning "Installation cancelled by user"
    exit 0
fi

print_header "Installing Dependencies"
print_status "Updating package lists..."
apt-get update -qq

print_status "Installing required packages..."
apt-get install -y wget curl gnupg software-properties-common apt-transport-https ca-certificates

print_header "Installing Open5GS"
print_status "Adding Open5GS repository..."
add-apt-repository -y ppa:open5gs/latest
apt-get update -qq

print_status "Installing Open5GS EPC components..."
apt-get install -y open5gs-mme open5gs-sgwc open5gs-sgwu open5gs-smf open5gs-upf open5gs-pcrf

print_header "Configuring EPC Components"

# Configure MME
print_status "Configuring MME..."
cat > /etc/open5gs/mme.yaml <<EOF
mme:
  freeDiameter: /etc/freeDiameter/mme.conf
  s1ap:
    - addr: $MME_IP
  gtpc:
    - addr: $SGWC_IP
  gummei:
    plmn_id:
      mcc: ${epc.network_config.mcc}
      mnc: ${epc.network_config.mnc}
    mme_gid: 2
    mme_code: 1
  tai:
    plmn_id:
      mcc: ${epc.network_config.mcc}
      mnc: ${epc.network_config.mnc}
    tac: ${epc.network_config.tac}
  security:
    integrity_order: [EIA2, EIA1, EIA0]
    ciphering_order: [EEA0, EEA1, EEA2]
  network_name:
    full: "Cloud HSS EPC"
    short: "CloudEPC"
  guami:
    plmn_id:
      mcc: ${epc.network_config.mcc}
      mnc: ${epc.network_config.mnc}
    amf_id:
      region: 2
      set: 1
EOF

# Configure SGW-C
print_status "Configuring SGW-C..."
cat > /etc/open5gs/sgwc.yaml <<EOF
sgwc:
  gtpc:
    - addr: $SGWC_IP
  pfcp:
    - addr: $SGWC_IP
  sgwu:
    - addr: $SGWU_IP
EOF

# Configure SGW-U
print_status "Configuring SGW-U..."
cat > /etc/open5gs/sgwu.yaml <<EOF
sgwu:
  gtpu:
    - addr: $SGWU_IP
  pfcp:
    - addr: $SGWU_IP
  sgwc:
    - addr: $SGWC_IP
EOF

# Configure SMF
print_status "Configuring SMF..."
cat > /etc/open5gs/smf.yaml <<EOF
smf:
  gtpc:
    - addr: $SMF_IP
  pfcp:
    - addr: $SMF_IP
  upf:
    - addr: $UPF_IP
  dns:
    - $DNS_PRIMARY
    - $DNS_SECONDARY
  subnet:
    - addr: $APN_POOL
  ue_pool:
    - addr: $APN_POOL
EOF

# Configure UPF
print_status "Configuring UPF..."
cat > /etc/open5gs/upf.yaml <<EOF
upf:
  gtpu:
    - addr: $UPF_IP
  pfcp:
    - addr: $UPF_IP
  smf:
    - addr: $SMF_IP
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
Identity = "mme.${epc.site_name}.local";
Realm = "local";

# TLS Configuration
TLS_Cred = "/etc/freeDiameter/mme.cert.pem", "/etc/freeDiameter/mme.key.pem";
TLS_CA = "/etc/freeDiameter/ca.cert.pem";

# Connect to Cloud HSS
ConnectPeer = "hss.cloud" { ConnectTo = "$HSS_IP"; No_TLS; };
ConnectPeer = "pcrf.cloud" { ConnectTo = "$HSS_IP"; No_TLS; };

# Application configuration
AppServers = "mme.local";
AppServers = "pcrf.local";

# Security
No_IPv6;
No_SCTP;
EOF

print_status "Setting up FreeDiameter PCRF configuration..."
cat > /etc/freeDiameter/pcrf.conf <<EOF
# FreeDiameter PCRF Configuration for Cloud HSS
Identity = "pcrf.${epc.site_name}.local";
Realm = "local";

# TLS Configuration
TLS_Cred = "/etc/freeDiameter/pcrf.cert.pem", "/etc/freeDiameter/pcrf.key.pem";
TLS_CA = "/etc/freeDiameter/ca.cert.pem";

# Connect to Cloud HSS
ConnectPeer = "hss.cloud" { ConnectTo = "$HSS_IP"; No_TLS; };

# Application configuration
AppServers = "pcrf.local";

# Security
No_IPv6;
No_SCTP;
EOF

print_header "Setting Up Metrics Agent"
print_status "Creating metrics collection agent..."

# Create metrics agent script
cat > /opt/open5gs-metrics-agent.js <<'EOF'
#!/usr/bin/env node

const https = require('https');
const os = require('os');

const HSS_API_URL = '${hssApiUrl}';
const EPC_ID = '${epc.epc_id}';
const TENANT_ID = '${epc.tenant_id}';

// Function to collect system metrics
function collectMetrics() {
    const metrics = {
        timestamp: new Date().toISOString(),
        epc_id: EPC_ID,
        tenant_id: TENANT_ID,
        system: {
            hostname: os.hostname(),
            uptime: os.uptime(),
            loadavg: os.loadavg(),
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem()
            },
            cpus: os.cpus().length
        },
        services: {
            mme: checkService('open5gs-mmed'),
            sgwc: checkService('open5gs-sgwcd'),
            sgwu: checkService('open5gs-sgwud'),
            smf: checkService('open5gs-smfd'),
            upf: checkService('open5gs-upfd'),
            pcrf: checkService('open5gs-pcrfd')
        }
    };
    
    return metrics;
}

// Function to check service status
function checkService(serviceName) {
    try {
        const { execSync } = require('child_process');
        const status = execSync(`systemctl is-active ${serviceName}`, { encoding: 'utf8' }).trim();
        return status === 'active';
    } catch (error) {
        return false;
    }
}

// Function to send heartbeat
function sendHeartbeat() {
    const metrics = collectMetrics();
    
    const postData = JSON.stringify({
        epc_id: EPC_ID,
        tenant_id: TENANT_ID,
        metrics: metrics,
        status: 'online'
    });
    
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    const req = https.request(HSS_API_URL + '/api/epc/' + EPC_ID + '/heartbeat', options, (res) => {
        console.log(`Heartbeat sent: ${res.statusCode}`);
    });
    
    req.on('error', (error) => {
        console.error('Heartbeat failed:', error.message);
    });
    
    req.write(postData);
    req.end();
}

// Send heartbeat every 60 seconds
setInterval(sendHeartbeat, 60000);

// Send initial heartbeat
sendHeartbeat();

console.log('Open5GS Metrics Agent started for EPC:', EPC_ID);
EOF

chmod +x /opt/open5gs-metrics-agent.js

# Create systemd service for metrics agent
cat > /etc/systemd/system/open5gs-metrics-agent.service <<EOF
[Unit]
Description=Open5GS Metrics Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /opt/open5gs-metrics-agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

print_header "Starting Services"
print_status "Enabling and starting Open5GS services..."

systemctl daemon-reload
systemctl enable open5gs-mmed
systemctl enable open5gs-sgwcd
systemctl enable open5gs-sgwud
systemctl enable open5gs-smfd
systemctl enable open5gs-upfd
systemctl enable open5gs-pcrfd
systemctl enable open5gs-metrics-agent

print_status "Starting services..."
systemctl start open5gs-mmed
sleep 2
systemctl start open5gs-sgwcd
sleep 2
systemctl start open5gs-sgwud
sleep 2
systemctl start open5gs-smfd
sleep 2
systemctl start open5gs-upfd
sleep 2
systemctl start open5gs-pcrfd
sleep 2
systemctl start open5gs-metrics-agent

print_header "Verification"
print_status "Checking service status..."

services=("open5gs-mmed" "open5gs-sgwcd" "open5gs-sgwud" "open5gs-smfd" "open5gs-upfd" "open5gs-pcrfd" "open5gs-metrics-agent")

for service in "\${services[@]}"; do
    if systemctl is-active --quiet $service; then
        print_success "$service is running"
    else
        print_error "$service failed to start"
        systemctl status $service --no-pager
    fi
done

print_header "Deployment Complete!"
print_success "EPC deployment completed successfully!"
echo ""
echo -e "${CYAN}EPC Configuration:${NC}"
echo "  Site: ${epc.site_name}"
echo "  EPC ID: ${epc.epc_id}"
echo "  MME IP: $MME_IP"
echo "  Cloud HSS: $HSS_IP"
echo ""
echo -e "${CYAN}Service Status:${NC}"
systemctl status open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd open5gs-pcrfd --no-pager
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "1. Configure your eNodeB to connect to MME at $MME_IP:36412"
echo "2. Add subscribers via the Cloud HSS web interface"
echo "3. Monitor EPC status in the dashboard"
echo ""
print_success "Your EPC is now online and connected to the Cloud HSS!"

systemctl restart open5gs-mmed
systemctl restart open5gs-sgwcd
systemctl restart open5gs-sgwud
systemctl restart open5gs-smfd
systemctl restart open5gs-upfd
systemctl restart open5gs-pcrfd

echo ""
echo "📊 Installing metrics agent..."

# Create metrics agent
cat > /usr/local/bin/epc-metrics-agent.sh <<'AGENT_EOF'
#!/bin/bash
# EPC Metrics Agent - Sends heartbeats and metrics to cloud

EPC_ID="${epc.epc_id}"
API_KEY="${epc.api_key}"
SECRET_KEY="${epc.secret_key}"
HSS_API="${hssApiUrl}"

while true; do
  # Collect metrics
  METRICS=$(cat <<JSON
{
  "epc_id": "$EPC_ID",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "online",
  "metrics": {
    "uptime": $(cat /proc/uptime | cut -d' ' -f1),
    "load_avg": "$(cat /proc/loadavg | cut -d' ' -f1-3)",
    "memory_used_mb": $(free -m | awk 'NR==2{print $3}'),
    "disk_used_gb": $(df -BG / | awk 'NR==2{print $3}' | sed 's/G//')
  },
  "version": {
    "open5gs": "$(dpkg -l | grep open5gs-mme | awk '{print $3}')",
    "os": "$(lsb_release -ds)",
    "kernel": "$(uname -r)"
  }
}
JSON
)

  # Send heartbeat
  curl -s -X POST "$HSS_API/api/epc/$EPC_ID/heartbeat" \\
    -H "Content-Type: application/json" \\
    -H "X-API-Key: $API_KEY" \\
    -H "X-Secret-Key: $SECRET_KEY" \\
    -d "$METRICS" \\
    > /dev/null 2>&1

  # Sleep 60 seconds
  sleep 60
done
AGENT_EOF

chmod +x /usr/local/bin/epc-metrics-agent.sh

# Create systemd service for metrics agent
cat > /etc/systemd/system/epc-metrics-agent.service <<'SERVICE_EOF'
[Unit]
Description=EPC Metrics Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/epc-metrics-agent.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE_EOF

systemctl daemon-reload
systemctl enable epc-metrics-agent
systemctl start epc-metrics-agent

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "     ✅ Remote EPC Deployment Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Status:"
echo "   EPC ID: ${epc.epc_id}"
echo "   Site:   ${epc.site_name}"
echo "   Status: Online (sending heartbeats every 60s)"
echo ""
echo "🔧 Services Running:"
echo "   • Open5GS MME"
echo "   • Open5GS SGW-C/U"
echo "   • Open5GS SMF"
echo "   • Open5GS UPF"
echo "   • Open5GS PCRF"
echo "   • Metrics Agent"
echo ""
echo "📡 Configuration:"
echo "   MCC: ${epc.network_config.mcc}"
echo "   MNC: ${epc.network_config.mnc}"
echo "   TAC: ${epc.network_config.tac}"
echo ""
echo "🔍 Check status:"
echo "   systemctl status open5gs-mmed"
echo "   systemctl status epc-metrics-agent"
echo ""
echo "📊 View logs:"
echo "   journalctl -u open5gs-mmed -f"
echo "   journalctl -u epc-metrics-agent -f"
echo ""
echo "═══════════════════════════════════════════════════════════"
`;

    res.setHeader('Content-Type', 'text/x-shellscript');
    res.setHeader('Content-Disposition', `attachment; filename="deploy-epc-${epc.site_name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.sh"`);
    res.send(script);

  } catch (error: any) {
    console.error('Error generating deployment script:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/epc/:epc_id
 * Delete EPC site
 */
router.delete('/:epc_id', async (req: Request, res: Response) => {
  try {
    const { epc_id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const db = await getDb();
    const result = await db.collection('remote_epcs').deleteOne({
      epc_id,
      tenant_id: tenantId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    res.json({ message: 'EPC deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting EPC:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/epc/:epc_id/heartbeat
 * Receive heartbeat from remote EPC
 */
router.post('/:epc_id/heartbeat', async (req: Request, res: Response) => {
  try {
    const { epc_id } = req.params;
    const apiKey = req.headers['x-api-key'] as string;
    const secretKey = req.headers['x-secret-key'] as string;

    const db = await getDb();
    const epc = await db.collection('remote_epcs').findOne({ epc_id });

    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    // Verify credentials
    if (epc.api_key !== apiKey || epc.secret_key !== secretKey) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update status and heartbeat
    const { metrics, version, timestamp } = req.body;

    await db.collection('remote_epcs').updateOne(
      { epc_id },
      {
        $set: {
          status: 'online',
          last_heartbeat: new Date(),
          updated_at: new Date(),
          metrics: metrics || {},
          version: version || {}
        }
      }
    );

    // Store metrics history (optional)
    await db.collection('epc_metrics').insertOne({
      epc_id,
      tenant_id: epc.tenant_id,
      timestamp: new Date(timestamp || Date.now()),
      metrics,
      version
    });

    res.json({ message: 'Heartbeat received', status: 'online' });

  } catch (error: any) {
    console.error('Error processing heartbeat:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard
 * Get dashboard metrics (EPCs + subscribers)
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const epcId = req.query.epc_id as string;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const db = await getDb();
    
    // Get EPC stats
    const epcQuery: any = { tenant_id: tenantId };
    if (epcId && epcId !== 'all') {
      epcQuery.epc_id = epcId;
    }

    const epcs = await db.collection('remote_epcs').find(epcQuery).toArray();
    
    const epcStats = {
      total: epcs.length,
      online: epcs.filter(e => e.status === 'online').length,
      offline: epcs.filter(e => e.status === 'offline').length,
      registered: epcs.filter(e => e.status === 'registered').length
    };

    // Get subscriber stats (basic)
    const subscriberStats = {
      total: 0,
      active: 0,
      suspended: 0,
      online: 0
    };

    try {
      const subscriberCount = await db.collection('subscribers').countDocuments({ tenant_id: tenantId });
      const activeCount = await db.collection('subscribers').countDocuments({ tenant_id: tenantId, status: 'active' });
      subscriberStats.total = subscriberCount;
      subscriberStats.active = activeCount;
    } catch (err) {
      console.log('Subscribers collection not available');
    }

    res.json({
      timestamp: new Date().toISOString(),
      epcs: epcStats,
      subscribers: subscriberStats,
      epc_list: epcs.map(e => ({
        epc_id: e.epc_id,
        site_name: e.site_name,
        status: e.status,
        last_heartbeat: e.last_heartbeat
      }))
    });

  } catch (error: any) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


