# Protected Files - ISO Generation and EPC Deployment

## ⚠️ Critical Files - DO NOT MODIFY

These files contain critical logic for ISO generation and EPC deployment. Modifications can break automated deployments.

### Core Route File
- **`routes/epc-deployment.js`**
  - Generates Debian netinstall ISOs
  - Configures preseed files for automated installation
  - Creates GRUB boot configuration
  - **Installation Type**: Debian text-only netinstall (no GUI/TUI)

### Helper Functions (utils/)
- **`utils/iso-helpers.js`**
  - Generates cloud-init configuration
  - Embeds EPC credentials in boot disc
  - Creates systemd services for first boot

- **`utils/bootstrap-helpers.js`**
  - Generates bootstrap scripts
  - Handles EPC auto-configuration on first boot
  - Connects EPC to WISPTools.io management system

- **`utils/deployment-helpers.js`**
  - Generates full deployment scripts
  - Installs Open5GS and EPC components
  - **Important**: Octal escape sequences (`\1`, `\2`) must be double-escaped (`\\1`, `\\2`) in JavaScript template strings

## Installation Configuration

### Debian Netinstall - Text-Only Mode

The ISO uses Debian text-only netinstall to ensure headless operation:

1. **Kernel Parameters** (in GRUB config):
   - `DEBIAN_FRONTEND=text` - Forces text mode installer
   - `text` - Additional text mode flag
   - `console=ttyS0,115200n8` - Serial console for headless operation
   - `console=tty1` - Primary console
   - `nomodeset nofb` - Disables framebuffer (headless)

2. **Preseed Configuration**:
   - `tasksel tasksel/first multiselect standard, ssh-server` - Standard system + SSH
   - `tasksel tasksel/skip-tasks string ^.*desktop^, ^.*x11^, ^.*gnome^, ^.*kde^` - **Skips all desktop environments**
   - Ensures minimal, headless installation

3. **Why Text-Only?**
   - EPC servers run headless (no monitor/keyboard)
   - Reduces installation time and disk space
   - Eliminates GUI dependencies
   - Works reliably over serial console

## Modification Guidelines

### When You CAN Modify
- ✅ Fixing bugs in ISO generation
- ✅ Adding new preseed options
- ✅ Updating package lists
- ✅ Fixing syntax errors

### When You MUST NOT Modify
- ❌ Changing installation mode (text vs GUI) without testing
- ❌ Removing required packages
- ❌ Changing GRUB console configuration
- ❌ Modifying escape sequences without understanding implications

### Before Modifying
1. Test ISO generation locally if possible
2. Verify preseed syntax with `debconf-set-selections`
3. Test on a VM before production deployment
4. Document changes in commit message

## Escape Sequence Notes

In JavaScript template strings (backticks), octal escape sequences are not allowed:

```javascript
// ❌ WRONG - Causes SyntaxError
`sed -i 's/pattern/\1/g' file`

// ✅ CORRECT - Double-escape backslashes
`sed -i 's/pattern/\\1/g' file`
```

This is especially important in `deployment-helpers.js` where sed commands use `\1`, `\2`, etc.

## Testing Checklist

Before deploying changes:
- [ ] ISO builds successfully
- [ ] ISO boots in VM
- [ ] Installation completes without prompts
- [ ] No desktop/GUI packages installed
- [ ] Serial console works
- [ ] EPC bootstrap script executes on first boot
- [ ] EPC connects to management server

---

**Last Updated**: 2025-10-31  
**Maintainer**: System automation  
**Purpose**: Protect critical EPC deployment logic from accidental modification

