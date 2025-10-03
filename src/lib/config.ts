// Environment Configuration for LTE PCI Mapper
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

export const config = {
  firebase: {
    apiKey: env.PUBLIC_FIREBASE_API_KEY || '',
    authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.PUBLIC_FIREBASE_APP_ID || '',
    measurementId: env.PUBLIC_FIREBASE_MEASUREMENT_ID || ''
  },
  arcgis: {
    apiKey: env.PUBLIC_ARCGIS_API_KEY || '',
    tileServers: {
      street: "streets-vector",
      satellite: "satellite",
      hybrid: "hybrid",
      topographic: "topo"
    }
  },
  gemini: {
    apiKey: env.PUBLIC_GEMINI_API_KEY || '',
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
    maxTokens: 300,
    temperature: 0.3
  },
  wolfram: {
    appId: env.PUBLIC_WOLFRAM_APP_ID || 'WQPAJ72446',
    apiUrl: 'http://api.wolframalpha.com/v1/simple'
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
      primary: '#3b82f6',
      secondary: '#64748b',
      success: '#10b981',
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
