#!/usr/bin/env node
/**
 * SNMP Network Discovery Script for Remote EPC (Node.js Version)
 * Scans local network for SNMP-enabled devices and reports findings
 * Uses npm packages: ping-scanner for ping sweeps, net-snmp for SNMP queries
 */

const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const http = require('http');

// Try to require npm packages, fallback to system commands if not available
let pingScanner = null;
let snmp = null;

try {
  // Try to load ping-scanner (may not be installed yet)
  pingScanner = require('ping-scanner');
} catch (e) {
  console.warn('[SNMP-DISCOVERY] ping-scanner not available, will use native ping');
}

try {
  // Try to load net-snmp (should be available)
  snmp = require('net-snmp');
} catch (e) {
  console.warn('[SNMP-DISCOVERY] net-snmp not available, will use system snmpget');
}

const execAsync = promisify(exec);

// Configuration
const CENTRAL_SERVER = 'hss.wisptools.io';
const API_URL = `https://${CENTRAL_SERVER}/api/epc`;
const CONFIG_DIR = '/etc/wisptools';
const LOG_FILE = '/var/log/wisptools-snmp-discovery.log';
const SNMP_COMMUNITIES = ['public', 'private', 'community'];
const SNMP_TIMEOUT = 2000; // 2 seconds
const MAX_PARALLEL_PINGS = 50;
const MAX_PARALLEL_SNMP = 20;

// Mikrotik-specific OIDs
const MIKROTIK_OIDS = {
  identity: '1.3.6.1.4.1.14988.1.1.1.1.1.3.0',
  version: '1.3.6.1.4.1.14988.1.1.1.1.1.4.0',
  serial: '1.3.6.1.4.1.14988.1.1.1.1.1.7.0',
  board: '1.3.6.1.4.1.14988.1.1.1.1.1.9.0',
  cpuLoad: '1.3.6.1.4.1.14988.1.1.1.3.1.0',
  temperature: '1.3.6.1.4.1.14988.1.1.1.8.2.0',
  uptime: '1.3.6.1.2.1.1.3.0'
};

// Standard SNMP OIDs
const STD_OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysObjectID: '1.3.6.1.2.1.1.2.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0'
};

/**
 * Logging utility
 */
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logMessage = `${timestamp} [SNMP-DISCOVERY] ${message}`;
  console.log(logMessage);
  
  // Append to log file
  fs.appendFile(LOG_FILE, logMessage + '\n').catch(() => {
    // Ignore log file errors
  });
}

/**
 * Get device code from config
 */
async function getDeviceCode() {
  try {
    const envFile = path.join(CONFIG_DIR, 'device-code.env');
    const codeFile = path.join(CONFIG_DIR, 'device_code');
    
    if (await fs.access(envFile).then(() => true).catch(() => false)) {
      const envContent = await fs.readFile(envFile, 'utf8');
      const match = envContent.match(/DEVICE_CODE=["']?([^"'\n]+)["']?/);
      if (match) return match[1].trim();
    }
    
    if (await fs.access(codeFile).then(() => true).catch(() => false)) {
      return (await fs.readFile(codeFile, 'utf8')).trim();
    }
    
    // Fallback: generate from MAC address
    const { stdout } = await execAsync("ip link show | grep -A1 'state UP' | grep link/ether | head -1 | awk '{print $2}'");
    const mac = stdout.trim().replace(/:/g, '').substring(0, 8).toUpperCase();
    return mac;
  } catch (error) {
    log(`WARNING: Failed to get device code: ${error.message}`);
    return null;
  }
}

/**
 * Get tenant ID from cache (set by check-in agent)
 */
