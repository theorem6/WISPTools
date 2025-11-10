/**
 * Centralized Firebase Admin Configuration
 * Single point of Firebase initialization to prevent conflicts
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const loadServiceAccountFromEnv = () => {
  const jsonString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonString && jsonString.trim().length > 0) {
    console.log('✅ Firebase Admin: Using FIREBASE_SERVICE_ACCOUNT_JSON environment variable');
    return JSON.parse(jsonString);
  }

  const base64String = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64String && base64String.trim().length > 0) {
    console.log('✅ Firebase Admin: Using FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable');
    const decoded = Buffer.from(base64String, 'base64').toString('utf8');
    return JSON.parse(decoded);
  }

  return null;
};

const resolveServiceAccount = () => {
  // Highest priority: JSON/BASE64 env variables
  const envAccount = loadServiceAccountFromEnv();
  if (envAccount) {
    return { source: 'env', account: envAccount };
  }

  // Next: explicit path env variables
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (explicitPath && fs.existsSync(explicitPath)) {
    console.log('✅ Firebase Admin: Using service account file from environment path:', explicitPath);
    return { source: 'file', account: require(explicitPath) };
  }

  // Finally: default location inside repo
  const defaultPath = path.join(__dirname, '..', 'wisptools-production-firebase-adminsdk.json');
  if (fs.existsSync(defaultPath)) {
    console.log('✅ Firebase Admin: Using default service account file:', defaultPath);
    return { source: 'file', account: require(defaultPath) };
  }

  console.warn('⚠️ Firebase Admin: No service account credentials found. Falling back to application default credentials (ADC).');
  return { source: 'adc', account: null };
};

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  try {
    const { source, account } = resolveServiceAccount();

    let credential;
    let resolvedProjectId = process.env.FIREBASE_PROJECT_ID;

    if (source === 'env' || source === 'file') {
      credential = admin.credential.cert(account);
      resolvedProjectId = resolvedProjectId || account.project_id;
    } else {
      credential = admin.credential.applicationDefault();
    }

    if (!resolvedProjectId) {
      resolvedProjectId = 'wisptools-production';
      console.warn('⚠️ Firebase Admin: FIREBASE_PROJECT_ID not set. Defaulting to wisptools-production.');
    }

    admin.initializeApp({
      credential,
      projectId: resolvedProjectId
    });

    console.log('✅ Firebase Admin initialized successfully');
    console.log('✅ Firebase Admin project:', admin.app().options.projectId);
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
    throw error;
  }
}

module.exports = {
  admin,
  auth: admin.auth(),
  firestore: admin.firestore(),
  isInitialized: admin.apps.length > 0
};