/**
 * SNMP Routes - Shared Helper Functions
 */

const { UnifiedSite, UnifiedCPE, NetworkEquipment } = require('../../models/network');

// Helper function to format SNMP device for API response
const formatSNMPDevice = (device, source = 'equipment') => {
  const config = source === 'equipment' && device.notes ? 
    (typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes) : 
    {};

  return {
    id: device._id.toString(),
    name: device.name,
    type: 'snmp',
    deviceType: source === 'equipment' ? device.type : 'cpe',
    status: device.status === 'active' ? 'online' : 'offline',
    manufacturer: config.manufacturer_detected_via_oui || 
                  config.oui_detection?.manufacturer || 
                  device.manufacturer || 
                  'Generic',
    model: device.model || 'Unknown',
    serialNumber: device.serialNumber || device._id.toString(),
    location: {
      coordinates: {
        latitude: device.location?.latitude || 0,
        longitude: device.location?.longitude || 0
      },
      address: device.location?.address || device.address || 'Unknown Location'
    },
    snmp: {
      enabled: true,
      version: config.snmp_version || 'v2c',
      community: config.snmp_community || 'public',
      port: config.snmp_port || 161,
      timeout: config.snmp_timeout || 5000,
      retries: config.snmp_retries || 3
    },
    ipAddress: config.management_ip || '192.168.1.10',
    lastPolled: device.updatedAt || device.lastPolled || new Date().toISOString(),
    metrics: device.metrics || null,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt
  };
};

// Helper function to filter out fake/demo devices
const FAKE_DEVICE_NAMES = [
  'Core Router MT-RB5009',
  'Core Switch CRS328',
  'EPC Core Server',
  'Backhaul Router RB4011',
  'Customer A CPE',
  'Customer B CPE',
  'Customer A LTE CPE',
  'Customer B LTE CPE'
];

const FAKE_PATTERNS = [
  /Customer.*CPE/i,
  /Customer.*LTE/i,
  /Customer A/i,
  /Customer B/i
];

function isFakeDevice(name) {
  if (!name) return false;
  if (FAKE_DEVICE_NAMES.some(fake => name.includes(fake))) return true;
  return FAKE_PATTERNS.some(pattern => pattern.test(name));
}

module.exports = { formatSNMPDevice, isFakeDevice };
