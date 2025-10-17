import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

// Firebase configuration with fallbacks
const firebaseConfig = {
  apiKey: env.PUBLIC_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0',
  authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'lte-pci-mapper-65450042-bbf71.firebaseapp.com',
  projectId: env.PUBLIC_FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'lte-pci-mapper-65450042-bbf71',
  storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'lte-pci-mapper-65450042-bbf71.firebasestorage.app',
  messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1044782186913',
  appId: env.PUBLIC_FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID || '1:1044782186913:web:e1d47cdb7b1d89bb0b6f9c',
  measurementId: env.PUBLIC_FIREBASE_MEASUREMENT_ID || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
};

// Log configuration status (only in development)
if (browser && typeof window !== 'undefined') {
  console.log('🔥 Firebase Config:', {
    apiKey: firebaseConfig.apiKey ? '✅ Set' : '❌ Missing',
    authDomain: firebaseConfig.authDomain ? '✅ Set' : '❌ Missing',
    projectId: firebaseConfig.projectId ? '✅ Set' : '❌ Missing',
    appId: firebaseConfig.appId ? '✅ Set' : '❌ Missing'
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
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    console.log('🔥 Firebase app initialized');
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
