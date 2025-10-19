// Comprehensive Inventory Management API
// Centralized asset tracking and management

const express = require('express');
const router = express.Router();
const { InventoryItem } = require('./inventory-schema');
const { requireModule, checkLimit } = require('./module-auth');

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

// Check if inventory module is enabled for this tenant
router.use(requireModule('inventory'));

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
    const itemData = {
      ...req.body,
      tenantId: req.tenantId,
      createdBy: req.user?.name || req.user?.email,
      createdById: req.user?.uid
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
    
    if (item.status !== 'available' && item.status !== 'reserved') {
      return res.status(400).json({ 
        error: 'Item cannot be deployed', 
        currentStatus: item.status 
      });
    }
    
    await item.deploy(deploymentInfo);
    
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

