/**
 * Subcontractor Management API
 * Handles subcontractor CRUD, approval, and payment processing
 */

const express = require('express');
const router = express.Router();
const Subcontractor = require('../models/subcontractor');
const { requireAuth, requireAdmin } = require('../middleware/admin-auth');

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
router.use(requireAuth);

/**
 * GET /api/subcontractors
 * List all subcontractors for tenant
 */
router.get('/', async (req, res) => {
  try {
    const { status, specialization } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (status) query.status = status;
    if (specialization) query.specializations = specialization;
    
    const subcontractors = await Subcontractor.find(query)
      .sort({ companyName: 1 })
      .lean();
    
    res.json(subcontractors);
  } catch (error) {
    console.error('Error fetching subcontractors:', error);
    res.status(500).json({ error: 'Failed to fetch subcontractors' });
  }
});

/**
 * GET /api/subcontractors/:id
 * Get single subcontractor
 */
router.get('/:id', async (req, res) => {
  try {
    const subcontractor = await Subcontractor.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).lean();
    
    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }
    
    res.json(subcontractor);
  } catch (error) {
    console.error('Error fetching subcontractor:', error);
    res.status(500).json({ error: 'Failed to fetch subcontractor' });
  }
});

/**
 * POST /api/subcontractors
 * Create new subcontractor
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      companyName,
      legalName,
      taxId,
      primaryContact,
      billingContact,
      businessType,
      paymentTerms,
      rates,
      insurance,
      certifications,
      specializations
    } = req.body;
    
    if (!companyName || !taxId || !primaryContact?.email || !primaryContact?.phone) {
      return res.status(400).json({
        error: 'Company name, tax ID, and primary contact information are required'
      });
    }
    
    // Check if subcontractor with same tax ID exists
    const existing = await Subcontractor.findOne({
      tenantId: req.tenantId,
      taxId: taxId
    });
    
    if (existing) {
      return res.status(400).json({
        error: 'Subcontractor with this tax ID already exists'
      });
    }
    
    const subcontractor = new Subcontractor({
      tenantId: req.tenantId,
      companyName,
      legalName: legalName || companyName,
      taxId,
      primaryContact,
      billingContact: billingContact || primaryContact,
      businessType,
      paymentTerms: paymentTerms || 'net30',
      rates: rates || {},
      insurance: insurance || {},
      certifications: certifications || [],
      specializations: specializations || [],
      status: 'pending',
      createdBy: req.user.uid
    });
    
    await subcontractor.save();
    
    res.status(201).json(subcontractor);
  } catch (error) {
    console.error('Error creating subcontractor:', error);
    res.status(500).json({ error: 'Failed to create subcontractor', message: error.message });
  }
});

/**
 * PUT /api/subcontractors/:id
 * Update subcontractor
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const subcontractor = await Subcontractor.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }
    
    // Update allowed fields
    const allowedUpdates = [
      'companyName', 'legalName', 'primaryContact', 'billingContact',
      'businessType', 'paymentTerms', 'rates', 'insurance', 'certifications',
      'specializations', 'notes', 'internalNotes'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        subcontractor[field] = req.body[field];
      }
    });
    
    await subcontractor.save();
    
    res.json(subcontractor);
  } catch (error) {
    console.error('Error updating subcontractor:', error);
    res.status(500).json({ error: 'Failed to update subcontractor' });
  }
});

/**
 * POST /api/subcontractors/:id/approve
 * Approve subcontractor (management only)
 */
router.post('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { approvalNotes } = req.body;
    
    const subcontractor = await Subcontractor.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }
    
    // Check insurance is current
    if (!subcontractor.isInsuranceCurrent()) {
      return res.status(400).json({
        error: 'Cannot approve subcontractor with expired insurance',
        expiredInsurance: {
          generalLiability: subcontractor.insurance.generalLiability?.expiryDate < new Date(),
          workersComp: subcontractor.insurance.workersComp?.expiryDate < new Date()
        }
      });
    }
    
    subcontractor.status = 'approved';
    subcontractor.approval = {
      approvedAt: new Date(),
      approvedBy: req.user.uid,
      approvedByName: req.user.email,
      approvalNotes: approvalNotes
    };
    
    await subcontractor.save();
    
    res.json({
      success: true,
      message: 'Subcontractor approved',
      subcontractor
    });
  } catch (error) {
    console.error('Error approving subcontractor:', error);
    res.status(500).json({ error: 'Failed to approve subcontractor' });
  }
});

/**
 * GET /api/subcontractors/:id/expired-items
 * Check for expired certifications and insurance
 */
router.get('/:id/expired-items', async (req, res) => {
  try {
    const subcontractor = await Subcontractor.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }
    
    const expiredCertifications = subcontractor.getExpiredCertifications();
    const expiredInsurance = {
      generalLiability: subcontractor.insurance.generalLiability?.expiryDate < new Date(),
      workersComp: subcontractor.insurance.workersComp?.expiryDate < new Date(),
      autoInsurance: subcontractor.insurance.autoInsurance?.expiryDate < new Date()
    };
    
    res.json({
      expiredCertifications,
      expiredInsurance,
      hasExpiredItems: expiredCertifications.length > 0 || 
                       Object.values(expiredInsurance).some(v => v)
    });
  } catch (error) {
    console.error('Error checking expired items:', error);
    res.status(500).json({ error: 'Failed to check expired items' });
  }
});

/**
 * DELETE /api/subcontractors/:id
 * Delete subcontractor (soft delete - set to inactive)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const subcontractor = await Subcontractor.findOneAndUpdate(
      {
        _id: req.params.id,
        tenantId: req.tenantId
      },
      {
        status: 'inactive'
      },
      { new: true }
    );
    
    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }
    
    res.json({
      success: true,
      message: 'Subcontractor deactivated',
      subcontractor
    });
  } catch (error) {
    console.error('Error deleting subcontractor:', error);
    res.status(500).json({ error: 'Failed to delete subcontractor' });
  }
});

module.exports = router;
