import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

// Firebase configuration with fallbacks
// authDomain: Must be the Firebase project's default domain (not custom domain)
// Custom domains work via authorized domains list, but authDomain must be Firebase hosting domain
const getAuthDomain = (): string => {
  // Check if we have an explicit authDomain override
  if (env.PUBLIC_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) {
    return env.PUBLIC_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  }
  
  // Use Firebase project's default domain (required for OAuth redirect URIs)
  // wisptools.io is added to authorized domains, but authDomain must be Firebase domain
  return 'wisptools-production.firebaseapp.com';
};

const firebaseConfig = {
  apiKey: env.PUBLIC_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD_XK8eTNOfbEugJ27yucf_VLizOTgzkfA',
  authDomain: getAuthDomain(),
  projectId: env.PUBLIC_FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'wisptools-production',
  storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'wisptools-production.firebasestorage.app',
  messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1048161130237',
  appId: env.PUBLIC_FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID || '1:1048161130237:web:160789736967985b655094', // wisptools-web app
  measurementId: env.PUBLIC_FIREBASE_MEASUREMENT_ID || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
};

// Configuration logging removed for security - API keys should not be exposed in browser console

// Singleton instances
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;
let firebaseFunctions: Functions | null = null;

// Initialize Firebase app (lazy initialization, client-side only)
function getFirebaseApp(): FirebaseApp {
  if (!browser) {
    throw new Error('Firebase can only be initialized on the client side');
  }

  if (!firebaseApp) {
    try {
      // FORCE check for existing apps and clear them if wrong project
      const existingApps = getApps();
      const existingApp = existingApps.find(app => 
        app.options.projectId !== firebaseConfig.projectId ||
        app.options.apiKey !== firebaseConfig.apiKey
      );
      
      if (existingApp) {
        console.warn('⚠️ Found existing app with different config. Using new app instance with unique name.');
        
        // Clear singleton instances
        firebaseAuth = null;
        firebaseDb = null;
        firebaseStorage = null;
        firebaseFunctions = null;
      }
      
      // Always initialize with correct config
      firebaseApp = initializeApp(firebaseConfig, 'wisptools-production');
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
      throw error;
    }
  }

  return firebaseApp;
}

// Get Firebase Auth instance (lazy initialization)
export function getFirebaseAuth(): Auth {
  if (!browser) {
    throw new Error('Firebase Auth can only be used on the client side');
  }

  if (!firebaseAuth) {
    firebaseAuth = getAuth(getFirebaseApp());

    // Set auth persistence
    setPersistence(firebaseAuth, browserLocalPersistence)
      .catch((error) => {
        console.error('❌ Firebase Auth: Failed to set persistence:', error);
      });
  }

  return firebaseAuth;
}

// Get Firestore instance (lazy initialization)
export function getFirebaseDb(): Firestore {
  if (!browser) {
    throw new Error('Firestore can only be used on the client side');
  }

  if (!firebaseDb) {
    firebaseDb = getFirestore(getFirebaseApp());
    console.log('📊 Firestore initialized');
  }

  return firebaseDb;
}

// Get Storage instance (lazy initialization)
export function getFirebaseStorage(): FirebaseStorage {
  if (!browser) {
    throw new Error('Firebase Storage can only be used on the client side');
  }

  if (!firebaseStorage) {
    firebaseStorage = getStorage(getFirebaseApp());
  }

  return firebaseStorage;
}

// Get Functions instance (lazy initialization)
export function getFirebaseFunctions(): Functions {
  if (!browser) {
    throw new Error('Firebase Functions can only be used on the client side');
  }

  if (!firebaseFunctions) {
    firebaseFunctions = getFunctions(getFirebaseApp());
  }

  return firebaseFunctions;
}

// Backward compatibility: Explicit wrapper functions for lazy initialization
// These ensure Firebase is only initialized when actually called, not when module loads

/**
 * Get Firebase Auth instance - lazy initialization
 * MUST be called as a function: auth()
 */
export function auth(): Auth {
  return getFirebaseAuth();
}

/**
 * Get Firestore instance - lazy initialization
 * MUST be called as a function: db()
 */
export function db(): Firestore {
  return getFirebaseDb();
}

/**
 * Get Storage instance - lazy initialization
 * MUST be called as a function: storage()
 */
export function storage(): FirebaseStorage {
  return getFirebaseStorage();
}

/**
 * Get Functions instance - lazy initialization
 * MUST be called as a function: functions()
 */
export function functions(): Functions {
  return getFirebaseFunctions();
}


// Default export - lazy getter
export default function getDefaultApp(): FirebaseApp | null {
  if (!browser) return null;
  return getFirebaseApp();
}
