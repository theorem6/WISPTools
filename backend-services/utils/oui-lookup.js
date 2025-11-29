/**
 * OUI (Organizationally Unique Identifier) Lookup Utility
 * Used to identify device manufacturers from MAC addresses
 * Helps with Mikrotik and other device detection
 */

// Mikrotik OUI prefixes (first 6 hex digits of MAC address)
const MIKROTIK_OUIS = [
  '00:0C:42',  // Mikrotik (most common)
  '4C:5E:0C',  // Mikrotik
  'D4:CA:6D',  // Mikrotik
  'E4:8D:8C',  // Mikrotik
  '48:8F:5A',  // Mikrotik
  'A4:BA:DB',  // Mikrotik
  'C4:AD:34',  // Mikrotik
  'CC:2D:E0',  // Mikrotik
  'F4:EC:38',  // Mikrotik
  'FC:2A:54',  // Mikrotik
  'FC:C2:3D'   // Mikrotik
];

// Other common networking equipment OUIs for reference
const COMMON_NETWORK_OUIS = {
  '00:0C:29': 'VMware',
  '00:0D:29': 'VMware',
  '00:50:56': 'VMware',
  '00:1C:42': 'Parallels',
  '00:26:2D': 'Samsung Electronics',
  '00:23:12': 'Apple',
  '00:23:DF': 'Cisco',
  '00:1B:0D': 'Cisco',
  '00:1E:13': 'Cisco',
  '00:1E:7D': 'Cisco',
  '00:21:1B': 'Cisco',
  '00:21:55': 'Cisco',
  '00:26:CA': 'Cisco',
  '00:1D:45': 'Cisco',
  '00:21:70': 'Ubiquiti Networks',
  '24:A4:3C': 'Ubiquiti Networks',
  '78:A3:E4': 'Ubiquiti Networks',
  'B4:FB:E4': 'Ubiquiti Networks',
  'D4:9A:20': 'Ubiquiti Networks',
  'E0:63:DA': 'Ubiquiti Networks',
  'F0:9F:C2': 'Ubiquiti Networks',
  '80:2A:A8': 'Ubiquiti Networks',
  '44:D9:E7': 'Ubiquiti Networks',
  '68:D7:9A': 'Ubiquiti Networks',
  '70:85:C2': 'Ubiquiti Networks',
  '80:2A:A8': 'Ubiquiti Networks'
};

/**
 * Normalize MAC address to standard format (uppercase, colons)
 * @param {string} mac - MAC address in any format
 * @returns {string} Normalized MAC address or null if invalid
 */
function normalizeMacAddress(mac) {
  if (!mac || typeof mac !== 'string') {
    return null;
  }
  
  // Remove common separators
  let cleaned = mac.replace(/[-.:\s]/g, '').toUpperCase();
  
  // Must be 12 hex characters
  if (!/^[0-9A-F]{12}$/.test(cleaned)) {
    return null;
  }
  
  // Add colons
  return cleaned.match(/.{2}/g).join(':');
}

/**
 * Extract OUI from MAC address (first 6 hex digits)
 * @param {string} mac - MAC address
 * @returns {string} OUI in format XX:XX:XX or null
 */
function extractOUI(mac) {
  const normalized = normalizeMacAddress(mac);
  if (!normalized) {
    return null;
  }
  
  // Return first 3 octets (OUI)
  return normalized.substring(0, 8);
}

/**
 * Check if MAC address belongs to Mikrotik
 * @param {string} mac - MAC address
 * @returns {boolean} True if Mikrotik OUI
 */
function isMikrotikOUI(mac) {
  const oui = extractOUI(mac);
  if (!oui) {
    return false;
  }
  
  return MIKROTIK_OUIS.includes(oui);
}

/**
 * Lookup manufacturer from OUI
 * @param {string} mac - MAC address
 * @returns {string|null} Manufacturer name or null
 */
function lookupManufacturer(mac) {
  const oui = extractOUI(mac);
  if (!oui) {
    return null;
  }
  
  // Check Mikrotik first
  if (MIKROTIK_OUIS.includes(oui)) {
    return 'Mikrotik';
  }
  
  // Check common network OUIs
  return COMMON_NETWORK_OUIS[oui] || null;
}

/**
 * Extract MAC addresses from ARP table entries
 * @param {Array} arpTable - ARP table entries
 * @returns {Array<string>} Array of MAC addresses
 */
function extractMacAddressesFromArpTable(arpTable) {
  const macs = [];
  
  if (!Array.isArray(arpTable)) {
    return macs;
  }
  
  arpTable.forEach(entry => {
    if (entry.mac_address) {
      const normalized = normalizeMacAddress(entry.mac_address);
      if (normalized) {
        macs.push(normalized);
      }
    }
    if (entry.mac) {
      const normalized = normalizeMacAddress(entry.mac);
      if (normalized) {
        macs.push(normalized);
      }
    }
    if (entry.phys_address) {
      const normalized = normalizeMacAddress(entry.phys_address);
      if (normalized) {
        macs.push(normalized);
      }
    }
  });
  
  return [...new Set(macs)]; // Remove duplicates
}

/**
 * Detect Mikrotik devices from ARP table by checking MAC addresses
 * @param {Array} arpTable - ARP table entries
 * @returns {Array} Array of detected Mikrotik MAC addresses with metadata
 */
function detectMikrotikFromArpTable(arpTable) {
  const mikrotikDevices = [];
  
  if (!Array.isArray(arpTable)) {
    return mikrotikDevices;
  }
  
  arpTable.forEach(entry => {
    const macFields = [
      entry.mac_address,
      entry.mac,
      entry.phys_address
    ].filter(Boolean);
    
    for (const macField of macFields) {
      if (isMikrotikOUI(macField)) {
        mikrotikDevices.push({
          mac_address: normalizeMacAddress(macField),
          ip_address: entry.ip_address || entry.ip || null,
          hostname: entry.hostname || entry.name || null,
          interface: entry.interface || entry.if_name || null,
          detected_via: 'oui_lookup'
        });
        break; // Only add once per entry
      }
    }
  });
  
  return mikrotikDevices;
}

module.exports = {
  normalizeMacAddress,
  extractOUI,
  isMikrotikOUI,
  lookupManufacturer,
  extractMacAddressesFromArpTable,
  detectMikrotikFromArpTable,
  MIKROTIK_OUIS,
  COMMON_NETWORK_OUIS
};