async function getTenantId() {
  try {
    const tenantFile = '/tmp/epc-tenant-id';
    if (await fs.access(tenantFile).then(() => true).catch(() => false)) {
      const tenantId = (await fs.readFile(tenantFile, 'utf8')).trim();
      if (tenantId && tenantId !== 'null') return tenantId;
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

/**
 * Get network information
 */
async function getNetworkInfo() {
  try {
    const { stdout: ipOutput } = await execAsync("hostname -I | awk '{print $1}'");
    const ip = ipOutput.trim();
    
    const { stdout: routeOutput } = await execAsync(`ip route | grep "${ip}" | awk '{print $1}' | head -1`);
    const network = routeOutput.trim();
    
    // Extract CIDR from network (e.g., "192.168.1.0/24")
    if (network.includes('/')) {
      return network;
    }
    
    // Calculate CIDR from IP and netmask
    const { stdout: netmaskOutput } = await execAsync(`ip route | grep "${ip}" | awk '{print $1}' | head -1`);
    // Default to /24 if can't determine
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  } catch (error) {
    log(`WARNING: Failed to get network info: ${error.message}`);
    // Default subnet
    return '192.168.1.0/24';
  }
}

/**
 * Ping sweep using ping-scanner (if available) or native ping
 */
async function pingSweep(subnet) {
  log(`Step 1: Ping sweep - finding responding hosts on subnet: ${subnet}`);
  const startTime = Date.now();
  const respondingIPs = [];
  
  // Extract base IP from subnet (e.g., "192.168.1.0/24" -> "192.168.1")
  const [baseIP, cidr] = subnet.split('/');
  const baseParts = baseIP.split('.').slice(0, 3).join('.');
  
  if (pingScanner) {
    // Use ping-scanner package
    try {
      log(`Using ping-scanner package for ping sweep...`);
      const scanner = new pingScanner.Scanner({
        network: subnet,
        timeout: 1000,
        concurrency: MAX_PARALLEL_PINGS
      });
      
      const results = await scanner.scan();
      for (const [ip, isAlive] of results.entries()) {
        if (isAlive) {
          respondingIPs.push(ip);
        }
      }
    } catch (error) {
      log(`WARNING: ping-scanner failed, falling back to native ping: ${error.message}`);
      // Fall through to native ping
    }
  }
  
  // Fallback to native ping if ping-scanner not available or failed
  if (respondingIPs.length === 0) {
    log(`Using native ping commands (parallel processing)...`);
    
    const pingPromises = [];
    for (let i = 1; i <= 254; i++) {
      const testIP = `${baseParts}.${i}`;
      
      const pingPromise = execAsync(`ping -c 1 -W 1 ${testIP}`)
        .then(() => testIP)
        .catch(() => null);
      
      pingPromises.push(pingPromise);
      
      // Batch processing to limit concurrency
      if (pingPromises.length >= MAX_PARALLEL_PINGS) {
        const results = await Promise.all(pingPromises);
        respondingIPs.push(...results.filter(ip => ip !== null));
        pingPromises.length = 0;
      }
    }
    
    // Process remaining pings
    if (pingPromises.length > 0) {
      const results = await Promise.all(pingPromises);
      respondingIPs.push(...results.filter(ip => ip !== null));
    }
  }
  
  // Remove self IP
  const selfIP = (await execAsync("hostname -I | awk '{print $1}'")).stdout.trim();
  const filteredIPs = respondingIPs.filter(ip => ip !== selfIP);
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`Ping sweep complete: Found ${filteredIPs.length} responding hosts in ${elapsed}s`);
  
  return filteredIPs;
}

/**
 * Get device info via SNMP using net-snmp (if available) or system snmpget
 */
async function getDeviceInfo(ip, community) {
  if (snmp) {
    // Use net-snmp package
    return await getDeviceInfoWithNetSNMP(ip, community);
  } else {
    // Fallback to system snmpget
    return await getDeviceInfoWithSystemSNMP(ip, community);
  }
}

/**
 * Get device info using net-snmp package
 */
async function getDeviceInfoWithNetSNMP(ip, community) {
  return new Promise((resolve, reject) => {
    const session = snmp.createSession(ip, community, {
      port: 161,
      retries: 1,
      timeout: SNMP_TIMEOUT,
      transport: 'udp4',
      trapPort: 162,
      idBitsSize: 32
    });
    
    const oids = [
      STD_OIDS.sysDescr,
      STD_OIDS.sysObjectID,
      STD_OIDS.sysName,
      STD_OIDS.sysUpTime
    ];
    
    session.get(oids, (error, varbinds) => {
      if (error) {
        session.close();
        reject(error);
        return;
      }
      
      const result = {
        ip_address: ip,
        sysDescr: varbinds[0].value?.toString() || '',
        sysObjectID: varbinds[1].value?.toString() || '',
        sysName: varbinds[2].value?.toString() || '',
        sysUpTime: 0,
        device_type: 'generic',
        community: community,
        snmp_enabled: true
      };
      
      // Parse uptime
      if (varbinds[3] && varbinds[3].value) {
        result.sysUpTime = typeof varbinds[3].value === 'number' 
          ? varbinds[3].value 
          : parseInt(varbinds[3].value.toString()) || 0;
      }
      
      // Detect device type from sysObjectID
      const sysObjectID = result.sysObjectID;
      if (sysObjectID.includes('1.3.6.1.4.1.14988')) {
        result.device_type = 'mikrotik';
      } else if (sysObjectID.includes('1.3.6.1.4.1.9')) {
        result.device_type = 'cisco';
      } else if (sysObjectID.includes('1.3.6.1.4.1.2011')) {
        result.device_type = 'huawei';
      }
      
      // Detect Mikrotik from description
      if (result.sysDescr.toLowerCase().includes('mikrotik') || 
          result.sysDescr.toLowerCase().includes('routeros')) {
        result.device_type = 'mikrotik';
      }
      
      session.close();
      resolve(result);
    });
  });
}

/**
 * Get device info using system snmpget (fallback)
 */
async function getDeviceInfoWithSystemSNMP(ip, community) {
  try {
    const [sysDescrOutput, sysObjectIDOutput, sysNameOutput, sysUpTimeOutput] = await Promise.all([
      execAsync(`timeout 2 snmpget -v2c -c "${community}" "${ip}" ${STD_OIDS.sysDescr} 2>/dev/null`).catch(() => ({ stdout: '' })),
      execAsync(`timeout 2 snmpget -v2c -c "${community}" "${ip}" ${STD_OIDS.sysObjectID} 2>/dev/null`).catch(() => ({ stdout: '' })),
      execAsync(`timeout 2 snmpget -v2c -c "${community}" "${ip}" ${STD_OIDS.sysName} 2>/dev/null`).catch(() => ({ stdout: '' })),
      execAsync(`timeout 2 snmpget -v2c -c "${community}" "${ip}" ${STD_OIDS.sysUpTime} 2>/dev/null`).catch(() => ({ stdout: '' }))
    ]);
    
    const sysDescr = sysDescrOutput.stdout.match(/STRING:\s*(.+)/)?.[1]?.trim() || '';
    const sysObjectID = sysObjectIDOutput.stdout.match(/OID:\s*(.+)/)?.[1]?.trim() || '';
    const sysName = sysNameOutput.stdout.match(/STRING:\s*(.+)/)?.[1]?.replace(/"/g, '').trim() || '';
    const sysUpTimeMatch = sysUpTimeOutput.stdout.match(/Timeticks:\s*\((\d+)\)/);
    const sysUpTime = sysUpTimeMatch ? parseInt(sysUpTimeMatch[1]) : 0;
    
    let device_type = 'generic';
    if (sysObjectID.includes('1.3.6.1.4.1.14988')) {
      device_type = 'mikrotik';
    } else if (sysObjectID.includes('1.3.6.1.4.1.9')) {
      device_type = 'cisco';
    } else if (sysObjectID.includes('1.3.6.1.4.1.2011')) {
      device_type = 'huawei';
    }
    
    if (sysDescr.toLowerCase().includes('mikrotik') || sysDescr.toLowerCase().includes('routeros')) {
      device_type = 'mikrotik';
    }
    
    return {
      ip_address: ip,
      sysDescr: sysDescr.substring(0, 200),
      sysObjectID: sysObjectID.substring(0, 100),
      sysName: sysName.substring(0, 100),
      sysUpTime: sysUpTime,
      device_type: device_type,
      community: community,
      snmp_enabled: true
    };
  } catch (error) {
    throw new Error(`Failed to get device info: ${error.message}`);
  }
}

/**
 * Get Mikrotik-specific information
 */
async function getMikrotikInfo(ip, community) {
  const mikrotikInfo = {
    identity: null,
    routerOS_version: null,
    serial_number: null,
    board_name: null,
    cpu_load_percent: null,
    temperature_celsius: null,
    uptime_ticks: null
  };
  
  if (snmp) {
    // Use net-snmp package
    return new Promise((resolve) => {
      const session = snmp.createSession(ip, community, {
        port: 161,
        retries: 1,
        timeout: SNMP_TIMEOUT,
        transport: 'udp4'
      });
      
      const oids = [
        MIKROTIK_OIDS.identity,
        MIKROTIK_OIDS.version,
        MIKROTIK_OIDS.serial,
        MIKROTIK_OIDS.board,
        MIKROTIK_OIDS.cpuLoad,
        MIKROTIK_OIDS.temperature,
        MIKROTIK_OIDS.uptime
      ];
      
      session.get(oids, (error, varbinds) => {
        session.close();
        
        if (!error && varbinds) {
          mikrotikInfo.identity = varbinds[0]?.value?.toString().substring(0, 100) || null;
          mikrotikInfo.routerOS_version = varbinds[1]?.value?.toString().substring(0, 50) || null;
          mikrotikInfo.serial_number = varbinds[2]?.value?.toString().substring(0, 50) || null;
          mikrotikInfo.board_name = varbinds[3]?.value?.toString().substring(0, 100) || null;
          
          const cpuLoad = varbinds[4]?.value;
          mikrotikInfo.cpu_load_percent = (cpuLoad && typeof cpuLoad === 'number' && cpuLoad > 0) ? cpuLoad : null;
          
          const temp = varbinds[5]?.value;
          mikrotikInfo.temperature_celsius = (temp && typeof temp === 'number' && temp > 0) ? temp : null;
          
          const uptime = varbinds[6]?.value;
          mikrotikInfo.uptime_ticks = (uptime && typeof uptime === 'number' && uptime > 0) ? uptime : null;
        }
        
        resolve(mikrotikInfo);
      });
    });
  } else {
    // Fallback to system snmpget
    try {
      const [identityOutput, versionOutput, serialOutput, boardOutput, cpuOutput, tempOutput, uptimeOutput] = await Promise.all([
        execAsync(`timeout 2 snmpget -v2c -c "${community}" "${ip}" ${MIKROTIK_OIDS.identity} 2>/dev/null`).catch(() => ({ stdout: '' })),
        execAsync(`timeout 2 snmpget -v2c -c "${community}" "${ip}" ${MIKROTIK_OIDS.version} 2>/dev/null`).catch(() => ({ stdout: '' })),
        execAsync(`timeout 2 snmpget -v2c -c "${community}" "${ip}" ${MIKROTIK_OIDS.serial} 2>/dev/null`).catch(() => ({ stdout: '' })),
        execAsync(`timeout 2 snmpget -v2c -c "${community}" "${ip}" ${MIKROTIK_OIDS.board} 2>/dev/null`).catch(() => ({ stdout: '' })),
        execAsync(`timeout 2 snmpget -v2c -c "${community}" "${ip}" ${MIKROTIK_OIDS.cpuLoad} 2>/dev/null`).catch(() => ({ stdout: '' })),
        execAsync(`timeout 2 snmpget -v2c -c "${community}" "${ip}" ${MIKROTIK_OIDS.temperature} 2>/dev/null`).catch(() => ({ stdout: '' })),
        execAsync(`timeout 2 snmpget -v2c -c "${community}" "${ip}" ${MIKROTIK_OIDS.uptime} 2>/dev/null`).catch(() => ({ stdout: '' }))
      ]);
      
      mikrotikInfo.identity = identityOutput.stdout.match(/STRING:\s*(.+)/)?.[1]?.trim().substring(0, 100) || null;
      mikrotikInfo.routerOS_version = versionOutput.stdout.match(/STRING:\s*(.+)/)?.[1]?.trim().substring(0, 50) || null;
      mikrotikInfo.serial_number = serialOutput.stdout.match(/STRING:\s*(.+)/)?.[1]?.trim().substring(0, 50) || null;
      mikrotikInfo.board_name = boardOutput.stdout.match(/STRING:\s*(.+)/)?.[1]?.trim().substring(0, 100) || null;
      
      const cpuMatch = cpuOutput.stdout.match(/(\d+)/);
      mikrotikInfo.cpu_load_percent = cpuMatch ? parseInt(cpuMatch[1]) : null;
      
      const tempMatch = tempOutput.stdout.match(/(\d+)/);
      mikrotikInfo.temperature_celsius = tempMatch ? parseInt(tempMatch[1]) : null;
      
      const uptimeMatch = uptimeOutput.stdout.match(/Timeticks:\s*\((\d+)\)/);
      mikrotikInfo.uptime_ticks = uptimeMatch ? parseInt(uptimeMatch[1]) : null;
      
      return mikrotikInfo;
    } catch (error) {
      return mikrotikInfo;
    }
  }
}

/**
 * Create ping-only device entry (no SNMP)
 */
function createPingOnlyDevice(ip) {
  return {
    ip_address: ip,
    sysDescr: 'Device responding to ping (SNMP not enabled or not accessible)',
    sysObjectID: '',
    sysName: '',
    sysUpTime: 0,
    device_type: 'generic',
    community: '',
    snmp_enabled: false,
    discovered_via: 'ping_only'
  };
}

/**
 * Scan network for SNMP devices (two-phase: ping first, then SNMP)
 */
async function scanNetwork(subnet, communities = SNMP_COMMUNITIES) {
  log(`Starting two-phase network discovery on subnet: ${subnet}`);
  const startTime = Date.now();
  
  // Phase 1: Ping sweep
  const respondingIPs = await pingSweep(subnet);
  
  if (respondingIPs.length === 0) {
    log(`No responding hosts found on subnet ${subnet}`);
    return [];
  }
  
  log(`Step 2: SNMP discovery - checking ${respondingIPs.length} responding hosts for SNMP...`);
  
  const devices = [];
  const pingOnlyDevices = [];
  
  // Phase 2: SNMP scan on responding hosts
  const snmpPromises = [];
  let processed = 0;
  
  for (const ip of respondingIPs) {
    const snmpPromise = (async () => {
      try {
        // Try each community string
        for (const community of communities) {
          try {
            const deviceInfo = await getDeviceInfo(ip, community);
            
            // Get Mikrotik-specific info if it's a Mikrotik device
            if (deviceInfo.device_type === 'mikrotik') {
              log(`  Detected Mikrotik device at ${ip}, gathering additional information...`);
              const mikrotikInfo = await getMikrotikInfo(ip, community);
              deviceInfo.mikrotik = mikrotikInfo;
            }
            
            devices.push(deviceInfo);
            log(`Found SNMP device: ${ip} (${deviceInfo.device_type}, community: ${community})`);
            return;
          } catch (error) {
            // Try next community
            continue;
          }
        }
        
        // No SNMP found, but host responded to ping
        pingOnlyDevices.push(createPingOnlyDevice(ip));
      } catch (error) {
        // Host doesn't have SNMP
        pingOnlyDevices.push(createPingOnlyDevice(ip));
      } finally {
        processed++;
        if (processed % 10 === 0 || processed === respondingIPs.length) {
          log(`  SNMP progress: ${processed}/${respondingIPs.length} hosts (${devices.length} SNMP device(s) found)...`);
        }
      }
    })();
    
    snmpPromises.push(snmpPromise);
    
    // Limit concurrent SNMP queries
    if (snmpPromises.length >= MAX_PARALLEL_SNMP) {
      await Promise.all(snmpPromises);
      snmpPromises.length = 0;
    }
  }
  
  // Process remaining SNMP queries
  if (snmpPromises.length > 0) {
    await Promise.all(snmpPromises);
  }
  
  // Combine SNMP devices and ping-only devices
  const allDevices = [...devices, ...pingOnlyDevices];
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`Discovery complete: ${allDevices.length} total devices (${devices.length} SNMP-enabled, ${pingOnlyDevices.length} ping-only) in ${elapsed}s`);
  
  return allDevices;
}

/**
 * Report discovered devices to server
 */
async function reportDiscoveredDevices(discoveredDevices) {
  const deviceCode = await getDeviceCode();
  const tenantId = await getTenantId();
  
  if (!deviceCode) {
    log(`ERROR: No device code found`);
    return false;
  }
  
  // Always report, even if empty
  const payload = {
    device_code: deviceCode,
    discovered_devices: discoveredDevices || []
  };
  
  const payloadStr = JSON.stringify(payload);
  const url = new URL(`${API_URL}/snmp/discovered`);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadStr),
        ...(tenantId ? { 'X-Tenant-ID': tenantId } : {})
      },
      timeout: 30000
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const response = JSON.parse(responseData);
            if (response.success !== false) {
              log(`Successfully reported ${discoveredDevices.length} discovered devices`);
              resolve(true);
            } else {
              log(`ERROR: Server returned error: ${response.error || response.message}`);
              resolve(false);
            }
          } catch (e) {
            log(`ERROR: Failed to parse server response`);
            resolve(false);
          }
        } else {
          log(`ERROR: Server returned HTTP ${res.statusCode}: ${responseData.substring(0, 200)}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      log(`ERROR: Failed to report discovered devices: ${error.message}`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      log(`ERROR: Request timeout while reporting discovered devices`);
      resolve(false);
    });
    
    req.write(payloadStr);
    req.end();
  });
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Check for single IP test mode
  if (args.length > 0 && /^\d+\.\d+\.\d+\.\d+$/.test(args[0])) {
    log(`Test mode: Scanning single IP ${args[0]}`);
    const deviceInfo = await getDeviceInfo(args[0], SNMP_COMMUNITIES[0]).catch(() => null);
    if (deviceInfo) {
      console.log(JSON.stringify(deviceInfo, null, 2));
    } else {
      log(`No SNMP device found at ${args[0]}`);
    }
    return;
  }
  
  // Get network info
  const subnet = args[0] || await getNetworkInfo();
  
  log(`Starting SNMP discovery on subnet: ${subnet}`);
  
  try {
    // Scan network
    const discoveredDevices = await scanNetwork(subnet);
    
    // Report to server
    if (discoveredDevices.length > 0 || true) { // Always report, even if empty
      await reportDiscoveredDevices(discoveredDevices);
    } else {
      log(`No devices discovered, skipping report`);
    }
  } catch (error) {
    log(`ERROR: Discovery failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    log(`FATAL ERROR: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { scanNetwork, getDeviceInfo, getMikrotikInfo };

