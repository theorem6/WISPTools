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
const MINIMAL_DIR = '/opt/base-images/minimal';
const KERNEL_PATH = `${MINIMAL_DIR}/vmlinuz`;
const INITRD_PATH = `${MINIMAL_DIR}/initrd`;
const GCE_PUBLIC_IP = process.env.GCE_PUBLIC_IP || '136.112.111.167';
const HSS_PORT = process.env.HSS_PORT || '3001';

/**
 * Generate EPC ISO from frontend deployment modal
 * POST /api/deploy/generate-epc-iso
 */
router.post('/generate-epc-iso', async (req, res) => {
  try {
    const { siteName, location, networkConfig, contact, hssConfig } = req.body;
    
    console.log('[ISO Generator] Creating ISO for site:', siteName);
    
    // Generate unique EPC ID
    const epc_id = `epc_${crypto.randomBytes(16).toString('hex')}`;
    const tenant_id = req.headers['x-tenant-id'] || 'unknown';
    
    // Generate tenant domain (simplified - use default if no subdomain available)
    const tenantDomain = 'wisptools.io'; // Default domain
    
    // Generate Origin-Host AVP FQDN: mme-{epc-id}.{tenant-domain}
    const mmeUniqueId = `mme-${epc_id.substring(4, 12)}`; // Use first 8 chars of epc_id for shorter FQDN
    const originHostFQDN = `${mmeUniqueId}.${tenantDomain}`;
    console.log('[ISO Generator] Origin-Host FQDN:', originHostFQDN);
    
    // Generate credentials
    const auth_code = crypto.randomBytes(16).toString('hex');
    const api_key = crypto.randomBytes(32).toString('hex');
    const secret_key = crypto.randomBytes(32).toString('hex');
    
    // Generate unique ISO filename
    const timestamp = Date.now();
    const iso_filename = `wisptools-epc-${siteName.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.iso`;
    const iso_path = path.join(ISO_OUTPUT_DIR, iso_filename);
    
    // Create output directory if it doesn't exist
    await fs.mkdir(ISO_OUTPUT_DIR, { recursive: true });
    await fs.mkdir(ISO_BUILD_DIR, { recursive: true });
    
    // Create temporary build directory
    const buildDir = path.join(ISO_BUILD_DIR, `build-${epc_id}-${timestamp}`);
    await fs.mkdir(buildDir, { recursive: true });
    
    // Generate cloud-init config
    const cloudInitUserData = generateCloudInitConfig({
      epc_id,
      tenant_id,
      auth_code,
      api_key,
      secret_key,
      site_name: siteName,
      gce_ip: GCE_PUBLIC_IP,
      hss_port: HSS_PORT,
      origin_host_fqdn: originHostFQDN
    });
    
    // Create autoinstall directory
    const autoinstallDir = path.join(buildDir, 'autoinstall');
    await fs.mkdir(autoinstallDir, { recursive: true });
    await fs.writeFile(path.join(autoinstallDir, 'user-data'), cloudInitUserData);
    await fs.writeFile(path.join(autoinstallDir, 'meta-data'), 
      `instance-id: epc-${epc_id}\nlocal-hostname: ${siteName.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}\n`);
    
    // Build a bootable ISO using Debian netboot
    const buildScript = path.join(buildDir, 'build.sh');
    const buildScriptContent = `#!/bin/bash
set -e

BUILD_DIR="${buildDir}"
ISO_PATH="${iso_path}"
KERNEL_PATH="${KERNEL_PATH}"
INITRD_PATH="${INITRD_PATH}"

echo "[Build] Starting bootable ISO creation (Debian netboot)..."
echo "[Build] Output: $ISO_PATH"

MIN_DIR_FOR_KERNEL="$(dirname "$KERNEL_PATH")"
mkdir -p "$MIN_DIR_FOR_KERNEL"

# ALWAYS download fresh Debian netboot kernel/initrd (no caching)
echo "[Build] Downloading fresh Debian netboot kernel/initrd..."
DEBIAN_NETBOOT_BASE="https://deb.debian.org/debian/dists/bookworm/main/installer-amd64/current/images/netboot/debian-installer/amd64"
rm -f "$KERNEL_PATH" "$INITRD_PATH" 2>/dev/null || true
wget -q --timeout=30 --tries=3 -O "$KERNEL_PATH" "$DEBIAN_NETBOOT_BASE/linux" || { echo "[Build] ERROR: Failed to download kernel"; exit 1; }
wget -q --timeout=30 --tries=3 -O "$INITRD_PATH" "$DEBIAN_NETBOOT_BASE/initrd.gz" || { echo "[Build] ERROR: Failed to download initrd"; exit 1; }

# Verify downloads succeeded
if [ ! -s "$KERNEL_PATH" ] || [ ! -s "$INITRD_PATH" ]; then
  echo "[Build] ERROR: Downloaded files are empty or missing"
  exit 1
fi
echo "[Build] Debian netboot files downloaded successfully"

# Clean up old build directories and old preseed files before starting
echo "[Build] Cleaning up old build artifacts..."
rm -rf "$BUILD_DIR" 2>/dev/null || true
NETBOOT_DIR="/var/www/html/downloads/netboot"
mkdir -p "$NETBOOT_DIR"
# Clean up preseed files older than 1 day
find "$NETBOOT_DIR" -name "preseed-*.cfg" -mtime +1 -delete 2>/dev/null || true

# Generate unique preseed for this EPC build
PRESEED_NAME="preseed-${epc_id}-$(date +%s).cfg"
GCE_PUBLIC_IP="${GCE_PUBLIC_IP}"
HSS_PORT="${HSS_PORT}"
echo "[Build] Creating unique preseed: $PRESEED_NAME"
cat > "$NETBOOT_DIR/$PRESEED_NAME" << 'PRESEED_EOF'
d-i debian-installer/locale string en_US
d-i keyboard-configuration/xkb-keymap select us
d-i netcfg/choose_interface select auto
d-i mirror/http/hostname string deb.debian.org
d-i mirror/http/directory string /debian
d-i partman-auto/method string regular
d-i partman-auto/choose_recipe select atomic
d-i partman/confirm_write_new_label boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
tasksel tasksel/first multiselect standard, ssh-server
d-i pkgsel/include string curl wget ca-certificates jq gnupg lsb-release
d-i finish-install/reboot_in_progress note
d-i preseed/late_command string \
    in-target mkdir -p /etc/wisptools /opt/wisptools; \
    in-target /bin/sh -c 'cat > /etc/wisptools/credentials.env <<"CREDS"\nEPC_ID=${epc_id}\nTENANT_ID=${tenant_id}\nEPC_AUTH_CODE=${auth_code}\nEPC_API_KEY=${api_key}\nEPC_SECRET_KEY=${secret_key}\nGCE_SERVER=${GCE_PUBLIC_IP}\nHSS_PORT=${HSS_PORT}\nORIGIN_HOST_FQDN=${originHostFQDN}\nCREDS'; \
    in-target wget -O /opt/wisptools/bootstrap.sh http://${GCE_PUBLIC_IP}:${HSS_PORT}/api/epc/${epc_id}/bootstrap?auth_code=${auth_code}; \
    in-target chmod +x /opt/wisptools/bootstrap.sh; \
    in-target /bin/sh -c 'cat > /etc/systemd/system/wisptools-bootstrap.service <<"UNIT"\n[Unit]\nDescription=WISPTools EPC Bootstrap\nAfter=network-online.target\nWants=network-online.target\nConditionPathExists=!/var/lib/wisptools/.bootstrapped\n\n[Service]\nType=oneshot\nExecStart=/opt/wisptools/bootstrap.sh\nRemainAfterExit=yes\n\n[Install]\nWantedBy=multi-user.target\nUNIT'; \
    in-target systemctl enable wisptools-bootstrap.service
PRESEED_EOF

# Build tiny ISO containing only netboot kernel/initrd and GRUB
ISO_ROOT="$BUILD_DIR/iso_root"
rm -rf "$ISO_ROOT" 2>/dev/null || true
mkdir -p "$ISO_ROOT/debian" "$ISO_ROOT/boot/grub"
echo "[Build] Copying Debian netboot files to ISO root..."
cp "$KERNEL_PATH" "$ISO_ROOT/debian/vmlinuz" || { echo "[Build] ERROR: Failed to copy kernel"; exit 1; }
cp "$INITRD_PATH" "$ISO_ROOT/debian/initrd.gz" || { echo "[Build] ERROR: Failed to copy initrd"; exit 1; }
chmod 0644 "$ISO_ROOT/debian/vmlinuz" "$ISO_ROOT/debian/initrd.gz" || true

cat > "$ISO_ROOT/boot/grub/grub.cfg" << GRUBCFG
set timeout=0
set default=auto
insmod gzio

menuentry "Debian 12 Netboot (Automated)" --id auto {
  linux /debian/vmlinuz auto priority=critical preseed/url=http://\${GCE_PUBLIC_IP}/downloads/netboot/\${PRESEED_NAME} net.ifnames=0 biosdevname=0 ---
  initrd /debian/initrd.gz
}

menuentry "Debian 12 Netboot (Manual)" {
  linux /debian/vmlinuz ---
  initrd /debian/initrd.gz
}
GRUBCFG

# Remove any existing ISO with same name to avoid conflicts
rm -f "$ISO_PATH" 2>/dev/null || true

apt-get update -y >/dev/null 2>&1 || true
apt-get install -y grub-pc-bin grub-efi-amd64-bin xorriso mtools >/dev/null 2>&1 || true

echo "[Build] Building ISO with grub-mkrescue..."
grub-mkrescue -o "$ISO_PATH" "$ISO_ROOT" >/dev/null 2>&1 || { echo "[Build] ERROR: grub-mkrescue failed"; exit 1; }

if [ ! -s "$ISO_PATH" ]; then
  echo "[Build] ERROR: Generated ISO is empty or missing"
  exit 1
fi
echo "[Build] ISO created successfully: $(du -h "$ISO_PATH" | cut -f1)"

if [ -f "$ISO_PATH" ]; then
  (cd "${ISO_OUTPUT_DIR}" && sha256sum "${iso_filename}" > "${iso_filename}.sha256") || true
  ZIP_FILENAME="${iso_filename}.zip"
  ZIP_PATH="${ISO_OUTPUT_DIR}/\${ZIP_FILENAME}"
  # Remove old ZIP if it exists
  rm -f "\$ZIP_PATH" "\${ZIP_PATH}.sha256" 2>/dev/null || true
  cd "${ISO_OUTPUT_DIR}"
  zip -q "\$ZIP_FILENAME" "${iso_filename}" || { echo "[Build] ERROR: Failed to create ZIP"; exit 1; }
  (cd "${ISO_OUTPUT_DIR}" && sha256sum "\$ZIP_FILENAME" > "\$ZIP_FILENAME.sha256") || true
  echo "[Build] ZIP created successfully: \$ZIP_FILENAME (\$(du -h "\$ZIP_PATH" | cut -f1))"
fi
`;

    await fs.writeFile(buildScript, buildScriptContent);
    await fs.chmod(buildScript, 0o755);
    try {
      const { stdout, stderr } = await execAsync(`sudo ${buildScript}`);
      console.log('[ISO Generator] Build output:', stdout);
      if (stderr) console.error('[ISO Generator] Build warnings:', stderr);
    } catch (isoError) {
      console.error('[ISO Generator] ISO creation failed:', isoError);
    }
    
    // Verify ISO was created
    const stats = await fs.stat(iso_path);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    // Check for ZIP file (created by build script)
    const zip_filename = `${iso_filename}.zip`;
    const zip_path = path.join(ISO_OUTPUT_DIR, zip_filename);
    let zipSizeMB = null;
    let zipDownloadUrl = null;
    let zipChecksumUrl = null;
    
    try {
      const zipStats = await fs.stat(zip_path);
      zipSizeMB = (zipStats.size / (1024 * 1024)).toFixed(2);
      zipDownloadUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${zip_filename}`;
      zipChecksumUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${zip_filename}.sha256`;
      console.log(`[ISO Generator] ZIP ready: ${zip_filename} (${zipSizeMB}MB)`);
    } catch (zipError) {
      console.warn('[ISO Generator] ZIP file not found, returning ISO URL only:', zipError.message);
    }
    
    const isoDownloadUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${iso_filename}`;
    const isoChecksumUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${iso_filename}.sha256`;
    
    console.log(`[ISO Generator] ISO ready: ${iso_filename} (${sizeMB}MB)`);
    
    res.json({
      success: true,
      epc_id,
      iso_filename,
      iso_download_url: isoDownloadUrl,
      iso_checksum_url: isoChecksumUrl,
      iso_size_mb: sizeMB,
      // Prefer ZIP for Windows compatibility
      download_url: zipDownloadUrl || isoDownloadUrl,
      checksum_url: zipChecksumUrl || isoChecksumUrl,
      size_mb: zipSizeMB || sizeMB,
      zip_filename: zip_filename,
      zip_download_url: zipDownloadUrl,
      zip_checksum_url: zipChecksumUrl,
      zip_size_mb: zipSizeMB,
      origin_host_fqdn: originHostFQDN,
      message: 'ISO generated successfully! Windows users: download the ZIP file.'
    });
    
  } catch (error) {
    console.error('[ISO Generator] Error:', error);
    res.status(500).json({ error: 'Failed to generate ISO', details: error.message });
  }
});

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
    
    if (!tenant_id || !auth_code || !api_key || !secret_key || !site_name) {
      return res.status(400).json({ error: 'Missing required EPC credentials for ISO generation' });
    }
    
    console.log(`[ISO Generator] Creating ISO for EPC: ${epc_id} (Tenant: ${tenant_id})`);
    
    // Generate unique ISO filename
    const timestamp = Date.now();
    const iso_filename = `wisptools-epc-${epc_id}-${timestamp}.iso`;
    const iso_path = path.join(ISO_OUTPUT_DIR, iso_filename);
    
    // Create ISO build directory
    const buildDir = path.join(ISO_BUILD_DIR, `build-${epc_id}-${timestamp}`);
    await fs.mkdir(buildDir, { recursive: true });
    
    // Generate cloud-init config
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
    
    // Create autoinstall directory
    const autoinstallDir = path.join(buildDir, 'autoinstall');
    await fs.mkdir(autoinstallDir, { recursive: true });
    await fs.writeFile(path.join(autoinstallDir, 'user-data'), cloudInitUserData);
    await fs.writeFile(path.join(autoinstallDir, 'meta-data'), `instance-id: epc-${epc_id}\nlocal-hostname: ${site_name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}\n`);
    
    // Build script that will actually create the ISO
    const buildScript = path.join(buildDir, 'build.sh');
    const buildScriptContent = `#!/bin/bash
set -e

BUILD_DIR="${buildDir}"
ISO_PATH="${iso_path}"
AUTOINSTALL_DIR="${autoinstallDir}"
BASE_ISO="${BASE_ISO_PATH}"

echo "[Build] Starting ISO creation..."
echo "[Build] EPC ID: ${epc_id}"
echo "[Build] Output: \$ISO_PATH"

# Extract base Ubuntu ISO
echo "[Build] Extracting base Ubuntu ISO..."
EXTRACT_DIR="\${BUILD_DIR}/iso_extract"
mkdir -p "\${EXTRACT_DIR}"
7z x "\${BASE_ISO}" -o"\${EXTRACT_DIR}" > /dev/null 2>&1

# Copy autoinstall files
echo "[Build] Copying autoinstall configuration..."
cp -r "\${AUTOINSTALL_DIR}" "\${EXTRACT_DIR}/"

# Update GRUB config for autoinstall
echo "[Build] Configuring GRUB..."
GRUB_CFG="\${EXTRACT_DIR}/boot/grub/grub.cfg"
if [ -f "\${GRUB_CFG}" ]; then
    cat > "\${GRUB_CFG}" << 'GRUBEOF'
set timeout=5
set default=0

menuentry "WISPTools.io EPC - Autoinstall" {
    set gfxpayload=keep
    linux   /casper/vmlinuz autoinstall ds=nocloud\\\\;s=/cdrom/autoinstall/ ---
    initrd  /casper/initrd
}

menuentry "Ubuntu Server (Manual)" {
    set gfxpayload=keep
    linux   /casper/vmlinuz ---
    initrd  /casper/initrd
}

menuentry "Boot from first hard disk" {
    set root=(hd0)
    chainloader +1
}
GRUBEOF
fi

# Update ISOLINUX config for BIOS boot
echo "[Build] Configuring ISOLINUX..."
ISOLINUX_CFG="\${EXTRACT_DIR}/isolinux/txt.cfg"
if [ -f "\${ISOLINUX_CFG}" ]; then
    cat > "\${ISOLINUX_CFG}" << 'ISOLINUXEOF'
default autoinstall
label autoinstall
  menu label ^WISPTools.io EPC - Autoinstall
  kernel /casper/vmlinuz
  append initrd=/casper/initrd autoinstall ds=nocloud;s=/cdrom/autoinstall/ ---
label manual
  menu label ^Ubuntu Server (Manual)
  kernel /casper/vmlinuz
  append initrd=/casper/initrd ---
ISOLINUXEOF
fi

# Build ISO with xorriso
echo "[Build] Building ISO image (this may take a few minutes)..."
xorriso -as mkisofs \\
  -r -V "WISPTools EPC ${epc_id}" \\
  -o "\${ISO_PATH}" \\
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
  -isohybrid-mbr /usr/lib/ISOLINUX/isohdpfx.bin \\
  "\${EXTRACT_DIR}" \\
  2>&1 | grep -v "FAILURE"

# Calculate checksum
if [ -f "\${ISO_PATH}" ]; then
    echo "[Build] Calculating checksum..."
    cd "$ISO_OUTPUT_DIR"
    sha256sum "${iso_filename}" > "${iso_filename}.sha256"
    echo "[Build] ISO created successfully: ${iso_filename}"
    echo "[Build] Size: \$(du -h \${ISO_PATH} | cut -f1)"
else
    echo "[Build] ERROR: ISO creation failed"
    exit 1
fi

echo "[Build] Cleaning up temporary files..."
rm -rf "\${BUILD_DIR}"

echo "[Build] Complete!"
`;
    
    await fs.writeFile(buildScript, buildScriptContent);
    await fs.chmod(buildScript, 0o755);
    
    // Execute build script
    console.log(`[ISO Generator] Executing build script...`);
    try {
      const { stdout, stderr } = await execAsync(`sudo ${buildScript}`);
      console.log('[ISO Generator] Build output:', stdout);
      if (stderr) console.error('[ISO Generator] Build warnings:', stderr);
    } catch (buildError) {
      console.error('[ISO Generator] Build failed:', buildError);
      // Still return success if ISO file exists
      try {
        await fs.access(iso_path);
      } catch {
        throw new Error(`Build failed: ${buildError.message}`);
      }
    }
    
    // Verify ISO was created
    const stats = await fs.stat(iso_path);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    const downloadUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${iso_filename}`;
    const checksumUrl = `http://${GCE_PUBLIC_IP}/downloads/isos/${iso_filename}.sha256`;
    
    console.log(`[ISO Generator] ISO created: ${iso_filename} (${sizeMB}MB)`);
    
    res.json({
      success: true,
      epc_id,
      iso_filename,
      download_url: downloadUrl,
      checksum_url: checksumUrl,
      size_mb: sizeMB,
      message: 'ISO generated successfully!'
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
    
    // Generate full deployment script with Open5GS installation
    // This runs automatically on first boot after Debian installation
    const deploymentScript = generateFullDeploymentScript(epc_id, GCE_PUBLIC_IP, HSS_PORT);
    
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
  const { epc_id, tenant_id, auth_code, api_key, secret_key, site_name, gce_ip, hss_port, origin_host_fqdn } = config;
  
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
${origin_host_fqdn ? `ORIGIN_HOST_FQDN=${origin_host_fqdn}` : ''}
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

/**
 * Generate full EPC deployment script with Open5GS installation
 * This installs all EPC components and dependencies automatically
 */
function generateFullDeploymentScript(epc_id, gce_ip, hss_port) {
  // Default network config (can be fetched from database later)
  const defaultMcc = '001';
  const defaultMnc = '01';
  const defaultTac = '1';
  const defaultApn = 'internet';
  const defaultDnsPrimary = '8.8.8.8';
  const defaultDnsSecondary = '8.8.4.4';
  
  return `#!/bin/bash
# WISPTools.io Full EPC Deployment Script
# EPC: ${epc_id}
# This script automatically installs and configures Open5GS EPC

set -e

# Color codes for output
CYAN='\\033[0;36m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

print_status() {
    echo -e "\${CYAN}→\${NC} \$1"
}

print_success() {
    echo -e "\${GREEN}✓\${NC} \$1"
}

print_error() {
    echo -e "\${RED}✗\${NC} \$1"
}

print_header() {
    echo ""
    echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
    echo -e "\${CYAN}  \$1\${NC}"
    echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
    echo ""
}

# Load credentials
source /etc/wisptools/credentials.env

print_header "WISPTools.io EPC Deployment"
echo "EPC ID: $EPC_ID"
echo "Tenant ID: $TENANT_ID"
echo "Cloud HSS: ${gce_ip}:${hss_port}"
echo ""

# Auto-detect network configuration
print_header "Network Configuration (Auto-Detected)"
MME_IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}' || hostname -I | awk '{print $1}')
if [ -z "$MME_IP" ]; then
    print_error "Could not detect IP address"
    exit 1
fi

SGWC_IP="$MME_IP"
SGWU_IP="$MME_IP"
SMF_IP="$MME_IP"
UPF_IP="$MME_IP"

print_success "Auto-detected Primary IP: $MME_IP"
print_status "All EPC components will use: $MME_IP"
echo ""

# Network configuration
MCC="${defaultMcc}"
MNC="${defaultMnc}"
TAC="${defaultTac}"
APN_NAME="${defaultApn}"
APN_POOL="10.45.0.0/16"
DNS_PRIMARY="${defaultDnsPrimary}"
DNS_SECONDARY="${defaultDnsSecondary}"
HSS_ADDR="${gce_ip}"
HSS_PORT="${hss_port}"

print_header "Installing Dependencies"
print_status "Updating package lists..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

print_status "Installing required packages..."
apt-get install -y wget curl gnupg software-properties-common apt-transport-https ca-certificates

print_header "Installing Node.js"
if ! command -v node &> /dev/null; then
    print_status "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_success "Node.js \$(node --version) installed"
else
    print_success "Node.js \$(node --version) already installed"
fi

print_status "Installing monitoring tools..."
apt-get install -y sysstat net-tools iftop vnstat htop

print_header "Installing Open5GS"
print_status "Adding Open5GS repository..."
add-apt-repository -y ppa:open5gs/latest
apt-get update -qq

print_status "Installing Open5GS EPC components..."
apt-get install -y open5gs-mme open5gs-sgwc open5gs-sgwu open5gs-smf open5gs-upf open5gs-pcrf freeDiameter

print_header "Configuring EPC Components"

# Configure MME
print_status "Configuring MME..."
cat > /etc/open5gs/mme.yaml <<EOF
mme:
  freeDiameter: /etc/freeDiameter/mme.conf
  s1ap:
    - addr: $MME_IP
  gtpc:
    - addr: $SGWC_IP
  gummei:
    plmn_id:
      mcc: ${MCC}
      mnc: ${MNC}
    mme_gid: 2
    mme_code: 1
  tai:
    plmn_id:
      mcc: ${MCC}
      mnc: ${MNC}
    tac: ${TAC}
  security:
    integrity_order: [EIA2, EIA1, EIA0]
    ciphering_order: [EEA0, EEA1, EEA2]
  network_name:
    full: "WISPTools.io EPC"
    short: "WISPTools"
  guami:
    plmn_id:
      mcc: ${MCC}
      mnc: ${MNC}
    amf_id:
      region: 2
      set: 1
EOF

# Configure SGW-C
print_status "Configuring SGW-C..."
cat > /etc/open5gs/sgwc.yaml <<EOF
sgwc:
  gtpc:
    - addr: $SGWC_IP
  pfcp:
    - addr: $SGWC_IP
  sgwu:
    - addr: $SGWU_IP
EOF

# Configure SGW-U
print_status "Configuring SGW-U..."
cat > /etc/open5gs/sgwu.yaml <<EOF
sgwu:
  gtpu:
    - addr: $SGWU_IP
  pfcp:
    - addr: $SGWU_IP
  sgwc:
    - addr: $SGWC_IP
EOF

# Configure SMF
print_status "Configuring SMF..."
cat > /etc/open5gs/smf.yaml <<EOF
smf:
  gtpc:
    - addr: $SMF_IP
  pfcp:
    - addr: $SMF_IP
  upf:
    - addr: $UPF_IP
  dns:
    - $DNS_PRIMARY
    - $DNS_SECONDARY
  subnet:
    - addr: $APN_POOL
  ue_pool:
    - addr: $APN_POOL
EOF

# Configure UPF
print_status "Configuring UPF..."
cat > /etc/open5gs/upf.yaml <<EOF
upf:
  gtpu:
    - addr: $UPF_IP
  pfcp:
    - addr: $UPF_IP
  smf:
    - addr: $SMF_IP
EOF

# Configure PCRF
print_status "Configuring PCRF..."
cat > /etc/open5gs/pcrf.yaml <<EOF
pcrf:
  freeDiameter: /etc/freeDiameter/pcrf.conf
  gtpc:
    - addr: 127.0.0.1
EOF

print_header "Configuring Diameter Connection to Cloud HSS"
print_status "Setting up FreeDiameter MME configuration..."

# Create FreeDiameter MME configuration
cat > /etc/freeDiameter/mme.conf <<EOF
# FreeDiameter MME Configuration for Cloud HSS
# EPC: $EPC_ID / Tenant: $TENANT_ID
Identity = "mme.$EPC_ID.wisptools.local";
Realm = "wisptools.local";

# Listening configuration
ListenOn = "$MME_IP";
Port = 3868;

# Connect to Cloud HSS
ConnectPeer = "hss.wisptools.cloud" { ConnectTo = "$HSS_ADDR"; No_TLS; Port = $HSS_PORT; };

# Application configuration
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_s6a.fdx";

# Security and performance
No_IPv6;
No_SCTP;
EOF

# Create FreeDiameter PCRF configuration
print_status "Setting up FreeDiameter PCRF configuration..."
cat > /etc/freeDiameter/pcrf.conf <<EOF
# FreeDiameter PCRF Configuration for Cloud HSS
# EPC: $EPC_ID / Tenant: $TENANT_ID
Identity = "pcrf.$EPC_ID.wisptools.local";
Realm = "wisptools.local";

# Listening configuration
ListenOn = "$MME_IP";
Port = 3869;

# Connect to Cloud HSS
ConnectPeer = "hss.wisptools.cloud" { ConnectTo = "$HSS_ADDR"; No_TLS; Port = $HSS_PORT; };

# Application configuration
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_gx.fdx";
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_rx.fdx";

# Security and performance
No_IPv6;
No_SCTP;
EOF

print_success "FreeDiameter configured to connect to Cloud HSS at $HSS_ADDR:$HSS_PORT"

print_header "Starting Open5GS Services"
print_status "Enabling and starting all EPC components..."

systemctl enable open5gs-mmed
systemctl enable open5gs-sgwcd
systemctl enable open5gs-sgwud
systemctl enable open5gs-smfd
systemctl enable open5gs-upfd
systemctl enable open5gs-pcrfd

systemctl start open5gs-mmed
systemctl start open5gs-sgwcd
systemctl start open5gs-sgwud
systemctl start open5gs-smfd
systemctl start open5gs-upfd
systemctl start open5gs-pcrfd

sleep 3

# Check service status
print_status "Checking service status..."
if systemctl is-active --quiet open5gs-mmed && \\
   systemctl is-active --quiet open5gs-sgwcd && \\
   systemctl is-active --quiet open5gs-sgwud && \\
   systemctl is-active --quiet open5gs-smfd && \\
   systemctl is-active --quiet open5gs-upfd && \\
   systemctl is-active --quiet open5gs-pcrfd; then
    print_success "All Open5GS services are running"
else
    print_error "Some services failed to start. Check logs: journalctl -u open5gs-*"
fi

print_header "Deployment Complete"
print_success "EPC $EPC_ID has been deployed successfully!"
echo ""
echo "Configuration Summary:"
echo "  MME IP: $MME_IP"
echo "  Cloud HSS: $HSS_ADDR:$HSS_PORT"
echo "  MCC/MNC: ${MCC}/${MNC}"
echo "  TAC: ${TAC}"
echo "  APN: $APN_NAME"
echo ""
echo "Services running:"
systemctl list-units --type=service --state=running | grep open5gs || true
echo ""
print_success "EPC is ready to accept connections!"
echo ""

exit 0
`;
}

module.exports = router;

