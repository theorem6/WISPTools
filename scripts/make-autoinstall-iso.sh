#!/bin/bash
set -euo pipefail

# Usage: make-autoinstall-iso.sh <base_iso> <autoinstall_dir> <output_iso> [volume_label]
# - base_iso: path to official Ubuntu live-server ISO
# - autoinstall_dir: directory containing user-data and meta-data
# - output_iso: path to write new ISO
# - volume_label: optional ISO volume label (<=32 chars)

BASE_ISO="${1:-}"
AUTOINSTALL_DIR="${2:-}"
OUTPUT_ISO="${3:-}"
VOL_LABEL="${4:-WISP-EPC}"

if [ -z "$BASE_ISO" ] || [ -z "$AUTOINSTALL_DIR" ] || [ -z "$OUTPUT_ISO" ]; then
  echo "Usage: $0 <base_iso> <autoinstall_dir> <output_iso> [volume_label]" >&2
  exit 2
fi

if [ ! -s "$BASE_ISO" ]; then
  echo "Base ISO not found: $BASE_ISO" >&2
  exit 3
fi

if [ ! -f "$AUTOINSTALL_DIR/user-data" ] || [ ! -f "$AUTOINSTALL_DIR/meta-data" ]; then
  echo "autoinstall dir must contain user-data and meta-data" >&2
  exit 4
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

EXTRACT_DIR="$workdir/iso_extract"
mkdir -p "$EXTRACT_DIR"

echo "[Generator] Extracting base ISO..."
if command -v 7z >/dev/null 2>&1; then
  7z x "$BASE_ISO" -o"$EXTRACT_DIR" >/dev/null
else
  xorriso -osirrox on -indev "$BASE_ISO" -extract / "$EXTRACT_DIR" >/dev/null 2>&1
fi

echo "[Generator] Adding autoinstall seed..."
mkdir -p "$EXTRACT_DIR/autoinstall"
cp -f "$AUTOINSTALL_DIR"/user-data "$EXTRACT_DIR/autoinstall/user-data"
cp -f "$AUTOINSTALL_DIR"/meta-data "$EXTRACT_DIR/autoinstall/meta-data"

# Duplicate at root for robustness
cp -f "$AUTOINSTALL_DIR"/user-data "$EXTRACT_DIR/user-data" || true
cp -f "$AUTOINSTALL_DIR"/meta-data "$EXTRACT_DIR/meta-data" || true

echo "[Generator] Updating GRUB and ISOLINUX to autoinstall..."
GRUB_CFG="$EXTRACT_DIR/boot/grub/grub.cfg"
ISOLINUX_CFG="$EXTRACT_DIR/isolinux/txt.cfg"

if [ -f "$GRUB_CFG" ]; then
  cat > "$GRUB_CFG" <<'GRUBEOF'
set timeout=0
set default=0

menuentry "WISPTools EPC - Autoinstall" {
    set gfxpayload=keep
    linux   /casper/vmlinuz autoinstall ds=nocloud;s=/cdrom/autoinstall/ ---
    initrd  /casper/initrd
}

menuentry "Ubuntu Server (manual)" {
    set gfxpayload=keep
    linux   /casper/vmlinuz ---
    initrd  /casper/initrd
}
GRUBEOF
fi

if [ -f "$ISOLINUX_CFG" ]; then
  cat > "$ISOLINUX_CFG" <<'ISOEOF'
default autoinstall
label autoinstall
  menu label ^WISPTools EPC - Autoinstall
  kernel /casper/vmlinuz
  append initrd=/casper/initrd autoinstall ds=nocloud;s=/cdrom/autoinstall/ ---
label manual
  menu label ^Ubuntu Server (manual)
  kernel /casper/vmlinuz
  append initrd=/casper/initrd ---
ISOEOF
fi

echo "[Generator] Building ISO..."
xorriso -as mkisofs \
  -r -V "${VOL_LABEL:0:32}" \
  -o "$OUTPUT_ISO" \
  -J -l \
  -b isolinux/isolinux.bin \
  -c isolinux/boot.cat \
  -no-emul-boot \
  -boot-load-size 4 \
  -boot-info-table \
  -eltorito-alt-boot \
  -e boot/grub/efi.img \
  -no-emul-boot \
  -isohybrid-gpt-basdat \
  -isohybrid-mbr /usr/lib/ISOLINUX/isohdpfx.bin \
  "$EXTRACT_DIR" >/dev/null

echo "[Generator] ISO created: $OUTPUT_ISO"



