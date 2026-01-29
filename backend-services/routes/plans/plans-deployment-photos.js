/**
 * Plan deployment photo upload & serve.
 * Storage: MongoDB Atlas (GridFS) when possible, Firebase Storage as fallback.
 * GET /api/plans/deployment-photos/:planId/:fileId - serve from GridFS
 * POST /api/plans/mobile/:userId/:planId/deployment/photos - multipart upload (assigned techs only)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { PlanProject } = require('../../models/plan');
const { storePhoto, getPhotoStream } = require('../../services/planDeploymentPhotoStorage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * GET /deployment-photos/:planId/:fileId - Serve photo from GridFS (MongoDB)
 * Path must be registered before /mobile/... so it matches first.
 */
router.get('/deployment-photos/:planId/:fileId', async (req, res) => {
  try {
    const { planId, fileId } = req.params;
    const result = await getPhotoStream(planId, fileId);
    if (!result) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    res.set('Content-Type', result.contentType);
    result.stream.pipe(res);
  } catch (err) {
    console.error('Error serving deployment photo:', err);
    res.status(500).json({ error: 'Failed to serve photo' });
  }
});

/**
 * POST /mobile/:userId/:planId/deployment/photos - Upload photo (assigned techs only)
 * Body: multipart form with field "photo"
 * Returns { url, storage: 'mongodb'|'firebase' }
 */
router.post('/mobile/:userId/:planId/deployment/photos', upload.single('photo'), async (req, res) => {
  try {
    const { userId, planId } = req.params;
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Photo file required' });
    }

    const plan = await PlanProject.findOne({ _id: planId, tenantId: req.tenantId });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    const isAssigned =
      plan.deployment?.assignedTo === userId ||
      (Array.isArray(plan.deployment?.assignedTeam) && plan.deployment.assignedTeam.includes(userId)) ||
      (Array.isArray(plan.deployment?.fieldTechs) && plan.deployment.fieldTechs.some((ft) => ft.userId === userId));
    if (!isAssigned) {
      return res.status(403).json({ error: 'Only assigned techs can upload deployment photos' });
    }

    const baseUrl = process.env.API_BASE_URL || (req.protocol + '://' + req.get('host'));
    const { url, storage } = await storePhoto(
      req.file.buffer,
      req.file.originalname || `photo-${Date.now()}.jpg`,
      { planId, userId, tenantId: req.tenantId },
      baseUrl
    );
    res.status(201).json({ url, storage });
  } catch (err) {
    console.error('Error uploading deployment photo:', err);
    res.status(500).json({ error: 'Failed to upload photo', message: err.message });
  }
});

module.exports = router;
