// Shared Firebase Admin initialization
// Import this module first in all functions that need Firestore

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin once
if (getApps().length === 0) {
  initializeApp();
}

// Export getFirestore for use in other modules
export const db = getFirestore();

