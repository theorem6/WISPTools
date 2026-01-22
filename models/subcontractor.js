/**
 * Subcontractor Schema
 * Manages subcontractor information, certifications, and payment processing
 */

const mongoose = require('mongoose');

const SubcontractorSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  
  // Company Information
  companyName: { type: String, required: true },
  legalName: String, // Legal entity name for contracts
  taxId: { type: String, required: true }, // EIN, SSN, or business tax ID
  dba: String, // "Doing Business As" name
  
  // Contact Information
  primaryContact: {
    name: { type: String, required: true },
    title: String,
    email: { type: String, required: true },
    phone: { type: String, required: true },
    mobile: String
  },
  billingContact: {
    name: String,
    email: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'US' }
    }
  },
  
  // Business Details
  businessType: {
    type: String,
    enum: ['sole-proprietor', 'llc', 'corporation', 'partnership', 'other']
  },
  yearEstablished: Number,
  employeeCount: String, // Range like "1-10", "11-50"
  
  // Payment Information
  paymentTerms: {
    type: String,
    enum: ['net15', 'net30', 'net45', 'net60', 'on-completion', 'milestone', 'custom'],
    default: 'net30'
  },
  paymentMethod: {
    preferred: {
      type: String,
      enum: ['check', 'ach', 'wire', 'credit-card'],
      default: 'ach'
    },
    achDetails: {
      accountType: { type: String, enum: ['checking', 'savings'] },
      routingNumber: String, // Encrypted
      accountNumber: String  // Encrypted
    },
    mailingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String
    }
  },
  
  // Rates and Pricing
  rates: {
    hourly: Number,
    daily: Number,
    towerClimbRate: Number,
    equipmentInstallRate: Number,
    travelRate: Number,
    perMileRate: Number
  },
  
  // Insurance & Certifications
  insurance: {
    generalLiability: {
      provider: String,
      policyNumber: String,
      coverageAmount: Number,
      expiryDate: Date,
      certificateUrl: String
    },
    workersComp: {
      provider: String,
      policyNumber: String,
      coverageAmount: Number,
      expiryDate: Date,
      certificateUrl: String
    },
    autoInsurance: {
      provider: String,
      policyNumber: String,
      coverageAmount: Number,
      expiryDate: Date,
      certificateUrl: String
    }
  },
  
  certifications: [{
    name: String, // "OSHA 30", "Tower Climbing Certified", "FCC License"
    issuedBy: String,
    certificateNumber: String,
    issueDate: Date,
    expiryDate: Date,
    certificateUrl: String,
    verified: { type: Boolean, default: false },
    verifiedBy: String,
    verifiedAt: Date
  }],
  
  // Status & Approval
  status: {
    type: String,
    enum: ['pending', 'under-review', 'approved', 'active', 'suspended', 'inactive'],
    default: 'pending',
    index: true
  },
  approval: {
    approvedAt: Date,
    approvedBy: String, // User ID
    approvedByName: String,
    approvalNotes: String
  },
  
  // Performance Tracking
  performance: {
    totalJobs: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    averageRating: Number, // 1-5 stars
    onTimeCompletionRate: Number, // Percentage
    lastJobDate: Date
  },
  
  // Specializations
  specializations: [{
    type: String,
    enum: [
      'tower-installation',
      'equipment-installation',
      'fiber-optic',
      'wireless-backhaul',
      'power-systems',
      'antenna-rigging',
      'testing-verification',
      'maintenance',
      'other'
    ]
  }],
  
  // Notes & History
  notes: String,
  internalNotes: String, // Not visible to subcontractor
  
  // Metadata
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

// Indexes
SubcontractorSchema.index({ tenantId: 1, status: 1 });
SubcontractorSchema.index({ companyName: 1 });
SubcontractorSchema.index({ taxId: 1 });

// Method to check if insurance is current
SubcontractorSchema.methods.isInsuranceCurrent = function() {
  const now = new Date();
  return (
    (!this.insurance.generalLiability?.expiryDate || this.insurance.generalLiability.expiryDate > now) &&
    (!this.insurance.workersComp?.expiryDate || this.insurance.workersComp.expiryDate > now)
  );
};

// Method to check if certifications are current
SubcontractorSchema.methods.getExpiredCertifications = function() {
  const now = new Date();
  return this.certifications.filter(cert => 
    cert.expiryDate && cert.expiryDate < now
  );
};

module.exports = mongoose.model('Subcontractor', SubcontractorSchema);
