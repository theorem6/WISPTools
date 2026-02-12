/**
 * Device tags for TR-069/ACS devices.
 * Tags are stored per tenant per device for filtering and grouping in the device list.
 */
const mongoose = require('mongoose');

const deviceTagSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  deviceId: { type: String, required: true, index: true },
  tags: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

deviceTagSchema.index({ tenantId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.models.DeviceTag || mongoose.model('DeviceTag', deviceTagSchema);
