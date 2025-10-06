#!/usr/bin/env node
// Complete ACS Deployment Script
// Run with: npm run deploy:complete

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${colors.cyan}[STEP ${step}]${colors.reset} ${colors.bright}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logWarning(message) {
  log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function logError(message) {
  log(`${colors.red}❌ ${message}${colors.reset}`);
}

async function promptUser(question) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function checkEnvironment() {
  logStep(1, 'Checking Environment');
  
  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    logError('package.json not found. Please run from project root.');
    process.exit(1);
  }
  
  // Check if Firebase project is configured
  if (!fs.existsSync('.firebaserc')) {
    logWarning('Firebase project not configured. Please run: firebase init');
  }
  
  logSuccess('Environment check passed');
}

async function deployGenieACS() {
  logStep(2, 'Deploying GenieACS Services');
  
  const deployGenieACS = await promptUser(`${colors.yellow}Deploy GenieACS services to server? (y/n): ${colors.reset}`);
  
  if (deployGenieACS.toLowerCase() === 'y') {
    const serverIP = await promptUser(`${colors.yellow}Enter server IP address: ${colors.reset}`);
    const serverUser = await promptUser(`${colors.yellow}Enter server username (default: root): ${colors.reset}`) || 'root';
    
    log(`\n${colors.blue}Deploying to server: ${serverUser}@${serverIP}${colors.reset}`);
    
    try {
      // Copy deployment script to server
      log('Copying deployment script to server...');
      execSync(`scp deploy/genieacs-install.js ${serverUser}@${serverIP}:/tmp/`, { stdio: 'inherit' });
      execSync(`scp setup-genieacs-services.sh ${serverUser}@${serverIP}:/tmp/`, { stdio: 'inherit' });
      
      // Execute deployment on server
      log('Executing GenieACS installation on server...');
      execSync(`ssh ${serverUser}@${serverIP} 'chmod +x /tmp/genieacs-install.js && chmod +x /tmp/setup-genieacs-services.sh && sudo /tmp/setup-genieacs-services.sh'`, { stdio: 'inherit' });
      
      logSuccess('GenieACS services deployed successfully');
      return serverIP;
    } catch (error) {
      logError(`GenieACS deployment failed: ${error.message}`);
      logWarning('Continuing with Firebase deployment...');
      return null;
    }
  } else {
    logWarning('Skipping GenieACS deployment');
    return null;
  }
}

async function deployFirebaseFunctions() {
  logStep(3, 'Deploying Firebase Functions');
  
  const deployFirebase = await promptUser(`${colors.yellow}Deploy Firebase Functions? (y/n): ${colors.reset}`);
  
  if (deployFirebase.toLowerCase() === 'y') {
    try {
      // Check Firebase CLI
      try {
        execSync('firebase --version', { stdio: 'ignore' });
      } catch (error) {
        logError('Firebase CLI not found. Installing...');
        execSync('npm install -g firebase-tools', { stdio: 'inherit' });
      }
      
      // Install function dependencies
      log('Installing function dependencies...');
      execSync('cd functions && npm install', { stdio: 'inherit' });
      
      // Build functions
      log('Building functions...');
      execSync('cd functions && npm run build', { stdio: 'inherit' });
      
      // Deploy functions
      log('Deploying Firebase Functions...');
      execSync('firebase deploy --only functions', { stdio: 'inherit' });
      
      logSuccess('Firebase Functions deployed successfully');
      return true;
    } catch (error) {
      logError(`Firebase deployment failed: ${error.message}`);
      return false;
    }
  } else {
    logWarning('Skipping Firebase deployment');
    return false;
  }
}

async function deployWebHosting() {
  logStep(4, 'Deploying Web Hosting');
  
  const deployHosting = await promptUser(`${colors.yellow}Deploy web hosting? (y/n): ${colors.reset}`);
  
  if (deployHosting.toLowerCase() === 'y') {
    try {
      // Build the web app
      log('Building web application...');
      execSync('npm run build', { stdio: 'inherit' });
      
      // Deploy hosting
      log('Deploying to Firebase Hosting...');
      execSync('firebase deploy --only hosting', { stdio: 'inherit' });
      
      logSuccess('Web hosting deployed successfully');
      return true;
    } catch (error) {
      logError(`Web hosting deployment failed: ${error.message}`);
      return false;
    }
  } else {
    logWarning('Skipping web hosting deployment');
    return false;
  }
}

async function configureIntegration(genieacsIP) {
  logStep(5, 'Configuring Integration');
  
  if (genieacsIP) {
    try {
      // Set GenieACS environment variables
      log('Setting GenieACS environment variables...');
      const envVars = {
        'genieacs.nbi_url': `http://${genieacsIP}:7557`,
        'genieacs.ui_url': `http://${genieacsIP}:8080`,
        'genieacs.cwmp_url': `http://${genieacsIP}:7547`,
        'genieacs.fs_url': `http://${genieacsIP}:7567`
      };
      
      for (const [key, value] of Object.entries(envVars)) {
        try {
          execSync(`firebase functions:config:set ${key}="${value}"`, { stdio: 'inherit' });
        } catch (error) {
          logWarning(`Failed to set ${key}`);
        }
      }
      
      logSuccess('Integration configured');
    } catch (error) {
      logWarning(`Configuration failed: ${error.message}`);
    }
  }
}

