#!/usr/bin/env node
// GenieACS Automated Installation Script
// Run with: npm run deploy:genieacs

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
  
  // Check if running as root
  if (process.getuid && process.getuid() !== 0) {
    logError('This script must be run as root (use sudo)');
    process.exit(1);
  }
  
  // Check OS
  try {
    const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
    if (osRelease.includes('Ubuntu') || osRelease.includes('Debian')) {
      logSuccess('Detected Ubuntu/Debian system');
    } else {
      logWarning('This script is optimized for Ubuntu/Debian. Other systems may need adjustments.');
    }
  } catch (error) {
    logWarning('Could not detect OS type');
  }
  
  // Check available disk space
  try {
    const df = execSync('df -h /', { encoding: 'utf8' });
    logSuccess('Disk space check passed');
  } catch (error) {
    logWarning('Could not check disk space');
  }
}

async function installDependencies() {
  logStep(2, 'Installing System Dependencies');
  
  // Update package lists
  runCommand('apt-get update -y', 'Updating package lists');
  
  // Install essential packages
  runCommand('apt-get install -y curl wget git build-essential', 'Installing essential packages');
  
  // Install Node.js 18
  log('Installing Node.js 18...');
  runCommand('curl -fsSL https://deb.nodesource.com/setup_18.x | bash -', 'Adding Node.js repository');
  runCommand('apt-get install -y nodejs', 'Installing Node.js');
  
  // Verify Node.js installation
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  logSuccess(`Node.js ${nodeVersion} and npm ${npmVersion} installed`);
}

async function installMongoDB() {
  logStep(3, 'Installing MongoDB');
  
  // Add MongoDB repository
  runCommand('wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -', 'Adding MongoDB GPG key');
  runCommand('echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list', 'Adding MongoDB repository');
  
  // Update package lists
  runCommand('apt-get update -y', 'Updating package lists for MongoDB');
  
  // Install MongoDB
  runCommand('apt-get install -y mongodb-org', 'Installing MongoDB');
  
  // Start and enable MongoDB
  runCommand('systemctl start mongod', 'Starting MongoDB');
  runCommand('systemctl enable mongod', 'Enabling MongoDB auto-start');
  
  // Verify MongoDB is running
  const mongodbStatus = execSync('systemctl is-active mongod', { encoding: 'utf8' }).trim();
  if (mongodbStatus === 'active') {
    logSuccess('MongoDB is running');
  } else {
    logError('MongoDB failed to start');
    process.exit(1);
  }
}

async function setupGenieACS() {
  logStep(4, 'Setting up GenieACS');
  
  // Create genieacs user
  try {
    execSync('id genieacs', { stdio: 'ignore' });
    logWarning('User genieacs already exists');
  } catch (error) {
    runCommand('useradd -r -s /bin/false genieacs', 'Creating genieacs user');
  }
  
  // Create directories
  const directories = [
    '/opt/genieacs',
    '/etc/genieacs',
    '/var/lib/genieacs/uploads',
    '/var/lib/genieacs/downloads',
    '/var/lib/genieacs/ui',
    '/var/log/genieacs'
  ];
  
  for (const dir of directories) {
    runCommand(`mkdir -p ${dir}`, `Creating directory ${dir}`);
  }
  
  // Clone GenieACS if not exists
  if (!fs.existsSync('/opt/genieacs/package.json')) {
    log('Cloning GenieACS repository...');
    runCommand('cd /tmp && git clone https://github.com/genieacs/genieacs.git', 'Cloning GenieACS');
    runCommand('cp -r /tmp/genieacs/* /opt/genieacs/', 'Copying GenieACS files');
    runCommand('rm -rf /tmp/genieacs', 'Cleaning up temporary files');
  } else {
    logWarning('GenieACS already exists, updating...');
    runCommand('cd /opt/genieacs && git pull', 'Updating GenieACS');
  }
  
  // Install GenieACS dependencies
  runCommand('cd /opt/genieacs && npm install', 'Installing GenieACS dependencies');
  runCommand('cd /opt/genieacs && npm run build', 'Building GenieACS');
  
  // Set ownership
  runCommand('chown -R genieacs:genieacs /opt/genieacs', 'Setting GenieACS ownership');
  runCommand('chown -R genieacs:genieacs /var/lib/genieacs', 'Setting data directory ownership');
  runCommand('chown -R genieacs:genieacs /var/log/genieacs', 'Setting log directory ownership');
}

async function createSystemdServices() {
  logStep(5, 'Creating Systemd Services');
  
  const services = [
    {
      name: 'genieacs-cwmp',
      description: 'GenieACS CWMP Server',
      exec: 'bin/genieacs-cwmp'
    },
    {
      name: 'genieacs-nbi',
      description: 'GenieACS NBI Server',
      exec: 'bin/genieacs-nbi'
    },
    {
      name: 'genieacs-fs',
      description: 'GenieACS File Server',
      exec: 'bin/genieacs-fs'
    },
    {
      name: 'genieacs-ui',
      description: 'GenieACS Web UI',
      exec: 'bin/genieacs-ui'
    }
  ];
  
  for (const service of services) {
    const serviceContent = `[Unit]
Description=${service.description}
After=mongod.service
Wants=mongod.service

[Service]
Type=simple
User=genieacs
Group=genieacs
WorkingDirectory=/opt/genieacs
ExecStart=/usr/bin/node ${service.exec}
Environment=NODE_ENV=production
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target`;

    fs.writeFileSync(`/etc/systemd/system/${service.name}.service`, serviceContent);
    logSuccess(`Created ${service.name}.service`);
  }
  
  // Reload systemd
  runCommand('systemctl daemon-reload', 'Reloading systemd');
}

