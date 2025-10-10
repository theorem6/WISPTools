# 🚀 Single Script Deployment Guide

## One Script to Deploy Everything!

I've created a **single, comprehensive deployment script** that handles everything with a guided walkthrough.

---

## 📋 What is `deploy-complete.sh`?

A fully automated, interactive deployment script that:

✅ **Checks Prerequisites** - Verifies tools and helps install missing ones  
✅ **Guides You Through Configuration** - Asks for MongoDB URI, domain, etc.  
✅ **Creates GCE Infrastructure** - Instance, IP, firewall rules  
✅ **Installs All Services** - GenieACS, Backend API, STUN, Nginx  
✅ **Deploys Frontend** - Builds and deploys to Firebase  
✅ **Verifies Everything** - Tests all endpoints  
✅ **Provides Summary** - Complete URLs and next steps  

---

## 🎯 Quick Start

### From Google Cloud Shell (Recommended)

1. **Open Cloud Shell**: https://console.cloud.google.com/?cloudshell=true

2. **Clone your repository**:
   ```bash
   git clone YOUR_REPO_URL
   cd PCI_mapper
   ```

3. **Run the script**:
   ```bash
   chmod +x deploy-complete.sh
   ./deploy-complete.sh
   ```

4. **Follow the prompts** - The script will guide you through everything!

### From Local Machine

1. **Clone repository**:
   ```bash
   git clone YOUR_REPO_URL
   cd PCI_mapper
   ```

2. **Make executable**:
   ```bash
   chmod +x deploy-complete.sh
   ```

3. **Run**:
   ```bash
   ./deploy-complete.sh
   ```

---

## 📝 What You'll Be Asked For

The script will prompt you for:

### 1. **MongoDB Configuration**
```
MongoDB Connection URI: mongodb+srv://user:password@cluster.mongodb.net/...
MongoDB Database Name: genieacs (or press Enter for default)
```

### 2. **Domain Configuration**
```
Do you have a custom domain? (y/n): y
Enter your domain: genieacs.yourdomain.com
```
*Or choose 'n' to use IP address only*

### 3. **SSL Certificate**
```
Email for SSL certificate: your-email@example.com
```

### 4. **Confirmation**
The script will show you a summary and ask you to confirm before proceeding.

---

## 🎬 Step-by-Step Walkthrough

The script runs through 8 steps with detailed explanations:

### **Step 1: Prerequisites Check** (1 minute)
- ✅ Checks for gcloud CLI
- ✅ Checks for Firebase CLI
- ✅ Offers to install missing tools
- ✅ Verifies git

### **Step 2: Authentication** (2 minutes)
- ✅ Sets GCP project
- ✅ Verifies gcloud authentication
- ✅ Verifies Firebase authentication
- ✅ Helps you authenticate if needed

### **Step 3: Configuration** (2 minutes)
- ✅ Asks for MongoDB URI and database
- ✅ Asks for domain or confirms IP-only setup
- ✅ Asks for SSL email
- ✅ Shows configuration summary

### **Step 4: Create GCE Infrastructure** (3 minutes)
- ✅ Reserves static external IP
- ✅ Creates 3 firewall rules
- ✅ Creates GCE instance (e2-standard-2)
- ✅ Displays external IP

### **Step 5: Setup Backend Services** (12 minutes)
- ✅ Copies setup script to GCE
- ✅ Installs Docker, Node.js, Nginx
- ✅ Deploys GenieACS containers
- ✅ Configures Backend API
- ✅ Sets up STUN server
- ✅ Configures Nginx with SSL

### **Step 6: Verify Backend** (1 minute)
- ✅ Tests health endpoint
- ✅ Checks all service statuses
- ✅ Displays service information

### **Step 7: Deploy Frontend** (7 minutes)
- ✅ Updates apphosting.yaml
- ✅ Deploys to Firebase App Hosting
- ✅ Routes traffic to latest version
- ✅ Confirms deployment

### **Step 8: Final Verification** (1 minute)
- ✅ Tests all endpoints
- ✅ Verifies backend health
- ✅ Verifies frontend accessibility
- ✅ Shows success summary

**Total Time: ~25-30 minutes**

---

