/**
 * Setup Admin Cloud Function
 * One-time function to set up a user as owner of all their tenants
 * 
 * Call this function once to grant yourself owner access
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const setupAdmin = onRequest(
  {
    region: 'us-central1',
    cors: true
  },
  async (req, res) => {
    try {
      // Verify the request has authorization
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized - Please login first' });
      }

      const token = authHeader.substring(7);
      let decodedToken;
      
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token - Please login again' });
      }

      const userId = decodedToken.uid;
      const userEmail = decodedToken.email;

      console.log(`Setting up admin for user: ${userEmail} (${userId})`);

      // Get all tenants
      const tenantsSnapshot = await admin.firestore().collection('tenants').get();

      if (tenantsSnapshot.empty) {
        return res.status(404).json({ 
          error: 'No tenants found',
          message: 'Please create a tenant from the web app first'
        });
      }

      const results = [];

      // Create user_tenants records for all tenants
      for (const tenantDoc of tenantsSnapshot.docs) {
        const tenantId = tenantDoc.id;
        const tenantData = tenantDoc.data();
        const userTenantId = `${userId}_${tenantId}`;

        // Check if already exists
        const existingDoc = await admin.firestore()
          .collection('user_tenants')
          .doc(userTenantId)
          .get();

        if (existingDoc.exists()) {
          results.push({
            tenantId,
            tenantName: tenantData.name || tenantData.displayName,
            status: 'already_exists',
            role: existingDoc.data()?.role
          });
          continue;
        }

        // Create new user_tenant record
        await admin.firestore()
          .collection('user_tenants')
          .doc(userTenantId)
          .set({
            userId,
            tenantId,
            role: 'owner',
            status: 'active',
            addedAt: admin.firestore.FieldValue.serverTimestamp(),
            invitedBy: userId,
            invitedAt: admin.firestore.FieldValue.serverTimestamp(),
            acceptedAt: admin.firestore.FieldValue.serverTimestamp()
          });

        results.push({
          tenantId,
          tenantName: tenantData.name || tenantData.displayName,
          status: 'created',
          role: 'owner'
        });

        console.log(`Created owner record for tenant: ${tenantData.name || tenantId}`);
      }

      // Update user profile
      await admin.firestore()
        .collection('users')
        .doc(userId)
        .set({
          uid: userId,
          email: userEmail,
          displayName: decodedToken.name || userEmail,
          photoURL: decodedToken.picture || '',
          primaryRole: 'owner',
          isPlatformAdmin: userEmail === 'david@david.com',
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      console.log('User profile updated');

      return res.status(200).json({
        success: true,
        message: `Successfully set up ${userEmail} as owner of ${results.length} tenant(s)`,
        user: {
          email: userEmail,
          userId,
          isPlatformAdmin: userEmail === 'david@david.com'
        },
        tenants: results,
        nextSteps: [
          'Refresh your browser (Ctrl+Shift+R)',
          'User Management and Help Desk modules should now appear',
          'You can now invite other users',
          'Configure module access in Settings'
        ]
      });

    } catch (error: any) {
      console.error('Setup admin error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
);

