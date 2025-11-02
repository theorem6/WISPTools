/**
 * Equipment Pricing API
 * Manages equipment pricing data for accurate cost estimation
 */

const express = require('express');
const router = express.Router();
const EquipmentPricing = require('../models/equipment-pricing');
const { InventoryItem } = require('../models/inventory');

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

/**
 * GET /api/equipment-pricing/price
 * Get estimated price for equipment
 * Query params: category, equipmentType, manufacturer, model
 */
router.get('/price', async (req, res) => {
  try {
    const { category, equipmentType, manufacturer, model } = req.query;
    
    if (!category || !equipmentType) {
      return res.status(400).json({ 
        error: 'category and equipmentType are required' 
      });
    }
    
    // Strategy 1: Try exact match (category + type + manufacturer + model)
    let pricing = null;
    
    if (manufacturer && model) {
      pricing = await EquipmentPricing.findOne({
        tenantId: req.tenantId,
        category,
        equipmentType,
        manufacturer,
        model
      }).sort({ lastUpdated: -1 });
    }
    
    // Strategy 2: Try manufacturer match (category + type + manufacturer)
    if (!pricing && manufacturer) {
      pricing = await EquipmentPricing.findOne({
        tenantId: req.tenantId,
        category,
        equipmentType,
        manufacturer,
        model: '' // Empty model means any model
      }).sort({ lastUpdated: -1 });
    }
    
    // Strategy 3: Try type match (category + type)
    if (!pricing) {
      pricing = await EquipmentPricing.findOne({
        tenantId: req.tenantId,
        category,
        equipmentType,
        manufacturer: '', // Empty means any manufacturer
        model: ''
      }).sort({ lastUpdated: -1 });
    }
    
    // Strategy 4: Calculate from inventory average
    if (!pricing) {
      try {
        const inventoryItems = await InventoryItem.find({
          tenantId: req.tenantId,
          category,
          status: { $in: ['available', 'deployed'] },
          'purchaseInfo.purchasePrice': { $exists: true, $gt: 0 }
        }).select('purchaseInfo.purchasePrice category equipmentType').lean();
        
        if (inventoryItems.length > 0) {
          const prices = inventoryItems
            .map(item => item.purchaseInfo?.purchasePrice)
            .filter(price => price && price > 0);
          
          if (prices.length > 0) {
            const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            pricing = {
              basePrice: averagePrice,
              source: 'inventory_average',
              confidence: 'medium'
            };
          }
        }
      } catch (inventoryError) {
        console.error('Error fetching inventory prices:', inventoryError);
      }
    }
    
    if (pricing) {
      return res.json({
        price: pricing.basePrice || pricing.unitPrice,
        source: pricing.source || 'pricing_database',
        confidence: 'high',
        manufacturer: pricing.manufacturer,
        model: pricing.model,
        lastUpdated: pricing.lastUpdated
      });
    }
    
    // Strategy 5: Return null (caller should use fallback)
    res.json({
      price: null,
      source: 'not_found',
      confidence: 'low',
      message: 'No pricing data found. Using default estimate.'
    });
  } catch (error) {
    console.error('Error fetching price:', error);
    res.status(500).json({ 
      error: 'Failed to fetch price',
      message: error.message 
    });
  }
});

/**
 * GET /api/equipment-pricing
 * List all pricing entries for tenant
 */
router.get('/', async (req, res) => {
  try {
    const { category, equipmentType } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (category) query.category = category;
    if (equipmentType) query.equipmentType = equipmentType;
    
    const pricing = await EquipmentPricing.find(query)
      .sort({ category: 1, equipmentType: 1, lastUpdated: -1 })
      .lean();
    
    res.json(pricing);
  } catch (error) {
    console.error('Error fetching pricing list:', error);
    res.status(500).json({ error: 'Failed to fetch pricing list' });
  }
});

/**
 * POST /api/equipment-pricing
 * Create or update pricing entry
 */
