import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

// Firebase configuration
const firebaseConfig = {
  apiKey: env.PUBLIC_FIREBASE_API_KEY || '',
  authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.PUBLIC_FIREBASE_APP_ID || '',
  measurementId: env.PUBLIC_FIREBASE_MEASUREMENT_ID || ''
};

// Singleton instances
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;

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

// Backward compatibility exports (will be lazily initialized)
export const auth = browser ? getFirebaseAuth() : null as any;
export const db = browser ? getFirebaseDb() : null as any;
export const storage = browser ? getFirebaseStorage() : null as any;

// Export app (lazy)
export default browser ? getFirebaseApp() : null as any;
