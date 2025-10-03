import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

const firebaseConfig = {
  apiKey: env.PUBLIC_FIREBASE_API_KEY || '',
  authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.PUBLIC_FIREBASE_APP_ID || '',
  measurementId: env.PUBLIC_FIREBASE_MEASUREMENT_ID || ''
};

// Initialize Firebase (only if not already initialized)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Set auth persistence to LOCAL (survives browser restarts)
if (browser) {
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('Firebase Auth: Persistence set to LOCAL (survives browser restarts)');
    })
    .catch((error) => {
      console.error('Firebase Auth: Failed to set persistence:', error);
    });
}

export default app;
