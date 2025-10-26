#!/bin/bash
# Test Minimal Boot Disc in VM
# Creates a test VM and boots from the custom ISO
#
# Requires: qemu/kvm
# Usage: bash test-boot-disc.sh <path-to-iso>

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() {
    echo -e "${CYAN}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check arguments
if [ -z "$1" ]; then
    print_error "Usage: $0 <path-to-iso>"
    exit 1
fi

ISO_FILE="$1"

if [ ! -f "$ISO_FILE" ]; then
    print_error "ISO file not found: $ISO_FILE"
    exit 1
fi

print_success "Found ISO: $ISO_FILE"

# Check for QEMU/KVM
print_status "Checking for QEMU/KVM..."

if ! command -v qemu-system-x86_64 &> /dev/null; then
    print_error "QEMU not found. Please install:"
    echo "  Ubuntu/Debian: sudo apt-get install qemu-kvm"
    echo "  RHEL/CentOS: sudo yum install qemu-kvm"
    exit 1
fi

print_success "QEMU found"

# Create test disk
TEST_DIR="/tmp/wisptools-test-vm"
DISK_IMAGE="$TEST_DIR/test-disk.qcow2"
DISK_SIZE="20G"

print_status "Creating test VM disk..."
mkdir -p "$TEST_DIR"

if [ ! -f "$DISK_IMAGE" ]; then
    qemu-img create -f qcow2 "$DISK_IMAGE" "$DISK_SIZE" > /dev/null
    print_success "Test disk created: $DISK_SIZE"
else
    print_warning "Using existing test disk"
    read -p "Recreate disk? (y/n): " RECREATE
    if [[ "$RECREATE" =~ ^[Yy]$ ]]; then
        rm -f "$DISK_IMAGE"
        qemu-img create -f qcow2 "$DISK_IMAGE" "$DISK_SIZE" > /dev/null
        print_success "Test disk recreated"
    fi
fi

# VM parameters
VM_MEMORY="4096"  # 4GB RAM
VM_CPUS="2"

print_status "VM Configuration:"
echo "  Memory: ${VM_MEMORY}M"
echo "  CPUs: $VM_CPUS"
echo "  Disk: $DISK_SIZE"
echo "  ISO: $(basename $ISO_FILE)"
echo ""

print_warning "VM will boot in graphical mode"
print_warning "Watch for autoinstall progress"
print_warning "System will reboot after installation"
print_warning "Close QEMU window to exit"
echo ""

read -p "Press Enter to start VM..."

# Launch QEMU
print_status "Starting VM..."
echo ""

# Use KVM acceleration if available
KVM_ARGS=""
if [ -w /dev/kvm ]; then
    KVM_ARGS="-enable-kvm"
    print_success "KVM acceleration enabled"
fi

# Network setup - bridged mode for real DHCP
# Or NAT mode for testing
NETWORK_ARGS="-netdev user,id=net0 -device virtio-net-pci,netdev=net0"

qemu-system-x86_64 \
    $KVM_ARGS \
    -m $VM_MEMORY \
    -smp $VM_CPUS \
    -cdrom "$ISO_FILE" \
    -drive file="$DISK_IMAGE",format=qcow2,if=virtio \
    -boot d \
    $NETWORK_ARGS \
    -vga virtio \
    -display gtk \
    -name "WISPTools Test VM" \
    2>&1

echo ""
print_success "VM closed"

# Ask if user wants to boot from disk
echo ""
read -p "Boot from installed disk (without ISO)? (y/n): " BOOT_DISK

if [[ "$BOOT_DISK" =~ ^[Yy]$ ]]; then
    print_status "Booting from disk..."
    echo ""
    print_warning "This will trigger the first-boot registration"
    echo ""
    
    qemu-system-x86_64 \
        $KVM_ARGS \
        -m $VM_MEMORY \
        -smp $VM_CPUS \
        -drive file="$DISK_IMAGE",format=qcow2,if=virtio \
        -boot c \
        $NETWORK_ARGS \
        -vga virtio \
        -display gtk \
        -name "WISPTools Test VM - First Boot" \
        2>&1
    
    echo ""
    print_success "First boot test complete"
fi

# Cleanup
echo ""
read -p "Delete test disk? (y/n): " DELETE

if [[ "$DELETE" =~ ^[Yy]$ ]]; then
    rm -rf "$TEST_DIR"
    print_success "Test disk deleted"
else
    print_status "Test disk kept: $DISK_IMAGE"
    print_status "To boot again: "
    echo "  qemu-system-x86_64 -m 4096 -smp 2 -drive file=$DISK_IMAGE,format=qcow2"
fi

print_success "Testing complete!"

