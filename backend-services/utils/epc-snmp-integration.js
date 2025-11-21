/**
 * EPC SNMP Integration Utilities
 * Functions to integrate SNMP agent into EPC ISO generation
 */

/**
 * Generate SNMP agent installation script for cloud-init
 */
function generateSNMPAgentInstallScript(config) {
  const { 
    epc_id, 
    tenant_id, 
    auth_code, 
    api_key, 
    gce_ip, 
    hss_port,
    snmp_config = {}
  } = config;

  if (!snmp_config.enabled) {
    return '';
  }

  return `
# Install and configure EPC SNMP Agent
- name: install-epc-snmp-agent
  cmd: |
    echo "Installing EPC SNMP Agent..."
    
    # Install Node.js and npm if not present
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs
    
    # Install SNMP tools
    apt-get install -y snmp snmp-mibs-downloader libsnmp-dev
    
    # Create EPC SNMP agent directory
    mkdir -p /opt/epc-snmp-agent
    cd /opt/epc-snmp-agent
    
    # Initialize npm project and install dependencies
    npm init -y
    npm install net-snmp
    
    # Create EPC SNMP agent script (embedded)
    cat > epc-snmp-agent.js << 'EOFSCRIPT'
${generateEmbeddedSNMPAgent()}
EOFSCRIPT
    
    # Create configuration file
    cat > config.json << 'EOFCONFIG'
{
  "epcId": "${epc_id}",
  "tenantId": "${tenant_id}",
  "authCode": "${auth_code}",
  "cloudApiUrl": "http://${gce_ip}:${hss_port}",
  "apiKey": "${api_key}",
  "snmpPort": ${snmp_config.port || 161},
  "snmpCommunity": "${snmp_config.community || 'public'}",
  "reportingInterval": ${snmp_config.reportingInterval || 60000},
  "enableSNMPAgent": ${snmp_config.enableAgent !== false},
  "enableCloudReporting": ${snmp_config.enableReporting !== false},
  "healthCheckInterval": ${snmp_config.healthCheckInterval || 30000},
  "customMetrics": ${JSON.stringify(snmp_config.customMetrics || {})}
}
EOFCONFIG
    
    # Create systemd service
    cat > /etc/systemd/system/epc-snmp-agent.service << 'EOFSERVICE'
[Unit]
Description=EPC SNMP Agent
After=network.target epc-service.target
Wants=network.target
Requires=epc-service.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/epc-snmp-agent
ExecStart=/usr/bin/node epc-snmp-agent.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=EPC_ID=${epc_id}
Environment=TENANT_ID=${tenant_id}
Environment=EPC_AUTH_CODE=${auth_code}
Environment=CLOUD_API_URL=http://${gce_ip}:${hss_port}
Environment=EPC_API_KEY=${api_key}

[Install]
WantedBy=multi-user.target
EOFSERVICE
    
    # Set permissions
    chmod +x epc-snmp-agent.js
    chmod 600 config.json
    
    # Enable and start the service
    systemctl daemon-reload
    systemctl enable epc-snmp-agent
    
    # Start after a delay to ensure EPC service is ready
    (sleep 30 && systemctl start epc-snmp-agent) &
    
    echo "EPC SNMP Agent installed successfully"
`;
}

/**
 * Generate APT repository configuration script
 */