async function enableAndStartServices() {
  logStep(6, 'Enabling and Starting Services');
  
  const services = ['genieacs-cwmp', 'genieacs-nbi', 'genieacs-fs', 'genieacs-ui'];
  
  for (const service of services) {
    runCommand(`systemctl enable ${service}`, `Enabling ${service}`);
    runCommand(`systemctl start ${service}`, `Starting ${service}`);
    
    // Wait a moment for service to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check service status
    try {
      const status = execSync(`systemctl is-active ${service}`, { encoding: 'utf8' }).trim();
      if (status === 'active') {
        logSuccess(`${service} is running`);
      } else {
        logWarning(`${service} is not active (status: ${status})`);
      }
    } catch (error) {
      logWarning(`Could not check status of ${service}`);
    }
  }
}

async function configureFirewall() {
  logStep(7, 'Configuring Firewall');
  
  const ports = [
    { port: 7547, service: 'GenieACS CWMP' },
    { port: 7557, service: 'GenieACS NBI' },
    { port: 7567, service: 'GenieACS FS' },
    { port: 8080, service: 'GenieACS UI' }
  ];
  
  // Check if ufw is available
  try {
    execSync('which ufw', { stdio: 'ignore' });
    
    for (const { port, service } of ports) {
      runCommand(`ufw allow ${port}/tcp comment "${service}"`, `Opening port ${port} for ${service}`, { continueOnError: true });
    }
    
    logSuccess('Firewall rules configured');
  } catch (error) {
    logWarning('UFW not found, please configure firewall manually');
  }
}

async function testServices() {
  logStep(8, 'Testing Services');
  
  const services = [
    { name: 'CWMP', url: 'http://localhost:7547', port: 7547 },
    { name: 'NBI', url: 'http://localhost:7557', port: 7557 },
    { name: 'FS', url: 'http://localhost:7567', port: 7567 },
    { name: 'UI', url: 'http://localhost:8080', port: 8080 }
  ];
  
  for (const service of services) {
    try {
      // Check if port is listening
      const netstat = execSync(`netstat -tlnp | grep :${service.port}`, { encoding: 'utf8' });
      if (netstat) {
        logSuccess(`${service.name} service is listening on port ${service.port}`);
      } else {
        logWarning(`${service.name} service is not listening on port ${service.port}`);
      }
    } catch (error) {
      logWarning(`${service.name} service port check failed`);
    }
  }
}

async function displayResults() {
  logStep(9, 'Installation Complete!');
  
  // Get server IP
  let serverIP = 'localhost';
  try {
    serverIP = execSync('hostname -I | awk \'{print $1}\'', { encoding: 'utf8' }).trim();
  } catch (error) {
    logWarning('Could not determine server IP');
  }
  
  log('\n' + '='.repeat(60));
  log(`${colors.green}🎉 GenieACS Installation Complete!${colors.reset}`);
  log('='.repeat(60));
  
  log('\n📡 Service URLs:');
  log(`${colors.cyan}GenieACS CWMP:${colors.reset} http://${serverIP}:7547`);
  log(`${colors.cyan}GenieACS NBI:${colors.reset}  http://${serverIP}:7557`);
  log(`${colors.cyan}GenieACS FS:${colors.reset}   http://${serverIP}:7567`);
  log(`${colors.cyan}GenieACS UI:${colors.reset}   http://${serverIP}:8080`);
  
  log('\n🔧 Management Commands:');
  log(`${colors.blue}Check status:${colors.reset} sudo systemctl status genieacs-*`);
  log(`${colors.blue}View logs:${colors.reset}    sudo journalctl -u genieacs-cwmp -f`);
  log(`${colors.blue}Restart:${colors.reset}      sudo systemctl restart genieacs-*`);
  
  log('\n🎯 Next Steps:');
  log('1. Configure CPE devices to connect to your server:7547');
  log('2. Update Firebase Functions with your server IP');
  log('3. Test device connectivity');
  log('4. Deploy Firebase Functions: npm run deploy:functions');
  
  log('\n📚 Documentation:');
  log('• Setup Guide: COMPLETE_GENIEACS_SETUP.md');
  log('• Firebase Bridge: functions/src/genieacsBridge.ts');
  
  log('\n' + '='.repeat(60));
}

async function main() {
  try {
    log(`${colors.bright}${colors.magenta}🚀 GenieACS Automated Installation${colors.reset}`);
    log(`${colors.blue}This script will install and configure all GenieACS services${colors.reset}\n`);
    
    await checkPrerequisites();
    await installDependencies();
    await installMongoDB();
    await setupGenieACS();
    await createSystemdServices();
    await enableAndStartServices();
    await configureFirewall();
    await testServices();
    await displayResults();
    
  } catch (error) {
    logError(`Installation failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the installation
if (require.main === module) {
  main();
}

module.exports = { main };
