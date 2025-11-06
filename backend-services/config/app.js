/**
 * Centralized Backend Configuration
 * All backend server URLs, ports, endpoints, and external service URLs should be defined here
 */

module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  
  // MongoDB Configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // CORS Configuration - Allowed Origins
  cors: {
    origins: [
      'https://wisptools.io',
      'https://wisptools-production.web.app',
      'https://wisptools-production.firebaseapp.com',
      'https://wisptools-io.web.app',
      'https://wisptools-io.firebaseapp.com',
      'https://lte-pci-mapper-65450042-bbf71.web.app',
      'https://lte-pci-mapper-65450042-bbf71.firebaseapp.com',
      'https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app',
      'https://pci-mapper--lte-pci-mapper-65450042-bbf71.us-central1.hosted.app',
      'http://localhost:5173', // Development
      'http://localhost:3000', // Development
      'http://localhost:3001'  // Development
    ],
    credentials: true
  },
  
  // External Service URLs
  externalServices: {
    // GenieACS
    genieacs: {
      baseUrl: process.env.GENIEACS_URL || 'http://localhost:7557',
      nbiUrl: process.env.GENIEACS_NBI_URL || 'http://localhost:7557',
      apiKey: process.env.GENIEACS_API_KEY || ''
    },
    
    // ArcGIS Geocoding
    arcgis: {
      geocodeUrl: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates',
      reverseGeocodeUrl: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode',
      apiKey: process.env.ARCGIS_API_KEY || ''
    },
    
    // HSS Management (GCE VM)
    hss: {
      baseUrl: process.env.HSS_API_URL || 'https://136.112.111.167:3001',
      apiUrl: process.env.HSS_API_URL || 'https://136.112.111.167:3001/api/hss',
      ipAddress: process.env.GCE_PUBLIC_IP || '136.112.111.167',
      port: process.env.HSS_PORT || 3001
    },
    
    // Google Cloud Functions
    cloudFunctions: {
      apiProxy: 'https://us-central1-wisptools-production.cloudfunctions.net/apiProxy',
      isoProxy: 'https://us-central1-wisptools-production.cloudfunctions.net/isoProxy',
      coverageMapProxy: 'https://us-central1-wisptools-production.cloudfunctions.net/coverageMapProxy'
    },
    
    // Firebase Configuration
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'wisptools-production',
      region: process.env.FIREBASE_REGION || 'us-central1'
    }
  },
  
  // API Route Paths
  routes: {
    base: '/api',
    plans: '/api/plans',
    network: '/api/network',
    customers: '/api/customers',
    inventory: '/api/inventory',
    deploy: '/api/deploy',
    hss: '/api/hss',
    monitoring: '/api/monitoring',
    maintain: '/api/maintain',
    tenants: '/api/tenants',
    admin: '/admin',
    workOrders: '/api/work-orders'
  },
  
  // Request Limits
  limits: {
    jsonBodySize: '10mb',
    urlEncodedBodySize: '10mb',
    requestTimeout: 30000 // 30 seconds
  }
};

