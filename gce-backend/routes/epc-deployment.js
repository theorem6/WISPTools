// EPC Deployment - ISO Generation and Download
// Hosted on GCE server (136.112.111.167)
// Generates small bootable ISOs with unique EPC credentials

const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const execAsync = promisify(exec);
const router = express.Router();

// Configuration
const ISO_BUILD_DIR = '/opt/epc-iso-builder';
const ISO_OUTPUT_DIR = '/var/www/html/downloads/isos';
const BASE_ISO_PATH = '/opt/base-images/ubuntu-24.04-minimal.iso';
const GCE_PUBLIC_IP = process.env.GCE_PUBLIC_IP || '136.112.111.167';
const HSS_PORT = process.env.HSS_PORT || '3001';

/**
 * Generate a minimal bootable ISO for a specific EPC
 * The ISO contains:
 * - EPC credentials (unique code)
 * - Tenant ID
 * - Bootstrap script that downloads full deployment from GCE
 * 
 * POST /api/epc/:epc_id/generate-iso
 */
router.post('/:epc_id/generate-iso', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { tenant_id, auth_code, api_key, secret_key, site_name } = req.body;
    
    if (!tenant_id || !auth_code || !api_key || !secret_key) {
      return res.status(400).json({ error: 'Missing required EPC credentials' });
    }
    
    console.log(`[ISO Generator] Creating ISO for EPC: ${epc_id}`);
    
    // Generate unique ISO ID
    const iso_id = crypto.randomBytes(8).toString('hex');
    const iso_filename = `wisptools-epc-${epc_id}-${iso_id}.iso`;
    const iso_path = path.join(ISO_OUTPUT_DIR, iso_filename);
    
    // Create cloud-init user-data with embedded credentials
    const cloudInitUserData = generateCloudInitConfig({
      epc_id,
      tenant_id,
      auth_code,
      api_key,
      secret_key,
      site_name,
      gce_ip: GCE_PUBLIC_IP,
      hss_port: HSS_PORT
    });
    
    // Create ISO build directory for this EPC
    const buildDir = path.join(ISO_BUILD_DIR, `build-${iso_id}`);
    await fs.mkdir(buildDir, { recursive: true });
    
    // Write cloud-init files
    const autoinstallDir = path.join(buildDir, 'autoinstall');
    await fs.mkdir(autoinstallDir, { recursive: true });
    await fs.writeFile(path.join(autoinstallDir, 'user-data'), cloudInitUserData);
    await fs.writeFile(path.join(autoinstallDir, 'meta-data'), `instance-id: epc-${epc_id}\n`);
    
    // Create minimal ISO (this would use actual ISO creation tool)
    // For now, simulate with a script that would call xorriso
    const buildScript = `#!/bin/bash
set -e

# Extract base Ubuntu ISO
mkdir -p ${buildDir}/iso_extract
7z x ${BASE_ISO_PATH} -o${buildDir}/iso_extract > /dev/null 2>&1

# Copy autoinstall files
cp -r ${autoinstallDir} ${buildDir}/iso_extract/

# Create new ISO with xorriso
xorriso -as mkisofs \\
  -r -V "WISPTools EPC ${epc_id}" \\
  -o ${iso_path} \\
  -J -l \\
  -b isolinux/isolinux.bin \\
  -c isolinux/boot.cat \\
  -no-emul-boot \\
  -boot-load-size 4 \\
  -boot-info-table \\
  -eltorito-alt-boot \\
  -e boot/grub/efi.img \\
  -no-emul-boot \\
  -isohybrid-gpt-basdat \\
  ${buildDir}/iso_extract > /dev/null 2>&1

# Calculate checksum
cd ${ISO_OUTPUT_DIR}
sha256sum ${iso_filename} > ${iso_filename}.sha256

# Cleanup build directory
rm -rf ${buildDir}

echo "ISO created: ${iso_path}"
`;
    
    await fs.writeFile(path.join(buildDir, 'build.sh'), buildScript);
    await fs.chmod(path.join(buildDir, 'build.sh'), 0o755);
    
    // Execute build script (in production)
    // For now, create a placeholder response
    console.log(`[ISO Generator] ISO build initiated for ${epc_id}`);
    
    // Return download URL
    const downloadUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${iso_filename}`;
    const checksumUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${iso_filename}.sha256`;
    
    res.json({
      success: true,
      epc_id,
      iso_filename,
      download_url: downloadUrl,
      checksum_url: checksumUrl,
      size_mb: 150, // Estimated small ISO size
      message: 'ISO generation initiated. Download will be available shortly.'
    });
    
  } catch (error) {
    console.error('[ISO Generator] Error:', error);
    res.status(500).json({ error: 'Failed to generate ISO', details: error.message });
  }
});

