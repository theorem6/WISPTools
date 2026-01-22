#!/bin/bash
# Install Open5GS on remote EPC device
# NOTE: Only installs MME, SGW, SMF, UPF - NOT HSS or PCRF
# HSS and PCRF run on the central server (hss.wisptools.io)

set -e

echo "======================================"
echo "Installing Open5GS Remote EPC"
echo "(MME, SGW, SMF, UPF only)"
echo "======================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo $0"
    exit 1
fi

# Detect OS for correct repository
echo "[1/5] Detecting OS and adding repository..."
if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
        ubuntu)
            case "$VERSION_CODENAME" in
                noble|mantic) REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/xUbuntu_24.04/" ;;
                jammy) REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/xUbuntu_22.04/" ;;
                *) REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/xUbuntu_22.04/" ;;
            esac
            echo "Detected Ubuntu $VERSION_CODENAME"
            ;;
        debian)
            REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/Debian_12/"
            echo "Detected Debian"
            ;;
        *)
            REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/Debian_12/"
            ;;
    esac
else
    REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/Debian_12/"
fi

echo "deb [trusted=yes] $REPO_URL ./" > /etc/apt/sources.list.d/open5gs.list

echo "[2/5] Updating package lists..."
apt-get update -qq

echo "[3/5] Installing Open5GS EPC components (MME, SGW, SMF, UPF)..."
# Install only the packages needed for remote EPC - NOT HSS or PCRF
apt-get install -y --no-install-recommends \
    open5gs-mme \
    open5gs-sgwc \
    open5gs-sgwu \
    open5gs-smf \
    open5gs-upf

echo "[4/5] Ensuring HSS and PCRF are NOT running locally..."
# These run on the central server, not here
for svc in open5gs-hssd open5gs-pcrfd; do
    systemctl stop $svc 2>/dev/null || true
    systemctl disable $svc 2>/dev/null || true
    systemctl mask $svc 2>/dev/null || true
done

echo "[5/5] Starting local EPC services..."
for svc in open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
    systemctl enable $svc 2>/dev/null || true
    systemctl start $svc 2>/dev/null || true
done

echo ""
echo "======================================"
echo "Remote EPC Services:"
for svc in open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
    STATUS=$(systemctl is-active $svc 2>/dev/null || echo "failed")
    printf "  %-20s %s\n" "$svc:" "$STATUS"
done
echo ""
echo "Central Services (at hss.wisptools.io):"
echo "  HSS:  Subscriber authentication"
echo "  PCRF: Policy/charging (if needed)"
echo "======================================"

