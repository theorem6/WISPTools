#!/bin/bash
# Setup Local APT Repository Mirror for WISPTools EPC Installer
# Mirrors essential Debian packages for offline/fast installation

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() { echo -e "${CYAN}▶${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

APT_REPO_DIR="/var/www/html/apt"
GPG_KEY_DIR="/opt/apt-keys"
DEBIAN_VERSION="bookworm"

echo ""
print_status "═══════════════════════════════════════════════════════════"
print_status "  Setting up Local APT Repository Mirror"
print_status "═══════════════════════════════════════════════════════════"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root"
    exit 1
fi

# Install required packages
print_status "Installing required packages..."
apt-get update -qq
apt-get install -y apt-mirror reprepro gnupg2

# Create directories
mkdir -p "$APT_REPO_DIR"/{conf,dists,pool,db}
mkdir -p "$GPG_KEY_DIR"

# ============================================================================
# Create GPG key for signing
# ============================================================================
if [ ! -f "$GPG_KEY_DIR/wisptools-repo.key" ]; then
    print_status "Generating GPG signing key..."
    
    cat > "$GPG_KEY_DIR/gpg-batch.conf" << 'GPGCONF'
%echo Generating WISPTools APT repository key
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: WISPTools APT Repository
Name-Email: apt@wisptools.io
Expire-Date: 0
%no-protection
%commit
%echo Done
GPGCONF

    gpg --batch --gen-key "$GPG_KEY_DIR/gpg-batch.conf"
    gpg --export --armor "apt@wisptools.io" > "$APT_REPO_DIR/wisptools-repo.gpg"
    gpg --export-secret-keys --armor "apt@wisptools.io" > "$GPG_KEY_DIR/wisptools-repo.key"
    chmod 600 "$GPG_KEY_DIR/wisptools-repo.key"
    
    print_success "GPG key generated"
else
    print_success "GPG key already exists"
fi

# ============================================================================
# Configure reprepro
# ============================================================================
print_status "Configuring reprepro..."

cat > "$APT_REPO_DIR/conf/distributions" << DISTCONF
Origin: WISPTools
Label: WISPTools APT Repository
Codename: stable
Architectures: amd64
Components: main
Description: WISPTools EPC packages and dependencies
SignWith: apt@wisptools.io
DISTCONF

cat > "$APT_REPO_DIR/conf/options" << OPTCONF
verbose
basedir $APT_REPO_DIR
OPTCONF

print_success "Reprepro configured"

# ============================================================================
# Add WISPTools installer package
# ============================================================================
print_status "Building WISPTools installer package..."

PACKAGE_BUILD_DIR="/tmp/wisptools-epc-installer"
rm -rf "$PACKAGE_BUILD_DIR"
mkdir -p "$PACKAGE_BUILD_DIR/DEBIAN"
mkdir -p "$PACKAGE_BUILD_DIR/opt/wisptools"
mkdir -p "$PACKAGE_BUILD_DIR/etc/wisptools"
mkdir -p "$PACKAGE_BUILD_DIR/etc/systemd/system"

# Copy scripts if they exist
if [ -f "/var/www/html/downloads/netboot/checkin.sh" ]; then
    cp "/var/www/html/downloads/netboot/checkin.sh" "$PACKAGE_BUILD_DIR/opt/wisptools/"
fi
if [ -f "/var/www/html/downloads/netboot/wisptools-checkin.service" ]; then
    cp "/var/www/html/downloads/netboot/wisptools-checkin.service" "$PACKAGE_BUILD_DIR/etc/systemd/system/"
fi
if [ -f "/var/www/html/downloads/netboot/wisptools-checkin.timer" ]; then
    cp "/var/www/html/downloads/netboot/wisptools-checkin.timer" "$PACKAGE_BUILD_DIR/etc/systemd/system/"
fi

# Create postinst script
cat > "$PACKAGE_BUILD_DIR/DEBIAN/postinst" << 'POSTINST'
#!/bin/bash
set -e

# Generate device code if not exists
if [ ! -f /etc/wisptools/device-code.env ]; then
    DEVICE_CODE=$(head /dev/urandom | tr -dc 'A-Z' | head -c4)$(head /dev/urandom | tr -dc '0-9' | head -c4)
    echo "DEVICE_CODE=$DEVICE_CODE" > /etc/wisptools/device-code.env
    chmod 644 /etc/wisptools/device-code.env
fi

# Make scripts executable
chmod +x /opt/wisptools/*.sh 2>/dev/null || true

# Enable services
systemctl daemon-reload
systemctl enable wisptools-checkin.timer 2>/dev/null || true
systemctl start wisptools-checkin.timer 2>/dev/null || true

echo "WISPTools EPC Installer package installed successfully"
echo "Device code: $(cat /etc/wisptools/device-code.env 2>/dev/null | grep DEVICE_CODE | cut -d= -f2)"

exit 0
POSTINST
chmod 755 "$PACKAGE_BUILD_DIR/DEBIAN/postinst"

# Create control file
cat > "$PACKAGE_BUILD_DIR/DEBIAN/control" << 'CONTROL'
Package: wisptools-epc-installer
Version: 1.0.0
Section: admin
Priority: optional
Architecture: all
Depends: curl, jq, python3, ca-certificates
Maintainer: WISPTools <support@wisptools.io>
Description: WISPTools EPC Device Installer
 Automated installer package for WISPTools EPC/SNMP devices.
 Includes check-in scripts and systemd services.
CONTROL

# Build package
dpkg-deb --build "$PACKAGE_BUILD_DIR" /tmp/wisptools-epc-installer_1.0.0_all.deb

# Add to repository
cd "$APT_REPO_DIR"
reprepro includedeb stable /tmp/wisptools-epc-installer_1.0.0_all.deb 2>/dev/null || {
    print_warning "Package may already exist, trying to replace..."
    reprepro remove stable wisptools-epc-installer 2>/dev/null || true
    reprepro includedeb stable /tmp/wisptools-epc-installer_1.0.0_all.deb
}

print_success "WISPTools installer package added to repository"

# Cleanup
rm -rf "$PACKAGE_BUILD_DIR" /tmp/wisptools-epc-installer_1.0.0_all.deb

# ============================================================================
# Set permissions
# ============================================================================
chown -R www-data:www-data "$APT_REPO_DIR" 2>/dev/null || true
chmod -R 755 "$APT_REPO_DIR"

echo ""
print_status "═══════════════════════════════════════════════════════════"
print_success "  Local APT Repository Setup Complete"
print_status "═══════════════════════════════════════════════════════════"
echo ""
print_status "Repository URL: https://hss.wisptools.io/apt"
print_status "GPG Key: https://hss.wisptools.io/apt/wisptools-repo.gpg"
echo ""
print_status "To use this repository on a device:"
print_status "  curl -fsSL https://hss.wisptools.io/apt/wisptools-repo.gpg | gpg --dearmor -o /etc/apt/trusted.gpg.d/wisptools.gpg"
print_status "  echo 'deb https://hss.wisptools.io/apt stable main' > /etc/apt/sources.list.d/wisptools.list"
print_status "  apt update && apt install wisptools-epc-installer"
echo ""

exit 0

