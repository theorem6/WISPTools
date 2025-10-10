# 🔧 Update Existing Frontend to Use GCE Backend

## Problem

Frontend build is failing. But your existing frontend deployment already works!

## Solution

**Don't redeploy the frontend yet.** Instead, update the existing working deployment to point to your new GCE backend.

---

## ✅ **Quick Fix: Update Existing apphosting.yaml**

In Cloud Shell, run:

```bash
cd ~/lte-pci-mapper

# Get your GCE external IP
GCE_IP=$(gcloud compute instances describe genieacs-backend --zone=us-central1-a --format='value(networkInterfaces[0].accessConfigs[0].natIP)')

echo "Your GCE IP: $GCE_IP"

# Backup existing config
cp apphosting.yaml apphosting.yaml.backup

# Add GCE backend variables to the END of the existing apphosting.yaml
cat >> apphosting.yaml << EOF

  # ==========================================
  # GCE BACKEND CONFIGURATION (NEW)
  # ==========================================
  - variable: PUBLIC_BACKEND_API_URL
    value: "http://${GCE_IP}/api"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_GENIEACS_NBI_URL
    value: "http://${GCE_IP}/nbi"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_GENIEACS_CWMP_URL
    value: "http://${GCE_IP}:7547"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_GENIEACS_FS_URL
    value: "http://${GCE_IP}/fs"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_GENIEACS_UI_URL
    value: "http://${GCE_IP}/admin"
    availability:
      - BUILD
      - RUNTIME

  - variable: PUBLIC_STUN_SERVER
    value: "stun:${GCE_IP}:3478"
    availability:
      - BUILD
      - RUNTIME
EOF

echo ""
echo "✅ apphosting.yaml updated with GCE backend URLs"
echo ""
echo "Now deploy:"
echo "  firebase deploy --only apphosting"
```

---

## 🚀 **Deploy:**

```bash
firebase deploy --only apphosting
```

---

## 🎯 **This Works Because:**

1. ✅ Uses your existing working apphosting.yaml (doesn't break it)
2. ✅ Just adds new environment variables
3. ✅ Frontend code already has the new backend clients
4. ✅ Build process stays the same

---

**Try this approach - it should work!**

