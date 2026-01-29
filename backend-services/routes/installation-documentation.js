/**
 * Installation Documentation API
 * Handles documentation upload, photos, approval workflow, and payment approval
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const InstallationDocumentation = require('../models/installation-documentation');
const { WorkOrder } = require('../models/work-order');
const Subcontractor = require('../models/subcontractor');
const { requireAuth, requireAdmin } = require('../middleware/admin-auth');

// Configure multer for file uploads (photos)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max per file
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

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
 * GET /api/installation-documentation
 * List all installation documentation for tenant
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { approvalStatus, siteId, workOrderId, installationType } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (approvalStatus) query.approvalStatus = approvalStatus;
    if (siteId) query.siteId = siteId;
    if (workOrderId) query.workOrderId = workOrderId;
    if (installationType) query.installationType = installationType;
    
    const docs = await InstallationDocumentation.find(query)
      .populate('workOrderId', 'ticketNumber title status')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json(docs);
  } catch (error) {
    console.error('Error fetching installation documentation:', error);
    res.status(500).json({ error: 'Failed to fetch documentation' });
  }
});

/**
 * GET /api/installation-documentation/:id
 * Get single installation documentation
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const doc = await InstallationDocumentation.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    })
      .populate('workOrderId')
      .lean();
    
    if (!doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }
    
    res.json(doc);
  } catch (error) {
    console.error('Error fetching documentation:', error);
    res.status(500).json({ error: 'Failed to fetch documentation' });
  }
});

/**
 * POST /api/installation-documentation
 * Create new installation documentation entry
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      workOrderId,
      installationType,
      siteId,
      siteName,
      location,
      installationDate,
      isSubcontractor,
      subcontractorId,
      requiredPhotos
    } = req.body;
    
    if (!installationType || !siteId) {
      return res.status(400).json({ 
        error: 'installationType and siteId are required' 
      });
    }
    
    // If subcontractor, verify they exist and are approved
    let subcontractor = null;
    if (isSubcontractor && subcontractorId) {
      subcontractor = await Subcontractor.findOne({
        _id: subcontractorId,
        tenantId: req.tenantId,
        status: { $in: ['approved', 'active'] }
      }).lean();
      
      if (!subcontractor) {
        return res.status(400).json({ 
          error: 'Subcontractor not found or not approved' 
        });
      }
    }
    
    const documentation = new InstallationDocumentation({
      tenantId: req.tenantId,
      workOrderId,
      installationType,
      siteId,
      siteName,
      location,
      installationDate: installationDate ? new Date(installationDate) : new Date(),
      installedBy: req.user.uid,
      installedByName: req.user.email,
      isSubcontractor: isSubcontractor || false,
      subcontractor: subcontractor ? {
        subcontractorId: subcontractor._id.toString(),
        companyName: subcontractor.companyName,
        contactName: subcontractor.primaryContact?.name,
        email: subcontractor.primaryContact?.email,
        phone: subcontractor.primaryContact?.phone,
        taxId: subcontractor.taxId,
        paymentTerms: subcontractor.paymentTerms || 'net30',
        status: subcontractor.status
      } : undefined,
      requiredPhotos: requiredPhotos || { minCount: 3 },
      approvalStatus: 'pending',
      createdBy: req.user.uid,
      // Set payment approval required if subcontractor
      paymentApproval: {
        required: isSubcontractor && subcontractor ? true : false,
        status: isSubcontractor && subcontractor ? 'pending-documentation' : 'not-required'
      }
    });
    
    await documentation.save();
    
    res.status(201).json(documentation);
  } catch (error) {
    console.error('Error creating documentation:', error);
    res.status(500).json({ error: 'Failed to create documentation', message: error.message });
  }
});

/**
 * POST /api/installation-documentation/:id/photos
 * Upload photos for installation documentation
 */
