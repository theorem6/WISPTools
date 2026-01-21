/**
 * Mobile App Status Routes
 * Get mobile app installation and activity status for users
 */

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (error) {
    console.error('Firebase Admin already initialized or error:', error);
  }
}

const db = admin.firestore();

/**
 * GET /api/users/:tenantId/mobile-status
 * Get mobile app status for all users in a tenant
 */
router.get('/:tenantId/mobile-status', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { UserTenant } = require('../../models/user-tenant');
    
    // Get all users in tenant
    const userTenants = await UserTenant.find({ tenantId, status: 'active' }).lean();
    
    const usersWithMobileStatus = [];
    
    for (const userTenant of userTenants) {
      try {
        // Get user's FCM tokens from Firestore
        const userDoc = await db.collection('users').doc(userTenant.userId).get();
        const userData = userDoc.data();
        
        const fcmTokens = userData?.fcmTokens || {};
        const hasMobileApp = Object.keys(fcmTokens).length > 0;
        
        // Calculate last active time from FCM tokens
        let lastActive = null;
        let status = 'offline';
        
        if (hasMobileApp) {
          const tokenEntries = Object.values(fcmTokens);
          const lastActiveTimes = tokenEntries
            .map((token: any) => token.lastActive?.toDate?.() || null)
            .filter(Boolean)
            .sort((a, b) => b.getTime() - a.getTime());
          
          if (lastActiveTimes.length > 0) {
            lastActive = lastActiveTimes[0];
            const minutesAgo = (Date.now() - lastActive.getTime()) / (1000 * 60);
            
            if (minutesAgo < 5) {
              status = 'online';
            } else if (minutesAgo < 60) {
              status = 'away';
            }
          }
        }
        
        // Get user details from Firebase Auth
        let userEmail = '';
        let userName = '';
        try {
          const authUser = await admin.auth().getUser(userTenant.userId);
          userEmail = authUser.email || '';
          userName = authUser.displayName || authUser.email || '';
        } catch (authError) {
          console.error(`Error getting auth user ${userTenant.userId}:`, authError);
        }
        
        usersWithMobileStatus.push({
          userId: userTenant.userId,
          email: userEmail,
          name: userName,
          role: userTenant.role,
          mobileApp: {
            installed: hasMobileApp,
            lastActive: lastActive?.toISOString() || null,
            fcmTokens: Object.keys(fcmTokens).length,
            status: status,
            version: userData?.mobileApp?.version || null
          }
        });
      } catch (error) {
        console.error(`Error processing user ${userTenant.userId}:`, error);
        // Continue with other users even if one fails
      }
    }
    
    res.json({
      users: usersWithMobileStatus,
      summary: {
        total: usersWithMobileStatus.length,
        withMobileApp: usersWithMobileStatus.filter(u => u.mobileApp.installed).length,
        online: usersWithMobileStatus.filter(u => u.mobileApp.status === 'online').length
      }
    });
  } catch (error) {
    console.error('Error fetching mobile status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch mobile status', 
      message: error.message 
    });
  }
});

/**
 * GET /api/users/:userId/mobile-status
 * Get mobile app status for a specific user
 */
router.get('/:userId/mobile-status', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's FCM tokens from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const fcmTokens = userData?.fcmTokens || {};
    const hasMobileApp = Object.keys(fcmTokens).length > 0;
    
    // Calculate last active time
    let lastActive = null;
    let status = 'offline';
    
    if (hasMobileApp) {
      const tokenEntries = Object.values(fcmTokens);
      const lastActiveTimes = tokenEntries
        .map((token: any) => token.lastActive?.toDate?.() || null)
        .filter(Boolean)
        .sort((a, b) => b.getTime() - a.getTime());
      
      if (lastActiveTimes.length > 0) {
        lastActive = lastActiveTimes[0];
        const minutesAgo = (Date.now() - lastActive.getTime()) / (1000 * 60);
        
        if (minutesAgo < 5) {
          status = 'online';
        } else if (minutesAgo < 60) {
          status = 'away';
        }
      }
    }
    
    res.json({
      userId,
      mobileApp: {
        installed: hasMobileApp,
        lastActive: lastActive?.toISOString() || null,
        fcmTokens: Object.keys(fcmTokens).length,
        status: status,
        version: userData?.mobileApp?.version || null
      }
    });
  } catch (error) {
    console.error('Error fetching user mobile status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch mobile status', 
      message: error.message 
    });
  }
});

module.exports = router;