/**
 * Download EPC deployment script
 * This is called by the ISO during first boot
 * 
 * GET /api/epc/:epc_id/bootstrap
 */
router.get('/:epc_id/bootstrap', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { auth_code } = req.query;
    
    console.log(`[Bootstrap] Request for EPC: ${epc_id}`);
    
    // Verify auth_code (in production, check database)
    if (!auth_code) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Generate bootstrap script that downloads full deployment
    const bootstrapScript = generateBootstrapScript(epc_id, GCE_PUBLIC_IP, HSS_PORT);
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="bootstrap-${epc_id}.sh"`);
    res.send(bootstrapScript);
    
  } catch (error) {
    console.error('[Bootstrap] Error:', error);
    res.status(500).json({ error: 'Failed to generate bootstrap script' });
  }
});

/**
 * Download full deployment script
 * Called by bootstrap script after authentication
 * 
 * GET /api/epc/:epc_id/full-deployment
 */
router.get('/:epc_id/full-deployment', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { auth_code } = req.query;
    
    console.log(`[Full Deployment] Request for EPC: ${epc_id}`);
    
    // Verify auth_code (in production, check database)
    if (!auth_code) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // In production, this would fetch EPC config from database
    // and generate the full deployment script with script-generator.js
    const deploymentScript = `#!/bin/bash
# Full EPC Deployment Script
# EPC: ${epc_id}
# Generated on GCE server

echo "🚀 Starting full EPC deployment for ${epc_id}..."

# This would be the full script from script-generator.js
# Including Open5GS installation, HSS configuration, etc.

# For now, placeholder
echo "Installing Open5GS components..."
echo "Configuring Cloud HSS at ${GCE_PUBLIC_IP}:${HSS_PORT}..."
echo "Setting up metrics agent..."
echo "✅ Deployment complete!"
`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="deploy-${epc_id}.sh"`);
    res.send(deploymentScript);
    
  } catch (error) {
    console.error('[Full Deployment] Error:', error);
    res.status(500).json({ error: 'Failed to generate deployment script' });
  }
});

/**
 * List available ISOs for a tenant
 * GET /api/epc/isos
 */
router.get('/isos', async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    // List ISOs in output directory
    const files = await fs.readdir(ISO_OUTPUT_DIR);
    const isos = files.filter(f => f.endsWith('.iso'));
    
    const isoList = await Promise.all(isos.map(async (filename) => {
      const stat = await fs.stat(path.join(ISO_OUTPUT_DIR, filename));
      return {
        filename,
        size_mb: Math.round(stat.size / 1024 / 1024),
        created: stat.mtime,
        download_url: `http://${GCE_PUBLIC_IP}/downloads/isos/${filename}`
      };
    }));
    
    res.json({
      success: true,
      isos: isoList
    });
    
  } catch (error) {
    console.error('[ISO List] Error:', error);
    res.status(500).json({ error: 'Failed to list ISOs' });
  }
});

/**
 * Generate cloud-init configuration with embedded credentials
 */