## 🎨 What It Looks Like

The script uses **color-coded output** for easy reading:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Complete Deployment - LTE WISP Management Platform
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Welcome!

This script will guide you through deploying your complete application:

Frontend:  Firebase App Hosting (SvelteKit + ArcGIS)
Backend:   Google Compute Engine (GenieACS + STUN + API)

What will be created:
  ✓ GCE instance (e2-standard-2: 2 vCPU, 8 GB RAM)
  ✓ Static external IP address
  ✓ Firewall rules (HTTP/HTTPS, TR-069, STUN)
  ...

▶ Step 1/8
Checking Prerequisites

ℹ Checking for required tools...

→ Checking gcloud CLI...
✓ gcloud CLI is installed (version: 456.0.0)

→ Checking Firebase CLI...
✓ Firebase CLI is installed (version: 13.0.0)
```

---

## 🎉 Success Summary

At the end, you'll see a complete summary:

```
🎉 Deployment Complete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Your URLs:

Frontend Application:
  https://lte-pci-mapper-nfomthzoza-uc.a.run.app

Backend API:
  https://your-domain.com/api/health    ← Test this first!

GenieACS Services:
  https://your-domain.com/nbi/devices   ← GenieACS NBI API
  https://your-domain.com/admin/        ← Admin Dashboard
  https://your-domain.com/fs/           ← Firmware Server

TR-069 CWMP (for CPE devices):
  http://35.xxx.xxx.xxx:7547

STUN Server:
  stun:35.xxx.xxx.xxx:3478

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 What Was Created:

✓ GCE Instance: genieacs-backend
✓ External IP: 35.xxx.xxx.xxx (static)
✓ Docker Containers: 4 (CWMP, NBI, FS, UI)
✓ Backend API: Running on port 3000
✓ STUN Server: Running on port 3478
✓ Nginx: Configured with SSL
✓ Frontend: Deployed to Firebase App Hosting
✓ Firewall Rules: HTTP/HTTPS, TR-069, STUN
```

Plus:
- 🔍 Next steps to take
- 📚 Useful commands
- 💰 Cost estimate
- 📖 Documentation links

---

## 📄 Deployment Information File

The script saves all important information to `deployment-info.txt`:

```
Deployment completed: 2025-10-10 14:30:00

Frontend URL: https://lte-pci-mapper-nfomthzoza-uc.a.run.app
Backend URL: https://genieacs.yourdomain.com
External IP: 35.xxx.xxx.xxx
Instance: genieacs-backend
Zone: us-central1-a

Health Check: https://genieacs.yourdomain.com/api/health
GenieACS NBI: https://genieacs.yourdomain.com/nbi/devices
...
```

---

## 🛠️ Features

### Interactive & User-Friendly
- ✅ **Color-coded output** for easy reading
- ✅ **Step-by-step explanations** at each stage
- ✅ **Pause points** to review progress
- ✅ **Confirmation prompts** before major actions
- ✅ **Progress indicators** during long operations

### Smart & Safe
- ✅ **Prerequisite checking** with helpful install prompts
- ✅ **Error handling** with clear messages
- ✅ **Existing resource detection** (won't duplicate)
- ✅ **Configuration validation** before proceeding
- ✅ **Service verification** after deployment

### Complete & Automated
- ✅ **End-to-end deployment** in one script
- ✅ **No manual steps** required
- ✅ **All services configured** automatically
- ✅ **SSL setup** included
- ✅ **Health checks** built-in

---

## 🔧 What Gets Automated

### Infrastructure
- ✅ Static IP reservation
- ✅ Firewall rule creation (3 rules)
- ✅ GCE instance creation
- ✅ Network configuration

### Backend Services
- ✅ System updates
- ✅ Docker installation
- ✅ Node.js 20 installation
- ✅ GenieACS deployment (4 containers)
- ✅ Backend API deployment
- ✅ STUN server setup
- ✅ Nginx configuration
- ✅ SSL certificate setup
- ✅ Service startup

### Frontend
- ✅ Configuration file generation
- ✅ Environment variable substitution
- ✅ Firebase deployment
- ✅ Traffic routing

### Verification
- ✅ Health endpoint testing
- ✅ Service status checking
- ✅ Endpoint accessibility verification
- ✅ Summary generation

---

## ⚠️ Important Notes

### Before Running

1. **Have your MongoDB URI ready** - You'll need this immediately
2. **Decide on domain vs IP** - Know if you have a custom domain
3. **Have email for SSL** - Required for certificate generation
4. **Ensure stable internet** - Script runs for 25-30 minutes

### During Execution

1. **Don't close terminal** - Let the script complete
2. **Read explanations** - Understand what's happening
3. **Answer prompts** - Provide accurate information
4. **Wait for completion** - Some steps take time

### After Completion

1. **Save deployment-info.txt** - Contains all your URLs and IPs
2. **Test endpoints** - Verify everything works
3. **Configure DNS** - If using custom domain
4. **Document customizations** - Note any changes you make

---

## 🆘 Troubleshooting

### Script Won't Start
```bash
# Make sure it's executable
chmod +x deploy-complete.sh

