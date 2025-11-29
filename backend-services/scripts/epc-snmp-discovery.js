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
const dgram = require('dgram'); // For UDP socket (MNDP)

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

// ============================================================================
// OUI (Organizationally Unique Identifier) Lookup Utility (Embedded)
// Used to identify device manufacturers from MAC addresses
// ============================================================================
const MIKROTIK_OUIS = [
  '00:0C:42', '4C:5E:0C', 'D4:CA:6D', 'E4:8D:8C', '48:8F:5A', 'A4:BA:DB',
  'C4:AD:34', 'CC:2D:E0', 'F4:EC:38', 'FC:2A:54', 'FC:C2:3D'
];

const COMMON_NETWORK_OUIS = {
  '00:0C:42': 'Mikrotik', '4C:5E:0C': 'Mikrotik', 'D4:CA:6D': 'Mikrotik',
  'E4:8D:8C': 'Mikrotik', '48:8F:5A': 'Mikrotik', 'A4:BA:DB': 'Mikrotik',
  'C4:AD:34': 'Mikrotik', 'CC:2D:E0': 'Mikrotik', 'F4:EC:38': 'Mikrotik',
  'FC:2A:54': 'Mikrotik', 'FC:C2:3D': 'Mikrotik',
  '00:00:0C': 'Cisco', '00:01:42': 'Cisco', '00:01:43': 'Cisco',
  '00:01:63': 'Cisco', '00:01:64': 'Cisco', '00:01:96': 'Cisco',
  '00:01:97': 'Cisco', '00:01:C7': 'Cisco', '00:01:C9': 'Cisco',
  '00:02:16': 'Cisco', '00:02:17': 'Cisco', '00:02:3D': 'Cisco',
  '00:02:4A': 'Cisco', '00:02:7D': 'Cisco', '00:02:B9': 'Cisco',
  '00:02:BA': 'Cisco', '00:02:FC': 'Cisco', '00:03:6B': 'Cisco',
  '00:03:6C': 'Cisco', '00:03:6D': 'Cisco', '00:03:93': 'Cisco',
  '00:03:E3': 'Cisco', '00:04:4B': 'Cisco', '00:04:9A': 'Cisco',
  '00:04:9B': 'Cisco', '00:04:C0': 'Cisco', '00:04:C1': 'Cisco',
  '00:05:31': 'Cisco', '00:05:32': 'Cisco', '00:05:5E': 'Cisco',
  '00:05:73': 'Cisco', '00:05:9A': 'Cisco', '00:05:DC': 'Cisco',
  '00:05:DF': 'Cisco', '00:07:85': 'Cisco', '00:09:43': 'Cisco',
  '00:0B:BE': 'Cisco', '00:0C:29': 'Cisco', '00:0C:41': 'Cisco',
  '00:0C:85': 'Cisco', '00:0C:CE': 'Cisco', '00:0D:29': 'Cisco',
  '00:0D:65': 'Cisco', '00:0D:97': 'Cisco', '00:0E:38': 'Cisco',
  '00:0E:83': 'Cisco', '00:0E:D6': 'Cisco', '00:0F:23': 'Cisco',
  '00:0F:34': 'Cisco', '00:0F:8F': 'Cisco', '00:10:07': 'Cisco',
  '00:10:11': 'Cisco', '00:10:14': 'Cisco', '00:10:79': 'Cisco',
  '00:10:FF': 'Cisco', '00:11:20': 'Cisco', '00:11:21': 'Cisco',
  '00:11:5C': 'Cisco', '00:11:92': 'Cisco', '00:11:93': 'Cisco',
  '00:11:BB': 'Cisco', '00:11:BC': 'Cisco', '00:12:00': 'Cisco',
  '00:12:01': 'Cisco', '00:12:43': 'Cisco', '00:12:7F': 'Cisco',
  '00:12:80': 'Cisco', '00:12:D9': 'Cisco', '00:13:19': 'Cisco',
  '00:13:1A': 'Cisco', '00:13:5F': 'Cisco', '00:13:60': 'Cisco',
  '00:13:80': 'Cisco', '00:13:C3': 'Cisco', '00:13:DF': 'Cisco',
  '00:14:1B': 'Cisco', '00:14:69': 'Cisco', '00:14:6A': 'Cisco',
  '00:14:A8': 'Cisco', '00:14:F1': 'Cisco', '00:15:2A': 'Cisco',
  '00:15:62': 'Cisco', '00:15:C6': 'Cisco', '00:15:C7': 'Cisco',
  '00:16:46': 'Cisco', '00:16:47': 'Cisco', '00:16:9E': 'Cisco',
  '00:16:C7': 'Cisco', '00:16:D3': 'Cisco', '00:17:0E': 'Cisco',
  '00:17:0F': 'Cisco', '00:17:59': 'Cisco', '00:17:94': 'Cisco',
  '00:17:95': 'Cisco', '00:17:DF': 'Cisco', '00:18:18': 'Cisco',
  '00:18:19': 'Cisco', '00:18:73': 'Cisco', '00:18:74': 'Cisco',
  '00:18:BA': 'Cisco', '00:18:BB': 'Cisco', '00:18:F3': 'Cisco',
  '00:19:06': 'Cisco', '00:19:07': 'Cisco', '00:19:2F': 'Cisco',
  '00:19:55': 'Cisco', '00:19:56': 'Cisco', '00:19:AA': 'Cisco',
  '00:19:AB': 'Cisco', '00:19:E7': 'Cisco', '00:1A:2F': 'Cisco',
  '00:1A:6C': 'Cisco', '00:1A:6D': 'Cisco', '00:1A:A1': 'Cisco',
  '00:1A:A2': 'Cisco', '00:1A:E2': 'Cisco', '00:1A:E3': 'Cisco',
  '00:1B:0C': 'Cisco', '00:1B:0D': 'Cisco', '00:1B:53': 'Cisco',
  '00:1B:54': 'Cisco', '00:1B:D4': 'Cisco', '00:1B:D5': 'Cisco',
  '00:1C:0E': 'Cisco', '00:1C:0F': 'Cisco', '00:1C:58': 'Cisco',
  '00:1C:AA': 'Cisco', '00:1C:DF': 'Cisco', '00:1D:45': 'Cisco',
  '00:1D:46': 'Cisco', '00:1D:70': 'Cisco', '00:1D:A1': 'Cisco',
  '00:1E:13': 'Cisco', '00:1E:14': 'Cisco', '00:1E:49': 'Cisco',
  '00:1E:4A': 'Cisco', '00:1E:7D': 'Cisco', '00:1E:7E': 'Cisco',
  '00:1E:BD': 'Cisco', '00:1E:BE': 'Cisco', '00:1E:F7': 'Cisco',
  '00:1E:F8': 'Cisco', '00:1F:6C': 'Cisco', '00:1F:6D': 'Cisco',
  '00:1F:9E': 'Cisco', '00:1F:9F': 'Cisco', '00:1F:CA': 'Cisco',
  '00:21:1B': 'Cisco', '00:21:1C': 'Cisco', '00:21:55': 'Cisco',
  '00:21:56': 'Cisco', '00:21:70': 'Cisco', '00:21:A1': 'Cisco',
  '00:21:D0': 'Cisco', '00:22:55': 'Cisco', '00:22:56': 'Cisco',
  '00:22:58': 'Cisco', '00:23:04': 'Cisco', '00:23:05': 'Cisco',
  '00:23:33': 'Cisco', '00:23:34': 'Cisco', '00:23:AB': 'Cisco',
  '00:23:AC': 'Cisco', '00:23:DF': 'Cisco', '00:23:E0': 'Cisco',
  '00:24:14': 'Cisco', '00:24:97': 'Cisco', '00:24:D7': 'Cisco',
  '00:24:D9': 'Cisco', '00:25:84': 'Cisco', '00:25:85': 'Cisco',
  '00:26:0A': 'Cisco', '00:26:0B': 'Cisco', '00:26:4A': 'Cisco',
  '00:26:4B': 'Cisco', '00:26:98': 'Cisco', '00:26:99': 'Cisco',
  '00:26:CA': 'Cisco', '00:26:CB': 'Cisco', '00:26:F2': 'Cisco',
  '00:15:6D': 'Ubiquiti Networks', '00:27:22': 'Ubiquiti Networks',
  '04:18:D6': 'Ubiquiti Networks', '24:A4:3C': 'Ubiquiti Networks',
  '44:D9:E7': 'Ubiquiti Networks', '68:D7:9A': 'Ubiquiti Networks',
  '70:85:C2': 'Ubiquiti Networks', '78:A3:E4': 'Ubiquiti Networks',
  '80:2A:A8': 'Ubiquiti Networks', 'B4:FB:E4': 'Ubiquiti Networks',
  'D4:9A:20': 'Ubiquiti Networks', 'E0:63:DA': 'Ubiquiti Networks',
  'F0:9F:C2': 'Ubiquiti Networks',
  '00:1E:10': 'Huawei', '00:46:4B': 'Huawei', '00:E0:FC': 'Huawei',
  '00:E0:FF': 'Huawei', '28:6E:D4': 'Huawei', '38:46:08': 'Huawei',
  '40:4E:36': 'Huawei', '5C:B3:95': 'Huawei', '60:DE:44': 'Huawei',
  '64:16:66': 'Huawei', '70:72:3C': 'Huawei', '80:FB:06': 'Huawei',
  '94:DB:DA': 'Huawei', 'AC:E2:D3': 'Huawei', 'C8:1E:E7': 'Huawei',
  'DC:D2:FC': 'Huawei', 'E0:28:6D': 'Huawei', 'F0:98:9D': 'Huawei',
  'FC:48:EF': 'Huawei',
  '00:27:19': 'TP-Link', '50:C7:BF': 'TP-Link', 'A0:F3:C1': 'TP-Link',
  'C8:3A:35': 'TP-Link',
  '00:1B:11': 'D-Link', '00:1E:58': 'D-Link', '00:21:91': 'D-Link',
  '00:26:5A': 'D-Link', '1C:7E:E5': 'D-Link', 'B8:A3:86': 'D-Link',
  'C8:D3:FF': 'D-Link', 'E0:19:1D': 'D-Link', 'F8:1A:67': 'D-Link',
  '00:09:5B': 'Netgear', '00:0F:B5': 'Netgear', '00:14:6C': 'Netgear',
  '00:1B:2F': 'Netgear', '00:1F:33': 'Netgear', '00:24:B2': 'Netgear',
  '20:4E:7F': 'Netgear', '44:94:FC': 'Netgear', 'A0:63:91': 'Netgear',
  'C4:04:15': 'Netgear',
  '00:0B:86': 'Aruba Networks', '00:17:A2': 'Aruba Networks',
  '24:DE:C6': 'Aruba Networks', '70:3A:0E': 'Aruba Networks',
  '78:FE:3D': 'Aruba Networks', '90:72:40': 'Aruba Networks',
  'AC:47:33': 'Aruba Networks',
  '00:17:C2': 'Ruckus Wireless', '00:1A:1E': 'Ruckus Wireless',
  '00:1D:AA': 'Ruckus Wireless',
  '00:0C:29': 'VMware', '00:0D:29': 'VMware', '00:50:56': 'VMware'
};

