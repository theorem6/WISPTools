// Coverage Map API Routes
const express = require('express');
const router = express.Router();
const { TowerSite, Sector, CPEDevice, NetworkEquipment } = require('./coverage-map-schema');

// Middleware to extract tenant ID from header
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

// Apply tenant middleware to all routes
router.use(requireTenant);

// ========== Tower Sites ==========

// Get all tower sites for tenant
router.get('/tower-sites', async (req, res) => {
  try {
    const sites = await TowerSite.find({ tenantId: req.tenantId })
      .sort({ name: 1 })
      .lean();
    res.json(sites);
  } catch (error) {
    console.error('Error fetching tower sites:', error);
    res.status(500).json({ error: 'Failed to fetch tower sites' });
  }
});

// Get single tower site
router.get('/tower-sites/:id', async (req, res) => {
  try {
    const site = await TowerSite.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    }).lean();
    
    if (!site) {
      return res.status(404).json({ error: 'Tower site not found' });
    }
    
    res.json(site);
  } catch (error) {
    console.error('Error fetching tower site:', error);
    res.status(500).json({ error: 'Failed to fetch tower site' });
  }
});

// Create tower site
router.post('/tower-sites', async (req, res) => {
  try {
    const siteData = {
      ...req.body,
      tenantId: req.tenantId
    };
    
    const site = new TowerSite(siteData);
    await site.save();
    
    res.status(201).json(site);
  } catch (error) {
    console.error('Error creating tower site:', error);
    res.status(500).json({ error: 'Failed to create tower site', details: error.message });
  }
});

// Update tower site
router.put('/tower-sites/:id', async (req, res) => {
  try {
    const site = await TowerSite.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!site) {
      return res.status(404).json({ error: 'Tower site not found' });
    }
    
    res.json(site);
  } catch (error) {
    console.error('Error updating tower site:', error);
    res.status(500).json({ error: 'Failed to update tower site' });
  }
});

