// Plan Project Model
// Manages deployment plans and project workflows

const mongoose = require('mongoose');

const PlanProjectSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'ready', 'approved', 'rejected', 'deployed', 'cancelled'],
    default: 'draft'
  },
  // Plan visibility on map
  showOnMap: {
    type: Boolean,
    default: false  // Plans are hidden by default until enabled
  },
  // Approval workflow
  approval: {
    approvedBy: String,
    approvedAt: Date,
    rejectedBy: String,
    rejectedAt: Date,
    rejectionReason: String,  // e.g., "budget", "technical", "timing", etc.
    approvalNotes: String
  },
  
  // Ownership
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdById: String,
  updatedBy: String,
  updatedById: String,
  
  // Project Scope
  scope: {
    towers: [String], // Tower IDs
    sectors: [String], // Sector IDs
    cpeDevices: [String], // CPE IDs
    equipment: [String], // Equipment IDs
    backhauls: [String] // Backhaul IDs
  },
  
  // Hardware Requirements
  hardwareRequirements: {
    existing: [{
      inventoryId: String,
      assetTag: String,
      type: String,
      location: String,
      status: {
        type: String,
        enum: ['available', 'reserved', 'deployed']
      }
    }],
    needed: [{
      category: {
        type: String,
        required: true
      },
      equipmentType: {
        type: String,
        required: true
      },
      manufacturer: String,
      model: String,
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      estimatedCost: Number,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      specifications: {
        power: String,
        frequency: String,
        range: String,
        capacity: String
      }
    }]
  },
  
  // Purchase Planning
  purchasePlan: {
    totalEstimatedCost: {
      type: Number,
      default: 0
    },
    missingHardware: [{
      id: String,
      category: String,
      equipmentType: String,
      manufacturer: String,
      model: String,
      quantity: Number,
      estimatedCost: Number,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      specifications: mongoose.Schema.Types.Mixed,
      reason: String,
      alternatives: [{
        manufacturer: String,
        model: String,
        estimatedCost: Number,
        availability: {
          type: String,
          enum: ['in-stock', 'backorder', 'discontinued']
        }
      }]
    }],
    procurementStatus: {
      type: String,
      enum: ['pending', 'quoted', 'ordered', 'received', 'complete'],
      default: 'pending'
    },
    vendorQuotes: [{
      vendor: String,
      quoteDate: Date,
      totalCost: Number,
      validUntil: Date,
      items: [{
        equipmentType: String,
        quantity: Number,
        unitCost: Number,
        totalCost: Number
      }]
    }]
  },
  
  // Deployment Details
  deployment: {
    estimatedStartDate: Date,
    estimatedEndDate: Date,
    actualStartDate: Date,
    actualEndDate: Date,
    assignedTo: String, // User ID or email
    assignedToName: String, // Display name
    assignedTeam: [String], // Array of user IDs/emails for team assignments
    deploymentStage: {
      type: String,
      enum: ['planning', 'procurement', 'preparation', 'in_progress', 'testing', 'completed', 'on_hold', 'cancelled'],
      default: 'planning'
    },
    fieldTechs: [{
      userId: String,
      email: String,
      name: String,
      assignedAt: Date,
      status: {
        type: String,
        enum: ['assigned', 'in_progress', 'completed', 'blocked'],
        default: 'assigned'
      },
      tasks: [{
        taskId: String,
        description: String,
        status: {
          type: String,
          enum: ['pending', 'in_progress', 'completed', 'blocked'],
          default: 'pending'
        },
        completedAt: Date,
        notes: String
      }]
    }],
    hardwareDeployment: [{
      inventoryId: String,
      assetTag: String,
      equipmentType: String,
      location: {
        siteId: String,
        siteName: String,
        coordinates: {
          lat: Number,
          lng: Number
        }
      },
      deployedBy: String, // User ID
      deployedAt: Date,
      status: {
        type: String,
        enum: ['pending', 'in_transit', 'on_site', 'installed', 'tested', 'completed', 'failed'],
        default: 'pending'
      },
      installationNotes: String,
      photos: [String], // URLs to photos
      testResults: {
        testedAt: Date,
        testedBy: String,
        passed: Boolean,
        notes: String,
        metrics: mongoose.Schema.Types.Mixed
      }
    }],
    documentation: {
      installationPhotos: [String],
      testReports: [String],
      asBuiltDrawings: [String],
      completionCertificate: String,
      notes: String
    },
    milestones: [{
      name: String,
      description: String,
      targetDate: Date,
      completedDate: Date,
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'overdue'],
        default: 'pending'
      }
    }],
    notes: String,
    issues: [{
      reportedBy: String,
      reportedAt: Date,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      description: String,
      status: {
        type: String,
        enum: ['open', 'investigating', 'resolved', 'closed'],
        default: 'open'
      },
      resolvedAt: Date,
      resolvedBy: String,
      resolution: String
    }]
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
PlanProjectSchema.index({ tenantId: 1, status: 1 });
PlanProjectSchema.index({ tenantId: 1, createdBy: 1 });
PlanProjectSchema.index({ tenantId: 1, updatedAt: -1 });

// Pre-save middleware
PlanProjectSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
PlanProjectSchema.methods.addHardwareRequirement = function(requirement) {
  this.hardwareRequirements.needed.push(requirement);
  return this.save();
};

PlanProjectSchema.methods.removeHardwareRequirement = function(requirementIndex) {
  if (requirementIndex >= 0 && requirementIndex < this.hardwareRequirements.needed.length) {
    this.hardwareRequirements.needed.splice(requirementIndex, 1);
    return this.save();
  }
  throw new Error('Invalid requirement index');
};

PlanProjectSchema.methods.markReady = function() {
  this.status = 'ready';
  return this.save();
};

PlanProjectSchema.methods.markDeployed = function() {
  this.status = 'deployed';
  this.deployment.actualStartDate = new Date();
  return this.save();
};

PlanProjectSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

// Static methods
PlanProjectSchema.statics.getByTenant = function(tenantId, status) {
  const query = { tenantId };
  if (status) query.status = status;
  return this.find(query).sort({ updatedAt: -1 });
};

PlanProjectSchema.statics.getReadyPlans = function(tenantId) {
  return this.find({ tenantId, status: 'ready' }).sort({ updatedAt: -1 });
};

PlanProjectSchema.statics.getByCreator = function(tenantId, createdBy) {
  return this.find({ tenantId, createdBy }).sort({ updatedAt: -1 });
};

// Virtual for total hardware count
PlanProjectSchema.virtual('totalHardwareCount').get(function() {
  return this.scope.towers.length + 
         this.scope.sectors.length + 
         this.scope.cpeDevices.length + 
         this.scope.equipment.length + 
         this.scope.backhauls.length;
});

// Virtual for missing hardware count
PlanProjectSchema.virtual('missingHardwareCount').get(function() {
  return this.purchasePlan.missingHardware.length;
});

// Virtual for critical missing hardware count
PlanProjectSchema.virtual('criticalMissingCount').get(function() {
  return this.purchasePlan.missingHardware.filter(item => item.priority === 'critical').length;
});

// Ensure virtual fields are included in JSON output
PlanProjectSchema.set('toJSON', { virtuals: true });

const PlanProject = mongoose.model('PlanProject', PlanProjectSchema);

module.exports = { PlanProject };
