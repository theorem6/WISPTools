// Environment Configuration for LTE PCI Mapper
import { browser } from '$app/environment';

export const config = {
  firebase: {
    apiKey: "AIzaSyDb5KthFS4DY4hZ_B8jsA3uxEsu6snQqWA",
    authDomain: "mapping-772cf.firebaseapp.com",
    projectId: "mapping-772cf",
    storageBucket: "mapping-772cf.firebasestorage.app",
    messagingSenderId: "483370858924",
    appId: "1:483370858924:web:b4890ced5af95e3153e209",
    measurementId: "G-2T2D6CWTTV"
  },
  arcgis: {
    apiKey: "AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ",
    tileServers: {
      street: "streets-vector",
      satellite: "satellite",
      hybrid: "hybrid",
      topographic: "topo"
    }
  },
  gemini: {
    apiKey: "AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
    maxTokens: 2048,
    temperature: 0.3
  },
  app: {
    name: "LTE PCI Conflict Mapper",
    version: "1.0.0",
    description: "Advanced LTE Physical Cell Identity conflict detection and visualization",
    supportEmail: "support@pci-mapper.com",
    githubUrl: "https://github.com/pci-mapper/pci-conflict-analyzer"
  },
  pci: {
    maxPCI: 503,
    conflictThresholds: {
      critical: 500, // meters
      high: 1000,
      medium: 2000,
      low: 3000
    },
    moduloTypes: ['MOD3', 'MOD6', 'MOD12', 'MOD30'],
    frequencyBands: {
      'LTE_BAND_1': { frequency: 2100, bandwidth: 2100 },
      'LTE_BAND_3': { frequency: 1800, bandwidth: 1800 },
      'LTE_BAND_7': { frequency: 2600, bandwidth: 2600 },
      'LTE_BAND_8': { frequency: 900, bandwidth: 900 },
      'LTE_BAND_20': { frequency: 800, bandwidth: 800 },
      'LTE_BAND_28': { frequency: 700, bandwidth: 700 }
    }
  },
  map: {
    defaultCenter: { longitude: -74.0060, latitude: 40.7128 }, // New York
    defaultZoom: 10,
    minZoom: 3,
    maxZoom: 20,
    clustering: {
      enabled: true,
      maxZoom: 14,
      distance: 35000 // meters
    },
    styles: {
      light: "streets-vector",
      dark: "dark-gray-vector",
      satellite: "satellite",
      terrain: "streets-vector"
    }
  },
  ui: {
    animationDuration: 200,
    colors: {
      primary: '#667eea',
      secondary: '#764ba2',
      success: '#28a745',
      warning: '#ffc107',
      danger: '#dc3545',
      info: '#17a2b8',
      light: '#f8f9fa',
      dark: '#343a40'
    },
    breakpoints: {
      mobile: 768,
      tablet: 1024,
      desktop: 1280,
      wide: 1536
    }
  }
};

// Environment-aware configuration
export const getConfig = () => {
  if (browser) {
    // Browser-side environment variables
    return {
      ...config,
      firebase: {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || config.firebase.apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || config.firebase.authDomain,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || config.firebase.projectId,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || config.firebase.storageBucket,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || config.firebase.messagingSenderId,
        appId: import.meta.env.VITE_FIREBASE_APP_ID || config.firebase.appId,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || config.firebase.measurementId
      },
      arcgis: {
        ...config.arcgis,
        apiKey: import.meta.env.VITE_ARCGIS_API_KEY || config.arcgis.apiKey
      },
      gemini: {
        ...config.gemini,
        apiKey: import.meta.env.VITE_GEMINI_API_KEY || config.gemini.apiKey
      }
    };
  }
  
  return config;
};

// Utility functions
export const isProduction = () => import.meta.env.MODE === 'production';
export const isDevelopment = () => import.meta.env.MODE === 'development';

// API endpoint builders
export const buildGeminiUrl = () => {
  const config = getConfig();
  return `${config.gemini.apiUrl}?key=${config.gemini.apiKey}`;
};

export const buildFirebaseConfig = () => {
  const config = getConfig();
  return config.firebase;
};

export const buildArcGISConfig = () => {
  const config = getConfig();
  return config.arcgis;
};