router.post('/:id/photos', requireAuth, upload.array('photos', 20), async (req, res) => {
  try {
    const doc = await InstallationDocumentation.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }
    
    // Upload photos to Firebase Storage
    const { admin } = require('../config/firebase');
    const bucket = admin.storage().bucket();
    const uploadedPhotos = [];
    
    for (const file of req.files) {
      const timestamp = Date.now();
      const filename = `installations/${req.tenantId}/${req.params.id}/photo-${timestamp}-${file.originalname}`;
      const fileUpload = bucket.file(filename);
      
      // Upload file
      await fileUpload.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            uploadedBy: req.user.uid,
            uploadedByName: req.user.email,
            installationDocId: req.params.id
          }
        }
      });
      
      // Make file publicly readable (or generate signed URL for private)
      await fileUpload.makePublic();
      
      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
      
      // Create thumbnail (simplified - in production, use image processing library)
      // Thumbnail: use same URL for now (storage resize URLs could be added later)
      const thumbnailUrl = publicUrl;
      
      const photo = {
        url: publicUrl,
        thumbnailUrl: thumbnailUrl,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date(),
        uploadedBy: req.user.uid,
        uploadedByName: req.user.email,
        description: req.body[`description_${file.originalname}`] || '',
        category: req.body[`category_${file.originalname}`] || 'other',
        location: req.body.location ? JSON.parse(req.body.location) : undefined
      };
      
      doc.photos.push(photo);
      uploadedPhotos.push(photo);
    }
    
    doc.photoCount = doc.photos.length;
    await doc.save();
    
    res.json({
      success: true,
      message: `Uploaded ${uploadedPhotos.length} photos`,
      photos: uploadedPhotos,
      totalPhotos: doc.photoCount
    });
  } catch (error) {
    console.error('Error uploading photos:', error);
    res.status(500).json({ error: 'Failed to upload photos', message: error.message });
  }
});

/**
 * PUT /api/installation-documentation/:id
 * Update installation documentation
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const doc = await InstallationDocumentation.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }
    
    // Update documentation fields
    const {
      documentation,
      installationDate,
      location,
      notes
    } = req.body;
    
    if (documentation) doc.documentation = { ...doc.documentation, ...documentation };
    if (installationDate) doc.installationDate = new Date(installationDate);
    if (location) doc.location = { ...doc.location, ...location };
    if (notes) doc.documentation.notes = notes;
    
    await doc.save();
    
    res.json(doc);
  } catch (error) {
    console.error('Error updating documentation:', error);
    res.status(500).json({ error: 'Failed to update documentation' });
  }
});

/**
 * POST /api/installation-documentation/:id/submit
 * Submit documentation for management approval
 */
router.post('/:id/submit', requireAuth, async (req, res) => {
  try {
    const doc = await InstallationDocumentation.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }
    
    // Check if documentation is complete
    const minPhotos = doc.requiredPhotos?.minCount || 3;
    if (doc.photos.length < minPhotos) {
      return res.status(400).json({
        error: 'Incomplete documentation',
        message: `At least ${minPhotos} photos are required. Currently have ${doc.photos.length}.`
      });
    }
    
    if (!doc.documentation?.equipmentList || doc.documentation.equipmentList.length === 0) {
      return res.status(400).json({
        error: 'Incomplete documentation',
        message: 'Equipment list is required'
      });
    }
    
    // Submit for approval
    doc.approvalStatus = 'submitted';
    doc.submittedAt = new Date();
    doc.submittedBy = req.user.uid;
    
    // If subcontractor and payment approval required, update status
    if (doc.paymentApproval.required) {
      doc.paymentApproval.status = 'documentation-complete';
    }
    
    await doc.save();

    try {
      const { firestore, admin } = require('../config/firebase');
      if (firestore && admin) {
        const { UserTenant } = require('../models/user');
        const admins = await UserTenant.find({ tenantId: req.tenantId, role: { $in: ['owner', 'admin'] } }).lean();
        for (const u of admins) {
          await firestore.collection('notifications').add({
            userId: u.userId,
            tenantId: req.tenantId,
            type: 'installation_doc_submitted',
            title: 'Installation documentation submitted',
            message: `Documentation for ${doc.customerName || doc.siteName || 'site'} is ready for review.`,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            data: { docId: doc._id.toString(), tenantId: req.tenantId }
          });
        }
      }
    } catch (notifErr) {
      console.warn('[InstallationDoc] Notification failed:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Documentation submitted for approval',
      documentation: doc
    });
  } catch (error) {
    console.error('Error submitting documentation:', error);
    res.status(500).json({ error: 'Failed to submit documentation' });
  }
});

/**
 * POST /api/installation-documentation/:id/approve
 * Approve installation documentation (management only)
 */