// Delete tower site
router.delete('/tower-sites/:id', async (req, res) => {
  try {
    const site = await TowerSite.findOneAndDelete({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!site) {
      return res.status(404).json({ error: 'Tower site not found' });
    }
    
    res.json({ success: true, message: 'Tower site deleted' });
  } catch (error) {
    console.error('Error deleting tower site:', error);
    res.status(500).json({ error: 'Failed to delete tower site' });
  }
});

// ========== Sectors ==========

// Get all sectors for tenant
router.get('/sectors', async (req, res) => {
  try {
    const { band, technology, siteId } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (band) query.band = band;
    if (technology) query.technology = technology;
    if (siteId) query.siteId = siteId;
    
    const sectors = await Sector.find(query)
      .populate('siteId', 'name type')
      .sort({ name: 1 })
      .lean();
    
    res.json(sectors);
  } catch (error) {
    console.error('Error fetching sectors:', error);
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

// Get sectors by site
router.get('/tower-sites/:siteId/sectors', async (req, res) => {
  try {
    const sectors = await Sector.find({ 
      siteId: req.params.siteId,
      tenantId: req.tenantId 
    })
    .sort({ name: 1 })
    .lean();
    
    res.json(sectors);
  } catch (error) {
    console.error('Error fetching sectors:', error);
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

// Create sector
router.post('/sectors', async (req, res) => {
  try {
    const sectorData = {
      ...req.body,
      tenantId: req.tenantId
    };
    
    const sector = new Sector(sectorData);
    await sector.save();
    
    res.status(201).json(sector);
  } catch (error) {
    console.error('Error creating sector:', error);
    res.status(500).json({ error: 'Failed to create sector', details: error.message });
  }
});

// Update sector
router.put('/sectors/:id', async (req, res) => {
  try {
    const sector = await Sector.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!sector) {
      return res.status(404).json({ error: 'Sector not found' });
    }
    
    res.json(sector);
  } catch (error) {
    console.error('Error updating sector:', error);
    res.status(500).json({ error: 'Failed to update sector' });
  }
});

// Delete sector
router.delete('/sectors/:id', async (req, res) => {
  try {
    const sector = await Sector.findOneAndDelete({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!sector) {
      return res.status(404).json({ error: 'Sector not found' });
    }
    
    res.json({ success: true, message: 'Sector deleted' });
  } catch (error) {
    console.error('Error deleting sector:', error);
    res.status(500).json({ error: 'Failed to delete sector' });
  }
});

// ========== CPE Devices ==========

// Get all CPE devices for tenant
router.get('/cpe-devices', async (req, res) => {
  try {
    const { status, technology } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (status) query.status = status;
    if (technology) query.technology = technology;
    
    const devices = await CPEDevice.find(query)
      .populate('siteId', 'name type')
      .sort({ name: 1 })
      .lean();
    
    res.json(devices);
  } catch (error) {
    console.error('Error fetching CPE devices:', error);
    res.status(500).json({ error: 'Failed to fetch CPE devices' });
  }
});

// Create CPE device
router.post('/cpe-devices', async (req, res) => {
  try {
    const deviceData = {
      ...req.body,
      tenantId: req.tenantId
    };
    
    const device = new CPEDevice(deviceData);
    await device.save();
    
    res.status(201).json(device);
  } catch (error) {
    console.error('Error creating CPE device:', error);
    res.status(500).json({ error: 'Failed to create CPE device', details: error.message });
  }
});

// Update CPE device
router.put('/cpe-devices/:id', async (req, res) => {
  try {
    const device = await CPEDevice.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!device) {
      return res.status(404).json({ error: 'CPE device not found' });
    }
    
    res.json(device);
  } catch (error) {
    console.error('Error updating CPE device:', error);
    res.status(500).json({ error: 'Failed to update CPE device' });
  }
});

// Delete CPE device
router.delete('/cpe-devices/:id', async (req, res) => {
  try {
    const device = await CPEDevice.findOneAndDelete({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!device) {
      return res.status(404).json({ error: 'CPE device not found' });
    }
    
    res.json({ success: true, message: 'CPE device deleted' });
  } catch (error) {
    console.error('Error deleting CPE device:', error);
    res.status(500).json({ error: 'Failed to delete CPE device' });
  }
});

// ========== Network Equipment ==========

// Get all equipment for tenant
router.get('/equipment', async (req, res) => {
  try {
    const { locationType, status, type } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (locationType) query.locationType = locationType;
    if (status) query.status = status;
    if (type) query.type = type;
    
    const equipment = await NetworkEquipment.find(query)
      .populate('siteId', 'name type')
      .sort({ name: 1 })
      .lean();
    
    res.json(equipment);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// Create equipment
router.post('/equipment', async (req, res) => {
  try {
    const equipmentData = {
      ...req.body,
      tenantId: req.tenantId
    };
    
    const equipment = new NetworkEquipment(equipmentData);
    await equipment.save();
    
    res.status(201).json(equipment);
  } catch (error) {
    console.error('Error creating equipment:', error);
    res.status(500).json({ error: 'Failed to create equipment', details: error.message });
  }
});

// Update equipment
router.put('/equipment/:id', async (req, res) => {
  try {
    const equipment = await NetworkEquipment.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    
    res.json(equipment);
  } catch (error) {
    console.error('Error updating equipment:', error);
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

// Delete equipment
router.delete('/equipment/:id', async (req, res) => {
  try {
    const equipment = await NetworkEquipment.findOneAndDelete({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }
    
    res.json({ success: true, message: 'Equipment deleted' });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    res.status(500).json({ error: 'Failed to delete equipment' });
  }
});

// ========== Geocoding ==========

// Geocode address using ArcGIS
router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    
    // Use ArcGIS geocoding service
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates`;
    const params = new URLSearchParams({
      f: 'json',
      singleLine: address,
      outFields: 'Match_addr,Addr_type'
    });
    
    const response = await fetch(`${url}?${params.toString()}`);
    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0) {
      const best = data.candidates[0];
      res.json({
        latitude: best.location.y,
        longitude: best.location.x,
        address: best.address
      });
    } else {
      res.status(404).json({ error: 'Address not found' });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// Reverse geocode coordinates
router.post('/reverse-geocode', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode`;
    const params = new URLSearchParams({
      f: 'json',
      location: `${longitude},${latitude}`,
      outSR: '4326'
    });
    
    const response = await fetch(`${url}?${params.toString()}`);
    const data = await response.json();
    
    if (data.address) {
      const addr = data.address;
      res.json({
        address: `${addr.Address}, ${addr.City}, ${addr.Region} ${addr.Postal}`
      });
    } else {
      res.status(404).json({ error: 'Address not found' });
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({ error: 'Reverse geocoding failed' });
  }
});

module.exports = router;

