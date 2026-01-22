/**
 * Mikrotik RouterOS SNMP OID Definitions
 * Comprehensive list of Mikrotik-specific SNMP OIDs for monitoring
 */

module.exports = {
  // System Information
  system: {
    identity: '1.3.6.1.4.1.14988.1.1.1.1.1.3.0', // System identity/name
    version: '1.3.6.1.4.1.14988.1.1.1.1.1.4.0',  // RouterOS version
    serialNumber: '1.3.6.1.4.1.14988.1.1.1.1.1.7.0', // Serial number
    firmwareVersion: '1.3.6.1.4.1.14988.1.1.1.1.1.5.0', // Firmware version
    licenseLevel: '1.3.6.1.4.1.14988.1.1.1.1.1.6.0', // License level
    architecture: '1.3.6.1.4.1.14988.1.1.1.1.1.8.0', // CPU architecture
    boardName: '1.3.6.1.4.1.14988.1.1.1.1.1.9.0'  // Board name
  },

  // System Resources
  resources: {
    uptime: '1.3.6.1.2.1.1.3.0',                    // System uptime (standard)
    cpuLoad: '1.3.6.1.4.1.14988.1.1.1.3.1.0',      // CPU load percentage
    totalMemory: '1.3.6.1.4.1.14988.1.1.1.2.1.0',  // Total memory
    freeMemory: '1.3.6.1.4.1.14988.1.1.1.2.2.0',   // Free memory
    totalHDD: '1.3.6.1.4.1.14988.1.1.1.2.3.0',     // Total HDD space
    freeHDD: '1.3.6.1.4.1.14988.1.1.1.2.4.0',      // Free HDD space
    voltage: '1.3.6.1.4.1.14988.1.1.1.8.1.0',      // System voltage
    temperature: '1.3.6.1.4.1.14988.1.1.1.8.2.0'   // CPU temperature
  },

  // Interface Statistics (Tables)
  interfaces: {
    table: '1.3.6.1.2.1.2.2.1',                     // Interface table base
    ifIndex: '1.3.6.1.2.1.2.2.1.1',                 // Interface index
    ifDescr: '1.3.6.1.2.1.2.2.1.2',                 // Interface description
    ifType: '1.3.6.1.2.1.2.2.1.3',                  // Interface type
    ifMtu: '1.3.6.1.2.1.2.2.1.4',                   // Interface MTU
    ifSpeed: '1.3.6.1.2.1.2.2.1.5',                 // Interface speed
    ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',           // Physical address (MAC)
    ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',           // Admin status
    ifOperStatus: '1.3.6.1.2.1.2.2.1.8',            // Operational status
    ifInOctets: '1.3.6.1.2.1.2.2.1.10',             // Input octets
    ifInUcastPkts: '1.3.6.1.2.1.2.2.1.11',          // Input unicast packets
    ifInErrors: '1.3.6.1.2.1.2.2.1.14',             // Input errors
    ifOutOctets: '1.3.6.1.2.1.2.2.1.16',            // Output octets
    ifOutUcastPkts: '1.3.6.1.2.1.2.2.1.17',         // Output unicast packets
    ifOutErrors: '1.3.6.1.2.1.2.2.1.20'             // Output errors
  },

  // Wireless Interface Statistics
  wireless: {
    // Wireless Registration Table
    registrationTable: '1.3.6.1.4.1.14988.1.1.1.2.1.1',
    regMacAddress: '1.3.6.1.4.1.14988.1.1.1.2.1.1.1.1',    // Client MAC address
    regInterface: '1.3.6.1.4.1.14988.1.1.1.2.1.1.1.2',     // Interface name
    regSignalStrength: '1.3.6.1.4.1.14988.1.1.1.2.1.1.1.3', // Signal strength
    regTxBytes: '1.3.6.1.4.1.14988.1.1.1.2.1.1.1.4',       // TX bytes
    regRxBytes: '1.3.6.1.4.1.14988.1.1.1.2.1.1.1.5',       // RX bytes
    regUptime: '1.3.6.1.4.1.14988.1.1.1.2.1.1.1.6',        // Connection uptime
    regTxRate: '1.3.6.1.4.1.14988.1.1.1.2.1.1.1.7',        // TX rate
    regRxRate: '1.3.6.1.4.1.14988.1.1.1.2.1.1.1.8',        // RX rate

    // Wireless Interface Table
    interfaceTable: '1.3.6.1.4.1.14988.1.1.1.1.1',
    wlanName: '1.3.6.1.4.1.14988.1.1.1.1.1.1.1',           // Interface name
    wlanMTU: '1.3.6.1.4.1.14988.1.1.1.1.1.1.2',            // MTU
    wlanMacAddress: '1.3.6.1.4.1.14988.1.1.1.1.1.1.3',     // MAC address
    wlanClientCount: '1.3.6.1.4.1.14988.1.1.1.1.1.1.4',    // Connected clients
    wlanAuthClientCount: '1.3.6.1.4.1.14988.1.1.1.1.1.1.5', // Authenticated clients
    wlanTxBytes: '1.3.6.1.4.1.14988.1.1.1.1.1.1.6',        // TX bytes
    wlanRxBytes: '1.3.6.1.4.1.14988.1.1.1.1.1.1.7',        // RX bytes
    wlanTxPackets: '1.3.6.1.4.1.14988.1.1.1.1.1.1.8',      // TX packets
    wlanRxPackets: '1.3.6.1.4.1.14988.1.1.1.1.1.1.9',      // RX packets
    wlanTxErrors: '1.3.6.1.4.1.14988.1.1.1.1.1.1.10',      // TX errors
    wlanRxErrors: '1.3.6.1.4.1.14988.1.1.1.1.1.1.11',      // RX errors
    wlanTxDrops: '1.3.6.1.4.1.14988.1.1.1.1.1.1.12',       // TX drops
    wlanRxDrops: '1.3.6.1.4.1.14988.1.1.1.1.1.1.13'        // RX drops
  },

  // PPP (Point-to-Point) Connections
  ppp: {
    activeTable: '1.3.6.1.4.1.14988.1.1.1.4.1',
    pppName: '1.3.6.1.4.1.14988.1.1.1.4.1.1.1',            // Connection name
    pppUser: '1.3.6.1.4.1.14988.1.1.1.4.1.1.2',            // Username
    pppAddress: '1.3.6.1.4.1.14988.1.1.1.4.1.1.3',         // IP address
    pppUptime: '1.3.6.1.4.1.14988.1.1.1.4.1.1.4',          // Connection uptime
    pppTxBytes: '1.3.6.1.4.1.14988.1.1.1.4.1.1.5',         // TX bytes
    pppRxBytes: '1.3.6.1.4.1.14988.1.1.1.4.1.1.6',         // RX bytes
    pppTxPackets: '1.3.6.1.4.1.14988.1.1.1.4.1.1.7',       // TX packets
    pppRxPackets: '1.3.6.1.4.1.14988.1.1.1.4.1.1.8'        // RX packets
  },

  // DHCP Server Statistics
  dhcp: {
    leaseTable: '1.3.6.1.4.1.14988.1.1.1.5.1',
    leaseAddress: '1.3.6.1.4.1.14988.1.1.1.5.1.1.1',       // IP address
    leaseMacAddress: '1.3.6.1.4.1.14988.1.1.1.5.1.1.2',    // MAC address
    leaseServer: '1.3.6.1.4.1.14988.1.1.1.5.1.1.3',        // DHCP server
    leaseStatus: '1.3.6.1.4.1.14988.1.1.1.5.1.1.4',        // Lease status
    leaseExpireTime: '1.3.6.1.4.1.14988.1.1.1.5.1.1.5',    // Expire time
    leaseHostName: '1.3.6.1.4.1.14988.1.1.1.5.1.1.6'       // Hostname
  },

  // Queue Statistics (Traffic Shaping)
  queues: {
    simpleTable: '1.3.6.1.4.1.14988.1.1.1.6.1',
    queueName: '1.3.6.1.4.1.14988.1.1.1.6.1.1.1',          // Queue name
    queueSrcAddress: '1.3.6.1.4.1.14988.1.1.1.6.1.1.2',    // Source address
    queueDstAddress: '1.3.6.1.4.1.14988.1.1.1.6.1.1.3',    // Destination address
    queueInterface: '1.3.6.1.4.1.14988.1.1.1.6.1.1.4',     // Interface
    queueBytesIn: '1.3.6.1.4.1.14988.1.1.1.6.1.1.5',       // Bytes in
    queueBytesOut: '1.3.6.1.4.1.14988.1.1.1.6.1.1.6',      // Bytes out
    queuePacketsIn: '1.3.6.1.4.1.14988.1.1.1.6.1.1.7',     // Packets in
    queuePacketsOut: '1.3.6.1.4.1.14988.1.1.1.6.1.1.8',    // Packets out
    queuePCQQueuesIn: '1.3.6.1.4.1.14988.1.1.1.6.1.1.9',   // PCQ queues in
    queuePCQQueuesOut: '1.3.6.1.4.1.14988.1.1.1.6.1.1.10', // PCQ queues out
    queueDroppedIn: '1.3.6.1.4.1.14988.1.1.1.6.1.1.11',    // Dropped packets in
    queueDroppedOut: '1.3.6.1.4.1.14988.1.1.1.6.1.1.12'    // Dropped packets out
  },

  // Firewall Statistics
  firewall: {
    connectionTable: '1.3.6.1.4.1.14988.1.1.1.7.1',
    connSrcAddress: '1.3.6.1.4.1.14988.1.1.1.7.1.1.1',     // Source address
    connDstAddress: '1.3.6.1.4.1.14988.1.1.1.7.1.1.2',     // Destination address
    connSrcPort: '1.3.6.1.4.1.14988.1.1.1.7.1.1.3',        // Source port
    connDstPort: '1.3.6.1.4.1.14988.1.1.1.7.1.1.4',        // Destination port
    connProtocol: '1.3.6.1.4.1.14988.1.1.1.7.1.1.5',       // Protocol
    connTimeout: '1.3.6.1.4.1.14988.1.1.1.7.1.1.6',        // Connection timeout
    connTxBytes: '1.3.6.1.4.1.14988.1.1.1.7.1.1.7',        // TX bytes
    connRxBytes: '1.3.6.1.4.1.14988.1.1.1.7.1.1.8'         // RX bytes
  },

  // Health Monitoring
  health: {
    temperature: '1.3.6.1.4.1.14988.1.1.3.10.0',           // System temperature
    voltage: '1.3.6.1.4.1.14988.1.1.3.8.0',                // System voltage
    current: '1.3.6.1.4.1.14988.1.1.3.9.0',                // System current
    powerConsumption: '1.3.6.1.4.1.14988.1.1.3.11.0',      // Power consumption
    fanSpeed1: '1.3.6.1.4.1.14988.1.1.3.17.0',             // Fan 1 speed
    fanSpeed2: '1.3.6.1.4.1.14988.1.1.3.18.0'              // Fan 2 speed
  },

  // GPS Information (for devices with GPS)
  gps: {
    latitude: '1.3.6.1.4.1.14988.1.1.1.9.1.0',             // GPS latitude
    longitude: '1.3.6.1.4.1.14988.1.1.1.9.2.0',            // GPS longitude
    altitude: '1.3.6.1.4.1.14988.1.1.1.9.3.0',             // GPS altitude
    speed: '1.3.6.1.4.1.14988.1.1.1.9.4.0',                // GPS speed
    datetime: '1.3.6.1.4.1.14988.1.1.1.9.5.0',             // GPS date/time
    satellites: '1.3.6.1.4.1.14988.1.1.1.9.6.0'            // GPS satellites
  },

  // LTE Interface (for LTE devices)
  lte: {
    signalStrength: '1.3.6.1.4.1.14988.1.1.16.1.1.2.1',    // LTE signal strength
    accessTechnology: '1.3.6.1.4.1.14988.1.1.16.1.1.3.1',  // Access technology
    currentOperator: '1.3.6.1.4.1.14988.1.1.16.1.1.4.1',   // Current operator
    currentCellID: '1.3.6.1.4.1.14988.1.1.16.1.1.5.1',     // Current cell ID
    lac: '1.3.6.1.4.1.14988.1.1.16.1.1.6.1',               // Location area code
    sessionUptime: '1.3.6.1.4.1.14988.1.1.16.1.1.7.1',     // Session uptime
    imei: '1.3.6.1.4.1.14988.1.1.16.1.1.8.1',              // IMEI
    imsi: '1.3.6.1.4.1.14988.1.1.16.1.1.9.1',              // IMSI
    uicc: '1.3.6.1.4.1.14988.1.1.16.1.1.10.1'              // UICC
  },

  // Netwatch (Network monitoring)
  netwatch: {
    table: '1.3.6.1.4.1.14988.1.1.1.10.1',
    netwatchHost: '1.3.6.1.4.1.14988.1.1.1.10.1.1.1',      // Monitored host
    netwatchTimeout: '1.3.6.1.4.1.14988.1.1.1.10.1.1.2',   // Timeout
    netwatchStatus: '1.3.6.1.4.1.14988.1.1.1.10.1.1.3',    // Status (up/down)
    netwatchSince: '1.3.6.1.4.1.14988.1.1.1.10.1.1.4'      // Status since
  }
};