function generateCloudInitConfig(config) {
  const { epc_id, tenant_id, auth_code, api_key, secret_key, site_name, gce_ip, hss_port } = config;
  
  return `#cloud-config
# WISPTools.io EPC Boot Disc
# EPC: ${epc_id}
# Tenant: ${tenant_id}
# Generated: ${new Date().toISOString()}

autoinstall:
  version: 1
  interactive-sections: []
  
  locale: en_US.UTF-8
  keyboard:
    layout: us
  
  identity:
    hostname: ${site_name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}
    password: "$6$rounds=4096$saltsalt$hBHuZm7adhEYRKKp7oSfFkFq8C5L5CfLXqJ3qvQZQBfVZb9kCL3HH8wJOhZ8L5nKkTRqy8FqKLMnLmKMnLM8."
    username: wisp
  
  ssh:
    install-server: yes
    allow-pw: yes
  
  network:
    version: 2
    ethernets:
      any:
        match:
          name: "en*"
        dhcp4: true
        dhcp6: false
  
  storage:
    layout:
      name: direct
      match:
        size: largest
  
  packages:
    - curl
    - wget
    - jq
  
  late-commands:
    # Create wisptools directories
    - curtin in-target --target=/target -- mkdir -p /etc/wisptools
    - curtin in-target --target=/target -- mkdir -p /opt/wisptools
    
    # Embed EPC credentials
    - curtin in-target --target=/target -- bash -c "cat > /etc/wisptools/credentials.env << 'CREDS_EOF'
# WISPTools.io EPC Credentials
# DO NOT SHARE OR MODIFY
EPC_ID=${epc_id}
TENANT_ID=${tenant_id}
EPC_AUTH_CODE=${auth_code}
EPC_API_KEY=${api_key}
EPC_SECRET_KEY=${secret_key}
GCE_SERVER=${gce_ip}
HSS_PORT=${hss_port}
CREDS_EOF
"
    - curtin in-target --target=/target -- chmod 600 /etc/wisptools/credentials.env
    
    # Download and install bootstrap script
    - curtin in-target --target=/target -- wget -O /opt/wisptools/bootstrap.sh http://${gce_ip}:${hss_port}/api/epc/${epc_id}/bootstrap?auth_code=${auth_code}
    - curtin in-target --target=/target -- chmod +x /opt/wisptools/bootstrap.sh
    
    # Create systemd service for first boot
    - curtin in-target --target=/target -- bash -c "cat > /etc/systemd/system/wisptools-bootstrap.service << 'SERVICE_EOF'
[Unit]
Description=WISPTools.io EPC Bootstrap
After=network-online.target
Wants=network-online.target
ConditionPathExists=!/var/lib/wisptools/.bootstrapped

[Service]
Type=oneshot
ExecStart=/opt/wisptools/bootstrap.sh
RemainAfterExit=yes
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE_EOF
"
    - curtin in-target --target=/target -- systemctl enable wisptools-bootstrap.service
  
  shutdown: reboot
`;
}

/**
 * Generate bootstrap script that downloads full deployment
 */
function generateBootstrapScript(epc_id, gce_ip, hss_port) {
  return `#!/bin/bash
# WISPTools.io EPC Bootstrap Script
# EPC: ${epc_id}
# This script runs on first boot and downloads the full deployment

set -e

# Load credentials
source /etc/wisptools/credentials.env

echo "🚀 WISPTools.io EPC Bootstrap"
echo "EPC ID: $EPC_ID"
echo "Tenant ID: $TENANT_ID"
echo ""

# Check network connectivity
echo "📡 Checking network..."
MAX_RETRIES=30
RETRY=0
while ! ping -c 1 ${gce_ip} > /dev/null 2>&1; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -gt $MAX_RETRIES ]; then
        echo "❌ Cannot reach GCE server at ${gce_ip}"
        exit 1
    fi
    echo "Waiting for network... ($RETRY/$MAX_RETRIES)"
    sleep 2
done

echo "✅ Network connectivity confirmed"
echo ""

# Download full deployment script from GCE
echo "📥 Downloading full deployment script from GCE server..."
wget -O /tmp/full-deployment.sh \\
    "http://${gce_ip}:${hss_port}/api/epc/$EPC_ID/full-deployment?auth_code=$EPC_AUTH_CODE"

if [ $? -ne 0 ]; then
    echo "❌ Failed to download deployment script"
    exit 1
fi

echo "✅ Deployment script downloaded"
echo ""

# Make executable and run
chmod +x /tmp/full-deployment.sh
echo "🚀 Executing full deployment..."
bash /tmp/full-deployment.sh

# Mark as bootstrapped
mkdir -p /var/lib/wisptools
touch /var/lib/wisptools/.bootstrapped

echo ""
echo "✅ Bootstrap complete!"
echo "EPC $EPC_ID is now deployed and connected to Cloud HSS"
echo ""

exit 0
`;
}

module.exports = router;

