# Deploy Functions Manually (Cloud Build Not Set Up)

Firebase Functions **don't auto-deploy from Git** unless Cloud Build triggers are configured.

## ⚡ Quick Fix - Deploy Functions Now

You have two options:

### Option 1: Use Firebase CLI (if available on another machine)

```bash
# From project root
firebase deploy --only functions:hssProxy
```

### Option 2: Set Up Cloud Build Trigger (One-time setup)

1. Go to: https://console.cloud.google.com/cloud-build/triggers?project=lte-pci-mapper-65450042-bbf71

2. Click **"Create Trigger"**

3. Configure:
   - **Name**: `deploy-functions-on-push`
   - **Event**: Push to branch
   - **Source**: Your GitHub repo (theorem6/lte-pci-mapper)
   - **Branch**: `^main$`
   - **Configuration**: Cloud Build configuration file
   - **Location**: `cloudbuild.yaml`

4. Click **"Create"**

5. The next git push will auto-deploy functions!

### Option 3: Manual Trigger Now

1. Go to Cloud Build: https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71

2. Click **"Run Trigger"** or **"Submit Build"**

3. Select `cloudbuild.yaml` from your repo

4. It will deploy the functions immediately

---

## 🎯 Immediate Workaround

Since the functions aren't deploying automatically, the **quickest solution** is to use the Firebase Console:

1. Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/functions

2. Click on `hssProxy` function

3. Click **"Edit"** or look for **"Deploy"** option

4. Manually update the code or redeploy from source

---

## 📊 Current Situation

- ✅ Code is in Git (commits `d1abbe3` and `ec6794c`)
- ✅ Backend on server works (port 3000)
- ❌ Cloud Functions not auto-deploying
- ⏳ Need to trigger deployment manually

---

**Fastest path forward:**
Use Cloud Console to manually trigger a build from the latest Git commit!