/**
 * Get default OID set for Mikrotik monitoring
 */
function getDefaultMikrotikOIDs() {
  const oids = module.exports;
  
  return [
    // System information
    { oid: oids.system.identity, name: 'identity', type: 'string', description: 'Device identity' },
    { oid: oids.system.version, name: 'version', type: 'string', description: 'RouterOS version' },
    { oid: oids.system.serialNumber, name: 'serialNumber', type: 'string', description: 'Serial number' },
    
    // System resources
    { oid: oids.resources.uptime, name: 'uptime', type: 'timeticks', description: 'System uptime' },
    { oid: oids.resources.cpuLoad, name: 'cpuLoad', type: 'integer', description: 'CPU load percentage' },
    { oid: oids.resources.totalMemory, name: 'totalMemory', type: 'integer', description: 'Total memory' },
    { oid: oids.resources.freeMemory, name: 'freeMemory', type: 'integer', description: 'Free memory' },
    { oid: oids.resources.temperature, name: 'temperature', type: 'integer', description: 'CPU temperature' },
    { oid: oids.resources.voltage, name: 'voltage', type: 'string', description: 'System voltage' },
    
    // Health monitoring
    { oid: oids.health.powerConsumption, name: 'powerConsumption', type: 'integer', description: 'Power consumption' },
    
    // Interface statistics (tables - will need special handling)
    { oid: oids.interfaces.ifOperStatus, name: 'interfaceStatus', type: 'integer', table: true, description: 'Interface operational status' },
    { oid: oids.interfaces.ifInOctets, name: 'interfaceInOctets', type: 'counter', table: true, description: 'Interface input octets' },
    { oid: oids.interfaces.ifOutOctets, name: 'interfaceOutOctets', type: 'counter', table: true, description: 'Interface output octets' }
  ];
}

