// Notifications API
// Handles notifications for field techs when projects are approved

const express = require('express');
const router = express.Router();
const { admin, auth, firestore } = require('../config/firebase');

// Optional auth: set req.user when token valid, otherwise req.user = null (never reject for GET / and GET /count)
const optionalAuth = async (req, res, next) => {
  req.tenantId = req.headers['x-tenant-id'] || null;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token, true);
    req.user = decoded;
  } catch (_) {
    req.user = null;
  }
  next();
};

router.use(optionalAuth);

/**
 * Create notification for project approval
 * Called automatically when a plan is approved
 */
async function createProjectApprovalNotification(planId, planName, tenantId, approvedBy) {
  if (!firestore) {
    console.warn('Firestore not available - skipping notification');
    return;
  }

  try {
    // Get all users in the tenant (field techs)
    const { UserTenant } = require('../models/user');
    const tenantUsers = await UserTenant.find({ tenantId }).lean();
    
    if (tenantUsers.length === 0) {
      console.log(`No users found for tenant ${tenantId} - skipping notifications`);
      return;
    }
    
    // Create notifications for each user
    const batch = firestore.batch();
    
    tenantUsers.forEach(userTenant => {
      const notificationRef = firestore.collection('notifications').doc();
      batch.set(notificationRef, {
        userId: userTenant.userId,
        tenantId: tenantId,
        type: 'project_approved',
        projectId: planId,
        title: `Project Approved: ${planName}`,
        message: `Project "${planName}" has been approved for deployment and is ready for field work.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: {
          projectName: planName,
          projectId: planId,
          approvedBy: approvedBy,
          tenantId: tenantId
        }
      });
    });

    await batch.commit();
    console.log(`✅ Created ${tenantUsers.length} notifications for project approval: ${planId}`);
  } catch (error) {
    console.error('Error creating project approval notifications:', error);
    // Don't throw - notification failure shouldn't block approval
  }
}

/**
 * GET /api/notifications - Get user notifications (recent, read and unread)
 * Returns [] when unauthenticated so clients avoid 400s (e.g. pre-auth or proxy dropping headers).
 */
router.get('/', async (req, res) => {
  try {
    if (!firestore) {
      return res.status(503).json({ error: 'Notifications service unavailable' });
    }

    const userId = req.user?.uid;
    if (!userId) {
      return res.json([]);
    }

    const notificationsRef = firestore.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50);

    const snapshot = await notificationsRef.get();
    const list = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : (d.createdAt ? new Date(d.createdAt) : new Date())
      };
    });

    res.json(list);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications', message: error.message });
  }
});

/**
 * PUT /api/notifications/:id/read - Mark notification as read
 */
router.put('/:id/read', async (req, res) => {
  try {
    if (!firestore) {
      return res.status(503).json({ error: 'Notifications service unavailable' });
    }

    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const notificationRef = firestore.collection('notifications').doc(req.params.id);
    const notification = await notificationRef.get();

    if (!notification.exists) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.data().userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await notificationRef.update({
      read: true,
      readAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read', message: error.message });
  }
});

/**
 * GET /api/notifications/count - Get unread notification count
 * Returns 0 when unauthenticated so clients avoid 400s (e.g. pre-auth or proxy dropping headers).
 */
router.get('/count', async (req, res) => {
  try {
    if (!firestore) {
      return res.json({ count: 0 });
    }

    const userId = req.user?.uid;
    if (!userId) {
      return res.json({ count: 0 });
    }

    const snapshot = await firestore.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    res.json({ count: snapshot.size });
  } catch (error) {
    console.error('Error getting notification count:', error);
    res.json({ count: 0 });
  }
});

module.exports = router;
module.exports.createProjectApprovalNotification = createProjectApprovalNotification;

