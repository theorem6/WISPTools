const express = require('express');
const router = express.Router();
const { UnifiedSite, UnifiedCPE, NetworkEquipment } = require('../../models/network');
const { SNMPMetrics } = require('../../models/snmp-metrics-schema');
const { formatSNMPDevice, isFakeDevice } = require('./snmp-helpers');

// Middleware to extract tenant ID
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

router.use(requireTenant);

router.get('/devices', async (req, res) => {
  try {
    console.log(`🔍 [SNMP API] Fetching SNMP devices for tenant: ${req.tenantId}`);
    
    const devices = [];
    
    // Get all network equipment with SNMP enabled
    const snmpEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      status: 'active',
      $or: [
        { notes: /snmp_enabled.*true/i },
        { notes: /snmp_community/i },
        { notes: /snmp_version/i }
      ]
    }).lean();
    
    console.log(`🖥️ Found ${snmpEquipment.length} SNMP equipment items`);
    
    // Add SNMP equipment (filter out fake devices)
    snmpEquipment.forEach(equipment => {
      if (!isFakeDevice(equipment.name)) {
        devices.push(formatSNMPDevice(equipment, 'equipment'));
      } else {
        console.log(`  ⚠️ Filtering out fake device: ${equipment.name}`);
      }
    });
    
    // Get CPE devices with SNMP/ACS modules enabled
    const snmpCPE = await UnifiedCPE.find({
      tenantId: req.tenantId,
      status: 'active',
      $or: [
        { 'modules.acs.enabled': true },
        { 'modules.hss.enabled': true }
      ]
    }).lean();
    
    console.log(`📱 Found ${snmpCPE.length} SNMP CPE devices`);
    
    // Add SNMP CPE (filter out fake devices)
    snmpCPE.forEach(cpe => {
      if (!isFakeDevice(cpe.name)) {
        devices.push(formatSNMPDevice(cpe, 'cpe'));
      } else {
        console.log(`  ⚠️ Filtering out fake device: ${cpe.name}`);
      }
    });
    
    console.log(`📊 Total SNMP devices for tenant ${req.tenantId}: ${devices.length}`);
    
    res.json({ 
      devices,
      total: devices.length,
      tenant: req.tenantId,
      summary: {
        routers: devices.filter(d => d.deviceType === 'router').length,
        switches: devices.filter(d => d.deviceType === 'switch').length,
        access_points: devices.filter(d => d.deviceType === 'access_point').length,
        cpe: devices.filter(d => d.deviceType === 'cpe').length,
        other: devices.filter(d => d.deviceType === 'other').length
      }
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error fetching SNMP devices:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SNMP devices', 
      message: error.message,
      devices: []
    });
  }
});

// GET /api/snmp/devices/:id - Get specific SNMP device details
router.get('/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 [SNMP API] Fetching SNMP device ${id} for tenant: ${req.tenantId}`);
    
    // Try to find as network equipment first
    let device = await NetworkEquipment.findOne({
      _id: id,
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    if (device) {
      const formattedDevice = formatSNMPDevice(device, 'equipment');
      return res.json(formattedDevice);
    }
    
    // Try to find as CPE device
    device = await UnifiedCPE.findOne({
      _id: id,
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    if (device) {
      const formattedDevice = formatSNMPDevice(device, 'cpe');
      return res.json(formattedDevice);
    }
    
    res.status(404).json({ error: 'SNMP device not found' });
  } catch (error) {
    console.error('❌ [SNMP API] Error fetching SNMP device:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SNMP device', 
      message: error.message 
    });
  }
});


module.exports = router;
