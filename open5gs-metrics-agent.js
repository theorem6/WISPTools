#!/usr/bin/env node

/**
 * Open5GS Metrics Collection Agent
 * 
 * This agent runs on the remote EPC site and collects metrics from Open5GS
 * components, then sends them to the cloud HSS/Management API.
 * 
 * Installation:
 *   npm install -g open5gs-metrics-agent
 *   open5gs-metrics-agent --config /etc/open5gs/metrics-agent.conf
 * 
 * Or via systemd service
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');

const execAsync = promisify(exec);

// Configuration
let CONFIG = {
  // API Endpoint
  api_url: process.env.EPC_API_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy',
  
  // Authentication (from registration)
  auth_code: process.env.EPC_AUTH_CODE || '',
  api_key: process.env.EPC_API_KEY || '',
  secret_key: process.env.EPC_SECRET_KEY || '',
  
  // Metrics collection interval (seconds)
  interval: parseInt(process.env.EPC_METRICS_INTERVAL) || 60,
  
  // Open5GS paths
  open5gs_log_dir: '/var/log/open5gs',
  open5gs_config_dir: '/etc/open5gs',
  
  // Components to monitor
  components: ['mme', 'sgwc', 'sgwu', 'upf', 'smf', 'pcrf'],
  
  // Version info
  version: '1.0.0'
};

// Load config from file if provided
if (process.argv.includes('--config')) {
  const configIndex = process.argv.indexOf('--config');
  const configFile = process.argv[configIndex + 1];
  
  if (fs.existsSync(configFile)) {
    const fileConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    CONFIG = { ...CONFIG, ...fileConfig };
  }
}

// Validate configuration
if (!CONFIG.auth_code || !CONFIG.api_key || !CONFIG.secret_key) {
  console.error('❌ Error: Missing authentication credentials');
  console.error('Please set EPC_AUTH_CODE, EPC_API_KEY, and EPC_SECRET_KEY environment variables');
  console.error('Or provide them in the configuration file');
  process.exit(1);
}

console.log('🚀 Open5GS Metrics Agent v' + CONFIG.version);
console.log('📡 API Endpoint:', CONFIG.api_url);
console.log('⏱️  Collection Interval:', CONFIG.interval, 'seconds');
console.log('');

// Metrics collection functions

async function getSystemMetrics() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  // Get CPU usage
  let cpuUsage = 0;
  try {
    const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'");
    cpuUsage = parseFloat(stdout.trim()) || 0;
  } catch (err) {
    // Fallback calculation
    cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;
  }
  
  // Get disk usage
  let diskUsage = 0;
  try {
    const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'");
    diskUsage = parseInt(stdout.trim()) || 0;
  } catch (err) {
    console.warn('Could not get disk usage:', err.message);
  }
  
  // Load average
  const loadAvg = os.loadavg();
  
  return {
    cpu_percent: Math.round(cpuUsage * 10) / 10,
    memory_percent: Math.round((usedMem / totalMem) * 100 * 10) / 10,
    disk_percent: diskUsage,
    load_average: loadAvg
  };
}

async function getComponentStatus() {
  const status = {};
  
  for (const component of CONFIG.components) {
    try {
      const { stdout } = await execAsync(`systemctl is-active open5gs-${component}d`);
      status[component] = stdout.trim() === 'active' ? 'running' : 'stopped';
    } catch (err) {
      status[component] = 'stopped';
    }
  }
  
  return status;
}

async function getLogFreshness() {
  const freshness = {};
  
  for (const component of ['mme', 'smf', 'upf', 'sgwu', 'sgwc']) {
    const logFile = path.join(CONFIG.open5gs_log_dir, `${component}.log`);
    
    try {
      const stats = fs.statSync(logFile);
      freshness[`latest_${component}_log`] = stats.mtime;
    } catch (err) {
      // Log file doesn't exist
      freshness[`latest_${component}_log`] = null;
    }
  }
  
  return freshness;
}

async function getSubscriberStats() {
  // Parse Open5GS database or use CLI if available
  // This is a simplified version - in production, you'd query MongoDB or use Open5GS APIs
  
  let totalConnected = 0;
  let activeSessions = 0;
  
  try {
    // Try to get active PDN sessions from MME
    const { stdout } = await execAsync("open5gs-dbctl session list 2>/dev/null || echo ''");
    if (stdout) {
      const lines = stdout.split('\n').filter(l => l.includes('IMSI'));
      totalConnected = lines.length;
      activeSessions = lines.length;
    }
  } catch (err) {
    // Silently fail - not all Open5GS installations have dbctl
  }
  
  return {
    total_seen: totalConnected,
    total_connected: totalConnected,
    total_disconnected: 0,
    active_sessions: activeSessions
  };
}

async function getOGSTUNPool() {
  // Parse OGSTUN interface and IP pool configuration
  let totalIPs = 0;
  let allocatedIPs = 0;
  
  try {
    // Read UPF or SMF config to get IP pool range
    const upfConfig = path.join(CONFIG.open5gs_config_dir, 'upf.yaml');
    if (fs.existsSync(upfConfig)) {
      const config = fs.readFileSync(upfConfig, 'utf8');
      
      // Simple regex to find subnet (e.g., 10.45.0.0/16)
      const subnetMatch = config.match(/subnet:\s*(\d+\.\d+\.\d+\.\d+)\/(\d+)/);
      if (subnetMatch) {
        const cidr = parseInt(subnetMatch[2]);
        totalIPs = Math.pow(2, 32 - cidr) - 2; // Subtract network and broadcast
      }
    }
    
    // Get currently allocated IPs from network namespace
    const { stdout } = await execAsync("ip netns exec ogstun ip addr show ogstun 2>/dev/null || echo ''");
    // This is simplified - in production, track actual PDN sessions
    
  } catch (err) {
    console.warn('Could not get OGSTUN pool info:', err.message);
  }
  
  const availableIPs = totalIPs - allocatedIPs;
  const utilization = totalIPs > 0 ? Math.round((allocatedIPs / totalIPs) * 100) : 0;
  
  return {
    total_ips: totalIPs,
    allocated_ips: allocatedIPs,
    available_ips: availableIPs,
    utilization_percent: utilization
  };
}

async function getENBStats() {
  const enbStats = [];
  
  try {
    // Parse MME log for S1 connection info
    const mmeLog = path.join(CONFIG.open5gs_log_dir, 'mme.log');
    
    if (fs.existsSync(mmeLog)) {
      const logContent = fs.readFileSync(mmeLog, 'utf8');
      const lines = logContent.split('\n').slice(-1000); // Last 1000 lines
      
      // Look for S1 setup messages
      const s1Regex = /S1.*eNB.*(\d+\.\d+\.\d+\.\d+).*Cell.*ID.*(\w+)/gi;
      const matches = lines.join('\n').match(s1Regex) || [];
      
      // This is simplified - in production, maintain state of eNB connections
      for (const match of matches.slice(0, 10)) {
        const ipMatch = match.match(/(\d+\.\d+\.\d+\.\d+)/);
        const cellMatch = match.match(/ID.*(\w+)/);
        
        if (ipMatch && cellMatch) {
          enbStats.push({
            s1_ip: ipMatch[1],
            cellid: cellMatch[1],
            status: 'connected',
            duration_seconds: 0,
            last_seen: new Date()
          });
        }
      }
    }
  } catch (err) {
    console.warn('Could not get eNB stats:', err.message);
  }
  
  return enbStats;
}

async function getCellIDStatus() {
  const enbStats = await getENBStats();
  
  return {
    total_cells: enbStats.length,
    active_cells: enbStats.filter(e => e.status === 'connected').length,
    inactive_cells: 0
  };
}

async function getAPNStats() {
  // This would query the subscriber database for APN assignments
  // Simplified for now
  return [{
    apn_name: 'internet',
    attached_count: 0,
    data_usage_bytes: 0
  }];
}

async function collectAllMetrics() {
  console.log('📊 Collecting metrics...');
  
  try {
    const [
      system,
      components,
      subscribers,
      ogstunPool,
      cellIdStatus,
      enbStats,
      apnStats,
      logFreshness
    ] = await Promise.all([
      getSystemMetrics(),
      getComponentStatus(),
      getSubscriberStats(),
      getOGSTUNPool(),
      getCellIDStatus(),
      getENBStats(),
      getAPNStats(),
      getLogFreshness()
    ]);
    
    const metrics = {
      subscribers,
      apn_stats: apnStats,
      multi_apn_imsis: [], // TODO: Implement
      attach_detach: {
        last_60min_attaches: 0, // TODO: Track from logs
        last_60min_detaches: 0,
        events: []
      },
      ogstun_pool: ogstunPool,
      cellid_status: cellIdStatus,
      enb_stats: enbStats,
      system,
      components,
      log_freshness: logFreshness
    };
    
    return metrics;
  } catch (error) {
    console.error('❌ Error collecting metrics:', error.message);
    throw error;
  }
}

async function sendHeartbeat() {
  const payload = {
    version: {
      open5gs: await getOpen5GSVersion(),
      metrics_agent: CONFIG.version,
      os: `${os.type()} ${os.release()}`
    },
    uptime_seconds: Math.floor(os.uptime())
  };
  
  return sendToAPI('/metrics/heartbeat', payload);
}

async function sendMetrics(metrics) {
  return sendToAPI('/metrics/submit', metrics);
}

async function sendToAPI(endpoint, payload) {
  const url = `${CONFIG.api_url}${endpoint}`;
  const payloadString = JSON.stringify(payload);
  
  // Generate signature
  const signature = crypto
    .createHmac('sha256', CONFIG.secret_key)
    .update(payloadString)
    .digest('hex');
  
  const headers = {
    'Content-Type': 'application/json',
    'X-EPC-Auth-Code': CONFIG.auth_code,
    'X-EPC-API-Key': CONFIG.api_key,
    'X-EPC-Signature': signature
  };
  
  try {
    // Use node-fetch or native fetch depending on Node version
    let fetch;
    if (typeof globalThis.fetch === 'undefined') {
      fetch = require('node-fetch');
    } else {
      fetch = globalThis.fetch;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payloadString
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${response.status}): ${error}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('❌ API request failed:', error.message);
    throw error;
  }
}

async function getOpen5GSVersion() {
  try {
    const { stdout } = await execAsync('open5gs-mmed --version 2>&1 | head -1');
    return stdout.trim();
  } catch (err) {
    return 'unknown';
  }
}

// Main collection loop
let intervalHandle;
let isCollecting = false;

async function mainLoop() {
  if (isCollecting) {
    console.log('⏭️  Skipping collection cycle (previous still running)');
    return;
  }
  
  isCollecting = true;
  
  try {
    // Send heartbeat
    await sendHeartbeat();
    console.log('💓 Heartbeat sent');
    
    // Collect and send metrics
    const metrics = await collectAllMetrics();
    await sendMetrics(metrics);
    
    console.log('✅ Metrics sent successfully');
    console.log(`   - Subscribers: ${metrics.subscribers.active_sessions} active`);
    console.log(`   - CPU: ${metrics.system.cpu_percent}%`);
    console.log(`   - Memory: ${metrics.system.memory_percent}%`);
    console.log(`   - Components: ${Object.values(metrics.components).filter(s => s === 'running').length}/${CONFIG.components.length} running`);
    console.log('');
  } catch (error) {
    console.error('❌ Collection failed:', error.message);
  } finally {
    isCollecting = false;
  }
}

// Start agent
async function start() {
  console.log('🔄 Starting metrics collection...');
  console.log('');
  
  // Initial collection
  await mainLoop();
  
  // Schedule periodic collection
  intervalHandle = setInterval(mainLoop, CONFIG.interval * 1000);
  
  console.log(`✅ Agent running (collecting every ${CONFIG.interval}s)`);
  console.log('   Press Ctrl+C to stop');
  console.log('');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }
  
  console.log('✅ Agent stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM, shutting down...');
  
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }
  
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the agent
if (require.main === module) {
  start().catch(error => {
    console.error('💥 Failed to start agent:', error);
    process.exit(1);
  });
}

module.exports = {
  collectAllMetrics,
  sendHeartbeat,
  sendMetrics,
  CONFIG
};