function normalizeMacAddress(mac) {
  if (!mac || typeof mac !== 'string') return null;
  const cleaned = mac.replace(/[-.:\s]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(cleaned)) return null;
  return cleaned.match(/.{2}/g).join(':');
}

function extractOUI(mac) {
  const normalized = normalizeMacAddress(mac);
  return normalized ? normalized.substring(0, 8) : null;
}

function isMikrotikOUI(mac) {
  const oui = extractOUI(mac);
  return oui ? MIKROTIK_OUIS.includes(oui) : false;
}

function lookupManufacturer(mac) {
  const oui = extractOUI(mac);
  if (!oui) return null;
  if (MIKROTIK_OUIS.includes(oui)) return 'Mikrotik';
  return COMMON_NETWORK_OUIS[oui] || null;
}

function detectMikrotikFromArpTable(arpTable) {
  const mikrotikDevices = [];
  if (!Array.isArray(arpTable)) return mikrotikDevices;
  arpTable.forEach(entry => {
    const macFields = [entry.mac_address, entry.mac, entry.phys_address].filter(Boolean);
    for (const macField of macFields) {
      if (isMikrotikOUI(macField)) {
        mikrotikDevices.push({
          mac_address: normalizeMacAddress(macField),
          ip_address: entry.ip_address || entry.ip || null,
          hostname: entry.hostname || entry.name || null,
          interface: entry.interface || entry.if_name || null,
          detected_via: 'oui_lookup'
        });
        break;
      }
    }
  });
  return mikrotikDevices;
}

function detectManufacturersFromArpTable(arpTable) {
  const detectedDevices = [];
  if (!Array.isArray(arpTable)) return detectedDevices;
  arpTable.forEach(entry => {
    const macFields = [entry.mac_address, entry.mac, entry.phys_address].filter(Boolean);
    for (const macField of macFields) {
      const manufacturer = lookupManufacturer(macField);
      if (manufacturer) {
        detectedDevices.push({
          mac_address: normalizeMacAddress(macField),
          manufacturer: manufacturer,
          ip_address: entry.ip_address || entry.ip || null,
          hostname: entry.hostname || entry.name || null,
          interface: entry.interface || entry.if_name || null,
          detected_via: 'oui_lookup',
          oui: extractOUI(macField)
        });
        break;
      }
    }
  });
  return detectedDevices;
}

function detectManufacturerFromInterfaces(interfaces) {
  if (!Array.isArray(interfaces)) return null;
  for (const iface of interfaces) {
    const macFields = [iface.mac_address, iface.mac, iface.phys_address, iface.ifPhysAddress].filter(Boolean);
    for (const macField of macFields) {
      const manufacturer = lookupManufacturer(macField);
      if (manufacturer) {
        return {
          manufacturer: manufacturer,
          mac_address: normalizeMacAddress(macField),
          interface: iface.name || iface.ifDescr || iface.if_name || null,
          detected_via: 'oui_lookup',
          oui: extractOUI(macField)
        };
      }
    }
  }
  return null;
}

// OUI Lookup utility object
const ouiLookup = {
  normalizeMacAddress,
  extractOUI,
  isMikrotikOUI,
  lookupManufacturer,
  detectMikrotikFromArpTable,
  detectManufacturersFromArpTable,
  detectManufacturerFromInterfaces,
  MIKROTIK_OUIS,
  COMMON_NETWORK_OUIS
};

// Configuration
const CENTRAL_SERVER = 'hss.wisptools.io';
const API_URL = `https://${CENTRAL_SERVER}/api/epc`;
const CONFIG_DIR = '/etc/wisptools';
const LOG_FILE = '/var/log/wisptools-snmp-discovery.log';
const SNMP_COMMUNITIES = ['public', 'private', 'community']; // Default fallback
const SNMP_TIMEOUT = 2000; // 2 seconds
const MAX_PARALLEL_PINGS = 50;
const MAX_PARALLEL_SNMP = 20;

// SNMP configuration from EPC config (loaded at runtime)
let SNMP_CONFIG = {
  communities: SNMP_COMMUNITIES,
  targets: [] // Subnets to scan
};

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

// LLDP (Link Layer Discovery Protocol) OIDs - Standard neighbor discovery
const LLDP_OIDS = {
  lldpLocChassisId: '1.0.8802.1.1.2.1.3.2.0', // Local chassis ID
  lldpRemTable: '1.0.8802.1.1.2.1.4.1', // Remote neighbor table
  lldpRemChassisId: '1.0.8802.1.1.2.1.4.1.1.5', // Remote chassis ID
  lldpRemSysName: '1.0.8802.1.1.2.1.4.1.1.9', // Remote system name
  lldpRemSysDesc: '1.0.8802.1.1.2.1.4.1.1.10', // Remote system description
  lldpRemManAddr: '1.0.8802.1.1.2.1.4.2.1.4', // Remote management address
  lldpRemLocalPortNum: '1.0.8802.1.1.2.1.4.1.1.7' // Local port number
};

// CDP (Cisco Discovery Protocol) OIDs
const CDP_OIDS = {
  cdpGlobalRun: '1.3.6.1.4.1.9.9.23.1.3.1.0', // CDP enabled
  cdpCacheTable: '1.3.6.1.4.1.9.9.23.1.2.1', // CDP cache table
  cdpCacheDeviceId: '1.3.6.1.4.1.9.9.23.1.2.1.1.6', // Device ID
  cdpCacheDevicePort: '1.3.6.1.4.1.9.9.23.1.2.1.1.7', // Device port
  cdpCachePlatform: '1.3.6.1.4.1.9.9.23.1.2.1.1.8', // Platform
  cdpCacheAddress: '1.3.6.1.4.1.9.9.23.1.2.1.1.4' // IP address
};

// Standard SNMP OIDs
const STD_OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysObjectID: '1.3.6.1.2.1.1.2.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysContact: '1.3.6.1.2.1.1.4.0',
  sysLocation: '1.3.6.1.2.1.1.6.0'
};