# Check you're in the right directory
pwd  # Should show: .../PCI_mapper
```

### Missing gcloud
```bash
# Install from: https://cloud.google.com/sdk/docs/install
# Or use Cloud Shell (pre-installed)
```

### Missing firebase
```bash
# Install globally
npm install -g firebase-tools

# Or the script will offer to install it
```

### Authentication Issues
```bash
# Re-authenticate
gcloud auth login
firebase login
```

### Script Fails Mid-Way
```bash
# Check the error message
# Most common: authentication or project permissions
# Re-run the script - it handles existing resources gracefully
```

---

## 📚 Alternative Methods

If you prefer manual control, you can still use:

| Method | Guide | Use Case |
|--------|-------|----------|
| **Single Script** ⭐ | This guide | Quick, automated deployment |
| **Cloud Shell Manual** | [CLOUD_SHELL_DEPLOYMENT.md](CLOUD_SHELL_DEPLOYMENT.md) | Step-by-step control |
| **Local Manual** | [DEPLOYMENT_GUIDE_GCE_BACKEND.md](DEPLOYMENT_GUIDE_GCE_BACKEND.md) | Detailed manual deployment |
| **Quick Checklist** | [QUICK_DEPLOY_CHECKLIST.md](QUICK_DEPLOY_CHECKLIST.md) | Checklist-based deployment |

---

## 🎯 Success Criteria

Deployment is successful when you see:

- ✅ All 8 steps completed
- ✅ "🎉 Deployment Complete!" message
- ✅ All URLs displayed
- ✅ deployment-info.txt created
- ✅ Health check returns "healthy"
- ✅ Frontend loads in browser
- ✅ No error messages

---

## 💡 Pro Tips

### Use Cloud Shell
- Pre-installed tools
- Already authenticated
- Fast network to GCP
- Free to use

### Prepare Information
- MongoDB URI
- Domain name (or plan to use IP)
- SSL email
- Have them ready before starting

### Run During Off-Hours
- Less likely to be interrupted
- Can let it run without monitoring

### Save Output
```bash
./deploy-complete.sh 2>&1 | tee deployment.log
```

### Test Immediately
```bash
curl https://your-backend.com/api/health
```

---

## 🚀 Ready to Deploy?

1. **Open terminal** (Cloud Shell recommended)
2. **Clone repository** if not already
3. **Run script**: `./deploy-complete.sh`
4. **Follow prompts** - Let it guide you!
5. **Test deployment** - Verify everything works
6. **Celebrate** 🎉 - You're done!

---

## 📞 Getting Help

### If the script fails:
1. Read the error message carefully
2. Check the troubleshooting section above
3. Review the logs in deployment.log
4. Check individual service documentation

### Common Issues:
- **Authentication** → Re-run `gcloud auth login`
- **Permissions** → Check IAM roles in GCP console
- **Network** → Ensure stable internet connection
- **MongoDB** → Verify connection URI is correct

---

**Script File**: `deploy-complete.sh`  
**Estimated Time**: 25-30 minutes  
**Difficulty**: ⭐ Easy (fully guided)  
**Success Rate**: 🎯 High (automated & tested)  

---

*One script. One command. Complete deployment.* 🚀

