# 🔧 Troubleshooting Deployment Issues

## When Script Fails Partway Through

If the script fails during instance creation, here's what to do:

---

## 🔍 Step 1: Check What Was Created

Run these commands in Cloud Shell:

```bash
# Check if instance exists
gcloud compute instances list --filter="name=genieacs-backend"

# Check if IP was reserved
gcloud compute addresses list --filter="name=genieacs-backend-ip"

# Check firewall rules
gcloud compute firewall-rules list --filter="name~genieacs-backend OR name~allow-http-https OR name~allow-tr069 OR name~allow-stun"
```

---

## 🎯 Decision Tree

### **Scenario A: Nothing Created Yet**
If all commands above show nothing, **start over** - it's safe.

### **Scenario B: IP Reserved, Firewall Rules Created, But No Instance**
This is most likely. The script created prerequisites but failed at instance creation.

**Solution: Continue with manual instance creation**

### **Scenario C: Instance Exists But Script Failed**
The instance was created but something else failed.

**Solution: Continue to setup script**

---

## ✅ Solution: Clean Up and Retry

### **Option 1: Clean Everything and Start Fresh** (Recommended)

```bash
# Delete instance (if exists)
gcloud compute instances delete genieacs-backend --zone=us-central1-a --quiet

# Release static IP (if exists)
gcloud compute addresses delete genieacs-backend-ip --region=us-central1 --quiet

# Delete firewall rules (if exist)
gcloud compute firewall-rules delete allow-http-https --quiet
gcloud compute firewall-rules delete allow-tr069-cwmp --quiet
gcloud compute firewall-rules delete allow-stun-turn --quiet

# Now start over
./gce-backend/create-gce-instance.sh
```

### **Option 2: Continue from Where It Failed**

If IP and firewall rules exist, just create the instance manually:

```bash
# Get the reserved IP
EXTERNAL_IP=$(gcloud compute addresses describe genieacs-backend-ip --region=us-central1 --format='value(address)')

echo "Using IP: $EXTERNAL_IP"

# Create instance manually
gcloud compute instances create genieacs-backend \
    --project=lte-pci-mapper-65450042-bbf71 \
    --zone=us-central1-a \
    --machine-type=e2-standard-2 \
    --network-interface=network-tier=PREMIUM,subnet=default,address=$EXTERNAL_IP \
    --maintenance-policy=MIGRATE \
    --tags=genieacs-backend,http-server,https-server \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-balanced
```

---

## 🐛 Common Errors & Solutions

### **Error: "Could not fetch resource"**

**Possible Causes:**
1. Quota exceeded
2. Invalid image reference
3. Network/subnet doesn't exist
4. Insufficient permissions

**Solutions:**

#### 1. **Check Quotas**
```bash
gcloud compute project-info describe --project=lte-pci-mapper-65450042-bbf71
```

Look for CPU quotas in us-central1.

#### 2. **Verify Image Exists**
```bash
gcloud compute images list --project=ubuntu-os-cloud --filter="family:ubuntu-2204-lts"
```

#### 3. **Check Permissions**
```bash
gcloud projects get-iam-policy lte-pci-mapper-65450042-bbf71 --flatten="bindings[].members" --filter="bindings.members:user:YOUR_EMAIL"
```

You need `roles/compute.instanceAdmin.v1` or higher.

#### 4. **Try Different Zone**
```bash
# Try us-central1-b instead
gcloud compute instances create genieacs-backend \
    --zone=us-central1-b \
    ... (rest of command)
```

---

## 📋 Quick Cleanup Script

Create this file: `cleanup-gce.sh`

```bash
#!/bin/bash

echo "🧹 Cleaning up GCE resources..."

# Delete instance
echo "Deleting instance..."
gcloud compute instances delete genieacs-backend --zone=us-central1-a --quiet 2>/dev/null
echo "✓ Instance deleted (or didn't exist)"

# Release static IP
echo "Releasing static IP..."
gcloud compute addresses delete genieacs-backend-ip --region=us-central1 --quiet 2>/dev/null
echo "✓ IP released (or didn't exist)"

# Delete firewall rules
echo "Deleting firewall rules..."
gcloud compute firewall-rules delete allow-http-https --quiet 2>/dev/null
gcloud compute firewall-rules delete allow-tr069-cwmp --quiet 2>/dev/null
gcloud compute firewall-rules delete allow-stun-turn --quiet 2>/dev/null
echo "✓ Firewall rules deleted (or didn't exist)"

echo ""
echo "✅ Cleanup complete! You can now run the script again:"
echo "   ./gce-backend/create-gce-instance.sh"
```

Run it:
```bash
chmod +x cleanup-gce.sh
./cleanup-gce.sh
```

---

## 🔍 Get Full Error Details

To see the complete error message:

```bash
# Check recent operations
gcloud compute operations list --limit=5

# Get detailed error
gcloud compute operations describe OPERATION_NAME --zone=us-central1-a
```

---

## 💡 Pro Tips

### **Tip 1: Enable Detailed Logging**

```bash
gcloud config set core/verbosity debug
./gce-backend/create-gce-instance.sh
gcloud config set core/verbosity info  # Reset after
```

### **Tip 2: Check Billing**

```bash
gcloud billing projects describe lte-pci-mapper-65450042-bbf71
```

Make sure billing is enabled.

### **Tip 3: Try Smaller Instance First**

```bash
# Use e2-micro for testing (free tier)
--machine-type=e2-micro
```

---

## 🎯 Recommended Action Plan

Based on your error, here's what to do:

### **1. Check What Exists**
```bash
gcloud compute instances list
gcloud compute addresses list
```

### **2. Clean Up**
```bash
# Quick cleanup
gcloud compute instances delete genieacs-backend --zone=us-central1-a --quiet
gcloud compute addresses delete genieacs-backend-ip --region=us-central1 --quiet
```

### **3. Check for Issues**
```bash
# Verify billing
gcloud billing projects describe lte-pci-mapper-65450042-bbf71

# Check quotas
gcloud compute project-info describe --project=lte-pci-mapper-65450042-bbf71 | grep -A 5 "quotas"
```

### **4. Try Again**
```bash
./gce-backend/create-gce-instance.sh
```

---

## 🆘 Still Failing?

### Get the exact error:

```bash
# Run with verbose logging
gcloud compute instances create genieacs-backend \
    --project=lte-pci-mapper-65450042-bbf71 \
    --zone=us-central1-a \
    --machine-type=e2-standard-2 \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --verbosity=debug
```

Then share the full error message for specific help.

---

## 📊 Common Error Messages

| Error Message | Solution |
|---------------|----------|
| `Quota exceeded` | Request quota increase or use smaller instance |
| `Resource not found` | Check image family name |
| `Permission denied` | Add `roles/compute.admin` to your account |
| `Network not found` | Use `--network=default` |
| `Zone not available` | Try different zone (us-central1-b) |
| `Billing not enabled` | Enable billing in console |

---

## ✅ Success Checklist

After successful creation:

- [ ] Instance shows in `gcloud compute instances list`
- [ ] Static IP is attached
- [ ] Instance state is `RUNNING`
- [ ] Can SSH: `gcloud compute ssh genieacs-backend --zone=us-central1-a`

---

**Next Step After Success:**
```bash
# Copy setup script
gcloud compute scp gce-backend/setup-gce-instance.sh genieacs-backend:~ --zone=us-central1-a

# SSH and run setup
gcloud compute ssh genieacs-backend --zone=us-central1-a
./setup-gce-instance.sh
```


