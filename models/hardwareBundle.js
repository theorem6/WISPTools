// Hardware Bundle Schema
// Allows customers to create bundles of hardware for easy planning and deployment

const mongoose = require('mongoose');

// Bundle Item Schema (embedded)
const BundleItemSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'EPC Equipment',
      'Radio Equipment',
      'Antennas',
      'Power Systems',
      'Networking Equipment',
      'Transmission Equipment',
      'Environmental Control',
      'Monitoring & Control',
      'Structural & Housing',
      'Test Equipment',
      'CPE Devices',
      'SIM Cards',
      'Cables & Accessories',
      'Tools',
      'Spare Parts',
      'Other'
    ]
  },
  equipmentType: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  manufacturer: String,
  model: String,
  notes: String,
  // Optional: Link to specific inventory item template
  inventoryTemplateId: mongoose.Schema.Types.ObjectId,
  // Estimated cost per unit
  estimatedCost: Number,
  // Custom specifications for this bundle item
  specifications: mongoose.Schema.Types.Mixed
}, { _id: true });

// Main Bundle Schema
const HardwareBundleSchema = new mongoose.Schema({
  // Tenant
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  
  // Bundle Type
  bundleType: {
    type: String,
    enum: ['standard', 'custom', 'site-deployment', 'cpe-installation', 'maintenance-kit', 'emergency-kit'],
    default: 'standard'
  },
  
  // Bundle Items
  items: [BundleItemSchema],
  
  // Total estimated cost
  estimatedTotalCost: Number,
  
  // Tags for categorization
  tags: [String],
  
  // Status
  status: {
    type: String,
    enum: ['active', 'archived', 'draft'],
    default: 'active'
  },
  
  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: Date,
  
  // Images/Documentation
  images: [{
    url: String,
    caption: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Notes
  notes: String,
  
  // Metadata
  createdBy: String,
  createdById: String,
  updatedBy: String,
  updatedById: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ============================================================================
// INDEXES
// ============================================================================
HardwareBundleSchema.index({ tenantId: 1, status: 1 });
HardwareBundleSchema.index({ tenantId: 1, bundleType: 1 });
HardwareBundleSchema.index({ tenantId: 1, name: 'text', description: 'text' });

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Update timestamp on save
HardwareBundleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate total estimated cost
  if (this.items && this.items.length > 0) {
    this.estimatedTotalCost = this.items.reduce((total, item) => {
      const itemCost = (item.estimatedCost || 0) * (item.quantity || 1);
      return total + itemCost;
    }, 0);
  } else {
    this.estimatedTotalCost = 0;
  }
  
  next();
});

// ============================================================================
// METHODS
// ============================================================================

// Increment usage count
HardwareBundleSchema.methods.incrementUsage = function() {
  this.usageCount = (this.usageCount || 0) + 1;
  this.lastUsedAt = new Date();
  return this.save();
};

// Add item to bundle
HardwareBundleSchema.methods.addItem = function(itemData) {
  this.items.push(itemData);
  return this.save();
};

// Remove item from bundle
HardwareBundleSchema.methods.removeItem = function(itemId) {
  this.items = this.items.filter(item => item._id.toString() !== itemId.toString());
  return this.save();
};

// Update item in bundle
HardwareBundleSchema.methods.updateItem = function(itemId, updates) {
  const item = this.items.id(itemId);
  if (item) {
    Object.assign(item, updates);
    return this.save();
  }
  throw new Error('Item not found in bundle');
};

// ============================================================================
// STATICS
// ============================================================================

// Get bundles by type
HardwareBundleSchema.statics.getByType = function(tenantId, bundleType) {
  return this.find({ tenantId, bundleType, status: 'active' }).sort({ name: 1 });
};

// Search bundles
HardwareBundleSchema.statics.search = function(tenantId, query) {
  return this.find({
    tenantId,
    status: 'active',
    $text: { $search: query }
  }).sort({ score: { $meta: 'textScore' } });
};

// ============================================================================
// MODEL
// ============================================================================
const HardwareBundle = mongoose.model('HardwareBundle', HardwareBundleSchema);

module.exports = {
  HardwareBundle,
  HardwareBundleSchema
};