router.post('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { approvalNotes, rejected, rejectionReason } = req.body;
    
    const doc = await InstallationDocumentation.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }
    
    if (doc.approvalStatus !== 'submitted' && doc.approvalStatus !== 'under-review') {
      return res.status(400).json({
        error: 'Documentation not in reviewable status',
        currentStatus: doc.approvalStatus
      });
    }
    
    if (rejected) {
      doc.approvalStatus = 'rejected';
      doc.approval = {
        approvedAt: new Date(),
        approvedBy: req.user.uid,
        approvedByName: req.user.email,
        approvedByRole: req.user.role,
        rejectionReason: rejectionReason || 'Not specified'
      };
    } else {
      doc.approvalStatus = 'approved';
      doc.approval = {
        approvedAt: new Date(),
        approvedBy: req.user.uid,
        approvedByName: req.user.email,
        approvedByRole: req.user.role,
        approvalNotes: approvalNotes
      };
      doc.completedAt = new Date();
      
      // If subcontractor, payment approval can now proceed
      if (doc.paymentApproval.required && doc.paymentApproval.status === 'documentation-complete') {
        // Payment approval still needs separate approval, but documentation is done
      }
    }
    
    await doc.save();

    try {
      const { firestore, admin } = require('../config/firebase');
      if (firestore && admin && !rejected && doc.uploadedBy) {
        await firestore.collection('notifications').add({
          userId: doc.uploadedBy,
          tenantId: req.tenantId,
          type: 'installation_doc_approved',
          title: 'Installation documentation approved',
          message: `Your documentation for ${doc.customerName || doc.siteName || 'site'} has been approved.`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: { docId: doc._id.toString(), tenantId: req.tenantId }
        });
      }
    } catch (notifErr) {
      console.warn('[InstallationDoc] Notification failed:', notifErr.message);
    }

    res.json({
      success: true,
      message: rejected ? 'Documentation rejected' : 'Documentation approved',
      documentation: doc
    });
  } catch (error) {
    console.error('Error approving documentation:', error);
    res.status(500).json({ error: 'Failed to approve documentation' });
  }
});

/**
 * POST /api/installation-documentation/:id/payment-approve
 * Approve payment for subcontractor (finance/management)
 */
router.post('/:id/payment-approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      approvedAmount,
      invoiceNumber,
      invoiceDate,
      invoiceUrl,
      paymentMethod,
      paymentNotes
    } = req.body;
    
    const doc = await InstallationDocumentation.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }
    
    if (!doc.paymentApproval.required) {
      return res.status(400).json({ error: 'Payment approval not required for this installation' });
    }
    
    if (doc.approvalStatus !== 'approved') {
      return res.status(400).json({
        error: 'Installation must be approved before payment can be approved',
        currentStatus: doc.approvalStatus
      });
    }
    
    if (doc.paymentApproval.status !== 'documentation-complete') {
      return res.status(400).json({
        error: 'Payment documentation not complete',
        currentStatus: doc.paymentApproval.status
      });
    }
    
    // Approve payment
    doc.paymentApproval.status = 'approved';
    doc.paymentApproval.approvedAmount = approvedAmount || doc.paymentApproval.requestedAmount;
    doc.paymentApproval.invoiceNumber = invoiceNumber;
    doc.paymentApproval.invoiceDate = invoiceDate ? new Date(invoiceDate) : new Date();
    doc.paymentApproval.invoiceUrl = invoiceUrl;
    doc.paymentApproval.approvedAt = new Date();
    doc.paymentApproval.approvedBy = req.user.uid;
    doc.paymentApproval.approvedByName = req.user.email;
    doc.paymentApproval.paymentMethod = paymentMethod;
    doc.paymentApproval.paymentNotes = paymentNotes;
    
    await doc.save();
    
    // TODO: Create payment record, send to accounting system
    
    res.json({
      success: true,
      message: 'Payment approved',
      paymentApproval: doc.paymentApproval
    });
  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

/**
 * DELETE /api/installation-documentation/:id/photos/:photoId
 * Delete a photo from documentation
 */
router.delete('/:id/photos/:photoId', requireAuth, async (req, res) => {
  try {
    const doc = await InstallationDocumentation.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    });
    
    if (!doc) {
      return res.status(404).json({ error: 'Documentation not found' });
    }
    
    // Only allow deletion if not yet submitted/approved
    if (doc.approvalStatus !== 'pending') {
      return res.status(400).json({
        error: 'Cannot delete photos from submitted or approved documentation'
      });
    }
    
    const photo = doc.photos.id(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Delete from Firebase Storage
    try {
      const { admin } = require('../config/firebase');
      const bucket = admin.storage().bucket();
      // Extract filename from URL
      const urlParts = photo.url.split('/');
      const filename = urlParts.slice(urlParts.indexOf('installations')).join('/');
      await bucket.file(filename).delete();
    } catch (storageError) {
      console.warn('Error deleting photo from storage:', storageError);
      // Continue with DB deletion even if storage deletion fails
    }
    
    photo.remove();
    doc.photoCount = doc.photos.length;
    await doc.save();
    
    res.json({
      success: true,
      message: 'Photo deleted',
      remainingPhotos: doc.photoCount
    });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
