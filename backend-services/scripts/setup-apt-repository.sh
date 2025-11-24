#!/bin/bash
# Setup APT Repository for WISPTools EPC Installer Package
# Run this on the GCE server to set up the repository infrastructure

set -e

GCE_PUBLIC_IP="${GCE_PUBLIC_IP:-136.112.111.167}"
HSS_PORT="${HSS_PORT:-3001}"
REPO_ROOT="/var/www/html/apt-repos"
REPO_NAME="main"
GPG_KEY_DIR="/opt/apt-keys"

echo "[APT Setup] Setting up WISPTools APT repository..."

# Install required packages
apt-get update -y
apt-get install -y dpkg-dev gnupg2 reprepro nginx

# Create repository directory structure
mkdir -p "$REPO_ROOT/$REPO_NAME"/{conf,dists,pool/main}
cd "$REPO_ROOT/$REPO_NAME"

# Create GPG key if it doesn't exist
if [ ! -f "$GPG_KEY_DIR/wisptools-apt.key" ]; then
  echo "[APT Setup] Generating GPG key for repository..."
  mkdir -p "$GPG_KEY_DIR"
  
  cat > "$GPG_KEY_DIR/gpg-batch.conf" << GPGCONF
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: WISPTools APT Repository
Name-Email: apt@wisptools.io
Expire-Date: 0
%no-protection
%commit
GPGCONF

  gpg --batch --generate-key "$GPG_KEY_DIR/gpg-batch.conf"
  
  # Export public key
  gpg --armor --export apt@wisptools.io > "$GPG_KEY_DIR/wisptools-apt.key"
  
  echo "[APT Setup] GPG key generated: $GPG_KEY_DIR/wisptools-apt.key"
fi

# Create reprepro configuration
cat > conf/distributions << REPOCONF
Origin: WISPTools
Label: WISPTools APT Repository
Suite: stable
Codename: stable
Architectures: amd64
Components: main
Description: WISPTools EPC Installer Packages
SignWith: apt@wisptools.io
REPOCONF

cat > conf/options << OPTIONS
verbose
basedir .
OPTIONS

# Build the EPC installer package
echo "[APT Setup] Building wisptools-epc-installer package..."
PACKAGE_SCRIPT="/opt/lte-pci-mapper/backend-services/scripts/build-epc-installer-package.sh"
if [ -f "$PACKAGE_SCRIPT" ]; then
  chmod +x "$PACKAGE_SCRIPT"
  PACKAGE_PATH=$("$PACKAGE_SCRIPT")
  
  if [ -f "$PACKAGE_PATH" ]; then
    echo "[APT Setup] Adding package to repository..."
    reprepro includedeb stable "$PACKAGE_PATH"
    echo "[APT Setup] Package added to repository"
  else
    echo "[APT Setup] ERROR: Package build failed"
    exit 1
  fi
else
  echo "[APT Setup] WARNING: Package build script not found at $PACKAGE_SCRIPT"
  echo "[APT Setup] You may need to build the package manually"
fi

# Create nginx configuration for apt repository
cat > /etc/nginx/sites-available/apt-repos << NGINXCONF
server {
    listen ${HSS_PORT};
    server_name ${GCE_PUBLIC_IP};
    
    root /var/www/html;
    index index.html;
    
    # APT repository
    location /apt-repos/ {
        alias ${REPO_ROOT}/;
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }
    
    # GPG key
    location /apt-repos/main/gpg.key {
        alias ${GPG_KEY_DIR}/wisptools-apt.key;
        add_header Content-Type text/plain;
    }
    
    # Downloads (ISOs, etc.)
    location /downloads/ {
        alias /var/www/html/downloads/;
        autoindex on;
    }
}
NGINXCONF

# Enable nginx site
ln -sf /etc/nginx/sites-available/apt-repos /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "[APT Setup] APT repository setup complete!"
echo "[APT Setup] Repository URL: http://${GCE_PUBLIC_IP}:${HSS_PORT}/apt-repos/${REPO_NAME}"
echo "[APT Setup] GPG key URL: http://${GCE_PUBLIC_IP}:${HSS_PORT}/apt-repos/${REPO_NAME}/gpg.key"
echo ""
echo "[APT Setup] To add packages in the future:"
echo "  reprepro includedeb stable /path/to/package.deb"

