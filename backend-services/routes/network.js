// Unified Network Equipment API
// Central repository for all sites, sectors, and CPE
// Other modules extend this data with their specific needs

const express = require('express');
const router = express.Router();
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment } = require('../models/network');

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

// ========== UNIFIED SITES ==========

router.get('/sites', async (req, res) => {
  try {
    const sites = await UnifiedSite.find({ tenantId: req.tenantId }).sort({ name: 1 }).lean();
    res.json(sites);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

router.get('/sites/:id', async (req, res) => {
  try {
    const site = await UnifiedSite.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json(site);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

router.post('/sites', async (req, res) => {
  try {
    const site = new UnifiedSite({ ...req.body, tenantId: req.tenantId });
    await site.save();
    res.status(201).json(site);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create site', details: error.message });
  }
});

router.put('/sites/:id', async (req, res) => {
  try {
    const site = await UnifiedSite.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json(site);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update site' });
  }
});

router.delete('/sites/:id', async (req, res) => {
  try {
    const site = await UnifiedSite.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// ========== UNIFIED SECTORS ==========

router.get('/sectors', async (req, res) => {
  try {
    const { band, technology, siteId } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (band) query.band = band;
    if (technology) query.technology = technology;
    if (siteId) query.siteId = siteId;
    
    const sectors = await UnifiedSector.find(query)
      .populate('siteId', 'name type location')
      .sort({ name: 1 })
      .lean();
    
    res.json(sectors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

router.get('/sectors/:id', async (req, res) => {
  try {
    const sector = await UnifiedSector.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate('siteId', 'name type location')
      .lean();
    if (!sector) return res.status(404).json({ error: 'Sector not found' });
    res.json(sector);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sector' });
  }
});

router.post('/sectors', async (req, res) => {
  try {
    const sector = new UnifiedSector({ ...req.body, tenantId: req.tenantId });
    await sector.save();
    res.status(201).json(sector);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create sector', details: error.message });
  }
});

router.put('/sectors/:id', async (req, res) => {
  try {
    const sector = await UnifiedSector.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!sector) return res.status(404).json({ error: 'Sector not found' });
    res.json(sector);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sector' });
  }
});

router.delete('/sectors/:id', async (req, res) => {
  try {
    const sector = await UnifiedSector.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!sector) return res.status(404).json({ error: 'Sector not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete sector' });
  }
});

// Get sectors by site
router.get('/sites/:siteId/sectors', async (req, res) => {
  try {
    const sectors = await UnifiedSector.find({ 
      siteId: req.params.siteId,
      tenantId: req.tenantId 
    }).sort({ name: 1 }).lean();
    res.json(sectors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

// ========== UNIFIED CPE ==========

router.get('/cpe', async (req, res) => {
  try {
    const { status, technology, siteId } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (status) query.status = status;
    if (technology) query.technology = technology;
    if (siteId) query.siteId = siteId;
    
    const cpe = await UnifiedCPE.find(query)
      .populate('siteId', 'name type location')
      .sort({ name: 1 })
      .lean();
    
    res.json(cpe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch CPE' });
  }
});

router.get('/cpe/:id', async (req, res) => {
  try {
    const cpe = await UnifiedCPE.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .populate('siteId', 'name type location')
      .lean();
    if (!cpe) return res.status(404).json({ error: 'CPE not found' });
    res.json(cpe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch CPE' });
  }
});

router.post('/cpe', async (req, res) => {
  try {
    const cpe = new UnifiedCPE({ ...req.body, tenantId: req.tenantId });
    await cpe.save();
    res.status(201).json(cpe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create CPE', details: error.message });
  }
});

router.put('/cpe/:id', async (req, res) => {
  try {
    const cpe = await UnifiedCPE.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!cpe) return res.status(404).json({ error: 'CPE not found' });
    res.json(cpe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update CPE' });
  }
});

router.delete('/cpe/:id', async (req, res) => {
  try {
    const cpe = await UnifiedCPE.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!cpe) return res.status(404).json({ error: 'CPE not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete CPE' });
  }
});

// ========== NETWORK EQUIPMENT ==========

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
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

router.post('/equipment', async (req, res) => {
  try {
    const equipment = new NetworkEquipment({ ...req.body, tenantId: req.tenantId });
    await equipment.save();
    res.status(201).json(equipment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create equipment', details: error.message });
  }
});

router.put('/equipment/:id', async (req, res) => {
  try {
    const equipment = await NetworkEquipment.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });
    res.json(equipment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

router.delete('/equipment/:id', async (req, res) => {
  try {
    const equipment = await NetworkEquipment.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete equipment' });
  }
});

// ========== GEOCODING ==========

router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Address is required' });
    
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
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

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
      res.json({ address: `${addr.Address}, ${addr.City}, ${addr.Region} ${addr.Postal}` });
    } else {
      res.status(404).json({ error: 'Address not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Reverse geocoding failed' });
  }
});

module.exports = router;

