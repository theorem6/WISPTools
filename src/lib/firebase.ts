import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDb5KthFS4DY4hZ_B8jsA3uxEsu6snQqWA",
  authDomain: "mapping-772cf.firebaseapp.com",
  projectId: "mapping-772cf",
  storageBucket: "mapping-772cf.firebasestorage.app",
  messagingSenderId: "483370858924",
  appId: "1:483370858924:web:b4890ced5af95e3153e209",
  measurementId: "G-2T2D6CWTTV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
