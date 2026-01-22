/**
 * Generate GRUB configuration section for headless operation
 */
function generateGRUBConfiguration() {
  return `# Persist framebuffer/console settings in GRUB to avoid graphics initialization
# ⚠️  Permanently disable framebuffer using nomodeset and nofb (modern approach, not deprecated vga=normal)
# nomodeset disables Kernel Mode Setting (KMS) - prevents graphics drivers from setting high-res modes early
# nofb disables framebuffer device completely
print_header "Configuring GRUB for headless/text-only operation"
if [ -f /etc/default/grub ]; then
  print_status "Updating /etc/default/grub kernel parameters"
  # Ensure GRUB_CMDLINE_LINUX_DEFAULT exists
  if ! grep -q '^GRUB_CMDLINE_LINUX_DEFAULT=' /etc/default/grub; then
    echo 'GRUB_CMDLINE_LINUX_DEFAULT="quiet"' >> /etc/default/grub
  fi
  # Update kernel parameters: nomodeset (disables KMS) nofb (disables framebuffer), text mode, serial console
  # Remove any existing nomodeset/nofb to avoid duplicates, then add them
  sed -i 's/ nomodeset//g; s/ nofb//g' /etc/default/grub
  sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT="\\(.*\\)"/GRUB_CMDLINE_LINUX_DEFAULT="\\1 nomodeset nofb text console=ttyS0,115200n8 console=tty1"/g' /etc/default/grub
  # Configure GRUB graphics mode for VirtualBox compatibility
  if ! grep -q '^GRUB_GFXMODE=' /etc/default/grub; then
    echo 'GRUB_GFXMODE=1024x768' >> /etc/default/grub
  fi
  if ! grep -q '^GRUB_GFXPAYLOAD_LINUX=' /etc/default/grub; then
    echo 'GRUB_GFXPAYLOAD_LINUX=keep' >> /etc/default/grub
  fi
  print_status "Running update-grub (or grub-mkconfig fallback)"
  if command -v update-grub >/dev/null 2>&1; then
    update-grub >/dev/null 2>&1 || true
  else
    grub-mkconfig -o /boot/grub/grub.cfg >/dev/null 2>&1 || true
  fi
  print_success "GRUB updated: framebuffer disabled (nomodeset nofb), text-only boot"
else
  print_status "/etc/default/grub not found, skipping persistent framebuffer disable"
fi
`;
}

module.exports = { generateGRUBConfiguration };