// Interface MIB OIDs (IF-MIB)
const IF_MIB_OIDS = {
  ifNumber: '1.3.6.1.2.1.2.1.0',
  ifTable: '1.3.6.1.2.1.2.2.1', // Interface table
  ifIndex: '1.3.6.1.2.1.2.2.1.1', // Interface index
  ifDescr: '1.3.6.1.2.1.2.2.1.2', // Interface description
  ifType: '1.3.6.1.2.1.2.2.1.3', // Interface type
  ifMtu: '1.3.6.1.2.1.2.2.1.4', // MTU
  ifSpeed: '1.3.6.1.2.1.2.2.1.5', // Interface speed (bps)
  ifPhysAddress: '1.3.6.1.2.1.2.2.1.6', // MAC address
  ifAdminStatus: '1.3.6.1.2.1.2.2.1.7', // Admin status (1=up, 2=down)
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8', // Operational status
  ifInOctets: '1.3.6.1.2.1.2.2.1.10', // Octets in (counter)
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16', // Octets out (counter)
  ifInErrors: '1.3.6.1.2.1.2.2.1.14', // Input errors
  ifOutErrors: '1.3.6.1.2.1.2.2.1.20' // Output errors
};

// IP MIB OIDs (for ARP and routing)
const IP_MIB_OIDS = {
  ipAdEntAddr: '1.3.6.1.2.1.4.20.1.1', // IP address table
  ipAdEntNetMask: '1.3.6.1.2.1.4.20.1.3', // Netmask
  ipAdEntIfIndex: '1.3.6.1.2.1.4.20.1.2', // Interface index for IP
  ipNetToMediaTable: '1.3.6.1.2.1.4.22.1', // ARP table
  ipNetToMediaPhysAddress: '1.3.6.1.2.1.4.22.1.2', // MAC address in ARP
  ipNetToMediaNetAddress: '1.3.6.1.2.1.4.22.1.3', // IP address in ARP
  ipNetToMediaIfIndex: '1.3.6.1.2.1.4.22.1.1', // Interface index in ARP
  ipNetToMediaType: '1.3.6.1.2.1.4.22.1.4', // ARP entry type
  ipRouteTable: '1.3.6.1.2.1.4.21.1', // Routing table
  ipRouteDest: '1.3.6.1.2.1.4.21.1.1', // Route destination
  ipRouteNextHop: '1.3.6.1.2.1.4.21.1.7', // Next hop
  ipRouteMask: '1.3.6.1.2.1.4.21.1.11', // Route mask
  ipRouteType: '1.3.6.1.2.1.4.21.1.8', // Route type
  ipRouteProto: '1.3.6.1.2.1.4.21.1.9' // Routing protocol
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
 * Load SNMP configuration from EPC config file
 */
async function loadSNMPConfig() {
  try {
    const configFiles = [
      '/etc/wisptools/last-config.json',
      '/etc/wisptools/epc-config.json'
    ];
    
    for (const configFile of configFiles) {
      try {
        if (await fs.access(configFile).then(() => true).catch(() => false)) {
          const configContent = await fs.readFile(configFile, 'utf8');
          const config = JSON.parse(configContent);
          
          if (config.snmp_config) {
            const snmpConfig = config.snmp_config;
            
            // Load communities
            if (snmpConfig.communities && Array.isArray(snmpConfig.communities) && snmpConfig.communities.length > 0) {
              SNMP_CONFIG.communities = snmpConfig.communities.filter(c => c && c.trim().length > 0);
              log(`Loaded ${SNMP_CONFIG.communities.length} SNMP communities from config: ${SNMP_CONFIG.communities.join(', ')}`);
            } else if (snmpConfig.community) {
              SNMP_CONFIG.communities = [snmpConfig.community];
              log(`Loaded SNMP community from config: ${snmpConfig.community}`);
            }
            
            // Load target subnets
            if (snmpConfig.targets && Array.isArray(snmpConfig.targets) && snmpConfig.targets.length > 0) {
              SNMP_CONFIG.targets = snmpConfig.targets.filter(t => t && t.trim().length > 0);
              log(`Loaded ${SNMP_CONFIG.targets.length} SNMP target subnets from config: ${SNMP_CONFIG.targets.join(', ')}`);
            }
            
            return true; // Successfully loaded config
          }
        }
      } catch (fileError) {
        // Try next file
        continue;
      }
    }
  } catch (error) {
    log(`WARNING: Failed to load SNMP config: ${error.message}`);
  }
  
  return false; // No config loaded, will use defaults
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
 * Perform OID walk to collect comprehensive device information
 */
async function performOIDWalk(ip, community) {
  const walkData = {
    interfaces: [],
    arp_table: [],
    routes: [],
    ip_addresses: []
  };
  
  if (!snmp) {
    return walkData; // Skip OID walk if net-snmp not available
  }
  
  try {
    const session = snmp.createSession(ip, community, {
      port: 161,
      retries: 1,
      timeout: SNMP_TIMEOUT * 2, // Longer timeout for walks
      transport: 'udp4'
    });
    
    // Walk interface table
    try {
      await new Promise((resolve) => {
        const interfaces = new Map();
        session.subtree(IF_MIB_OIDS.ifTable, (error, varbinds) => {
          if (error || !varbinds) {
            resolve();
            return;
          }
          
          varbinds.forEach((vb) => {
            const oid = vb.oid.toString();
            const value = vb.value;
            const ifIndex = parseInt(oid.split('.').pop());
            
            if (!interfaces.has(ifIndex)) {
              interfaces.set(ifIndex, { index: ifIndex });
            }
            
            const iface = interfaces.get(ifIndex);
            
            // Map OID to interface property
            if (oid.includes(IF_MIB_OIDS.ifDescr.replace('1.3.6.1.2.1.2.2.1.', ''))) {
              iface.description = value?.toString() || '';
            } else if (oid.includes(IF_MIB_OIDS.ifType.replace('1.3.6.1.2.1.2.2.1.', ''))) {
              iface.type = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
            } else if (oid.includes(IF_MIB_OIDS.ifSpeed.replace('1.3.6.1.2.1.2.2.1.', ''))) {
              iface.speed = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
            } else if (oid.includes(IF_MIB_OIDS.ifPhysAddress.replace('1.3.6.1.2.1.2.2.1.', ''))) {
              iface.mac_address = value?.toString() || '';
            } else if (oid.includes(IF_MIB_OIDS.ifAdminStatus.replace('1.3.6.1.2.1.2.2.1.', ''))) {
              iface.admin_status = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
            } else if (oid.includes(IF_MIB_OIDS.ifOperStatus.replace('1.3.6.1.2.1.2.2.1.', ''))) {
              iface.oper_status = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
            } else if (oid.includes(IF_MIB_OIDS.ifInOctets.replace('1.3.6.1.2.1.2.2.1.', ''))) {
              iface.in_octets = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
            } else if (oid.includes(IF_MIB_OIDS.ifOutOctets.replace('1.3.6.1.2.1.2.2.1.', ''))) {
              iface.out_octets = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
            } else if (oid.includes(IF_MIB_OIDS.ifInErrors.replace('1.3.6.1.2.1.2.2.1.', ''))) {
              iface.in_errors = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
            } else if (oid.includes(IF_MIB_OIDS.ifOutErrors.replace('1.3.6.1.2.1.2.2.1.', ''))) {
              iface.out_errors = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
            }
          });
          
          walkData.interfaces = Array.from(interfaces.values());
          resolve();
        });
      });
    } catch (error) {
      log(`WARNING: Failed to walk interface table for ${ip}: ${error.message}`);
    }
    
    // Walk ARP table
    try {
      await new Promise((resolve) => {
        const arpEntries = new Map();
        session.subtree(IP_MIB_OIDS.ipNetToMediaTable, (error, varbinds) => {
          if (error || !varbinds) {
            resolve();
            return;
          }
          
          varbinds.forEach((vb) => {
            const oid = vb.oid.toString();
            const value = vb.value;
            
            // Parse ARP entry index from OID
            // Format: 1.3.6.1.2.1.4.22.1.X.Y.Z where X=ifIndex, Y=NetAddress type, Z=NetAddress
            const parts = oid.split('.');
            if (parts.length >= 9) {
              const ifIndex = parseInt(parts[parts.length - 3]);
              const entryKey = `${ifIndex}_${parts.slice(-2).join('.')}`;
              
              if (!arpEntries.has(entryKey)) {
                arpEntries.set(entryKey, { if_index: ifIndex });
              }
              
              const entry = arpEntries.get(entryKey);
              
              if (oid.includes(IP_MIB_OIDS.ipNetToMediaPhysAddress.replace('1.3.6.1.2.1.4.22.1.', ''))) {
                entry.mac_address = value?.toString() || '';
              } else if (oid.includes(IP_MIB_OIDS.ipNetToMediaNetAddress.replace('1.3.6.1.2.1.4.22.1.', ''))) {
                entry.ip_address = value?.toString() || '';
              } else if (oid.includes(IP_MIB_OIDS.ipNetToMediaType.replace('1.3.6.1.2.1.4.22.1.', ''))) {
                entry.type = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              }
            }
          });
          
          walkData.arp_table = Array.from(arpEntries.values()).filter(e => e.ip_address && e.mac_address);
          resolve();
        });
      });
    } catch (error) {
      log(`WARNING: Failed to walk ARP table for ${ip}: ${error.message}`);
    }
    
    // Walk routing table
    try {
      await new Promise((resolve) => {
        const routes = new Map();
        session.subtree(IP_MIB_OIDS.ipRouteTable, (error, varbinds) => {
          if (error || !varbinds) {
            resolve();
            return;
          }
          
          varbinds.forEach((vb) => {
            const oid = vb.oid.toString();
            const value = vb.value;
            
            // Parse route index from OID
            // Format: 1.3.6.1.2.1.4.21.1.X.Y where Y is destination IP
            const parts = oid.split('.');
            if (parts.length >= 8) {
              const destIP = parts.slice(-4).join('.');
              const routeKey = destIP;
              
              if (!routes.has(routeKey)) {
                routes.set(routeKey, { destination: destIP });
              }
              
              const route = routes.get(routeKey);
              
              if (oid.includes(IP_MIB_OIDS.ipRouteNextHop.replace('1.3.6.1.2.1.4.21.1.', ''))) {
                route.next_hop = value?.toString() || '';
              } else if (oid.includes(IP_MIB_OIDS.ipRouteMask.replace('1.3.6.1.2.1.4.21.1.', ''))) {
                route.mask = value?.toString() || '';
              } else if (oid.includes(IP_MIB_OIDS.ipRouteType.replace('1.3.6.1.2.1.4.21.1.', ''))) {
                route.type = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              } else if (oid.includes(IP_MIB_OIDS.ipRouteProto.replace('1.3.6.1.2.1.4.21.1.', ''))) {
                route.protocol = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              }
            }
          });
          
          walkData.routes = Array.from(routes.values());
          resolve();
        });
      });
    } catch (error) {
      log(`WARNING: Failed to walk routing table for ${ip}: ${error.message}`);
    }
    
    // Walk IP address table
    try {
      await new Promise((resolve) => {
        const ipAddrs = new Map();
        session.subtree(IP_MIB_OIDS.ipAdEntAddr, (error, varbinds) => {
          if (error || !varbinds) {
            resolve();
            return;
          }
          
          varbinds.forEach((vb) => {
            const ip = vb.value?.toString() || '';
            if (ip && !ip.includes('127.') && !ip.includes('::1')) {
              ipAddrs.set(ip, { ip_address: ip });
            }
          });
          
          walkData.ip_addresses = Array.from(ipAddrs.values());
          resolve();
        });
      });
    } catch (error) {
      log(`WARNING: Failed to walk IP address table for ${ip}: ${error.message}`);
    }
    
    session.close();
  } catch (error) {
    log(`WARNING: OID walk failed for ${ip}: ${error.message}`);
  }
  
  return walkData;
}

/**
 * Identify device type based on OID walk results
 * Also checks OUI from ARP table for Mikrotik detection
 */
function identifyDeviceType(deviceInfo, walkData) {
  // Check sysObjectID and sysDescr first
  const sysObjectID = deviceInfo.sysObjectID || '';
  const sysDescr = (deviceInfo.sysDescr || '').toLowerCase();
  
  // Mikrotik - check OID first
  if (sysObjectID.includes('1.3.6.1.4.1.14988') || sysDescr.includes('mikrotik') || sysDescr.includes('routeros')) {
    return 'mikrotik';
  }
  
  // Check OUI from ARP table for Mikrotik detection
  if (ouiLookup && walkData && walkData.arp_table && Array.isArray(walkData.arp_table)) {
    const mikrotikFromARP = ouiLookup.detectMikrotikFromArpTable(walkData.arp_table);
    if (mikrotikFromARP && mikrotikFromARP.length > 0) {
      log(`  Detected Mikrotik device via OUI lookup from ARP table (${mikrotikFromARP.length} MAC address(es))`);
      return 'mikrotik';
    }
  }
  
  // Also check interfaces for Mikrotik MAC addresses
  if (ouiLookup && walkData && walkData.interfaces && Array.isArray(walkData.interfaces)) {
    for (const iface of walkData.interfaces) {
      if (iface.mac_address || iface.phys_address) {
        const mac = iface.mac_address || iface.phys_address;
        if (ouiLookup.isMikrotikOUI(mac)) {
          log(`  Detected Mikrotik device via OUI lookup from interface MAC: ${mac}`);
          return 'mikrotik';
        }
      }
    }
  }
  
  // Cisco
  if (sysObjectID.includes('1.3.6.1.4.1.9')) {
    // Check for switch vs router
    if (walkData.interfaces && walkData.interfaces.length > 8) {
      const hasManyEth = walkData.interfaces.filter(i => i.type === 6).length > 4; // ethernetCsmacd = 6
      if (hasManyEth) return 'switch';
    }
    return 'cisco_router';
  }
  
  // Huawei
  if (sysObjectID.includes('1.3.6.1.4.1.2011')) {
    return 'huawei';
  }
  
  // Ubiquiti
  if (sysObjectID.includes('1.3.6.1.4.1.41112') || sysDescr.includes('ubiquiti')) {
    return 'ubiquiti';
  }
  
  // Determine by interface characteristics
  if (walkData.interfaces && walkData.interfaces.length > 0) {
    const interfaceCount = walkData.interfaces.length;
    const ethernetCount = walkData.interfaces.filter(i => i.type === 6).length;
    const hasVLAN = walkData.interfaces.some(i => i.type === 53 || i.description?.toLowerCase().includes('vlan'));
    
    // Switch characteristics: many ethernet interfaces, VLAN support, ARP table
    if (ethernetCount > 4 && hasVLAN && walkData.arp_table && walkData.arp_table.length > 0) {
      return 'switch';
    }
    
    // Router characteristics: fewer interfaces, routing table
    if (interfaceCount <= 8 && walkData.routes && walkData.routes.length > 1) {
      return 'router';
    }
    
    // AP characteristics: wireless interfaces (type 71 = ieee80211)
    const wirelessCount = walkData.interfaces.filter(i => i.type === 71 || i.type === 6 && i.description?.toLowerCase().includes('wifi')).length;
    if (wirelessCount > 0) {
      return 'access_point';
    }
  }
  
  return deviceInfo.device_type || 'generic';
}

/**
 * Get device info via SNMP using net-snmp (if available) or system snmpget
 */
async function getDeviceInfo(ip, community) {
  let deviceInfo;
  
  if (snmp) {
    // Use net-snmp package
    deviceInfo = await getDeviceInfoWithNetSNMP(ip, community);
  } else {
    // Fallback to system snmpget
    deviceInfo = await getDeviceInfoWithSystemSNMP(ip, community);
  }
  
  // Perform comprehensive OID walk
  log(`  Performing OID walk for ${ip}...`);
  const walkData = await performOIDWalk(ip, community);
  
  // Identify device type based on walk results
  deviceInfo.device_type = identifyDeviceType(deviceInfo, walkData);
  
  // Detect manufacturer via OUI lookup from ARP table or interfaces
  if (ouiLookup) {
    let manufacturerFromOUI = null;
    
    // Try ARP table first
    if (walkData.arp_table && Array.isArray(walkData.arp_table)) {
      const manufacturersFromARP = ouiLookup.detectManufacturersFromArpTable(walkData.arp_table);
      if (manufacturersFromARP && manufacturersFromARP.length > 0) {
        manufacturerFromOUI = manufacturersFromARP[0].manufacturer;
        log(`  Detected manufacturer ${manufacturerFromOUI} via OUI lookup from ARP table`);
      }
    }
    
    // Try interfaces if ARP table didn't yield results
    if (!manufacturerFromOUI && walkData.interfaces && Array.isArray(walkData.interfaces)) {
      const manufacturerInfo = ouiLookup.detectManufacturerFromInterfaces(walkData.interfaces);
      if (manufacturerInfo && manufacturerInfo.manufacturer) {
        manufacturerFromOUI = manufacturerInfo.manufacturer;
        log(`  Detected manufacturer ${manufacturerFromOUI} via OUI lookup from interface MAC`);
      }
    }
    
    if (manufacturerFromOUI) {
      deviceInfo.manufacturer_from_oui = manufacturerFromOUI;
      deviceInfo.oui_detection = {
        manufacturer: manufacturerFromOUI,
        detected_at: new Date().toISOString(),
        source: 'arp_table_or_interfaces'
      };
    }
  }
  
  // Add walk data to device info
  deviceInfo.oid_walk = walkData;
  deviceInfo.interfaces = walkData.interfaces;
  deviceInfo.arp_table = walkData.arp_table;
  deviceInfo.routes = walkData.routes;
  deviceInfo.ip_addresses = walkData.ip_addresses;
  
  return deviceInfo;
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
 * Get Mikrotik neighbors via LLDP or CDP
 * Returns: { neighbors: [], cdp_enabled: boolean, lldp_enabled: boolean, cdp_failed: boolean, lldp_failed: boolean }
 */
async function getMikrotikNeighbors(ip, community) {
  const result = {
    neighbors: [],
    cdp_enabled: false,
    lldp_enabled: false,
    cdp_failed: false,
    lldp_failed: false,
    cdp_error: null,
    lldp_error: null
  };
  
  try {
    if (snmp) {
      // Use net-snmp package to walk LLDP table
      return new Promise((resolve) => {
        const session = snmp.createSession(ip, community, {
          port: 161,
          retries: 1,
          timeout: SNMP_TIMEOUT,
          transport: 'udp4'
        });
        
        // Try LLDP first (standard protocol)
        session.subtree(LLDP_OIDS.lldpRemTable, (error, varbinds) => {
          if (error || !varbinds || varbinds.length === 0) {
            result.lldp_failed = true;
            result.lldp_error = error ? error.message : 'No LLDP data';
            session.close();
            // Try CDP as fallback
            getCDPNeighbors(session, ip, community).then(cdpResult => {
              resolve({
                neighbors: cdpResult.neighbors || cdpResult || [],
                ...result,
                ...cdpResult
              });
            });
            return;
          }
          
          result.lldp_enabled = true;
          
          // Parse LLDP neighbors
          const neighborMap = {};
          varbinds.forEach((vb) => {
            const oid = vb.oid.toString();
            const value = vb.value?.toString() || '';
            
            // Extract neighbor index from OID
            // Format: 1.0.8802.1.1.2.1.4.1.1.X.timeMark.timeMarkIndex.lldpRemLocalPortNum.lldpRemIndex
            const match = oid.match(/\.(\d+)\.(\d+)\.(\d+)$/);
            if (match) {
              const [, portNum, index] = match;
              const neighborKey = `${portNum}.${index}`;
              
              if (!neighborMap[neighborKey]) {
                neighborMap[neighborKey] = {
                  local_port: parseInt(portNum),
                  index: parseInt(index),
                  discovered_via: 'lldp'
                };
              }
              
              // Map OID to field
              if (oid.includes('1.0.8802.1.1.2.1.4.1.1.5')) {
                neighborMap[neighborKey].chassis_id = value;
              } else if (oid.includes('1.0.8802.1.1.2.1.4.1.1.9')) {
                neighborMap[neighborKey].system_name = value;
              } else if (oid.includes('1.0.8802.1.1.2.1.4.1.1.10')) {
                neighborMap[neighborKey].system_description = value;
              }
            }
          });
          
          session.close();
          resolve({
            neighbors: Object.values(neighborMap),
            ...result
          });
        });
      });
    } else {
      // Fallback to system snmpwalk
      return await getNeighborsWithSystemSNMP(ip, community);
    }
  } catch (error) {
    log(`WARNING: Failed to discover neighbors for ${ip}: ${error.message}`);
    result.cdp_failed = true;
    result.lldp_failed = true;
    result.cdp_error = error.message;
    result.lldp_error = error.message;
    return result;
  }
}

/**
 * Get CDP neighbors (Cisco Discovery Protocol)
 * Returns: { neighbors: [], cdp_enabled: boolean, cdp_failed: boolean, cdp_error: string }
 */
async function getCDPNeighbors(session, ip, community) {
  const result = {
    neighbors: [],
    cdp_enabled: false,
    cdp_failed: false,
    cdp_error: null
  };
  
  return new Promise((resolve) => {
    if (!session) {
      session = snmp.createSession(ip, community, {
        port: 161,
        retries: 1,
        timeout: SNMP_TIMEOUT,
        transport: 'udp4'
      });
    }
    
    session.subtree(CDP_OIDS.cdpCacheTable, (error, varbinds) => {
      if (session && session !== snmp) {
        session.close();
      }
      
      if (error || !varbinds || varbinds.length === 0) {
        result.cdp_failed = true;
        result.cdp_error = error ? error.message : 'No CDP data';
        resolve(result);
        return;
      }
      
      result.cdp_enabled = true;
      
      // Parse CDP neighbors
      const neighborMap = {};
      varbinds.forEach((vb) => {
        const oid = vb.oid.toString();
        const value = vb.value?.toString() || '';
        
        // Extract CDP index from OID
        const match = oid.match(/\.(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (match) {
          const [, ifIndex, cdpIndex] = match;
          const neighborKey = `${ifIndex}.${cdpIndex}`;
          
          if (!neighborMap[neighborKey]) {
            neighborMap[neighborKey] = {
              local_interface: parseInt(ifIndex),
              index: parseInt(cdpIndex),
              discovered_via: 'cdp'
            };
          }
          
          // Map OID to field
          if (oid.includes('1.3.6.1.4.1.9.9.23.1.2.1.1.6')) {
            neighborMap[neighborKey].device_id = value;
            // Check if Mikrotik from device ID
            if (value && typeof value === 'string' && 
                (value.toLowerCase().includes('mikrotik') || value.toLowerCase().includes('routeros'))) {
              neighborMap[neighborKey].device_type = 'mikrotik';
            }
          } else if (oid.includes('1.3.6.1.4.1.9.9.23.1.2.1.1.7')) {
            neighborMap[neighborKey].remote_port = value;
          } else if (oid.includes('1.3.6.1.4.1.9.9.23.1.2.1.1.8')) {
            neighborMap[neighborKey].platform = value;
            // Check if Mikrotik from platform
            if (value && typeof value === 'string' && 
                (value.toLowerCase().includes('mikrotik') || value.toLowerCase().includes('routeros'))) {
              neighborMap[neighborKey].device_type = 'mikrotik';
            }
          } else if (oid.includes('1.3.6.1.4.1.9.9.23.1.2.1.1.4')) {
            neighborMap[neighborKey].ip_address = value;
          }
        }
      });
      
      resolve({
        neighbors: Object.values(neighborMap),
        ...result
      });
    });
  });
}

/**
 * Get neighbors using system snmpwalk (fallback)
 * Returns: { neighbors: [], cdp_enabled: boolean, lldp_enabled: boolean, cdp_failed: boolean, lldp_failed: boolean }
 */
async function getNeighborsWithSystemSNMP(ip, community) {
  const result = {
    neighbors: [],
    cdp_enabled: false,
    lldp_enabled: false,
    cdp_failed: false,
    lldp_failed: false,
    cdp_error: null,
    lldp_error: null
  };
  
  try {
    // Try LLDP first
    const lldpOutput = await execAsync(`timeout 3 snmpwalk -v2c -c "${community}" "${ip}" ${LLDP_OIDS.lldpRemSysName} 2>/dev/null`).catch((err) => {
      result.lldp_failed = true;
      result.lldp_error = err.message || 'LLDP query failed';
      return { stdout: '' };
    });
    
    if (lldpOutput.stdout && lldpOutput.stdout.trim()) {
      result.lldp_enabled = true;
      // Parse LLDP output
      const lines = lldpOutput.stdout.split('\n');
      lines.forEach((line) => {
        const match = line.match(/\.(\d+)\.(\d+)\.(\d+)\.(\d+)\.(\d+)\.(\d+)\s+=\s+(.+)/);
        if (match) {
          const sysName = match[7]?.replace(/STRING:\s*"?([^"]+)"?/, '$1').trim();
          if (sysName && sysName !== '""') {
            const neighborEntry = {
              system_name: sysName,
              discovered_via: 'lldp',
              source_ip: ip
            };
            
            // Check if device is Mikrotik from system name
            if (sysName.toLowerCase().includes('mikrotik') || 
                sysName.toLowerCase().includes('routeros')) {
              neighborEntry.device_type = 'mikrotik';
            }
            
            result.neighbors.push(neighborEntry);
          }
        }
      });
    }
    
    // Try CDP if LLDP didn't find anything
    if (result.neighbors.length === 0) {
      const cdpOutput = await execAsync(`timeout 3 snmpwalk -v2c -c "${community}" "${ip}" ${CDP_OIDS.cdpCacheDeviceId} 2>/dev/null`).catch((err) => {
        result.cdp_failed = true;
        result.cdp_error = err.message || 'CDP query failed';
        return { stdout: '' };
      });
      
      if (cdpOutput.stdout && cdpOutput.stdout.trim()) {
        result.cdp_enabled = true;
        const lines = cdpOutput.stdout.split('\n');
        lines.forEach((line) => {
          const match = line.match(/\.(\d+)\.(\d+)\.(\d+)\.(\d+)\s+=\s+(.+)/);
          if (match) {
            const deviceId = match[5]?.replace(/STRING:\s*"?([^"]+)"?/, '$1').trim();
            if (deviceId && deviceId !== '""') {
              const neighborEntry = {
                device_id: deviceId,
                discovered_via: 'cdp',
                source_ip: ip
              };
              
              // Check if device is Mikrotik from device ID
              if (deviceId.toLowerCase().includes('mikrotik') || 
                  deviceId.toLowerCase().includes('routeros')) {
                neighborEntry.device_type = 'mikrotik';
              }
              
              result.neighbors.push(neighborEntry);
            }
          }
        });
      } else {
        result.cdp_failed = true;
        result.cdp_error = 'No CDP data found';
      }
    }
  } catch (error) {
    result.cdp_failed = true;
    result.lldp_failed = true;
    result.cdp_error = error.message || 'Unknown error';
    result.lldp_error = error.message || 'Unknown error';
  }
  
  return result;
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
    uptime_ticks: null,
    neighbors: []
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
      
      session.get(oids, async (error, varbinds) => {
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
        
        session.close();
        
        // Discover neighbors for Mikrotik devices
        try {
          const neighborResult = await getMikrotikNeighbors(ip, community);
          mikrotikInfo.neighbors = Array.isArray(neighborResult) ? neighborResult : (neighborResult.neighbors || []);
          mikrotikInfo.cdp_lldp_status = Array.isArray(neighborResult) ? null : {
            cdp_enabled: neighborResult.cdp_enabled || false,
            lldp_enabled: neighborResult.lldp_enabled || false,
            cdp_failed: neighborResult.cdp_failed || false,
            lldp_failed: neighborResult.lldp_failed || false,
            cdp_error: neighborResult.cdp_error || null,
            lldp_error: neighborResult.lldp_error || null
          };
        } catch (err) {
          log(`WARNING: Failed to discover neighbors for ${ip}: ${err.message}`);
          mikrotikInfo.neighbors = [];
          mikrotikInfo.cdp_lldp_status = {
            cdp_enabled: false,
            lldp_enabled: false,
            cdp_failed: true,
            lldp_failed: true,
            cdp_error: err.message,
            lldp_error: err.message
          };
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
 * Calculate broadcast address from IP and netmask
 */
function calculateBroadcast(ip, netmask) {
  const ipParts = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  
  const broadcast = ipParts.map((ipPart, i) => {
    return (ipPart | (~maskParts[i] & 0xFF)) & 0xFF;
  });
  
  return broadcast.join('.');
}

/**
 * Get all active network interfaces with IPv4 addresses and their broadcast addresses
 */
async function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const activeInterfaces = [];
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    
    for (const addr of addrs) {
      // Only IPv4, not loopback, not internal
      if (addr.family === 'IPv4' && !addr.internal) {
        const broadcastAddr = addr.netmask ? calculateBroadcast(addr.address, addr.netmask) : null;
        activeInterfaces.push({
          name: name,
          address: addr.address,
          netmask: addr.netmask,
          broadcast: broadcastAddr,
          mac: addr.mac
        });
        break; // Only need one IPv4 address per interface
      }
    }
  }
  
  return activeInterfaces;
}

/**
 * Discover Mikrotik devices via MNDP (Mikrotik Neighbor Discovery Protocol)
 * MNDP is a Layer 2 broadcast protocol that Mikrotik devices use to announce themselves
 * Listens for UDP broadcasts on port 5678 on all network interfaces
 */
async function discoverMNDP(listenDuration = 5000) {
  log(`Phase 0: MNDP discovery - listening for Mikrotik neighbor broadcasts (${listenDuration/1000}s)...`);
  const startTime = Date.now();
  const discoveredDevices = new Map(); // Use MAC or IP as key to avoid duplicates
  
  // Get all network interfaces
  const interfaces = await getNetworkInterfaces();
  log(`  MNDP: Found ${interfaces.length} active network interface(s): ${interfaces.map(i => `${i.name} (${i.address})`).join(', ')}`);
  
  // If no interfaces found, still try binding to 0.0.0.0 as fallback
  if (interfaces.length === 0) {
    log(`  MNDP: No active interfaces found, will bind to 0.0.0.0 as fallback`);
  }
  
  return new Promise((resolve) => {
    const sockets = [];
    let boundSockets = 0;
    let timerStarted = false;
    
    // Shared message handler for parsing MNDP packets
    const handleMessage = (msg, rinfo, interfaceName = 'unknown') => {
      try {
        // MNDP packet format (based on Mikrotik RouterOS MNDP protocol):
        // MNDP uses UDP port 5678 for broadcasts
        // Packet structure: Header (variable) + TLV (Type-Length-Value) fields
        // Common fields: Identity, Version, Platform, Board name, MAC address, Interface, Uptime
        
        if (msg.length < 8) {
          return; // Too short to be valid MNDP packet
        }
        
        // MNDP packets may have different header formats depending on RouterOS version
        // Try multiple parsing strategies
        if (msg.length >= 8) {
          const deviceInfo = {
            ip_address: rinfo.address,
            mac_address: null,
            identity: null,
            version: null,
            board_name: null,
            platform: null,
            uptime: null,
            interface: null,
            discovered_via: 'mndp',
            source_ip: rinfo.address,
            source_port: rinfo.port
          };
          
          // Parse TLV fields (Type-Length-Value format)
          // Common TLV types in MNDP:
          // 0x01: Identity
          // 0x02: Version
          // 0x03: Platform
          // 0x04: Board name
          // 0x05: MAC address
          // 0x06: Interface
          // 0x07: Uptime
          
          let pos = 8; // Skip header
          while (pos < msg.length - 2) {
            if (pos + 2 > msg.length) break;
            
            const tlvType = msg[pos];
            const tlvLength = msg.readUInt16BE(pos + 1);
            pos += 3;
            
            if (pos + tlvLength > msg.length) break;
            
            const tlvValue = msg.slice(pos, pos + tlvLength);
            pos += tlvLength;
            
            switch (tlvType) {
              case 0x01: // Identity
                deviceInfo.identity = tlvValue.toString('utf8').replace(/\0/g, '').trim();
                break;
              case 0x02: // Version
                deviceInfo.version = tlvValue.toString('utf8').replace(/\0/g, '').trim();
                break;
              case 0x03: // Platform
                deviceInfo.platform = tlvValue.toString('utf8').replace(/\0/g, '').trim();
                break;
              case 0x04: // Board name
                deviceInfo.board_name = tlvValue.toString('utf8').replace(/\0/g, '').trim();
                break;
              case 0x05: // MAC address
                if (tlvLength >= 6) {
                  deviceInfo.mac_address = Array.from(tlvValue.slice(0, 6))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join(':').toUpperCase();
                }
                break;
              case 0x06: // Interface
                deviceInfo.interface = tlvValue.toString('utf8').replace(/\0/g, '').trim();
                break;
              case 0x07: // Uptime
                if (tlvLength >= 4) {
                  deviceInfo.uptime = tlvValue.readUInt32BE(0);
                }
                break;
            }
          }
          
          // Also try alternative parsing: sometimes MNDP packets have a simpler format
          // Try to extract strings directly from the packet
          if (!deviceInfo.identity && msg.length > 20) {
            const packetStr = msg.toString('utf8', 8);
            const identityMatch = packetStr.match(/([^\x00]{1,64})/);
            if (identityMatch) {
              deviceInfo.identity = identityMatch[1].trim();
            }
          }
          
          // Only add if we got some useful information
          if (deviceInfo.ip_address || deviceInfo.identity || deviceInfo.mac_address) {
            // Use MAC as primary key (most reliable), fallback to IP
            const key = deviceInfo.mac_address || deviceInfo.ip_address || `mndp-${rinfo.address}`;
            discoveredDevices.set(key, deviceInfo);
            
            log(`  MNDP: Discovered Mikrotik device ${deviceInfo.ip_address || 'unknown'} (${deviceInfo.identity || 'unknown identity'}) via interface ${interfaceName}`);
          }
        }
      } catch (parseError) {
        // Ignore parsing errors, continue listening
      }
    };
    
    // Function to close all sockets and resolve
    const closeAllAndResolve = () => {
      sockets.forEach(socket => {
        try {
          socket.close();
        } catch (e) {
          // Ignore errors closing sockets
        }
      });
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const neighbors = Array.from(discoveredDevices.values());
      const discoveredIPs = neighbors.map(d => d.ip_address).filter(Boolean);
      
      log(`MNDP discovery complete: Found ${discoveredDevices.size} Mikrotik device(s) in ${elapsed}s`);
      resolve({ discoveredIPs, neighbors });
    };
    
    // Create main socket bound to 0.0.0.0 (should receive broadcasts from all interfaces)
    // Also try binding to each interface individually for better Layer 2 reception
    
    // Function to start the listening timer
    function startTimerIfReady() {
      if (!timerStarted && boundSockets > 0) {
        timerStarted = true;
        log(`  MNDP: ${boundSockets} socket(s) bound, listening for ${listenDuration/1000}s...`);
        
        setTimeout(() => {
          closeAllAndResolve();
        }, listenDuration);
      }
    }
    
    // First, bind to 0.0.0.0 (should receive broadcasts from all interfaces)
    try {
      const mainSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      sockets.push(mainSocket);
      
      mainSocket.on('error', (error) => {
        if (error.code !== 'EADDRINUSE') {
          log(`WARNING: Main MNDP socket error: ${error.message}`);
        }
      });
      
      mainSocket.on('message', (msg, rinfo) => {
        handleMessage(msg, rinfo, 'all-interfaces');
      });
      
      mainSocket.bind(5678, '0.0.0.0', () => {
        boundSockets++;
        log(`  MNDP: Main socket bound to 0.0.0.0:5678 (receives broadcasts from all interfaces)...`);
        
        try {
          mainSocket.setBroadcast(true);
          mainSocket.setRecvBufferSize(65536); // Larger buffer for multiple broadcasts
          // Try to enable SO_REUSEPORT if available (Linux only, allows multiple binds)
          if (process.platform === 'linux') {
            mainSocket.setRecvBufferSize(65536);
          }
        } catch (e) {}
        
        startTimerIfReady();
      });
    } catch (createError) {
      log(`WARNING: Failed to create main MNDP socket: ${createError.message}`);
    }
    
    // Also try to bind to each interface individually for better Layer 2 reception
    // This is important because MNDP broadcasts are Layer 2 and may not reach 0.0.0.0 socket
    for (const iface of interfaces) {
      if (!iface.address || iface.address === '0.0.0.0') continue;
      
      try {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        sockets.push(socket);
        
        socket.on('error', (error) => {
          // EADDRINUSE is expected when binding same port - ignore it
          if (error.code !== 'EADDRINUSE') {
            // Other errors logged at debug level only
          }
        });
        
        socket.on('message', (msg, rinfo) => {
          handleMessage(msg, rinfo, iface.name);
        });
        
        // Try to bind to this interface's IP address
        // Note: On Linux, we may need SO_REUSEPORT to bind same port multiple times
        socket.bind(5678, iface.address, () => {
          boundSockets++;
          log(`  MNDP: Additional socket bound on ${iface.name} (${iface.address}:5678)...`);
          startTimerIfReady();
        });
        
      } catch (createError) {
        // Binding to specific interface may fail - that's ok, main socket should work
      }
    }
    
    // Fallback: if no sockets bound after 1 second, resolve with empty results
    setTimeout(() => {
      if (!timerStarted) {
        if (boundSockets > 0) {
          startTimerIfReady();
        } else {
          log(`WARNING: No MNDP sockets bound successfully, resolving with empty results`);
          closeAllAndResolve();
        }
      }
    }, 1000);
    
    // If no sockets were created at all, resolve immediately
    if (sockets.length === 0) {
      log(`ERROR: No MNDP sockets could be created`);
      resolve({ discoveredIPs: [], neighbors: [] });
    }
  });
}

/**
 * Phase 1: Discover devices via CDP/LLDP neighbor tables
 * Queries CDP/LLDP neighbor tables from common gateway/router IPs first
 * This discovers devices even if they don't respond to ping or SNMP
 */
async function discoverCDPLLDP(subnet) {
  log(`Phase 1: CDP/LLDP discovery - querying neighbor tables...`);
  const startTime = Date.now();
  const discoveredIPs = new Set();
  const discoveredNeighbors = [];
  
  try {
    // Extract base network from subnet (e.g., "192.168.1.0/24" -> "192.168.1")
    const [baseIP] = subnet.split('/');
    const baseParts = baseIP.split('.').slice(0, 3).join('.');
    
    // Common router/gateway IPs to try first for CDP/LLDP queries
    const commonGateways = [
      `${baseParts}.1`,   // Common gateway
      `${baseParts}.254`, // Alternative gateway
      `${baseParts}.253`  // Another common gateway
    ];
    
    // Also try to get actual gateway from routing table
    try {
      const { stdout: gatewayOutput } = await execAsync("ip route | grep default | awk '{print $3}' | head -1").catch(() => ({ stdout: '' }));
      const gateway = gatewayOutput.trim();
      if (gateway && !commonGateways.includes(gateway)) {
        commonGateways.unshift(gateway);
      }
    } catch (e) {
      // Ignore
    }
    
    log(`  Querying CDP/LLDP neighbor tables from ${commonGateways.length} potential gateway/router IP(s)...`);
    
    // Try to query CDP/LLDP neighbor tables from common gateway IPs
    // This works even if the gateway doesn't have full SNMP access
    for (const gatewayIP of commonGateways) {
      try {
        for (const community of SNMP_COMMUNITIES) {
          try {
            // Try LLDP first
            const neighbors = await getNeighborsWithSystemSNMP(gatewayIP, community);
            if (neighbors && neighbors.length > 0) {
              log(`  Found ${neighbors.length} neighbor(s) via LLDP from ${gatewayIP}`);
              neighbors.forEach(neighbor => {
                discoveredNeighbors.push({ ...neighbor, source_ip: gatewayIP });
                if (neighbor.ip_address) {
                  discoveredIPs.add(neighbor.ip_address);
                }
              });
              break; // Found neighbors, move to next gateway
            }
          } catch (e) {
            // Continue to next community
          }
        }
      } catch (e) {
        // Continue to next gateway
      }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`CDP/LLDP discovery complete: Found ${discoveredIPs.size} device(s) via neighbor tables in ${elapsed}s`);
    
  } catch (error) {
    log(`WARNING: CDP/LLDP discovery failed: ${error.message}`);
  }
  
  return { discoveredIPs: Array.from(discoveredIPs), neighbors: discoveredNeighbors };
}

/**
 * Query CDP/LLDP neighbor tables from all responding IPs (even without full SNMP)
 */
async function queryCDPLLDPNeighbors(ips, communities = SNMP_COMMUNITIES) {
  log(`  Querying CDP/LLDP neighbor tables from ${ips.length} host(s)...`);
  const neighbors = [];
  
  const neighborPromises = [];
  for (const ip of ips) {
    const neighborPromise = (async () => {
      try {
        // Try to query LLDP/CDP neighbor tables directly, even if device doesn't support full SNMP
        for (const community of communities) {
          try {
            // Try LLDP first
            const lldpNeighbors = await getNeighborsWithSystemSNMP(ip, community);
            if (lldpNeighbors && lldpNeighbors.length > 0) {
              neighbors.push(...lldpNeighbors.map(n => ({ ...n, source_ip: ip })));
              log(`  Found ${lldpNeighbors.length} LLDP neighbor(s) from ${ip}`);
              return;
            }
          } catch (e) {
            // Continue to next method
          }
        }
      } catch (error) {
        // Ignore errors - device might not support neighbor discovery
      }
    })();
    
    neighborPromises.push(neighborPromise);
    
    // Limit concurrency
    if (neighborPromises.length >= MAX_PARALLEL_SNMP) {
      await Promise.all(neighborPromises);
      neighborPromises.length = 0;
    }
  }
  
  if (neighborPromises.length > 0) {
    await Promise.all(neighborPromises);
  }
  
  return neighbors;
}

/**
 * Scan network for devices (three-phase: CDP/LLDP first, then ping, then SNMP)
 */
async function scanNetwork(subnet, communities = SNMP_COMMUNITIES) {
  log(`Starting four-phase network discovery on subnet: ${subnet}`);
  const startTime = Date.now();
  
  const allDiscoveredIPs = new Set();
  const allDiscoveredNeighbors = [];
  
  // Phase 0: MNDP discovery (Mikrotik-specific, passive listening)
  // Start MNDP discovery in parallel - it listens for broadcasts on all interfaces
  const mndpDiscoveryPromise = discoverMNDP(10000); // Listen for 10 seconds to catch all broadcasts
  
  // Phase 1: CDP/LLDP discovery - query neighbor tables from gateways/routers
  const { discoveredIPs: cdpLldpIPs, neighbors: cdpLldpNeighbors } = await discoverCDPLLDP(subnet);
  cdpLldpIPs.forEach(ip => allDiscoveredIPs.add(ip));
  allDiscoveredNeighbors.push(...cdpLldpNeighbors);
  
  // Wait for MNDP discovery to complete (it runs in parallel)
  const { discoveredIPs: mndpIPs, neighbors: mndpNeighbors } = await mndpDiscoveryPromise;
  mndpIPs.forEach(ip => allDiscoveredIPs.add(ip));
  allDiscoveredNeighbors.push(...mndpNeighbors);
  
  log(`  MNDP discovery added ${mndpIPs.length} Mikrotik device(s) to discovery list`);
  
  // Phase 2: Ping sweep
  log(`Phase 2: Ping sweep - finding responding hosts on subnet: ${subnet}`);
  const respondingIPs = await pingSweep(subnet);
  
  // Add ping-responding IPs to discovered set
  respondingIPs.forEach(ip => allDiscoveredIPs.add(ip));
  
  // Query CDP/LLDP neighbor tables from ping-responding hosts
  // This discovers additional devices even if they don't respond to ping
  if (respondingIPs.length > 0) {
    log(`  Querying CDP/LLDP neighbor tables from ${respondingIPs.length} ping-responding host(s)...`);
    for (const ip of respondingIPs) {
      try {
        for (const community of communities) {
          try {
            const neighborResult = await getNeighborsWithSystemSNMP(ip, community);
            const neighbors = Array.isArray(neighborResult) ? neighborResult : (neighborResult.neighbors || []);
            if (neighbors && neighbors.length > 0) {
              neighbors.forEach(neighbor => {
                allDiscoveredNeighbors.push({ ...neighbor, source_ip: ip });
                if (neighbor.ip_address) {
                  allDiscoveredIPs.add(neighbor.ip_address);
                }
              });
              break; // Found neighbors from this IP
            }
          } catch (e) {
            // Continue to next community
          }
        }
      } catch (e) {
        // Continue to next IP
      }
    }
  }
  
  log(`Phase 3: SNMP discovery - checking ${allDiscoveredIPs.size} discovered host(s) for SNMP...`);
  
  const devices = [];
  const pingOnlyDevices = [];
  const discoveredIPs = Array.from(allDiscoveredIPs);
  
  // Phase 3: SNMP scan on all discovered hosts
  const snmpPromises = [];
  let processed = 0;
  
  for (const ip of discoveredIPs) {
    const snmpPromise = (async () => {
      try {
        // Try each community string
        let foundSNMP = false;
        for (const community of communities) {
          try {
            const deviceInfo = await getDeviceInfo(ip, community);
            foundSNMP = true;
            
            // Get Mikrotik-specific info if it's a Mikrotik device
            if (deviceInfo.device_type === 'mikrotik') {
              log(`  Detected Mikrotik device at ${ip}, gathering additional information...`);
              const mikrotikInfo = await getMikrotikInfo(ip, community);
              deviceInfo.mikrotik = mikrotikInfo;
              
              // Neighbors are already included in mikrotikInfo.neighbors from getMikrotikInfo
              if (mikrotikInfo.neighbors && mikrotikInfo.neighbors.length > 0) {
                deviceInfo.neighbors = mikrotikInfo.neighbors;
                log(`  Found ${mikrotikInfo.neighbors.length} neighbor(s) for ${ip}`);
              }
              
              // Copy CDP/LLDP status from mikrotikInfo if available
              if (mikrotikInfo.cdp_lldp_status) {
                deviceInfo.cdp_lldp_status = mikrotikInfo.cdp_lldp_status;
              }
            } else {
              // Query CDP/LLDP neighbors for non-Mikrotik devices too
              try {
                const neighborResult = await getNeighborsWithSystemSNMP(ip, community);
                const neighbors = Array.isArray(neighborResult) ? neighborResult : (neighborResult.neighbors || []);
                if (neighbors && neighbors.length > 0) {
                  deviceInfo.neighbors = neighbors;
                  deviceInfo.cdp_lldp_status = Array.isArray(neighborResult) ? null : {
                    cdp_enabled: neighborResult.cdp_enabled || false,
                    lldp_enabled: neighborResult.lldp_enabled || false,
                    cdp_failed: neighborResult.cdp_failed || false,
                    lldp_failed: neighborResult.lldp_failed || false,
                    cdp_error: neighborResult.cdp_error || null,
                    lldp_error: neighborResult.lldp_error || null
                  };
                  log(`  Found ${neighbors.length} neighbor(s) for ${ip}`);
                }
              } catch (e) {
                // No neighbors found
                deviceInfo.cdp_lldp_status = {
                  cdp_enabled: false,
                  lldp_enabled: false,
                  cdp_failed: true,
                  lldp_failed: true,
                  cdp_error: e.message || 'Unknown error',
                  lldp_error: e.message || 'Unknown error'
                };
              }
            }
            
            devices.push(deviceInfo);
            log(`Found SNMP device: ${ip} (${deviceInfo.device_type}, community: ${community})`);
            return;
          } catch (error) {
            // Try next community
            continue;
          }
        }
        
        // No SNMP found, but host was discovered (via ping or CDP/LLDP)
        if (!foundSNMP) {
          // Still try to query neighbors even without SNMP access
          try {
            for (const community of communities) {
              try {
                const neighborResult = await getNeighborsWithSystemSNMP(ip, community);
                const neighbors = Array.isArray(neighborResult) ? neighborResult : (neighborResult.neighbors || []);
                if (neighbors && neighbors.length > 0) {
                  // Create device entry with neighbor info
                  const device = createPingOnlyDevice(ip);
                  device.neighbors = neighbors;
                  device.cdp_lldp_status = Array.isArray(neighborResult) ? null : {
                    cdp_enabled: neighborResult.cdp_enabled || false,
                    lldp_enabled: neighborResult.lldp_enabled || false,
                    cdp_failed: neighborResult.cdp_failed || false,
                    lldp_failed: neighborResult.lldp_failed || false,
                    cdp_error: neighborResult.cdp_error || null,
                    lldp_error: neighborResult.lldp_error || null
                  };
                  pingOnlyDevices.push(device);
                  log(`  Found ${neighbors.length} neighbor(s) for ${ip} (no SNMP access)`);
                  return;
                }
              } catch (e) {
                continue;
              }
            }
          } catch (e) {
            // Ignore
          }
          
          pingOnlyDevices.push(createPingOnlyDevice(ip));
        }
      } catch (error) {
        // Host doesn't have SNMP
        pingOnlyDevices.push(createPingOnlyDevice(ip));
      } finally {
        processed++;
        if (processed % 10 === 0 || processed === discoveredIPs.length) {
          log(`  SNMP progress: ${processed}/${discoveredIPs.length} hosts (${devices.length} SNMP device(s) found)...`);
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
    // Load SNMP config first
    await loadSNMPConfig();
    
    log(`Test mode: Scanning single IP ${args[0]}`);
    const deviceInfo = await getDeviceInfo(args[0], SNMP_CONFIG.communities[0] || SNMP_COMMUNITIES[0]).catch(() => null);
    if (deviceInfo) {
      console.log(JSON.stringify(deviceInfo, null, 2));
    } else {
      log(`No SNMP device found at ${args[0]}`);
    }
    return;
  }
  
  // Load SNMP configuration from EPC config
  await loadSNMPConfig();
  
  // Get subnets to scan (from config or command line arg or auto-detect)
  let subnetsToScan = [];
  
  if (args[0] && !/^\d+\.\d+\.\d+\.\d+$/.test(args[0])) {
    // Command line argument provided (subnet, not single IP)
    subnetsToScan = [args[0]];
  } else if (SNMP_CONFIG.targets && SNMP_CONFIG.targets.length > 0) {
    // Use configured subnets
    subnetsToScan = SNMP_CONFIG.targets;
  } else {
    // Auto-detect subnet
    const autoSubnet = await getNetworkInfo();
    subnetsToScan = [autoSubnet];
  }
  
  log(`Starting SNMP discovery on ${subnetsToScan.length} subnet(s): ${subnetsToScan.join(', ')}`);
  log(`Using SNMP communities: ${SNMP_CONFIG.communities.join(', ')}`);
  
  try {
    // Scan all configured subnets
    const allDiscoveredDevices = [];
    
    for (const subnet of subnetsToScan) {
      log(`Scanning subnet: ${subnet}`);
      const discoveredDevices = await scanNetwork(subnet, SNMP_CONFIG.communities);
      allDiscoveredDevices.push(...discoveredDevices);
    }
    
    const discoveredDevices = allDiscoveredDevices;
    
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

