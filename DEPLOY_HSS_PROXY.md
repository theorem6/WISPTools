# Deploy HSS Proxy Function

The HSS API proxy function has been added to provide HTTPS access to your HTTP backend.

## 🚀 **Option 1: Deploy via Google Cloud Shell (Recommended)**

### Step 1: Open Cloud Shell
Go to: https://console.cloud.google.com/  
Click the **>_** icon (top right)

### Step 2: Deploy Function
```bash
# Clone the repo
git clone https://github.com/theorem6/lte-pci-mapper.git
cd lte-pci-mapper/functions

# Install dependencies
npm install

# Build
npm run build

# Deploy the proxy function
firebase deploy --only functions:hssProxy --project lte-pci-mapper-65450042-bbf71
```

### Step 3: Get Function URL
After deployment, you'll see:
```
✔  functions[hssProxy(us-central1)] Deployed successfully
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy
```

---

## 🚀 **Option 2: Deploy via Firebase Console**

1. Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/functions
2. Click "Get started" if first time
3. The function will auto-deploy when you push to GitHub (if Firebase Functions auto-deployment is enabled)

---

## 🚀 **Option 3: Deploy via gcloud CLI**

```bash
cd C:\Users\david\Downloads\PCI_mapper\functions

# Deploy using gcloud
gcloud functions deploy hssProxy \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=hssProxy \
  --trigger-http \
  --allow-unauthenticated \
  --project=lte-pci-mapper-65450042-bbf71
```

---

## ✅ **What This Does**

The `hssProxy` function:
1. ✅ Receives HTTPS requests from your frontend
2. ✅ Forwards them to your backend at `http://34.36.231.142:3000`
3. ✅ Returns the response back to the frontend
4. ✅ Automatically handles CORS
5. ✅ No SSL certificate management needed!

---

## 🧪 **Test After Deployment**

```bash
# Test the proxy
curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/bandwidth-plans

# Should return the bandwidth plans from your backend
```

---

## 📊 **Architecture**

```
Frontend (Firebase App Hosting)
    ↓ HTTPS
Firebase Function (hssProxy)
    ↓ HTTP (internal Google Cloud network)
Backend GCE VM (34.36.231.142:3000)
    ↓
MongoDB Atlas
```

---

## 💰 **Cost**

- First 2 million invocations/month: **FREE**
- After that: $0.40 per million invocations
- Very cost-effective for most use cases!

---

## ⏱️ **Timeline**

- Function deployment: ~2-3 minutes
- Frontend will auto-redeploy: ~5-10 minutes
- **Total: ~15 minutes and everything will work!**

---

## 🔍 **Troubleshooting**

### Function not deploying?
```bash
# Check logs
gcloud functions logs read hssProxy --region=us-central1 --limit=50
```

### Frontend still showing errors?
- Wait for frontend to redeploy (check Firebase Console)
- Clear browser cache
- Check that backend is running: `curl http://34.36.231.142:3000/bandwidth-plans`

### CORS errors?
The function already includes CORS headers, but if you see issues:
1. Check that `cors({ origin: true })` is in the function
2. Verify the function is deployed correctly