/**
 * Get wireless-specific OIDs for AP/CPE devices
 */
function getWirelessOIDs() {
  const oids = module.exports;
  
  return [
    { oid: oids.wireless.wlanClientCount, name: 'wlanClientCount', type: 'integer', table: true, description: 'Connected wireless clients' },
    { oid: oids.wireless.wlanTxBytes, name: 'wlanTxBytes', type: 'counter', table: true, description: 'Wireless TX bytes' },
    { oid: oids.wireless.wlanRxBytes, name: 'wlanRxBytes', type: 'counter', table: true, description: 'Wireless RX bytes' },
    { oid: oids.wireless.wlanTxErrors, name: 'wlanTxErrors', type: 'counter', table: true, description: 'Wireless TX errors' },
    { oid: oids.wireless.wlanRxErrors, name: 'wlanRxErrors', type: 'counter', table: true, description: 'Wireless RX errors' }
  ];
}

/**
 * Get LTE-specific OIDs for LTE devices
 */
function getLTEOIDs() {
  const oids = module.exports;
  
  return [
    { oid: oids.lte.signalStrength, name: 'lteSignalStrength', type: 'integer', description: 'LTE signal strength' },
    { oid: oids.lte.accessTechnology, name: 'lteAccessTechnology', type: 'string', description: 'LTE access technology' },
    { oid: oids.lte.currentOperator, name: 'lteOperator', type: 'string', description: 'Current LTE operator' },
    { oid: oids.lte.sessionUptime, name: 'lteSessionUptime', type: 'timeticks', description: 'LTE session uptime' }
  ];
}

module.exports.getDefaultMikrotikOIDs = getDefaultMikrotikOIDs;
module.exports.getWirelessOIDs = getWirelessOIDs;
module.exports.getLTEOIDs = getLTEOIDs;
