// Comprehensive Inventory Management API
// Centralized asset tracking and management

const express = require('express');
const router = express.Router();
const { InventoryItem } = require('../models/inventory');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Require tenant ID
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

router.use(requireTenant);

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

// GET /inventory - List all inventory items with filtering
router.get('/', async (req, res) => {
  try {
    const {
      category,
      status,
      locationType,
      locationId,
      manufacturer,
      model,
      search,
      page = 1,
      limit = 100,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build query
    const query = { tenantId: req.tenantId };
    
    if (category) query.category = category;
    if (status) query.status = status;
    if (locationType) query['currentLocation.type'] = locationType;
    if (locationId) query['currentLocation.siteId'] = locationId;
    if (manufacturer) query.manufacturer = new RegExp(manufacturer, 'i');
    if (model) query.model = new RegExp(model, 'i');
    
    // Text search
    if (search) {
      query.$text = { $search: search };
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    
    // Execute query
    const items = await InventoryItem
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await InventoryItem.countDocuments(query);
    
    res.json({
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory', message: error.message });
  }
});

// GET /inventory/stats - Get inventory statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Promise.all([
      // Total items
      InventoryItem.countDocuments({ tenantId: req.tenantId }),
      
      // By status
      InventoryItem.aggregate([
        { $match: { tenantId: req.tenantId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      
      // By category
      InventoryItem.aggregate([
        { $match: { tenantId: req.tenantId } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      
      // By location type
      InventoryItem.aggregate([
        { $match: { tenantId: req.tenantId } },
        { $group: { _id: '$currentLocation.type', count: { $sum: 1 } } }
      ]),
      
      // Total value
      InventoryItem.aggregate([
        { $match: { tenantId: req.tenantId } },
        { $group: { _id: null, totalValue: { $sum: '$bookValue' } } }
      ])
    ]);
    
    res.json({
      totalItems: stats[0],
      byStatus: stats[1],
      byCategory: stats[2],
      byLocation: stats[3],
      totalValue: stats[4][0]?.totalValue || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics', message: error.message });
  }
});

// GET /inventory/:id - Get single item
router.get('/:id', async (req, res) => {
  try {
    const item = await InventoryItem.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item', message: error.message });
  }
});

// POST /inventory - Create new item
router.post('/', async (req, res) => {
  try {
    // Get tenant's primary location if no location specified
    let defaultLocation = null;
    if (!req.body.currentLocation) {
      const { Tenant } = require('../models/tenant');
      const { UnifiedSite } = require('../models/network');
      
      const tenant = await Tenant.findOne({ _id: req.tenantId });
      if (tenant?.primaryLocation?.siteId) {
        const site = await UnifiedSite.findOne({ 
          _id: tenant.primaryLocation.siteId,
          tenantId: req.tenantId 
        });
        
        if (site) {
          // Determine location type from site types
          const siteTypes = Array.isArray(site.type) ? site.type : [site.type];
          let locationType = 'warehouse';
          if (siteTypes.includes('noc')) locationType = 'noc';
          else if (siteTypes.includes('hq')) locationType = 'noc'; // HQ treated as NOC
          else if (siteTypes.includes('tower')) locationType = 'tower';
          else if (siteTypes.includes('warehouse')) locationType = 'warehouse';
          
          defaultLocation = {
            type: locationType,
            siteId: site._id.toString(),
            siteName: site.name || tenant.primaryLocation.siteName,
            latitude: site.location?.latitude,
            longitude: site.location?.longitude,
            address: site.location?.address
          };
        }
      }
    }
    
    const itemData = {
      ...req.body,
      tenantId: req.tenantId,
      createdBy: req.user?.name || req.user?.email,
      createdById: req.user?.uid,
      // Use default location if none provided
      currentLocation: req.body.currentLocation || defaultLocation
    };
    
    const item = new InventoryItem(itemData);
    await item.save();
    
    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item', message: error.message });
  }
});

// PUT /inventory/:id - Update item
router.put('/:id', async (req, res) => {
  try {
    const item = await InventoryItem.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Update fields
    Object.assign(item, req.body);
    item.updatedBy = req.user?.name || req.user?.email;
    item.updatedById = req.user?.uid;
    
    await item.save();
    
    res.json(item);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item', message: error.message });
  }
});

// DELETE /inventory/:id - Delete item
router.delete('/:id', async (req, res) => {
  try {
    const item = await InventoryItem.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({ message: 'Item deleted successfully', item });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item', message: error.message });
  }
});

// ============================================================================
// SPECIAL OPERATIONS
// ============================================================================

// POST /inventory/:id/transfer - Transfer item to new location
router.post('/:id/transfer', async (req, res) => {
  try {
    const { newLocation, reason, movedBy, notes } = req.body;
    
    if (!newLocation) {
      return res.status(400).json({ error: 'newLocation is required' });
    }
    
    const item = await InventoryItem.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    await item.transferTo(newLocation, reason, movedBy, notes);
    
    res.json({ message: 'Item transferred successfully', item });
  } catch (error) {
    console.error('Error transferring item:', error);
    res.status(500).json({ error: 'Failed to transfer item', message: error.message });
  }
});

// POST /inventory/:id/deploy - Deploy item
router.post('/:id/deploy', async (req, res) => {
  try {
    const deploymentInfo = req.body;
    
    const item = await InventoryItem.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Ensure status exists (should have default, but safety check)
    if (!item.status) {
      console.warn(`[Deploy] Item ${item._id} has no status, defaulting to 'available'`);
      item.status = 'available';
    }
    
    console.log(`[Deploy] Attempting to deploy item ${item._id} (${item.model || item.equipmentType || 'unknown'}), current status: ${item.status}`);
    
    // Allow deployment for: available, reserved, deployed (redeployment), maintenance (returning to service), in-transit
    // Block deployment for: retired, lost, sold, rma
    const deployableStatuses = ['available', 'reserved', 'deployed', 'maintenance', 'in-transit'];
    const blockedStatuses = ['retired', 'lost', 'sold', 'rma'];
    
    if (blockedStatuses.includes(item.status)) {
      return res.status(400).json({ 
        error: `Item cannot be deployed. Current status: ${item.status}. Items with status '${item.status}' cannot be deployed.`,
        currentStatus: item.status,
        message: `This item is marked as '${item.status}' and cannot be deployed. Please update the item status first if you need to deploy it.`
      });
    }
    
    if (!deployableStatuses.includes(item.status)) {
      return res.status(400).json({ 
        error: `Item cannot be deployed. Current status: ${item.status}`,
        currentStatus: item.status,
        message: `Items with status '${item.status}' cannot be deployed. Please update the item status to 'available' or 'reserved' first.`
      });
    }
    
    await item.deploy(deploymentInfo);
    
    console.log(`[Deploy] Successfully deployed item ${item._id} (${item.model || item.equipmentType || 'unknown'}) to status: ${item.status}`);
    
    res.json({ message: 'Item deployed successfully', item });
  } catch (error) {
    console.error('Error deploying item:', error);
    res.status(500).json({ error: 'Failed to deploy item', message: error.message });
  }
});

// POST /inventory/:id/return - Return item to inventory
router.post('/:id/return', async (req, res) => {
  try {
    const { returnLocation, reason, notes } = req.body;
    
    if (!returnLocation) {
      return res.status(400).json({ error: 'returnLocation is required' });
    }
    
    const item = await InventoryItem.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    await item.returnToInventory(returnLocation, reason, notes);
    
    res.json({ message: 'Item returned to inventory', item });
  } catch (error) {
    console.error('Error returning item:', error);
    res.status(500).json({ error: 'Failed to return item', message: error.message });
  }
});

// POST /inventory/:id/maintenance - Add maintenance record
router.post('/:id/maintenance', async (req, res) => {
  try {
    const maintenanceData = req.body;
    
    const item = await InventoryItem.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    await item.addMaintenance(maintenanceData);
    
    res.json({ message: 'Maintenance record added', item });
  } catch (error) {
    console.error('Error adding maintenance:', error);
    res.status(500).json({ error: 'Failed to add maintenance', message: error.message });
  }
});

// POST /inventory/bulk-import - Bulk import items
router.post('/bulk-import', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }
    
    // Add tenant ID and metadata to all items
    const itemsWithTenant = items.map(item => ({
      ...item,
      tenantId: req.tenantId,
      createdBy: req.user?.name || req.user?.email,
      createdById: req.user?.uid
    }));
    
    const result = await InventoryItem.insertMany(itemsWithTenant, { ordered: false });
    
    res.json({
      message: 'Bulk import completed',
      imported: result.length,
      total: items.length
    });
  } catch (error) {
    console.error('Error bulk importing:', error);
    
    // Handle partial success
    if (error.name === 'BulkWriteError') {
      res.status(207).json({
        message: 'Partial import completed',
        imported: error.result.nInserted,
        failed: error.writeErrors?.length || 0,
        errors: error.writeErrors
      });
    } else {
      res.status(500).json({ error: 'Failed to import items', message: error.message });
    }
  }
});

// POST /inventory/bulk-update - Bulk update items
router.post('/bulk-update', async (req, res) => {
  try {
    const { itemIds, updates } = req.body;
    
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds array is required' });
    }
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates object is required' });
    }
    
    const result = await InventoryItem.updateMany(
      {
        _id: { $in: itemIds },
        tenantId: req.tenantId
      },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
          updatedBy: req.user?.name || req.user?.email,
          updatedById: req.user?.uid
        }
      }
    );
    
    res.json({
      message: 'Bulk update completed',
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk updating:', error);
    res.status(500).json({ error: 'Failed to update items', message: error.message });
  }
});

// ============================================================================
// ALERTS & NOTIFICATIONS
// ============================================================================

// GET /inventory/alerts/low-stock - Get low stock items
router.get('/alerts/low-stock', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;
    
    const lowStockItems = await InventoryItem.getLowStockItems(req.tenantId, threshold);
    
    res.json(lowStockItems);
  } catch (error) {
    console.error('Error fetching low stock:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items', message: error.message });
  }
});

