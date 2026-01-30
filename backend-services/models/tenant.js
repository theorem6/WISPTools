/**
 * Tenant Schema for MongoDB
 * 
 * Unified tenant management using MongoDB instead of Firestore
 * This ensures consistency with user-tenant associations
 */

const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  // Basic tenant information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  subdomain: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9-]+$/
  },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  
  // Technical configuration
  cwmpUrl: {
    type: String,
    required: true
  },
  
  // Primary location for inventory management
  // References a UnifiedSite (NOC/HQ/Tower/Warehouse)
  primaryLocation: {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UnifiedSite',
      default: null
    },
    siteName: {
      type: String,
      default: null
    }
  },
  
  // Status and metadata
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },
  
  // Settings and limits
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      allowSelfRegistration: false,
      requireEmailVerification: true,
      maxUsers: 50,
      maxDevices: 1000,
      features: {
        acs: true,
        hss: true,
        pci: true,
        helpDesk: true,
        userManagement: true,
        customerManagement: true
      }
    }
  },
  
  limits: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      maxUsers: 50,
      maxDevices: 1000,
      maxNetworks: 10,
      maxTowerSites: 100
    }
  },
  
  // Customer Portal Branding
  branding: {
    // Logo & Visual Identity
    logo: {
      url: { type: String },
      altText: { type: String, default: 'Company Logo' },
      favicon: { type: String }
    },
    
    // Colors
    colors: {
      primary: { type: String, default: '#3b82f6' },
      secondary: { type: String, default: '#64748b' },
      accent: { type: String, default: '#10b981' },
      background: { type: String, default: '#ffffff' },
      text: { type: String, default: '#111827' },
      textSecondary: { type: String, default: '#6b7280' }
    },
    
    // Company Information
    company: {
      name: { type: String },
      displayName: { type: String },
      supportEmail: { type: String },
      supportPhone: { type: String },
      supportHours: { type: String, default: 'Mon-Fri 8am-5pm' },
      website: { type: String },
      address: { type: String }
    },
    
    // Portal Customization
    portal: {
      welcomeMessage: { type: String, default: 'Welcome to our Customer Portal' },
      footerText: { type: String },
      customCSS: { type: String },
      enableCustomDomain: { type: Boolean, default: false },
      customDomain: { type: String },
      portalSubdomain: { type: String }, // Subdomain for portal access
      portalUrl: { type: String } // Full portal URL
    },
    
    // Features
    features: {
      enableFAQ: { type: Boolean, default: true },
      enableServiceStatus: { type: Boolean, default: true },
      enableBilling: { type: Boolean, default: true },
      enableTickets: { type: Boolean, default: true },
      enableLiveChat: { type: Boolean, default: false },
      enableKnowledgeBase: { type: Boolean, default: false }
    },

    // Billing Portal Admin: payment gateways & invoice customization
    billingPortal: {
      paymentGateways: {
        stripe: {
          enabled: { type: Boolean, default: false },
          publicKey: { type: String },
          note: { type: String }
        },
        paypal: {
          enabled: { type: Boolean, default: false },
          clientId: { type: String },
          sandbox: { type: Boolean, default: true },
          note: { type: String }
        }
      },
      invoice: {
        companyName: { type: String },
        logoUrl: { type: String },
        address: { type: String },
        footerText: { type: String },
        termsAndConditions: { type: String },
        dueDays: { type: Number, default: 14 },
        currency: { type: String, default: 'USD' }
      }
    }
  },
  
  // Audit fields
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'tenants'
});

// Indexes for performance
tenantSchema.index({ subdomain: 1 }, { unique: true });
tenantSchema.index({ status: 1 });
tenantSchema.index({ createdBy: 1 });
tenantSchema.index({ createdAt: -1 });

// Update updatedAt on save
tenantSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Soft delete method
tenantSchema.methods.softDelete = function(deletedBy) {
  this.status = 'deleted';
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Restore method
tenantSchema.methods.restore = function() {
  this.status = 'active';
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

const Tenant = mongoose.model('Tenant', tenantSchema);

module.exports = { Tenant };
