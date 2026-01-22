const mongoose = require('mongoose');

const GeometrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point', 'LineString', 'Polygon'],
      required: true
    },
    coordinates: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  { _id: false }
);

const PlanLayerFeatureSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  planId: {
    type: String,
    required: true,
    index: true
  },
  featureType: {
    type: String,
    enum: ['site', 'sector', 'cpe', 'equipment', 'link', 'note'],
    required: true
  },
  geometry: GeometrySchema,
  properties: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  status: {
    type: String,
    enum: ['draft', 'pending-review', 'approved', 'rejected', 'authorized'],
    default: 'draft'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  originFeatureId: String,
  promotedResourceId: String,
  promotedResourceType: String,
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

PlanLayerFeatureSchema.index({ tenantId: 1, planId: 1, featureType: 1 });
PlanLayerFeatureSchema.index({ tenantId: 1, status: 1 });

PlanLayerFeatureSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

PlanLayerFeatureSchema.statics.findByPlan = function (tenantId, planId) {
  return this.find({ tenantId, planId }).sort({ createdAt: 1 });
};

PlanLayerFeatureSchema.statics.countByPlan = async function (tenantId, planId) {
  const results = await this.aggregate([
    { $match: { tenantId, planId } },
    {
      $group: {
        _id: { featureType: '$featureType', status: '$status' },
        count: { $sum: 1 }
      }
    }
  ]);

  const summary = { total: 0, byType: {}, byStatus: {} };
  for (const row of results) {
    const { featureType, status } = row._id;
    summary.total += row.count;
    summary.byType[featureType] = (summary.byType[featureType] || 0) + row.count;
    summary.byStatus[status] = (summary.byStatus[status] || 0) + row.count;
  }

  return summary;
};

const PlanLayerFeature = mongoose.model('PlanLayerFeature', PlanLayerFeatureSchema);

module.exports = { PlanLayerFeature };


