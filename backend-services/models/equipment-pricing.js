/**
 * Equipment Pricing Database
 * Stores pricing information for equipment types to improve cost estimation accuracy
 */

const mongoose = require('mongoose');

const EquipmentPricingSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  equipmentType: {
    type: String,
    required: true,
    index: true
  },
  manufacturer: {
    type: String,
    default: ''
  },
  model: {
    type: String,
    default: ''
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  source: {
    type: String,
    enum: ['manual', 'inventory', 'vendor'],
    default: 'manual'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  vendorUrl: String,
  notes: String,
  // For bulk pricing
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  unitPrice: {
    type: Number,
    default: function() {
      return this.basePrice / this.quantity;
    }
  }
}, {
  timestamps: true
});

// Index for fast lookups
EquipmentPricingSchema.index({ tenantId: 1, category: 1, equipmentType: 1 });
EquipmentPricingSchema.index({ tenantId: 1, manufacturer: 1, model: 1 });

module.exports = mongoose.model('EquipmentPricing', EquipmentPricingSchema);