async function testDeployment(genieacsIP) {
  logStep(6, 'Testing Deployment');
  
  // Get Firebase project info
  let projectId = 'lte-pci-mapper';
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));
    projectId = firebaseConfig.projects.default;
  } catch (error) {
    logWarning('Could not read Firebase project ID');
  }
  
  const functionsUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
  
  // Test Firebase Functions
  log('Testing Firebase Functions...');
  try {
    const response = await fetch(`${functionsUrl}/initializeSamplePresets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      logSuccess('Firebase Functions are responding');
    } else {
      logWarning(`Firebase Functions returned status ${response.status}`);
    }
  } catch (error) {
    logWarning(`Firebase Functions test failed: ${error.message}`);
  }
  
  // Test GenieACS if deployed
  if (genieacsIP) {
    log(`Testing GenieACS services on ${genieacsIP}...`);
    
    const services = [
      { name: 'CWMP', port: 7547 },
      { name: 'NBI', port: 7557 },
      { name: 'FS', port: 7567 },
      { name: 'UI', port: 8080 }
    ];
    
    for (const service of services) {
      try {
        const response = await fetch(`http://${genieacsIP}:${service.port}`, {
          method: 'GET',
          timeout: 5000
        });
        logSuccess(`${service.name} service is responding`);
      } catch (error) {
        logWarning(`${service.name} service test failed`);
      }
    }
  }
}

async function displayResults(genieacsIP, firebaseDeployed, hostingDeployed) {
  logStep(7, 'Deployment Complete!');
  
  // Get Firebase project info
  let projectId = 'lte-pci-mapper';
  let hostingUrl = '';
  
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));
    projectId = firebaseConfig.projects.default;
    hostingUrl = `https://${projectId}.web.app`;
  } catch (error) {
    logWarning('Could not read Firebase configuration');
  }
  
  const functionsUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
  
  log('\n' + '='.repeat(70));
  log(`${colors.green}🎉 ACS Deployment Complete!${colors.reset}`);
  log('='.repeat(70));
  
  if (hostingDeployed) {
    log(`\n🌐 Web Application: ${colors.cyan}${hostingUrl}${colors.reset}`);
  }
  
  if (firebaseDeployed) {
    log(`\n🔥 Firebase Functions: ${colors.cyan}${functionsUrl}${colors.reset}`);
  }
  
  if (genieacsIP) {
    log(`\n📡 GenieACS Services on ${genieacsIP}:`);
    log(`  • CWMP (TR-069): ${colors.cyan}http://${genieacsIP}:7547${colors.reset}`);
    log(`  • NBI (API):     ${colors.cyan}http://${genieacsIP}:7557${colors.reset}`);
    log(`  • FS (Files):    ${colors.cyan}http://${genieacsIP}:7567${colors.reset}`);
    log(`  • UI (Web):      ${colors.cyan}http://${genieacsIP}:8080${colors.reset}`);
  }
  
  log('\n🎯 Next Steps:');
  log('1. Configure CPE devices to connect to GenieACS CWMP');
  log('2. Test the ACS module in your web application');
  log('3. Monitor device connectivity and performance');
  log('4. Set up monitoring and alerts');
  
  log('\n🧪 Test Commands:');
  if (firebaseDeployed) {
    log(`${colors.blue}Test Presets:${colors.reset} curl -X POST ${functionsUrl}/initializeSamplePresets`);
    if (genieacsIP) {
      log(`${colors.blue}Test Sync:${colors.reset} curl -X POST ${functionsUrl}/syncGenieACSDevices`);
    }
  }
  
  log('\n📚 Documentation:');
  log('• Setup Guide: COMPLETE_GENIEACS_SETUP.md');
  log('• Firebase Bridge: functions/src/genieacsBridge.ts');
  log('• Deployment Scripts: deploy/ directory');
  
  log('\n' + '='.repeat(70));
}

async function main() {
  try {
    log(`${colors.bright}${colors.magenta}🚀 Complete ACS Deployment${colors.reset}`);
    log(`${colors.blue}This script will deploy GenieACS, Firebase Functions, and Web Hosting${colors.reset}\n`);
    
    await checkEnvironment();
    
    const genieacsIP = await deployGenieACS();
    const firebaseDeployed = await deployFirebaseFunctions();
    const hostingDeployed = await deployWebHosting();
    
    await configureIntegration(genieacsIP);
    await testDeployment(genieacsIP);
    await displayResults(genieacsIP, firebaseDeployed, hostingDeployed);
    
  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the deployment
if (require.main === module) {
  main();
}

module.exports = { main };
