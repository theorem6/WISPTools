// OUI (Organizationally Unique Identifier) Lookup Utility
// Used to identify device manufacturers from MAC addresses

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
          detected_via: 'oui_lookup'
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

module.exports = {
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
