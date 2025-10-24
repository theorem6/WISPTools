# PCI Mapper Project Location - GCE Server
# ========================================

## Server Details:
- **Server:** `acs-hss-server`
- **Project Location:** `/root/lte-pci-mapper`
- **Access:** Requires root privileges
- **User:** `david` (regular user) → `root` (for project access)

## Deployment Commands:
```bash
# Switch to root user
sudo su -

# Navigate to project
cd /root/lte-pci-mapper

# Pull latest changes
git pull origin main

# Run deployment script
bash gce-deploy-planning.sh
```

## Important Notes:
- ✅ Project is located at `/root/lte-pci-mapper`
- ✅ Must run as root to access the project directory
- ✅ User `david` cannot access `/root/` directory
- ✅ Use `sudo su -` to become root, then navigate to project
- ✅ No `sudo` needed once you're root

## Quick Access:
```bash
sudo su - && cd /root/lte-pci-mapper && git pull origin main && bash gce-deploy-planning.sh
```

## File Structure Confirmed:
- ✅ `.git` directory exists
- ✅ `backend-services/server.js` exists
- ✅ This is the correct PCI Mapper project