// GET /inventory/alerts/warranty-expiring - Get items with expiring warranties
router.get('/alerts/warranty-expiring', async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days) || 30;
    
    const expiringWarranties = await InventoryItem.getExpiringWarranties(req.tenantId, daysAhead);
    
    res.json(expiringWarranties);
  } catch (error) {
    console.error('Error fetching expiring warranties:', error);
    res.status(500).json({ error: 'Failed to fetch expiring warranties', message: error.message });
  }
});

// GET /inventory/alerts/maintenance-due - Get items needing maintenance
router.get('/alerts/maintenance-due', async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days) || 7;
    
    const maintenanceDue = await InventoryItem.getMaintenanceDue(req.tenantId, daysAhead);
    
    res.json(maintenanceDue);
  } catch (error) {
    console.error('Error fetching maintenance due:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance due items', message: error.message });
  }
});

// ============================================================================
// LOCATION-BASED QUERIES
// ============================================================================

// GET /inventory/by-location/:locationType - Get items by location type
router.get('/by-location/:locationType', async (req, res) => {
  try {
    const { locationType } = req.params;
    const { locationId } = req.query;
    
    const items = await InventoryItem.getByLocation(req.tenantId, locationType, locationId);
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching items by location:', error);
    res.status(500).json({ error: 'Failed to fetch items by location', message: error.message });
  }
});

