#!/bin/bash
# Setup APT Repository Infrastructure on GCE Server
# This creates:
#   1. A caching proxy for Open5GS packages
#   2. A custom repo for WISPTools packages
#   3. Proper nginx configuration for serving both

set -e

echo "======================================"
echo "Setting up APT Repository Infrastructure"
echo "======================================"

# Configuration
APT_CACHE_DIR="/var/cache/apt-cacher-ng"
REPO_ROOT="/var/www/html/apt"
WISPTOOLS_REPO="$REPO_ROOT/wisptools"
GPG_KEY_DIR="/opt/apt-keys"
OPEN5GS_MIRROR="$REPO_ROOT/open5gs"

# Step 1: Install required packages
echo "[1/6] Installing required packages..."
apt-get update -qq
apt-get install -y --no-install-recommends \
    apt-cacher-ng \
    dpkg-dev \
    gnupg2 \
    reprepro

# Step 2: Configure apt-cacher-ng for caching Open5GS packages
echo "[2/6] Configuring apt-cacher-ng..."
cat > /etc/apt-cacher-ng/acng.conf << 'ACNGCONF'
CacheDir: /var/cache/apt-cacher-ng
LogDir: /var/log/apt-cacher-ng
Port: 3142
BindAddress: 0.0.0.0
ReportPage: acng-report.html
ExTreshold: 4
LocalDirs: acng-doc /usr/share/doc/apt-cacher-ng

# Allow Open5GS repository
Remap-open5gs: download.opensuse.org/repositories/home:/acetcom:/open5gs

# Pass through HTTPS
PassThroughPattern: .*
ACNGCONF

systemctl enable apt-cacher-ng
systemctl restart apt-cacher-ng

# Step 3: Create WISPTools repository structure
echo "[3/6] Creating WISPTools APT repository..."
mkdir -p "$WISPTOOLS_REPO"/{conf,dists/stable/main/binary-amd64,pool/main}
mkdir -p "$GPG_KEY_DIR"

# Generate GPG key if it doesn't exist
if [ ! -f "$GPG_KEY_DIR/wisptools-apt.key" ]; then
    echo "Generating GPG key for repository..."
    cat > "$GPG_KEY_DIR/gpg-batch.conf" << 'GPGCONF'
Key-Type: RSA
Key-Length: 4096
Name-Real: WISPTools APT Repository
Name-Email: apt@wisptools.io
Expire-Date: 0
%no-protection
%commit
GPGCONF
    
    gpg --batch --generate-key "$GPG_KEY_DIR/gpg-batch.conf" 2>/dev/null || true
    gpg --armor --export apt@wisptools.io > "$GPG_KEY_DIR/wisptools-apt.key" 2>/dev/null || true
fi

# Create reprepro configuration
cat > "$WISPTOOLS_REPO/conf/distributions" << 'REPOCONF'
Origin: WISPTools
Label: WISPTools EPC Repository
Suite: stable
Codename: stable
Architectures: amd64
Components: main
Description: WISPTools Remote EPC Management Packages
REPOCONF

cat > "$WISPTOOLS_REPO/conf/options" << 'OPTIONS'
verbose
basedir .
OPTIONS

# Step 4: Create client configuration scripts
echo "[4/6] Creating client configuration scripts..."

# Script for remote EPCs to configure APT
cat > /var/www/html/downloads/scripts/configure-apt.sh << 'APTSCRIPT'
#!/bin/bash
# Configure APT on remote EPC to use central repository
# Run: curl -fsSL https://hss.wisptools.io/downloads/scripts/configure-apt.sh | sudo bash

set -e

echo "======================================"
echo "Configuring APT for WISPTools EPC"
echo "======================================"

CENTRAL_SERVER="hss.wisptools.io"

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
        ubuntu)
            case "$VERSION_CODENAME" in
                noble|mantic) OPEN5GS_DIST="xUbuntu_24.04" ;;
                jammy) OPEN5GS_DIST="xUbuntu_22.04" ;;
                *) OPEN5GS_DIST="xUbuntu_22.04" ;;
            esac
            ;;
        debian)
            OPEN5GS_DIST="Debian_12"
            ;;
        *)
            OPEN5GS_DIST="Debian_12"
            ;;
    esac
