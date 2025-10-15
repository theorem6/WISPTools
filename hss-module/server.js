/**
 * Cloud HSS Server - Main Entry Point
 * Automated deployment via Firebase App Hosting to GCE
 * 
 * Project: lte-pci-mapper-65450042-bbf71
 * Instance: genieacs-backend
 * Zone: us-central1-a
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
let config = {};

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} else {
  // Default configuration
  config = {
    server: {
      host: '0.0.0.0',
      rest_api_port: parseInt(process.env.PORT) || 3000,
      s6a_port: 3868
    },
    diameter: {
      realm: process.env.HSS_REALM || 'lte-pci-mapper.com',
      identity: process.env.HSS_IDENTITY || 'hss.lte-pci-mapper.com'
    },
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hss',
      database: 'hss'
    },
    acs_integration: {
      enabled: true,
      sync_interval_minutes: 5,
      genieacs_mongodb_uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/genieacs',
      genieacs_database: 'genieacs'
    }
  };
}

// Validate environment
const MONGODB_URI = process.env.MONGODB_URI || config.mongodb.uri;
const HSS_ENCRYPTION_KEY = process.env.HSS_ENCRYPTION_KEY;
const REST_PORT = config.server.rest_api_port;
const S6A_PORT = config.server.s6a_port;

console.log('═══════════════════════════════════════════════════════════');
console.log('     Cloud HSS Server - Automated Firebase Deployment');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Project:  lte-pci-mapper-65450042-bbf71`);
console.log(`Instance: genieacs-backend`);
console.log(`Zone:     us-central1-a`);
console.log('═══════════════════════════════════════════════════════════');
console.log('');

if (!HSS_ENCRYPTION_KEY) {
  console.error('❌ ERROR: HSS_ENCRYPTION_KEY environment variable not set!');
  console.error('   Generate key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

if (!MONGODB_URI || MONGODB_URI.includes('<db_password>')) {
  console.error('❌ ERROR: MONGODB_URI not properly configured!');
  console.error('   Set MONGODB_URI environment variable with valid MongoDB connection string');
  process.exit(1);
}

console.log('✅ Environment validation passed');
console.log('');

// Initialize services
let hssApi, s6aInterface, acsIntegration;

async function startServices() {
  try {
    // Start REST API
    console.log('📡 Starting HSS REST API...');
    
    // Lazy load to avoid errors if modules aren't built yet
    try {
      const restApi = require('./api/rest-api');
      hssApi = restApi.default || restApi;
      
      const app = express();
      app.use('/api', hssApi);
      
      // Health check endpoint
      app.get('/health', (req, res) => {
        res.json({
          status: 'healthy',
          service: 'Cloud HSS',
          timestamp: new Date().toISOString(),
          components: {
            rest_api: 'running',
            s6a_interface: s6aInterface ? 'running' : 'not started',
            acs_integration: acsIntegration ? 'running' : 'not started'
          }
        });
      });
      
      app.listen(REST_PORT, config.server.host, () => {
        console.log(`✅ HSS REST API listening on ${config.server.host}:${REST_PORT}`);
        console.log(`   Health: http://localhost:${REST_PORT}/health`);
        console.log(`   API:    http://localhost:${REST_PORT}/api/`);
      });
    } catch (error) {
      console.error('⚠️  REST API module not available:', error.message);
      console.log('   Continuing with minimal server...');
      
      // Minimal server for health checks
      const app = express();
      app.get('/health', (req, res) => {
        res.json({
          status: 'initializing',
          service: 'Cloud HSS',
          timestamp: new Date().toISOString()
        });
      });
      app.listen(REST_PORT, config.server.host, () => {
        console.log(`✅ Minimal health server on port ${REST_PORT}`);
      });
    }
    
    // Start S6a Diameter Interface (for MME connections)
    if (fs.existsSync(path.join(__dirname, 'services/s6a-diameter-interface.js'))) {
      console.log('🌐 Starting S6a Diameter Interface...');
      try {
        const S6aDiameterInterface = require('./services/s6a-diameter-interface').S6aDiameterInterface;
        
        s6aInterface = new S6aDiameterInterface(
          MONGODB_URI,
          HSS_ENCRYPTION_KEY,
          {
            host: config.server.host,
            port: S6A_PORT,
            realm: config.diameter.realm,
            identity: config.diameter.identity
          }
        );
        
        await s6aInterface.start();
        console.log(`✅ S6a Diameter Interface listening on ${config.server.host}:${S6A_PORT}`);
        console.log(`   Realm:    ${config.diameter.realm}`);
        console.log(`   Identity: ${config.diameter.identity}`);
        console.log('   Ready for remote MME connections');
      } catch (error) {
        console.error('⚠️  S6a Interface error:', error.message);
        console.log('   Continuing without S6a interface...');
      }
    } else {
      console.log('⚠️  S6a interface module not found, skipping...');
    }
    
    // Start ACS Integration (if enabled)
    if (config.acs_integration.enabled) {
      console.log('🔄 Starting ACS Integration...');
      try {
        const ACSIntegrationService = require('./services/acs-integration').ACSIntegrationService;
        
        acsIntegration = new ACSIntegrationService(
          MONGODB_URI,
          'http://localhost:7557'  // GenieACS NBI on same server
        );
        
        // Sync every configured interval
        const intervalMs = config.acs_integration.sync_interval_minutes * 60 * 1000;
        setInterval(async () => {
          try {
            console.log('🔄 Running ACS sync...');
            const result = await acsIntegration.syncCPEDevices();
            console.log(`   ✅ Synced: ${result.synced}, Linked: ${result.linked}, Errors: ${result.errors}`);
          } catch (error) {
            console.error('   ❌ ACS sync error:', error.message);
          }
        }, intervalMs);
        
        // Initial sync after 30 seconds
        setTimeout(async () => {
          try {
            console.log('🔄 Initial ACS sync...');
            const result = await acsIntegration.syncCPEDevices();
            console.log(`   ✅ Synced: ${result.synced}, Linked: ${result.linked}, Errors: ${result.errors}`);
          } catch (error) {
            console.error('   ❌ Initial sync error:', error.message);
          }
        }, 30000);
        
        console.log(`✅ ACS Integration enabled (sync every ${config.acs_integration.sync_interval_minutes} minutes)`);
      } catch (error) {
        console.error('⚠️  ACS Integration error:', error.message);
        console.log('   Continuing without ACS integration...');
      }
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('     🚀 Cloud HSS Server - Ready');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📊 Service Status:');
    console.log(`   REST API:           ✅ Port ${REST_PORT}`);
    console.log(`   S6a Diameter:       ${s6aInterface ? '✅' : '⚠️'}  Port ${S6A_PORT}`);
    console.log(`   ACS Integration:    ${acsIntegration ? '✅' : '⚠️'}  ${config.acs_integration.enabled ? 'Enabled' : 'Disabled'}`);
    console.log('');
    console.log('🔗 Endpoints:');
    console.log(`   Health Check:  http://localhost:${REST_PORT}/health`);
    console.log(`   API Base:      http://localhost:${REST_PORT}/api/`);
    console.log(`   S6a Diameter:  ${config.server.host}:${S6A_PORT}`);
    console.log('');
    console.log('📝 Database:');
    console.log(`   MongoDB:       ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`);
    console.log(`   HSS DB:        ${config.mongodb.database}`);
    console.log(`   GenieACS DB:   ${config.acs_integration.genieacs_database}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
  } catch (error) {
    console.error('❌ FATAL ERROR starting services:');
    console.error(error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('');
  console.log('📴 Shutting down HSS server...');
  
  if (s6aInterface) {
    try {
      await s6aInterface.stop();
      console.log('✅ S6a interface stopped');
    } catch (error) {
      console.error('Error stopping S6a interface:', error);
    }
  }
  
  console.log('✅ Cloud HSS server shutdown complete');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('');
  console.log('📴 Received SIGINT, shutting down...');
  process.exit(0);
});

// Catch unhandled errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the services
startServices().catch((error) => {
  console.error('❌ Failed to start services:', error);
  process.exit(1);
});