function generateAPTRepositoryScript(config) {
  const { 
    tenant_id, 
    gce_ip, 
    hss_port,
    apt_config = {}
  } = config;

  if (!apt_config.enabled) {
    return '';
  }

  return `
# Configure APT repository for EPC updates
- name: configure-epc-apt-repository
  cmd: |
    echo "Configuring EPC APT repository..."
    
    # Create APT sources directory
    mkdir -p /etc/apt/sources.list.d
    
    # Add WispTools EPC repository
    echo "deb http://${gce_ip}:${hss_port}/apt-repos/${tenant_id} stable main" > /etc/apt/sources.list.d/wisptools-epc.list
    
    # Download and add GPG key
    curl -fsSL "http://${gce_ip}:${hss_port}/api/epc-updates/gpg-key" | apt-key add -
    
    # Update package list
    apt-get update
    
    ${apt_config.autoUpdate ? `
    # Configure automatic updates
    apt-get install -y unattended-upgrades apt-listchanges
    
    # Configure unattended-upgrades for EPC packages
    cat > /etc/apt/apt.conf.d/50unattended-upgrades-epc << 'EOFUPDATES'
Unattended-Upgrade::Allowed-Origins {
    "WispTools EPC:stable";
};
Unattended-Upgrade::Package-Blacklist {
    // Add any packages that should not be auto-updated
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Mail "root";
EOFUPDATES
    
    # Configure auto-upgrade schedule
    cat > /etc/apt/apt.conf.d/20auto-upgrades-epc << 'EOFSCHEDULE'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "${apt_config.updateSchedule === 'daily' ? '1' : '0'}";
EOFSCHEDULE
    
    # Create update log directory
    mkdir -p /var/log/epc-updates
    ` : ''}
    
    # Create EPC update status script
    cat > /usr/local/bin/epc-update-status << 'EOFSTATUS'
#!/bin/bash
# EPC Update Status Reporter
# Reports update status back to cloud API

CONFIG_FILE="/opt/epc-snmp-agent/config.json"
if [ -f "$CONFIG_FILE" ]; then
    EPC_ID=$(grep -o '"epcId": *"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    TENANT_ID=$(grep -o '"tenantId": *"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    API_URL=$(grep -o '"cloudApiUrl": *"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    API_KEY=$(grep -o '"apiKey": *"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    
    # Report update status
    curl -X POST "$API_URL/api/epc-updates/status" \\
         -H "Content-Type: application/json" \\
         -H "Authorization: Bearer $API_KEY" \\
         -H "x-tenant-id: $TENANT_ID" \\
         -d "{\\"epcId\\": \\"$EPC_ID\\", \\"status\\": \\"$1\\", \\"timestamp\\": \\"$(date -Iseconds)\\"}"
fi
EOFSTATUS
    
    chmod +x /usr/local/bin/epc-update-status
    
    echo "EPC APT repository configured successfully"
`;
}

/**
 * Generate embedded SNMP agent script (simplified version for ISO)
 */
function generateEmbeddedSNMPAgent() {
  return `
// Embedded EPC SNMP Agent (ISO Version)
const snmp = require('net-snmp');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');
const http = require('http');

class EPCSNMPAgent {
  constructor() {
    this.config = this.loadConfig();
    this.agent = null;
    this.reportingTimer = null;
    this.isRunning = false;
  }

  loadConfig() {
    try {
      const configData = fs.readFileSync('/opt/epc-snmp-agent/config.json', 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('Failed to load config:', error);
      return {
        epcId: process.env.EPC_ID || 'unknown',
        tenantId: process.env.TENANT_ID || 'unknown',
        cloudApiUrl: process.env.CLOUD_API_URL || 'http://localhost:3001',
        reportingInterval: 60000,
        enableSNMPAgent: true,
        enableCloudReporting: true
      };
    }
  }

  async initialize() {
    try {
      console.log('[EPC SNMP Agent] Starting...');
      
      if (this.config.enableSNMPAgent) {
        await this.startSNMPAgent();
      }
      
      if (this.config.enableCloudReporting) {
        this.startCloudReporting();
      }
      
      this.isRunning = true;
      console.log('[EPC SNMP Agent] Started successfully');
    } catch (error) {
      console.error('[EPC SNMP Agent] Failed to start:', error);
    }
  }

  async startSNMPAgent() {
    this.agent = snmp.createAgent({
      port: this.config.snmpPort || 161,
      disableAuthorization: false
    });

    const mib = this.agent.getMib();
    const baseOID = '1.3.6.1.4.1.99999.1.1';
    
    // Register basic EPC OIDs
    mib.registerProvider({
      name: 'epcId',
      type: snmp.MibProviderType.Scalar,
      oid: baseOID + '.1.0',
      scalarType: snmp.ObjectType.OctetString,
      handler: (req) => req.done(snmp.ErrorStatus.NoError, this.config.epcId)
    });

    mib.registerProvider({
      name: 'epcUptime',
      type: snmp.MibProviderType.Scalar,
      oid: baseOID + '.2.0',
      scalarType: snmp.ObjectType.TimeTicks,
      handler: (req) => req.done(snmp.ErrorStatus.NoError, Math.floor(os.uptime()))
    });

    console.log('[EPC SNMP Agent] SNMP agent started on port', this.config.snmpPort);
  }

  startCloudReporting() {
    this.reportingTimer = setInterval(() => {
      this.reportToCloud().catch(console.error);
    }, this.config.reportingInterval);
    
    // Initial report
    this.reportToCloud().catch(console.error);
  }

  async reportToCloud() {
    try {
      const metrics = await this.collectMetrics();
      
      const payload = {
        epcId: this.config.epcId,
        tenantId: this.config.tenantId,
        authCode: this.config.authCode,
        metrics: metrics,
        timestamp: new Date().toISOString()
      };
      
      await this.sendToAPI('/api/epc/metrics', payload);
      console.log('[EPC SNMP Agent] Metrics reported successfully');
    } catch (error) {
      console.error('[EPC SNMP Agent] Failed to report metrics:', error);
    }
  }

  async collectMetrics() {
    return {
      system: {
        uptime: os.uptime(),
        hostname: os.hostname(),
        platform: os.platform()
      },
      resources: {
        cpuUsage: await this.getCPUUsage(),
        memoryUsage: (1 - os.freemem() / os.totalmem()) * 100,
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        loadAverage: os.loadavg()
      },
      epc: {
        activeUsers: await this.getActiveUsers(),
        serviceStatus: await this.getServiceStatus()
      }
    };
  }

  async getCPUUsage() {
    return new Promise((resolve) => {
      exec("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//'", (error, stdout) => {
        resolve(error ? 0 : parseFloat(stdout.trim()) || 0);
      });
    });
  }

  async getActiveUsers() {
    return new Promise((resolve) => {
      exec('who | wc -l', (error, stdout) => {
        resolve(error ? 0 : parseInt(stdout.trim()) || 0);
      });
    });
  }

  async getServiceStatus() {
    return new Promise((resolve) => {
      exec('systemctl is-active epc-service', (error, stdout) => {
        resolve({
          status: stdout.trim(),
          running: stdout.trim() === 'active'
        });
      });
    });
  }

  async sendToAPI(endpoint, data) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.config.cloudApiUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const postData = JSON.stringify(data);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': 'Bearer ' + this.config.apiKey,
          'x-tenant-id': this.config.tenantId
        }
      };
      
      const req = client.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(responseData || '{}'));
          } else {
            reject(new Error('HTTP ' + res.statusCode + ': ' + responseData));
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  shutdown() {
    this.isRunning = false;
    if (this.reportingTimer) clearInterval(this.reportingTimer);
    if (this.agent) this.agent.close();
  }
}

// Start the agent
const agent = new EPCSNMPAgent();
agent.initialize();

// Handle shutdown
process.on('SIGINT', () => agent.shutdown());
process.on('SIGTERM', () => agent.shutdown());
`;
}

/**
 * Generate complete cloud-init configuration with SNMP and APT integration
 */
function generateEnhancedCloudInit(config) {
  let cloudInit = `#cloud-config
# EPC Deployment with SNMP Agent and APT Repository
# Generated: ${new Date().toISOString()}

# Basic system configuration
hostname: ${config.site_name?.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() || 'epc-site'}
manage_etc_hosts: true

# Package updates and installations
package_update: true
package_upgrade: true

packages:
  - curl
  - wget
  - htop
  - net-tools
  - systemd
  - logrotate

# Write files and configurations
write_files:
  - path: /etc/epc/deployment-info.json
    content: |
      {
        "epcId": "${config.epc_id}",
        "tenantId": "${config.tenant_id}",
        "siteName": "${config.site_name}",
        "deployedAt": "${new Date().toISOString()}",
        "cloudApiUrl": "http://${config.gce_ip}:${config.hss_port}",
        "version": "1.0.0"
      }
    permissions: '0644'

# Run commands in order
runcmd:
  - mkdir -p /etc/epc /var/log/epc /opt/epc
  - echo "EPC deployment started at $(date)" >> /var/log/epc/deployment.log
`;

  // Add SNMP agent installation
  cloudInit += generateSNMPAgentInstallScript(config);

  // Add APT repository configuration
  cloudInit += generateAPTRepositoryScript(config);

  // Add final setup commands
  cloudInit += `
  # Final EPC setup and service start
  - name: finalize-epc-setup
    cmd: |
      echo "Finalizing EPC setup..."
      
      # Set up log rotation for EPC logs
      cat > /etc/logrotate.d/epc << 'EOFLOGROTATE'
/var/log/epc/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOFLOGROTATE
      
      # Create EPC status check script
      cat > /usr/local/bin/epc-health-check << 'EOFHEALTH'
#!/bin/bash
# EPC Health Check Script
systemctl is-active --quiet epc-service && echo "EPC: OK" || echo "EPC: FAILED"
systemctl is-active --quiet epc-snmp-agent && echo "SNMP: OK" || echo "SNMP: FAILED"
EOFHEALTH
      chmod +x /usr/local/bin/epc-health-check
      
      # Final deployment notification
      echo "EPC deployment completed at $(date)" >> /var/log/epc/deployment.log
      echo "EPC ID: ${config.epc_id}" >> /var/log/epc/deployment.log
      echo "Tenant ID: ${config.tenant_id}" >> /var/log/epc/deployment.log
      
      # Notify cloud of successful deployment
      if [ -f "/opt/epc-snmp-agent/config.json" ]; then
          /usr/local/bin/epc-update-status "deployed"
      fi

# Power state changes
power_state:
  delay: "+1"
  mode: reboot
  message: "EPC deployment complete, rebooting..."
  timeout: 30
  condition: True
`;

  return cloudInit;
}

module.exports = {
  generateSNMPAgentInstallScript,
  generateAPTRepositoryScript,
  generateEmbeddedSNMPAgent,
  generateEnhancedCloudInit
};
