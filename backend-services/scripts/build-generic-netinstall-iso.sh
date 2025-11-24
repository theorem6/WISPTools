#!/bin/bash
# Build Generic Ubuntu Netinstall ISO
# This ISO is built once and reused for all EPC deployments
# The ISO will phone home to GCE server to get EPC-specific configuration

set -e

ISO_OUTPUT_DIR="/var/www/html/downloads/isos"
ISO_BUILD_DIR="/opt/epc-iso-builder/generic"
ISO_FILENAME="wisptools-epc-generic-netinstall.iso"
GCE_PUBLIC_IP="${GCE_PUBLIC_IP:-136.112.111.167}"
HSS_PORT="${HSS_PORT:-3001}"

echo "[Generic ISO Builder] Building generic Ubuntu 22.04 LTS netinstall ISO..."
echo "[Generic ISO Builder] This ISO will be reused for all EPC deployments"

# Create build directory
mkdir -p "$ISO_BUILD_DIR"
cd "$ISO_BUILD_DIR"

# Download Ubuntu netboot files if not already present
KERNEL_PATH="/opt/base-images/minimal/vmlinuz"
INITRD_PATH="/opt/base-images/minimal/initrd"

if [ ! -f "$KERNEL_PATH" ] || [ ! -f "$INITRD_PATH" ]; then
  echo "[Generic ISO Builder] Downloading Ubuntu 22.04 LTS netboot files..."
  mkdir -p "$(dirname "$KERNEL_PATH")"
  
  UBUNTU_NETBOOT_BASE="http://archive.ubuntu.com/ubuntu/dists/jammy/main/installer-amd64/current/images/netboot/ubuntu-installer/amd64"
  
  wget -q --timeout=30 -O "$KERNEL_PATH" "$UBUNTU_NETBOOT_BASE/linux" || {
    echo "[Generic ISO Builder] ERROR: Failed to download kernel"
    exit 1
  }
  
  wget -q --timeout=30 -O "$INITRD_PATH" "$UBUNTU_NETBOOT_BASE/initrd.gz" || {
    echo "[Generic ISO Builder] ERROR: Failed to download initrd"
    exit 1
  }
  
  echo "[Generic ISO Builder] Ubuntu netboot files downloaded"
fi

# Create ISO root structure
ISO_ROOT="$ISO_BUILD_DIR/iso_root"
rm -rf "$ISO_ROOT"
mkdir -p "$ISO_ROOT/ubuntu" "$ISO_ROOT/boot/grub"

# Copy kernel and initrd
cp "$KERNEL_PATH" "$ISO_ROOT/ubuntu/vmlinuz"
cp "$INITRD_PATH" "$ISO_ROOT/ubuntu/initrd.gz"
chmod 0644 "$ISO_ROOT/ubuntu/vmlinuz" "$ISO_ROOT/ubuntu/initrd.gz"

# Create GRUB config that phones home for configuration
cat > "$ISO_ROOT/boot/grub/grub.cfg" << GRUBCFG
set timeout=0
set default=auto
insmod gzio

menuentry "WISPTools EPC Netinstall (Auto)" --id auto {
  linux /ubuntu/vmlinuz autoinstall ds=nocloud-net\;s=http://${GCE_PUBLIC_IP}:${HSS_PORT}/downloads/netboot/generic/ ip=dhcp net.ifnames=0 biosdevname=0 ---
  initrd /ubuntu/initrd.gz
}

menuentry "WISPTools EPC Netinstall (Manual)" {
  linux /ubuntu/vmlinuz ---
  initrd /ubuntu/initrd.gz
}
GRUBCFG

# Create generic autoinstall config directory
NETBOOT_DIR="/var/www/html/downloads/netboot"
mkdir -p "$NETBOOT_DIR/generic"

# Create generic user-data that installs wisptools-epc-installer package
cat > "$NETBOOT_DIR/generic/user-data" << USERDATA
#cloud-config
autoinstall:
  version: 1
  locale: en_US
  keyboard:
    layout: us
  network:
    network:
      version: 2
      ethernets:
        any:
          match:
            name: "en*"
          dhcp4: true
  storage:
    layout:
      name: direct
  packages:
    - curl
    - wget
    - ca-certificates
    - gnupg
    - lsb-release
    - openssh-server
  user-data:
    users:
      - name: wisp
        groups: [adm, sudo]
        shell: /bin/bash
        lock-passwd: false
        passwd: \$6\$rounds=4096\$saltsalt\$hBHuZm7adhEYRKKp7oSfFkFq8C5L5CfLXqJ3qvQZQBfVZb9kCL3HH8wJOhZ8L5nKkTRqy8FqKLMnLmKMnLM8.
    runcmd:
      - mkdir -p /etc/wisptools
      - |
        cat > /etc/apt/sources.list.d/wisptools.list << 'APTEOF'
deb http://${GCE_PUBLIC_IP}:${HSS_PORT}/apt-repos/main stable main
APTEOF
      - wget -qO- http://${GCE_PUBLIC_IP}:${HSS_PORT}/apt-repos/main/gpg.key | apt-key add -
      - apt-get update
      - apt-get install -y wisptools-epc-installer
      - systemctl enable wisptools-epc-checkin.service
  late-commands:
    - curtin in-target --target=/target -- systemctl enable ssh
USERDATA

# Create generic meta-data
cat > "$NETBOOT_DIR/generic/meta-data" << METADATA
instance-id: wisptools-generic-epc
local-hostname: epc-generic
METADATA

# Build ISO
echo "[Generic ISO Builder] Building ISO with grub-mkrescue..."
mkdir -p "$ISO_OUTPUT_DIR"
ISO_PATH="$ISO_OUTPUT_DIR/$ISO_FILENAME"

apt-get update -y >/dev/null 2>&1 || true
apt-get install -y grub-pc-bin grub-efi-amd64-bin xorriso mtools >/dev/null 2>&1 || true

rm -f "$ISO_PATH"
grub-mkrescue -o "$ISO_PATH" "$ISO_ROOT" >/dev/null 2>&1 || {
  echo "[Generic ISO Builder] ERROR: grub-mkrescue failed"
  exit 1
}

if [ ! -s "$ISO_PATH" ]; then
  echo "[Generic ISO Builder] ERROR: Generated ISO is empty"
  exit 1
fi

# Create checksum
(cd "$ISO_OUTPUT_DIR" && sha256sum "$ISO_FILENAME" > "$ISO_FILENAME.sha256")

echo "[Generic ISO Builder] Generic ISO created successfully: $ISO_PATH ($(du -h "$ISO_PATH" | cut -f1))"
echo "[Generic ISO Builder] This ISO can be used for all EPC deployments"