else
    OPEN5GS_DIST="Debian_12"
fi

echo "Detected: $ID $VERSION_CODENAME -> $OPEN5GS_DIST"

# Configure Open5GS repository with trusted=yes (GPG key often expires)
echo "[1/3] Configuring Open5GS repository..."
cat > /etc/apt/sources.list.d/open5gs.list << EOF
deb [trusted=yes] https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/${OPEN5GS_DIST}/ ./
EOF

# Configure WISPTools repository
echo "[2/3] Configuring WISPTools repository..."
cat > /etc/apt/sources.list.d/wisptools.list << EOF
deb [trusted=yes] https://${CENTRAL_SERVER}/apt/wisptools stable main
EOF

# Update package lists
echo "[3/3] Updating package lists..."
apt-get update -qq

echo ""
echo "======================================"
echo "APT configuration complete!"
echo "======================================"
echo ""
echo "You can now install/update packages:"
echo "  sudo apt install open5gs-mme open5gs-sgwc open5gs-sgwu open5gs-smf open5gs-upf"
echo ""
APTSCRIPT
chmod 644 /var/www/html/downloads/scripts/configure-apt.sh

# Step 5: Update nginx configuration
echo "[5/6] Updating nginx configuration..."

# Check if nginx ssl config exists
if [ -f /etc/nginx/sites-available/hss-ssl ]; then
    # Add apt location to existing SSL config
    if ! grep -q "location /apt/" /etc/nginx/sites-available/hss-ssl; then
        # Insert apt location before the last closing brace
        sed -i '/^}$/i\
    # APT Repository\
    location /apt/ {\
        alias /var/www/html/apt/;\
        autoindex on;\
        autoindex_exact_size off;\
    }\
\
    # APT Cacher NG proxy\
    location /apt-cache/ {\
        proxy_pass http://127.0.0.1:3142/;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
    }' /etc/nginx/sites-available/hss-ssl
    fi
else
    # Create new config if SSL config doesn't exist
    cat > /etc/nginx/sites-available/apt-repos << 'NGINXCONF'
server {
    listen 80;
    server_name hss.wisptools.io;
    
    root /var/www/html;
    
    # APT Repository
    location /apt/ {
        alias /var/www/html/apt/;
        autoindex on;
        autoindex_exact_size off;
    }
    
    # APT Cacher NG proxy
    location /apt-cache/ {
        proxy_pass http://127.0.0.1:3142/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Downloads
    location /downloads/ {
        alias /var/www/html/downloads/;
        autoindex on;
    }
}
NGINXCONF
    ln -sf /etc/nginx/sites-available/apt-repos /etc/nginx/sites-enabled/ 2>/dev/null || true
fi

# Test and reload nginx
nginx -t && systemctl reload nginx

# Step 6: Open firewall ports
echo "[6/6] Configuring firewall..."
iptables -C INPUT -p tcp --dport 3142 -j ACCEPT 2>/dev/null || \
    iptables -A INPUT -p tcp --dport 3142 -j ACCEPT

# Save iptables rules
iptables-save > /etc/iptables/rules.v4 2>/dev/null || true

echo ""
echo "======================================"
echo "APT Repository Setup Complete!"
echo "======================================"
echo ""
echo "Repository URLs:"
echo "  WISPTools Repo: https://hss.wisptools.io/apt/wisptools"
echo "  APT Cache:      http://hss.wisptools.io:3142/"
echo ""
echo "For remote EPCs, run:"
echo "  curl -fsSL https://hss.wisptools.io/downloads/scripts/configure-apt.sh | sudo bash"
echo ""
echo "To add packages to WISPTools repo:"
echo "  cd $WISPTOOLS_REPO && reprepro includedeb stable /path/to/package.deb"
echo ""
