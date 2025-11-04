import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

// Firebase configuration with fallbacks
// authDomain: Can be any authorized domain - Firebase will work with any domain in the authorized list
// Using the default Firebase domain as fallback, but it will work with wisptools.io once authorized
const getAuthDomain = (): string => {
  // Check if we have an explicit authDomain override
  if (env.PUBLIC_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) {
    return env.PUBLIC_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  }
  
  // If on custom domain, use it (will work if authorized)
  if (typeof window !== 'undefined' && window.location.hostname === 'wisptools.io') {
    return 'wisptools.io';
  }
  
  // Default Firebase domain (always authorized)
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

// Log configuration status (only in development)
if (browser && typeof window !== 'undefined') {
  console.log('🔥 Firebase Config:', {
    apiKey: firebaseConfig.apiKey ? '✅ Set' : '❌ Missing',
    authDomain: firebaseConfig.authDomain ? '✅ Set' : '❌ Missing',
    projectId: firebaseConfig.projectId ? '✅ Set' : '❌ Missing',
    appId: firebaseConfig.appId ? '✅ Set' : '❌ Missing',
    storageBucket: firebaseConfig.storageBucket ? '✅ Set' : '❌ Missing',
    messagingSenderId: firebaseConfig.messagingSenderId ? '✅ Set' : '❌ Missing'
  });
  console.log('🔥 Firebase Config Values:', {
    apiKey: firebaseConfig.apiKey?.substring(0, 20) + '...',
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    appId: firebaseConfig.appId,
    storageBucket: firebaseConfig.storageBucket
  });
}

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
      console.log('🔥 Initializing Firebase app:', {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        apiKey: firebaseConfig.apiKey?.substring(0, 20) + '...'
      });
      
      // FORCE check for existing apps and clear them if wrong project
      const existingApps = getApps();
      const existingApp = existingApps.find(app => 
        app.options.projectId !== firebaseConfig.projectId ||
        app.options.apiKey !== firebaseConfig.apiKey
      );
      
      if (existingApp) {
        console.log('🔥 Found existing app with wrong config, deleting:', {
          existingProjectId: existingApp.options.projectId,
          existingApiKey: existingApp.options.apiKey?.substring(0, 20) + '...',
          correctProjectId: firebaseConfig.projectId
        });
        
        // Delete the existing app
        try {
          existingApp.delete();
          console.log('🔥 Deleted existing Firebase app');
        } catch (deleteError) {
          console.warn('⚠️ Could not delete existing app:', deleteError);
        }
        
        // Clear singleton instances
        firebaseAuth = null;
        firebaseDb = null;
        firebaseStorage = null;
        firebaseFunctions = null;
      }
      
      // Always initialize with correct config
      firebaseApp = initializeApp(firebaseConfig, 'wisptools-production');
      
      console.log('🔥 Firebase app initialized successfully:', {
        name: firebaseApp.name,
        projectId: firebaseApp.options.projectId,
        apiKey: firebaseApp.options.apiKey?.substring(0, 20) + '...',
        authDomain: firebaseApp.options.authDomain
      });
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
      .then(() => {
        console.log('🔐 Firebase Auth: Persistence set to LOCAL');
      })
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
    console.log('📦 Firebase Storage initialized');
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
    console.log('⚡ Firebase Functions initialized');
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
