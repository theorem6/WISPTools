#!/usr/bin/env node
// Firebase Functions Deployment Script
// Run with: npm run deploy:functions

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

function runCommand(command, description, options = {}) {
  try {
    log(`Running: ${colors.blue}${command}${colors.reset}`);
    const result = execSync(command, { 
      stdio: 'inherit', 
      encoding: 'utf8',
      cwd: options.cwd || process.cwd(),
      ...options 
    });
    logSuccess(`${description} completed`);
    return result;
  } catch (error) {
    logError(`${description} failed: ${error.message}`);
    if (options.continueOnError) {
      logWarning(`Continuing despite error...`);
      return null;
    } else {
      process.exit(1);
    }
  }
}

async function checkPrerequisites() {
  logStep(1, 'Checking Prerequisites');
  
  // Check if Firebase CLI is installed
  try {
    const firebaseVersion = execSync('firebase --version', { encoding: 'utf8' }).trim();
    logSuccess(`Firebase CLI ${firebaseVersion} is installed`);
  } catch (error) {
    logError('Firebase CLI is not installed. Please install it first:');
    log('npm install -g firebase-tools');
    process.exit(1);
  }
  
  // Check if we're logged in to Firebase
  try {
    execSync('firebase projects:list', { stdio: 'ignore' });
    logSuccess('Logged in to Firebase');
  } catch (error) {
    logError('Not logged in to Firebase. Please login first:');
    log('firebase login');
    process.exit(1);
  }
  
  // Check if firebase.json exists
  if (!fs.existsSync('firebase.json')) {
    logError('firebase.json not found. Please run this script from the project root.');
    process.exit(1);
  }
  
  logSuccess('firebase.json found');
}

async function installFunctionDependencies() {
  logStep(2, 'Installing Function Dependencies');
  
  // Check if functions directory exists
  if (!fs.existsSync('functions')) {
    logError('functions directory not found');
    process.exit(1);
  }
  
  // Install dependencies
  runCommand('npm install', 'Installing function dependencies', { cwd: 'functions' });
  
  logSuccess('Function dependencies installed');
}

async function buildFunctions() {
  logStep(3, 'Building Functions');
  
  // Build TypeScript functions
  runCommand('npm run build', 'Building TypeScript functions', { cwd: 'functions' });
  
  logSuccess('Functions built successfully');
}

async function setEnvironmentVariables() {
  logStep(4, 'Setting Environment Variables');
  
  // Get server IP from user or use default
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt) => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };
  
  const serverIP = await question(`${colors.yellow}Enter your GenieACS server IP (or press Enter for localhost): ${colors.reset}`);
  const finalIP = serverIP.trim() || 'localhost';
  
  rl.close();
  
  // Set environment variables
  const envVars = {
    'genieacs.nbi_url': `http://${finalIP}:7557`,
    'genieacs.ui_url': `http://${finalIP}:8080`,
    'genieacs.cwmp_url': `http://${finalIP}:7547`,
    'genieacs.fs_url': `http://${finalIP}:7567`
  };
  
  for (const [key, value] of Object.entries(envVars)) {
    runCommand(`firebase functions:config:set ${key}="${value}"`, `Setting ${key}`, { continueOnError: true });
  }
  
  logSuccess('Environment variables set');
}

async function deployFunctions() {
  logStep(5, 'Deploying Firebase Functions');
  
  // Deploy functions
  runCommand('firebase deploy --only functions', 'Deploying Firebase Functions');
  
  logSuccess('Firebase Functions deployed successfully');
}

async function testFunctions() {
  logStep(6, 'Testing Deployed Functions');
  
  // Get project ID
  let projectId = 'lte-pci-mapper'; // Default
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));
    projectId = firebaseConfig.projects.default;
  } catch (error) {
    logWarning('Could not read .firebaserc, using default project ID');
  }
  
  const functionsUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
  
  // Test functions
  const testFunctions = [
    'initializeSamplePresets',
    'getPresets',
    'syncGenieACSDevices'
  ];
  
  for (const funcName of testFunctions) {
    try {
      log(`Testing ${funcName}...`);
      const response = await fetch(`${functionsUrl}/${funcName}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        logSuccess(`${funcName} is responding`);
      } else {
        logWarning(`${funcName} returned status ${response.status}`);
      }
    } catch (error) {
      logWarning(`${funcName} test failed: ${error.message}`);
    }
  }
}

async function displayResults() {
  logStep(7, 'Deployment Complete!');
  
  // Get project ID
  let projectId = 'lte-pci-mapper';
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));
    projectId = firebaseConfig.projects.default;
  } catch (error) {
    logWarning('Could not read .firebaserc');
  }
  
  const functionsUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
  
  log('\n' + '='.repeat(60));
  log(`${colors.green}🎉 Firebase Functions Deployment Complete!${colors.reset}`);
  log('='.repeat(60));
  
  log('\n🔗 Function URLs:');
  log(`${colors.cyan}Presets Management:${colors.reset}`);
  log(`  • Get Presets: GET ${functionsUrl}/getPresets`);
  log(`  • Create Preset: POST ${functionsUrl}/createPreset`);
  log(`  • Delete Preset: DELETE ${functionsUrl}/deletePreset/{id}`);
  log(`  • Initialize: POST ${functionsUrl}/initializeSamplePresets`);
  
  log(`\n${colors.cyan}GenieACS Bridge:${colors.reset}`);
  log(`  • Sync Devices: POST ${functionsUrl}/syncGenieACSDevices`);
  log(`  • Get Device: GET ${functionsUrl}/getDeviceParameters/{id}`);
  log(`  • Execute Task: POST ${functionsUrl}/executeDeviceTask/{id}`);
  log(`  • Performance: GET ${functionsUrl}/getDevicePerformanceMetrics/{id}`);
  
  log(`\n${colors.cyan}CPE Management:${colors.reset}`);
  log(`  • Get CPEs: GET ${functionsUrl}/getCPEDevices`);
  log(`  • Update Location: PUT ${functionsUrl}/updateCPELocation/{id}`);
  
  log('\n🧪 Test Functions:');
  log(`${colors.blue}Test Presets:${colors.reset} curl -X POST ${functionsUrl}/initializeSamplePresets`);
  log(`${colors.blue}Test Sync:${colors.reset} curl -X POST ${functionsUrl}/syncGenieACSDevices`);
  
  log('\n📱 ACS Module Integration:');
  log('Your ACS module should now be able to:');
  log('• Load presets from database');
  log('• Delete presets with persistence');
  log('• Sync CPE devices from GenieACS');
  log('• Execute tasks on CPE devices');
  log('• View real-time device metrics');
  
  log('\n🎯 Next Steps:');
  log('1. Test your ACS module in the web interface');
  log('2. Connect CPE devices to GenieACS');
  log('3. Monitor device connectivity and performance');
  
  log('\n' + '='.repeat(60));
}

async function main() {
  try {
    log(`${colors.bright}${colors.magenta}🔥 Firebase Functions Deployment${colors.reset}`);
    log(`${colors.blue}This script will deploy all Firebase Functions${colors.reset}\n`);
    
    await checkPrerequisites();
    await installFunctionDependencies();
    await buildFunctions();
    await setEnvironmentVariables();
    await deployFunctions();
    await testFunctions();
    await displayResults();
    
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
