/**
 * Centralized Firebase Admin Configuration
 * Single point of Firebase initialization to prevent conflicts
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  try {
    // Try to load service account key file
    // First check for environment variable, then look for key file in project
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 
                                process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                                path.join(__dirname, '..', 'wisptools-production-firebase-adminsdk.json');
    
    let credential;
    
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      // Use service account file if provided
      const serviceAccount = require(serviceAccountPath);
      credential = admin.credential.cert(serviceAccount);
      console.log('✅ Firebase Admin initialized with service account file:', serviceAccountPath);
    } else {
      // Fall back to application default credentials (for GCE/Cloud Run)
      credential = admin.credential.applicationDefault();
      console.log('✅ Firebase Admin initialized with application default credentials');
    }
    
    admin.initializeApp({
      credential: credential,
      projectId: process.env.FIREBASE_PROJECT_ID || 'wisptools-production'
    });
    
    console.log('✅ Firebase Admin initialized successfully');
    console.log('✅ Firebase Admin project:', admin.app().options.projectId);
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
    // Don't exit process, let individual modules handle the error
  }
}

// Export Firebase services
module.exports = {
  admin,
  auth: admin.auth(),
  firestore: admin.firestore(),
  isInitialized: admin.apps.length > 0
};