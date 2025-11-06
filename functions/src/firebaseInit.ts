// Shared Firebase Admin initialization
// Import this module first in all functions that need Firestore

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import { FUNCTIONS_CONFIG } from './config.js';

// Initialize Firebase Admin once
if (getApps().length === 0) {
  try {
    // Try to load service account key file
    const serviceAccountPath = FUNCTIONS_CONFIG.firebase.serviceAccountPath;
    
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      // Use service account file if provided
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || FUNCTIONS_CONFIG.firebase.projectId
      });
      console.log('✅ Firebase Admin initialized with service account file:', serviceAccountPath);
    } else {
      // Fall back to application default credentials (for Firebase Functions)
      initializeApp();
      console.log('✅ Firebase Admin initialized with application default credentials');
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
    // Still try to initialize with defaults
    initializeApp();
  }
}

// Export getFirestore and getAuth for use in other modules
export const db = getFirestore();
export const auth = getAuth();

