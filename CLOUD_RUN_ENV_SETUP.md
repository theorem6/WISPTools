# ☁️ Cloud Run Environment Variables Setup

## Quick Setup

### Option 1: Use Shell Script (Easiest)

```bash
# In Firebase Web IDE terminal
chmod +x setup-cloud-run-env.sh
./setup-cloud-run-env.sh
```

### Option 2: Manual gcloud Command

```bash
# Set Firebase Config (JSON format)
gcloud run services update pci-mapper \
  --region us-central1 \
  --project lte-pci-mapper-65450042-bbf71 \
  --update-env-vars FIREBASE_CONFIG='{"databaseURL":"","projectId":"lte-pci-mapper-65450042-bbf71","storageBucket":"lte-pci-mapper-65450042-bbf71.firebasestorage.app","apiKey":"AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0"}'

# Set all individual variables
gcloud run services update pci-mapper \
  --region us-central1 \
  --project lte-pci-mapper-65450042-bbf71 \
  --update-env-vars \
PUBLIC_FIREBASE_API_KEY=AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0,\
PUBLIC_FIREBASE_AUTH_DOMAIN=lte-pci-mapper-65450042-bbf71.firebaseapp.com,\
PUBLIC_FIREBASE_PROJECT_ID=lte-pci-mapper-65450042-bbf71,\
PUBLIC_FIREBASE_STORAGE_BUCKET=lte-pci-mapper-65450042-bbf71.firebasestorage.app,\
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1044782186913,\
PUBLIC_FIREBASE_APP_ID=1:1044782186913:web:a5367441ce136118948be0,\
PUBLIC_ARCGIS_API_KEY=AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ,\
PUBLIC_GEMINI_API_KEY=AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg,\
PUBLIC_WOLFRAM_APP_ID=WQPAJ72446
```

### Option 3: Use apphosting.yaml (Recommended)

The `apphosting.yaml` file we created should automatically configure everything during deployment. Just:

```bash
git pull origin main
firebase deploy
```

## 📋 Environment Variables Reference

### Firebase Configuration:

```bash
PUBLIC_FIREBASE_API_KEY=AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0
PUBLIC_FIREBASE_AUTH_DOMAIN=lte-pci-mapper-65450042-bbf71.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=lte-pci-mapper-65450042-bbf71
PUBLIC_FIREBASE_STORAGE_BUCKET=lte-pci-mapper-65450042-bbf71.firebasestorage.app
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1044782186913
PUBLIC_FIREBASE_APP_ID=1:1044782186913:web:a5367441ce136118948be0
```

### API Keys:

```bash
PUBLIC_ARCGIS_API_KEY=AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ
PUBLIC_GEMINI_API_KEY=AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg
PUBLIC_WOLFRAM_APP_ID=WQPAJ72446
```

## 🔍 Verify Variables Are Set

```bash
# List all environment variables for the service
gcloud run services describe pci-mapper \
  --region us-central1 \
  --project lte-pci-mapper-65450042-bbf71 \
  --format='table(spec.template.spec.containers[0].env[].name, spec.template.spec.containers[0].env[].value)'
```

## 🚀 Alternative: Firebase Console UI

If gcloud command doesn't work:

1. Go to: https://console.cloud.google.com/run/detail/us-central1/pci-mapper/revisions?project=lte-pci-mapper-65450042-bbf71
2. Click **"Edit & Deploy New Revision"**
3. Scroll to **"Variables & Secrets"** → **"Environment Variables"**
4. Click **"+ Add Variable"** for each:
   - Name: `PUBLIC_FIREBASE_API_KEY`
   - Value: `AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0`
   - (Repeat for all variables)
5. Click **"Deploy"**

## ⚡ Fastest Method

**Just deploy with the `apphosting.yaml` file:**

```bash
cd ~/lte-pci-mapper
git pull origin main
firebase deploy
```

Firebase will automatically read `apphosting.yaml` and configure everything! 🎯

## 🆘 Troubleshooting

### Error: "Service not found"

```bash
# List all services
gcloud run services list --project lte-pci-mapper-65450042-bbf71

# Check which region it's in
gcloud run services list --project lte-pci-mapper-65450042-bbf71 --format='table(metadata.name, metadata.namespace, status.url)'
```

### Error: "Permission denied"

```bash
# Authenticate
gcloud auth login

# Set project
gcloud config set project lte-pci-mapper-65450042-bbf71
```

### Variables not taking effect

```bash
# Force new revision
gcloud run services update pci-mapper \
  --region us-central1 \
  --project lte-pci-mapper-65450042-bbf71 \
  --clear-env-vars

# Then set them again using the commands above
```

---

**The easiest way: Just pull and deploy - `apphosting.yaml` handles everything automatically!** 🚀

