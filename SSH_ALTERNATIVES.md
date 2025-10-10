# 🔐 SSH Connection Alternatives for Cloud Shell

## Issue: "Your platform does not support SSH"

This can happen in Cloud Shell. Here are the solutions:

---

## ✅ Solution 1: Use Cloud Console SSH (Easiest)

### **Open SSH in Browser:**

1. Go to: https://console.cloud.google.com/compute/instances
2. Find: `genieacs-backend`
3. Click: **SSH** button (in the Connect column)

This opens a browser-based SSH terminal directly to your instance!

---

## ✅ Solution 2: Use gcloud SSH with --tunnel-through-iap

```bash
gcloud compute ssh genieacs-backend \
    --zone=us-central1-a \
    --tunnel-through-iap
```

This uses Identity-Aware Proxy instead of direct SSH.

---

## ✅ Solution 3: Upload Keys Manually

```bash
# Generate SSH key if needed
ssh-keygen -t rsa -f ~/.ssh/google_compute_engine -C cloudshell -N ""

# Add to instance metadata
gcloud compute instances add-metadata genieacs-backend \
    --zone=us-central1-a \
    --metadata-from-file ssh-keys=<(echo "cloudshell:$(cat ~/.ssh/google_compute_engine.pub)")

# Try SSH again
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

---

## ✅ Solution 4: Use Serial Console (For Troubleshooting)

```bash
gcloud compute instances get-serial-port-output genieacs-backend \
    --zone=us-central1-a \
    --port=1
```

---

## 🎯 Recommended Approach for Your Setup

Since you need to copy the setup script and run it, use the **Console SSH** method:

### **Step 1: Open Console SSH**

Go to: https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71

Click the **SSH** button next to `genieacs-backend`

### **Step 2: Copy Setup Script (Alternative Method)**

In the **browser SSH terminal**, run:

```bash
# Download setup script directly from GitHub
curl -o setup-gce-instance.sh https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/gce-backend/setup-gce-instance.sh

# Make executable
chmod +x setup-gce-instance.sh

# Verify
ls -la setup-gce-instance.sh

# Run setup
./setup-gce-instance.sh
```

---

## 🚀 Alternative: Use Cloud Shell File Upload

### **Method 1: Upload via Cloud Shell Editor**

1. In Cloud Shell, click the **three dots** (⋮) menu
2. Select **Upload file**
3. Upload `gce-backend/setup-gce-instance.sh`
4. Then copy to instance:

```bash
# From Cloud Shell
gcloud compute scp ~/setup-gce-instance.sh genieacs-backend:~ --zone=us-central1-a
```

### **Method 2: Use wget/curl**

In the Console SSH session (on the instance):

```bash
# Download from GitHub
wget https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/gce-backend/setup-gce-instance.sh

# Or use curl
curl -O https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/gce-backend/setup-gce-instance.sh

# Make executable
chmod +x setup-gce-instance.sh

# Run
./setup-gce-instance.sh
```

---

## 🔧 Fix SSH Keys (If You Want Direct SSH)

```bash
# In Cloud Shell, run:

# 1. Generate key
ssh-keygen -t rsa -b 2048 -f ~/.ssh/google_compute_engine -q -N ""

# 2. Add to project metadata
gcloud compute project-info add-metadata \
    --metadata-from-file ssh-keys=<(gcloud compute os-login ssh-keys list --format="value(key)" | awk '{print "cloudshell:" $0}')

# 3. Wait 30 seconds for propagation
sleep 30

# 4. Try SSH again
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

---

## 🎯 Quick Solution for Right Now

### **Option A: Browser SSH (Fastest)**

1. Click here: https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71
2. Click **SSH** button next to `genieacs-backend`
3. In the new SSH window, run:
   ```bash
   curl -o setup-gce-instance.sh https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/gce-backend/setup-gce-instance.sh
   chmod +x setup-gce-instance.sh
   ./setup-gce-instance.sh
   ```

### **Option B: Use SCP Instead**

```bash
# Copy file using SCP (works when SSH doesn't)
gcloud compute scp gce-backend/setup-gce-instance.sh genieacs-backend:~ \
    --zone=us-central1-a \
    --tunnel-through-iap
```

Then use Console SSH to run it.

---

## 📝 Why This Happens

Cloud Shell SSH issues occur due to:
1. Missing SSH keys in metadata
2. OS Login not configured
3. Firewall blocking SSH (port 22)
4. Instance not fully ready yet

The Console SSH button bypasses these issues by using IAP.

---

## ✅ Complete Workaround

### **In Cloud Shell:**

```bash
# Copy script using SCP with IAP
gcloud compute scp gce-backend/setup-gce-instance.sh genieacs-backend:~ \
    --zone=us-central1-a \
    --tunnel-through-iap
```

### **In Console SSH (browser):**

1. Go to: https://console.cloud.google.com/compute/instances
2. Click SSH button
3. Run:
   ```bash
   ls -la setup-gce-instance.sh
   chmod +x setup-gce-instance.sh
   ./setup-gce-instance.sh
   ```

---

## 🔑 Enable OS Login (Better Long-term Solution)

```bash
# Enable OS Login for the project
gcloud compute project-info add-metadata \
    --metadata enable-oslogin=TRUE

# Wait a moment
sleep 10

# Try SSH again
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

---

## 💡 Pro Tip: Use Startup Script

You can also run the setup automatically by using a startup script:

```bash
# Add startup script metadata
gcloud compute instances add-metadata genieacs-backend \
    --zone=us-central1-a \
    --metadata-from-file startup-script=gce-backend/setup-gce-instance.sh
```

Then reboot:
```bash
gcloud compute instances reset genieacs-backend --zone=us-central1-a
```

---

## 🎯 Summary: What To Do NOW

**Easiest Method:**

1. **Open**: https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71
2. **Click**: The **SSH** button next to `genieacs-backend`
3. **Run** in the browser SSH window:
   ```bash
   curl -o setup-gce-instance.sh https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/gce-backend/setup-gce-instance.sh
   chmod +x setup-gce-instance.sh
   ./setup-gce-instance.sh
   ```

This bypasses all SSH issues and gets you running immediately! 🚀


