/**
 * Centralized Firebase Admin Configuration
 * Single point of Firebase initialization to prevent conflicts
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('✅ Firebase Admin initialized successfully');
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