// GET /inventory/by-site/:siteId - Get all equipment at a specific site
router.get('/by-site/:siteId', async (req, res) => {
  try {
    const items = await InventoryItem.find({
      tenantId: req.tenantId,
      'currentLocation.siteId': req.params.siteId
    }).sort({ category: 1, equipmentType: 1 });
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching items by site:', error);
    res.status(500).json({ error: 'Failed to fetch items by site', message: error.message });
  }
});

// ============================================================================
// SCAN IN/OUT OPERATIONS
// ============================================================================

// POST /inventory/scan/check-in - Check in item by barcode/QR/asset tag
router.post('/scan/check-in', async (req, res) => {
  try {
    const { identifier, location, notes } = req.body;
    
    if (!identifier) {
      return res.status(400).json({ error: 'identifier is required (barcode, QR code, or asset tag)' });
    }
    
    // Get default location from tenant if not provided
    let finalLocation = location;
    if (!finalLocation) {
      const { Tenant } = require('../models/tenant');
      const { UnifiedSite } = require('../models/network');
      
      const tenant = await Tenant.findOne({ _id: req.tenantId });
      if (tenant?.primaryLocation?.siteId) {
        const site = await UnifiedSite.findOne({ 
          _id: tenant.primaryLocation.siteId,
          tenantId: req.tenantId 
        });
        
        if (site) {
          // Determine location type from site types
          const siteTypes = Array.isArray(site.type) ? site.type : [site.type];
          let locationType = 'warehouse';
          if (siteTypes.includes('noc')) locationType = 'noc';
          else if (siteTypes.includes('hq')) locationType = 'noc'; // HQ treated as NOC
          else if (siteTypes.includes('tower')) locationType = 'tower';
          else if (siteTypes.includes('warehouse')) locationType = 'warehouse';
          
          finalLocation = {
            type: locationType,
            siteId: site._id.toString(),
            siteName: site.name || tenant.primaryLocation.siteName,
            latitude: site.location?.latitude,
            longitude: site.location?.longitude,
            address: site.location?.address
          };
        }
      }
      
      if (!finalLocation) {
        return res.status(400).json({ error: 'location is required. Please set a primary location in tenant settings.' });
      }
    }
    
    // Find item by barcode, QR code, or asset tag
    const item = await InventoryItem.findOne({
      tenantId: req.tenantId,
      $or: [
        { barcode: identifier },
        { qrCode: identifier },
        { assetTag: identifier },
        { serialNumber: identifier }
      ]
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found', identifier });
    }
    
    // Check in: Transfer to new location and set status to available if not already
    const movedBy = req.user?.name || req.user?.email || 'system';
    await item.transferTo(finalLocation, 'check-in', movedBy, notes || 'Checked in via scanner');
    
    // Update status to available if currently in-transit or reserved
    if (item.status === 'in-transit' || item.status === 'reserved') {
      item.status = 'available';
      await item.save();
    }
    
    res.json({ 
      message: 'Item checked in successfully', 
      item,
      action: 'check-in'
    });
  } catch (error) {
    console.error('Error checking in item:', error);
    res.status(500).json({ error: 'Failed to check in item', message: error.message });
  }
});

// POST /inventory/scan/check-out - Check out item by barcode/QR/asset tag
router.post('/scan/check-out', async (req, res) => {
  try {
    const { identifier, location, notes, status } = req.body;
    
    if (!identifier) {
      return res.status(400).json({ error: 'identifier is required (barcode, QR code, or asset tag)' });
    }
    
    if (!location) {
      return res.status(400).json({ error: 'location is required' });
    }
    
    // Find item by barcode, QR code, or asset tag
    const item = await InventoryItem.findOne({
      tenantId: req.tenantId,
      $or: [
        { barcode: identifier },
        { qrCode: identifier },
        { assetTag: identifier },
        { serialNumber: identifier }
      ]
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found', identifier });
    }
    
    // Verify item is available for checkout
    if (item.status === 'deployed' && location.type !== 'customer') {
      return res.status(400).json({ 
        error: 'Item is already deployed and cannot be checked out',
        currentStatus: item.status,
        currentLocation: item.currentLocation
      });
    }
    
    // Check out: Transfer to new location
    const movedBy = req.user?.name || req.user?.email || 'system';
    await item.transferTo(location, 'check-out', movedBy, notes || 'Checked out via scanner');
    
    // Update status based on checkout type
    const newStatus = status || (location.type === 'customer' ? 'deployed' : 'in-transit');
    item.status = newStatus;
    await item.save();
    
    res.json({ 
      message: 'Item checked out successfully', 
      item,
      action: 'check-out'
    });
  } catch (error) {
    console.error('Error checking out item:', error);
    res.status(500).json({ error: 'Failed to check out item', message: error.message });
  }
});

// POST /inventory/scan/lookup - Look up item by barcode/QR/asset tag
router.post('/scan/lookup', async (req, res) => {
  try {
    const { identifier } = req.body;
    
    if (!identifier) {
      return res.status(400).json({ error: 'identifier is required' });
    }
    
    // Find item by barcode, QR code, asset tag, or serial number
    const item = await InventoryItem.findOne({
      tenantId: req.tenantId,
      $or: [
        { barcode: identifier },
        { qrCode: identifier },
        { assetTag: identifier },
        { serialNumber: identifier }
      ]
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found', identifier });
    }
    
    res.json({ item });
  } catch (error) {
    console.error('Error looking up item:', error);
    res.status(500).json({ error: 'Failed to look up item', message: error.message });
  }
});

// ============================================================================
// REPORTS & EXPORT
// ============================================================================

// GET /inventory/export/csv - Export inventory to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const items = await InventoryItem.find({ tenantId: req.tenantId });
    
    // Generate CSV
    const headers = [
      'Asset Tag', 'Category', 'Type', 'Manufacturer', 'Model', 'Serial Number',
      'Status', 'Condition', 'Location Type', 'Location', 'Purchase Date', 
      'Purchase Price', 'Warranty End', 'Notes'
    ];
    
    const rows = items.map(item => [
      item.assetTag || '',
      item.category,
      item.equipmentType,
      item.manufacturer || '',
      item.model || '',
      item.serialNumber,
      item.status,
      item.condition,
      item.currentLocation.type,
      item.currentLocation.siteName || item.currentLocation.warehouse?.name || '',
      item.purchaseInfo?.purchaseDate || '',
      item.purchaseInfo?.purchasePrice || '',
      item.warranty?.endDate || '',
      item.notes || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=inventory-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV', message: error.message });
  }
});

module.exports = router;

