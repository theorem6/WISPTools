// EPC Deployment - ISO Generation and Download
// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED FILE - CRITICAL ISO GENERATION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════
// 
// ⚠️  DO NOT MODIFY unless fixing ISO generation bugs
// ⚠️  This file generates Debian netinstall ISOs with text-only installer
// ⚠️  Changes to installation routine can break EPC deployment
// 
// DEPENDENCIES:
//   - gce-backend/utils/iso-helpers.js (cloud-init config)
//   - gce-backend/utils/bootstrap-helpers.js (bootstrap script)
//   - gce-backend/utils/deployment-helpers.js (full deployment script)
// 
// INSTALLATION TYPE: Debian text-only netinstall (no GUI/TUI)
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Import isolated helper functions
const { generateCloudInitConfig } = require('../utils/iso-helpers');
const { generateBootstrapScript } = require('../utils/bootstrap-helpers');
const { generateFullDeploymentScript } = require('../utils/deployment-helpers');

const execAsync = promisify(exec);
const router = express.Router();

// Configuration - DO NOT CHANGE
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
    
    // Generate cloud-init config using isolated helper
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
# Force non-interactive installation (no GUI, no prompts)
d-i debian-installer/locale string en_US.UTF-8
d-i debian-installer/country string US
d-i debian-installer/language string en
d-i console-keymaps-at/keymap select us
d-i keyboard-configuration/xkb-keymap select us
d-i keyboard-configuration/layoutcode string us

# Skip all interactive prompts
d-i debconf/priority select critical
d-i netcfg/choose_interface select auto
d-i netcfg/get_hostname string epc-host
d-i netcfg/get_domain string local
d-i netcfg/wireless_wep string
d-i mirror/http/hostname string deb.debian.org
d-i mirror/http/directory string /debian
d-i mirror/http/proxy string
d-i mirror/country string US

# Partitioning - fully automatic
d-i partman-auto/method string regular
d-i partman-auto/choose_recipe select atomic
d-i partman-auto/expert_recipe string atomic :: \
    1000 1000 1000 ext4 \
    \$primary{ } \$bootable{ } \
    method{ format } \
    format{ } \
    use_filesystem{ } \
    filesystem{ ext4 } \
    mountpoint{ / } .
d-i partman-partitioning/confirm_write_new_label boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
d-i partman/confirm_write_new_label boolean true
d-i partman-auto/disk string /dev/sda
d-i partman-auto/init_automatically_partition select biggest_free
d-i partman-md/device_remove_md boolean true
d-i partman-lvm/device_remove_lvm boolean true
d-i partman-lvm/confirm boolean true
d-i partman-lvm/confirm_nooverwrite boolean true

# Package selection - TEXT-ONLY INSTALL (NO DESKTOP/GUI)
# ⚠️  DO NOT MODIFY: EPC requires headless text-only installation
tasksel tasksel/first multiselect standard, ssh-server
tasksel tasksel/skip-tasks string ^.*desktop^, ^.*x11^, ^.*gnome^, ^.*kde^
d-i pkgsel/include string curl wget ca-certificates jq gnupg lsb-release
d-i pkgsel/upgrade select none
d-i pkgsel/update-policy select none

# Grub installation
d-i grub-installer/only_debian boolean true
d-i grub-installer/with_other_os boolean true
d-i finish-install/keep-consoles boolean true
d-i debian-installer/exit/poweroff boolean false
d-i debian-installer/exit/halt boolean false
d-i preseed/early_command string anna-install selinux-utils || true
d-i pkgsel/include string curl wget ca-certificates jq gnupg lsb-release
d-i finish-install/reboot_in_progress note
d-i preseed/late_command string \\
    mkdir -p /target/etc/wisptools /target/opt/wisptools /target/var/lib/wisptools; \\
    echo 'EPC_ID=${epc_id}' > /target/etc/wisptools/credentials.env; \\
    echo 'TENANT_ID=${tenant_id}' >> /target/etc/wisptools/credentials.env; \\
    echo 'EPC_AUTH_CODE=${auth_code}' >> /target/etc/wisptools/credentials.env; \\
    echo 'EPC_API_KEY=${api_key}' >> /target/etc/wisptools/credentials.env; \\
    echo 'EPC_SECRET_KEY=${secret_key}' >> /target/etc/wisptools/credentials.env; \\
    echo 'GCE_SERVER=${GCE_PUBLIC_IP}' >> /target/etc/wisptools/credentials.env; \\
    echo 'HSS_PORT=${HSS_PORT}' >> /target/etc/wisptools/credentials.env; \\
    echo 'ORIGIN_HOST_FQDN=${originHostFQDN}' >> /target/etc/wisptools/credentials.env; \\
    chmod 600 /target/etc/wisptools/credentials.env; \\
    wget -O /target/opt/wisptools/bootstrap.sh http://${GCE_PUBLIC_IP}:${HSS_PORT}/api/epc/${epc_id}/bootstrap?auth_code=${auth_code}; \\
    chmod +x /target/opt/wisptools/bootstrap.sh; \\
    cat > /target/etc/systemd/system/wisptools-bootstrap.service << 'EOF_SERVICE' \\
