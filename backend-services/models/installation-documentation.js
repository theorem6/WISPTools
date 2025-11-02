/**
 * Installation Documentation Schema
 * Tracks all documentation including photos for installations (towers, equipment, etc.)
 * Requires management approval before completion
 */

const mongoose = require('mongoose');

const PhotoSchema = new mongoose.Schema({
  url: { type: String, required: true }, // Storage URL (Firebase Storage, S3, etc.)
  thumbnailUrl: String, // Thumbnail for faster loading
  filename: String,
  size: Number, // Bytes
  mimeType: { type: String, default: 'image/jpeg' },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: String, // User ID
  uploadedByName: String,
  description: String,
  category: {
    type: String,
    enum: [
      'before',        // Before installation
      'during',        // During installation process
      'after',         // After completion
      'equipment',     // Equipment documentation
      'safety',        // Safety compliance
      'compliance',    // Regulatory compliance
      'location',      // Site location/access
      'testing',       // Testing/verification
      'other'
    ],
    default: 'other'
  },
  tags: [String],
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  }
}, { _id: true });

const SubcontractorSchema = new mongoose.Schema({
  subcontractorId: { type: String, required: true, index: true },
  companyName: { type: String, required: true },
  contactName: String,
  email: String,
  phone: String,
  taxId: String, // Tax ID or EIN for payment processing
  paymentTerms: {
    type: String,
    enum: ['net30', 'net45', 'net60', 'on-completion', 'milestone'],
    default: 'net30'
  },
  hourlyRate: Number,
  flatRate: Number,
  status: {
    type: String,
    enum: ['pending', 'approved', 'active', 'inactive'],
    default: 'pending'
  },
  insuranceInfo: {
    provider: String,
    policyNumber: String,
    expiryDate: Date,
    certificateUrl: String
  },
  certifications: [{
    type: String, // e.g., "OSHA 30", "Tower Climbing Certified"
    issuedBy: String,
    expiryDate: Date
  }],
  notes: String
}, { _id: true });

const InstallationDocumentationSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  
  // Link to work order or installation project
  workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', index: true },
  installationType: {
    type: String,
    enum: ['tower', 'equipment', 'cpe', 'sector', 'backhaul', 'power', 'fiber', 'other'],
    required: true
  },
  
  // Site Information
  siteId: String,
  siteName: String,
  location: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Installation Details
  installationDate: Date,
  installedBy: String, // User ID or subcontractor ID
  installedByName: String,
  isSubcontractor: { type: Boolean, default: false },
  subcontractor: SubcontractorSchema,
  
  // Documentation Requirements
  requiredPhotos: {
    minCount: { type: Number, default: 3 },
    requiredCategories: [String] // ['before', 'during', 'after', 'equipment']
  },
  
  // Photos Collection
  photos: [PhotoSchema],
  photoCount: { type: Number, default: 0 },
  
  // Documentation Fields
  documentation: {
    equipmentList: [{
      equipmentId: String,
      serialNumber: String,
      manufacturer: String,
      model: String,
      installationLocation: String, // "Tower - Sector 1", "Ground - Shelter"
      installationNotes: String
    }],
    technicalSpecs: {
      frequency: String,
      powerOutput: String,
      antennaGain: String,
      azimuth: Number,
      elevation: Number,
      cableLength: Number,
      cableType: String
    },
    safetyCompliance: {
      safetyBriefingCompleted: Boolean,
      ppeUsed: [String], // ['hard-hat', 'harness', 'safety-glasses']
      safetyInspector: String,
      inspectionDate: Date,
      complianceNotes: String
    },
    testingResults: {
      testedBy: String,
      testDate: Date,
      signalStrength: Number,
      snr: Number,
      throughput: Number,
      passed: Boolean,
      testNotes: String
    },
    notes: String,
    issuesEncountered: [{
      description: String,
      severity: { type: String, enum: ['low', 'medium', 'high'] },
      resolved: Boolean,
      resolutionNotes: String
    }]
  },
  
  // Approval Workflow
  approvalStatus: {
    type: String,
    enum: ['pending', 'submitted', 'under-review', 'approved', 'rejected', 'requires-revision'],
    default: 'pending',
    index: true
  },
  submittedAt: Date,
  submittedBy: String, // User ID
  
  // Management Approval
  approval: {
    approvedAt: Date,
    approvedBy: String, // User ID (management)
    approvedByName: String,
    approvedByRole: String, // 'manager', 'admin', 'owner'
    approvalNotes: String,
    rejectionReason: String
  },
  
  // Payment Approval (for subcontractors)
  paymentApproval: {
    required: { type: Boolean, default: false }, // true if subcontractor involved
    status: {
      type: String,
      enum: ['not-required', 'pending-documentation', 'documentation-complete', 'approved', 'paid', 'rejected'],
      default: 'not-required'
    },
    requestedAmount: Number,
    approvedAmount: Number,
    invoiceNumber: String,
    invoiceDate: Date,
    invoiceUrl: String, // Link to invoice document
    approvedAt: Date,
    approvedBy: String, // User ID (finance/management)
    approvedByName: String,
    paymentMethod: {
      type: String,
      enum: ['check', 'ach', 'wire', 'credit-card', 'other']
    },
    paymentDate: Date,
    paymentNotes: String
  },
  
  // Quality Assurance
  qaReview: {
    reviewedAt: Date,
    reviewedBy: String,
    reviewedByName: String,
    passed: Boolean,
    issues: [String],
    qaNotes: String
  },
  
  // Metadata
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: Date
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Indexes for efficient queries
InstallationDocumentationSchema.index({ tenantId: 1, approvalStatus: 1 });
InstallationDocumentationSchema.index({ workOrderId: 1 });
InstallationDocumentationSchema.index({ siteId: 1 });
InstallationDocumentationSchema.index({ installedBy: 1 });
InstallationDocumentationSchema.index({ 'paymentApproval.status': 1 });
InstallationDocumentationSchema.index({ 'subcontractor.subcontractorId': 1 });

// Virtual for checking if documentation is complete
InstallationDocumentationSchema.virtual('isComplete').get(function() {
  return this.photos.length >= (this.requiredPhotos?.minCount || 3) &&
         this.documentation?.equipmentList?.length > 0 &&
         this.approvalStatus === 'approved';
});

// Method to check if payment approval is required
InstallationDocumentationSchema.methods.requiresPaymentApproval = function() {
  return this.isSubcontractor && 
         this.approvalStatus === 'approved' &&
         this.paymentApproval.required;
};

module.exports = mongoose.model('InstallationDocumentation', InstallationDocumentationSchema);
