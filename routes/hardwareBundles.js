// Hardware Bundle API Routes
// Manage hardware bundles for easy planning and deployment

const express = require('express');
const router = express.Router();
const { HardwareBundle } = require('../models/hardwareBundle');

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

// GET /bundles - List all bundles
router.get('/', async (req, res) => {
  try {
    const {
      bundleType,
      status = 'active',
      search,
      page = 1,
      limit = 50,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build query
    const query = { tenantId: req.tenantId };
    
    if (status) query.status = status;
    if (bundleType) query.bundleType = bundleType;
    
    // Text search
    if (search) {
      query.$text = { $search: search };
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = search 
      ? { score: { $meta: 'textScore' }, [sortBy]: sortOrder === 'asc' ? 1 : -1 }
      : { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    
    // Execute query
    const bundles = await HardwareBundle
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await HardwareBundle.countDocuments(query);
    
    res.json({
      bundles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ error: 'Failed to fetch bundles', message: error.message });
  }
});

// GET /bundles/:id - Get single bundle
router.get('/:id', async (req, res) => {
  try {
    const bundle = await HardwareBundle.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    res.json(bundle);
  } catch (error) {
    console.error('Error fetching bundle:', error);
    res.status(500).json({ error: 'Failed to fetch bundle', message: error.message });
  }
});

// POST /bundles - Create new bundle
router.post('/', async (req, res) => {
  try {
    const bundleData = {
      ...req.body,
      tenantId: req.tenantId,
      createdBy: req.user?.name || req.user?.email,
      createdById: req.user?.uid
    };
    
    const bundle = new HardwareBundle(bundleData);
    await bundle.save();
    
    res.status(201).json(bundle);
  } catch (error) {
    console.error('Error creating bundle:', error);
    res.status(500).json({ error: 'Failed to create bundle', message: error.message });
  }
});

// PUT /bundles/:id - Update bundle
router.put('/:id', async (req, res) => {
  try {
    const bundle = await HardwareBundle.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    // Update fields
    Object.assign(bundle, req.body);
    bundle.updatedBy = req.user?.name || req.user?.email;
    bundle.updatedById = req.user?.uid;
    
    await bundle.save();
    
    res.json(bundle);
  } catch (error) {
    console.error('Error updating bundle:', error);
    res.status(500).json({ error: 'Failed to update bundle', message: error.message });
  }
});

// DELETE /bundles/:id - Delete bundle
router.delete('/:id', async (req, res) => {
  try {
    const bundle = await HardwareBundle.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    res.json({ message: 'Bundle deleted successfully', bundle });
  } catch (error) {
    console.error('Error deleting bundle:', error);
    res.status(500).json({ error: 'Failed to delete bundle', message: error.message });
  }
});

// ============================================================================
// BUNDLE ITEMS OPERATIONS
// ============================================================================

// POST /bundles/:id/items - Add item to bundle
router.post('/:id/items', async (req, res) => {
  try {
    const bundle = await HardwareBundle.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    await bundle.addItem(req.body);
    
    res.json({ message: 'Item added to bundle', bundle });
  } catch (error) {
    console.error('Error adding item to bundle:', error);
    res.status(500).json({ error: 'Failed to add item', message: error.message });
  }
});

// PUT /bundles/:id/items/:itemId - Update item in bundle
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const bundle = await HardwareBundle.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    await bundle.updateItem(req.params.itemId, req.body);
    
    res.json({ message: 'Item updated', bundle });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item', message: error.message });
  }
});

// DELETE /bundles/:id/items/:itemId - Remove item from bundle
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const bundle = await HardwareBundle.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    await bundle.removeItem(req.params.itemId);
    
    res.json({ message: 'Item removed from bundle', bundle });
  } catch (error) {
    console.error('Error removing item:', error);
    res.status(500).json({ error: 'Failed to remove item', message: error.message });
  }
});

// ============================================================================
// BUNDLE USAGE TRACKING
// ============================================================================

// POST /bundles/:id/use - Increment usage count
router.post('/:id/use', async (req, res) => {
  try {
    const bundle = await HardwareBundle.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    
    await bundle.incrementUsage();
    
    res.json({ message: 'Usage count incremented', bundle });
  } catch (error) {
    console.error('Error incrementing usage:', error);
    res.status(500).json({ error: 'Failed to increment usage', message: error.message });
  }
});

// ============================================================================
// QUERIES
// ============================================================================

// GET /bundles/type/:bundleType - Get bundles by type
router.get('/type/:bundleType', async (req, res) => {
  try {
    const bundles = await HardwareBundle.getByType(req.tenantId, req.params.bundleType);
    res.json(bundles);
  } catch (error) {
    console.error('Error fetching bundles by type:', error);
    res.status(500).json({ error: 'Failed to fetch bundles', message: error.message });
  }
});

// GET /bundles/search/:query - Search bundles
router.get('/search/:query', async (req, res) => {
  try {
    const bundles = await HardwareBundle.search(req.tenantId, req.params.query);
    res.json(bundles);
  } catch (error) {
    console.error('Error searching bundles:', error);
    res.status(500).json({ error: 'Failed to search bundles', message: error.message });
  }
});

module.exports = router;

