// Shared Firebase Admin initialization
// Import this module first in all functions that need Firestore

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin once
if (getApps().length === 0) {
  initializeApp();
}

// Export getFirestore and getAuth for use in other modules
export const db = getFirestore();
export const auth = getAuth();

