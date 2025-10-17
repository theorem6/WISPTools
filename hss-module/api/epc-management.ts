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
# Remote EPC Deployment Script
# Site: ${epc.site_name}
# EPC ID: ${epc.epc_id}
# Generated: ${new Date().toISOString()}

set -e

echo "═══════════════════════════════════════════════════════════"
echo "     Remote EPC Deployment - ${epc.site_name}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "EPC ID: ${epc.epc_id}"
echo "Location: ${epc.location.city}, ${epc.location.state}"
echo "Coordinates: ${epc.location.coordinates.latitude}, ${epc.location.coordinates.longitude}"
echo "Network: MCC=${epc.network_config.mcc} MNC=${epc.network_config.mnc} TAC=${epc.network_config.tac}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root (use sudo)"
  exit 1
fi

echo "📦 Installing dependencies..."
apt-get update -qq
apt-get install -y wget curl gnupg software-properties-common apt-transport-https

echo "📥 Adding Open5GS repository..."
add-apt-repository -y ppa:open5gs/latest
apt-get update -qq

echo "🔧 Installing Open5GS EPC..."
apt-get install -y open5gs-mme open5gs-sgwc open5gs-sgwu open5gs-smf open5gs-upf open5gs-pcrf

echo "⚙️  Configuring MME connection to cloud HSS..."
cat > /etc/open5gs/mme.yaml <<'EOF'
mme:
  freeDiameter: /etc/freeDiameter/mme.conf
  s1ap:
    - addr: 0.0.0.0
  gtpc:
    - addr: 127.0.0.1
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
EOF

echo "📡 Configuring Diameter connection..."
# TODO: Configure FreeDiameter to connect to cloud HSS
# HSS Endpoint: hss.lte-pci-mapper.com:3868

echo "🚀 Starting services..."
systemctl enable open5gs-mmed
systemctl enable open5gs-sgwcd
systemctl enable open5gs-sgwud
systemctl enable open5gs-smfd
systemctl enable open5gs-upfd
systemctl enable open5gs-pcrfd

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