router.post('/', async (req, res) => {
  try {
    const {
      category,
      equipmentType,
      manufacturer,
      model,
      basePrice,
      currency,
      source,
      vendorUrl,
      notes,
      quantity
    } = req.body;
    
    if (!category || !equipmentType || !basePrice) {
      return res.status(400).json({ 
        error: 'category, equipmentType, and basePrice are required' 
      });
    }
    
    // Try to find existing entry
    const existing = await EquipmentPricing.findOne({
      tenantId: req.tenantId,
      category,
      equipmentType,
      manufacturer: manufacturer || '',
      model: model || ''
    });
    
    if (existing) {
      // Update existing
      existing.basePrice = basePrice;
      existing.currency = currency || 'USD';
      existing.source = source || 'manual';
      existing.lastUpdated = new Date();
      if (vendorUrl) existing.vendorUrl = vendorUrl;
      if (notes) existing.notes = notes;
      if (quantity) {
        existing.quantity = quantity;
        existing.unitPrice = basePrice / quantity;
      }
      
      await existing.save();
      
      return res.json({
        success: true,
        pricing: existing,
        message: 'Pricing updated'
      });
    }
    
    // Create new
    const pricing = new EquipmentPricing({
      tenantId: req.tenantId,
      category,
      equipmentType,
      manufacturer: manufacturer || '',
      model: model || '',
      basePrice,
      currency: currency || 'USD',
      source: source || 'manual',
      vendorUrl,
      notes,
      quantity: quantity || 1,
      unitPrice: basePrice / (quantity || 1)
    });
    
    await pricing.save();
    
    res.status(201).json({
      success: true,
      pricing,
      message: 'Pricing created'
    });
  } catch (error) {
    console.error('Error creating/updating pricing:', error);
    res.status(500).json({ 
      error: 'Failed to create/update pricing',
      message: error.message 
    });
  }
});

/**
 * POST /api/equipment-pricing/import-from-inventory
 * Import prices from existing inventory items
 */
router.post('/import-from-inventory', async (req, res) => {
  try {
    const { category } = req.body; // Optional category filter
    
    const query = {
      tenantId: req.tenantId,
      'purchaseInfo.purchasePrice': { $exists: true, $gt: 0 }
    };
    
    if (category) {
      query.category = category;
    }
    
    const inventoryItems = await InventoryItem.find(query)
      .select('category equipmentType manufacturer model purchaseInfo')
      .lean();
    
    let imported = 0;
    let updated = 0;
    
    for (const item of inventoryItems) {
      if (!item.purchaseInfo?.purchasePrice) continue;
      
      const existing = await EquipmentPricing.findOne({
        tenantId: req.tenantId,
        category: item.category,
        equipmentType: item.equipmentType,
        manufacturer: item.manufacturer || '',
        model: item.model || ''
      });
      
      if (existing) {
        // Update if inventory price is newer
        if (item.purchaseInfo.purchaseDate && 
            (!existing.lastUpdated || 
             new Date(item.purchaseInfo.purchaseDate) > existing.lastUpdated)) {
          existing.basePrice = item.purchaseInfo.purchasePrice;
          existing.source = 'inventory';
          existing.lastUpdated = new Date(item.purchaseInfo.purchaseDate);
          await existing.save();
          updated++;
        }
      } else {
        // Create new
        const pricing = new EquipmentPricing({
          tenantId: req.tenantId,
          category: item.category,
          equipmentType: item.equipmentType,
          manufacturer: item.manufacturer || '',
          model: item.model || '',
          basePrice: item.purchaseInfo.purchasePrice,
          currency: item.purchaseInfo.currency || 'USD',
          source: 'inventory',
          lastUpdated: item.purchaseInfo.purchaseDate || new Date()
        });
        
        await pricing.save();
        imported++;
      }
    }
    
    res.json({
      success: true,
      imported,
      updated,
      total: imported + updated,
      message: `Imported ${imported} new prices, updated ${updated} existing prices`
    });
  } catch (error) {
    console.error('Error importing from inventory:', error);
    res.status(500).json({ 
      error: 'Failed to import from inventory',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/equipment-pricing/:id
 * Delete pricing entry
 */
router.delete('/:id', async (req, res) => {
  try {
    const pricing = await EquipmentPricing.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!pricing) {
      return res.status(404).json({ error: 'Pricing entry not found' });
    }
    
    res.json({ success: true, message: 'Pricing entry deleted' });
  } catch (error) {
    console.error('Error deleting pricing:', error);
    res.status(500).json({ error: 'Failed to delete pricing entry' });
  }
});

module.exports = router;