[Unit]\\
Description=WISPTools EPC Bootstrap and Deployment\\
After=network-online.target\\
Wants=network-online.target\\
ConditionPathExists=!/var/lib/wisptools/.bootstrapped\\

[Service]\\
Type=oneshot\\
ExecStart=/opt/wisptools/bootstrap.sh\\
RemainAfterExit=yes\\
StandardOutput=journal+console\\
StandardError=journal+console\\
TimeoutStartSec=3600\\

[Install]\\
WantedBy=multi-user.target\\
EOF_SERVICE\\
    chroot /target systemctl enable wisptools-bootstrap.service; \\
    echo "WISPTools EPC bootstrap service configured for EPC ${epc_id}"
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
set timeout=3
set default=auto
insmod gzio

menuentry "Debian 12 Netboot (Automated EPC Install)" --id auto {
  # ⚠️  TEXT-ONLY INSTALL: No VGA/framebuffer - pure text console only
  # Removed all vga/video parameters - framebuffer completely disabled
  # nomodeset nofb = disable framebuffer, console only to serial/tty
  linux /debian/vmlinuz auto=true priority=critical preseed/url=http://\${GCE_PUBLIC_IP}/downloads/netboot/\${PRESEED_NAME} preseed/file=/cdrom/preseed.cfg preseed/interactive=false DEBIAN_FRONTEND=text DEBCONF_NONINTERACTIVE_SEEN=true net.ifnames=0 biosdevname=0 nomodeset nofb console=ttyS0,115200n8 console=tty1 text ---
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
 * Generate a minimal bootable ISO for a specific EPC (legacy endpoint)
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
    
    // Generate Origin-Host FQDN
    const mmeUniqueId = `mme-${epc_id.substring(4, 12)}`;
    const originHostFQDN = `${mmeUniqueId}.wisptools.io`;
    
    // Generate unique ISO filename
    const timestamp = Date.now();
    const iso_filename = `wisptools-epc-${epc_id}-${timestamp}.iso`;
    const iso_path = path.join(ISO_OUTPUT_DIR, iso_filename);
    
    // Create ISO build directory
    const buildDir = path.join(ISO_BUILD_DIR, `build-${epc_id}-${timestamp}`);
    await fs.mkdir(buildDir, { recursive: true });
    
    // Generate cloud-init config using isolated helper
    const cloudInitUserData = generateCloudInitConfig({
      epc_id,
      tenant_id,
      auth_code,
      api_key,
      secret_key,
      site_name,
      gce_ip: GCE_PUBLIC_IP,
      hss_port: HSS_PORT,
      origin_host_fqdn: originHostFQDN
    });
    
    // Create autoinstall directory
    const autoinstallDir = path.join(buildDir, 'autoinstall');
    await fs.mkdir(autoinstallDir, { recursive: true });
    await fs.writeFile(path.join(autoinstallDir, 'user-data'), cloudInitUserData);
    await fs.writeFile(path.join(autoinstallDir, 'meta-data'), `instance-id: epc-${epc_id}\nlocal-hostname: ${site_name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}\n`);
    
    // Build script using Debian netboot (same as above endpoint)
    const buildScript = path.join(buildDir, 'build.sh');
    const buildScriptContent = `#!/bin/bash
set -e

BUILD_DIR="${buildDir}"
ISO_PATH="${iso_path}"
KERNEL_PATH="${KERNEL_PATH}"
INITRD_PATH="${INITRD_PATH}"

echo "[Build] Starting bootable ISO creation (Debian netboot)..."
echo "[Build] EPC ID: ${epc_id}"
echo "[Build] Output: $ISO_PATH"

MIN_DIR_FOR_KERNEL="$(dirname "$KERNEL_PATH")"
mkdir -p "$MIN_DIR_FOR_KERNEL"

# Download Debian netboot kernel/initrd
echo "[Build] Downloading Debian netboot files..."
DEBIAN_NETBOOT_BASE="https://deb.debian.org/debian/dists/bookworm/main/installer-amd64/current/images/netboot/debian-installer/amd64"
rm -f "$KERNEL_PATH" "$INITRD_PATH" 2>/dev/null || true
wget -q --timeout=30 --tries=3 -O "$KERNEL_PATH" "$DEBIAN_NETBOOT_BASE/linux" || { echo "[Build] ERROR: Failed to download kernel"; exit 1; }
wget -q --timeout=30 --tries=3 -O "$INITRD_PATH" "$DEBIAN_NETBOOT_BASE/initrd.gz" || { echo "[Build] ERROR: Failed to download initrd"; exit 1; }

# Verify downloads
if [ ! -s "$KERNEL_PATH" ] || [ ! -s "$INITRD_PATH" ]; then
  echo "[Build] ERROR: Downloaded files are empty or missing"
  exit 1
fi

# Clean up old builds
rm -rf "$BUILD_DIR" 2>/dev/null || true
NETBOOT_DIR="/var/www/html/downloads/netboot"
mkdir -p "$NETBOOT_DIR"

# Generate preseed
PRESEED_NAME="preseed-${epc_id}-$(date +%s).cfg"
cat > "$NETBOOT_DIR/$PRESEED_NAME" << 'PRESEED_EOF'
# Force non-interactive installation (no GUI, no prompts)
d-i debian-installer/locale string en_US.UTF-8
d-i debian-installer/country string US
d-i debian-installer/language string en
d-i console-keymaps-at/keymap select us
d-i keyboard-configuration/xkb-keymap select us
d-i keyboard-configuration/layoutcode string us

# Skip all interactive prompts
d-i debconf/priority select critical
d-i netcfg/choose_interface select auto
d-i netcfg/get_hostname string epc-host
d-i netcfg/get_domain string local
d-i netcfg/wireless_wep string
d-i mirror/http/hostname string deb.debian.org
d-i mirror/http/directory string /debian
d-i mirror/http/proxy string
d-i mirror/country string US

# Partitioning - fully automatic
d-i partman-auto/method string regular
d-i partman-auto/choose_recipe select atomic
d-i partman-auto/expert_recipe string atomic :: \
    1000 1000 1000 ext4 \
    \$primary{ } \$bootable{ } \
    method{ format } \
    format{ } \
    use_filesystem{ } \
    filesystem{ ext4 } \
    mountpoint{ / } .
d-i partman-partitioning/confirm_write_new_label boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
d-i partman/confirm_write_new_label boolean true
d-i partman-auto/disk string /dev/sda
d-i partman-auto/init_automatically_partition select biggest_free
d-i partman-md/device_remove_md boolean true
d-i partman-lvm/device_remove_lvm boolean true
d-i partman-lvm/confirm boolean true
d-i partman-lvm/confirm_nooverwrite boolean true

# Package selection - TEXT-ONLY INSTALL (NO DESKTOP/GUI)
# ⚠️  DO NOT MODIFY: EPC requires headless text-only installation
tasksel tasksel/first multiselect standard, ssh-server
tasksel tasksel/skip-tasks string ^.*desktop^, ^.*x11^, ^.*gnome^, ^.*kde^
d-i pkgsel/include string curl wget ca-certificates jq gnupg lsb-release
d-i pkgsel/upgrade select none
d-i pkgsel/update-policy select none

# Grub installation
d-i grub-installer/only_debian boolean true
d-i grub-installer/with_other_os boolean true
d-i finish-install/keep-consoles boolean true
d-i debian-installer/exit/poweroff boolean false
d-i debian-installer/exit/halt boolean false
d-i preseed/early_command string anna-install selinux-utils || true
d-i pkgsel/include string curl wget ca-certificates jq gnupg lsb-release
d-i finish-install/reboot_in_progress note
d-i preseed/late_command string \\
    in-target mkdir -p /etc/wisptools /opt/wisptools; \\
    in-target /bin/sh -c 'cat > /etc/wisptools/credentials.env <<"CREDS"\\nEPC_ID=${epc_id}\\nTENANT_ID=${tenant_id}\\nEPC_AUTH_CODE=${auth_code}\\nEPC_API_KEY=${api_key}\\nEPC_SECRET_KEY=${secret_key}\\nGCE_SERVER=${GCE_PUBLIC_IP}\\nHSS_PORT=${HSS_PORT}\\nORIGIN_HOST_FQDN=${originHostFQDN}\\nCREDS'; \\
    in-target wget -O /opt/wisptools/bootstrap.sh http://${GCE_PUBLIC_IP}:${HSS_PORT}/api/epc/${epc_id}/bootstrap?auth_code=${auth_code}; \\
    in-target chmod +x /opt/wisptools/bootstrap.sh; \\
    in-target /bin/sh -c 'cat > /etc/systemd/system/wisptools-bootstrap.service <<"UNIT"\\n[Unit]\\nDescription=WISPTools EPC Bootstrap\\nAfter=network-online.target\\nWants=network-online.target\\nConditionPathExists=!/var/lib/wisptools/.bootstrapped\\n\\n[Service]\\nType=oneshot\\nExecStart=/opt/wisptools/bootstrap.sh\\nRemainAfterExit=yes\\n\\n[Install]\\nWantedBy=multi-user.target\\nUNIT'; \\
    in-target systemctl enable wisptools-bootstrap.service
PRESEED_EOF

# Build ISO
ISO_ROOT="$BUILD_DIR/iso_root"
rm -rf "$ISO_ROOT" 2>/dev/null || true
mkdir -p "$ISO_ROOT/debian" "$ISO_ROOT/boot/grub"
cp "$KERNEL_PATH" "$ISO_ROOT/debian/vmlinuz" || { echo "[Build] ERROR: Failed to copy kernel"; exit 1; }
cp "$INITRD_PATH" "$ISO_ROOT/debian/initrd.gz" || { echo "[Build] ERROR: Failed to copy initrd"; exit 1; }

cat > "$ISO_ROOT/boot/grub/grub.cfg" << GRUBCFG
set timeout=0
set default=auto
insmod gzio

menuentry "Debian 12 Netboot (Automated EPC Install)" --id auto {
  # ⚠️  TEXT-ONLY INSTALL: No VGA/framebuffer - pure text console only
  # Removed all vga/video parameters - framebuffer completely disabled
  # nomodeset nofb = disable framebuffer, console only to serial/tty
  linux /debian/vmlinuz auto=true priority=critical preseed/url=http://\${GCE_PUBLIC_IP}/downloads/netboot/\${PRESEED_NAME} preseed/file=/cdrom/preseed.cfg preseed/interactive=false DEBIAN_FRONTEND=text DEBCONF_NONINTERACTIVE_SEEN=true net.ifnames=0 biosdevname=0 nomodeset nofb console=ttyS0,115200n8 console=tty1 text ---
  initrd /debian/initrd.gz
}

menuentry "Debian 12 Netboot (Manual)" {
  linux /debian/vmlinuz ---
  initrd /debian/initrd.gz
}
GRUBCFG

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
    } catch (buildError) {
      console.error('[ISO Generator] Build failed:', buildError);
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
      origin_host_fqdn: originHostFQDN,
      message: 'ISO generated successfully!'
    });
    
  } catch (error) {
    console.error('[ISO Generator] Error:', error);
    res.status(500).json({ error: 'Failed to generate ISO', details: error.message });
  }
});

/**
 * Download EPC bootstrap script
 * This is called by the ISO during first boot
 * GET /api/epc/:epc_id/bootstrap
 */
router.get('/:epc_id/bootstrap', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { auth_code } = req.query;
    
    console.log(`[Bootstrap] Request for EPC: ${epc_id}`);
    
    // Verify auth_code
    if (!auth_code) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Generate bootstrap script using isolated helper
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
 * GET /api/epc/:epc_id/full-deployment
 */
router.get('/:epc_id/full-deployment', async (req, res) => {
  try {
    const { epc_id } = req.params;
    const { auth_code } = req.query;
    
    console.log(`[Full Deployment] Request for EPC: ${epc_id}`);
    
    // Verify auth_code
    if (!auth_code) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Generate full deployment script using isolated helper
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

module.exports = router;
