# Firebase Console Deployment from Git

## ✅ Everything is Ready in Git!

All your code is committed and pushed to GitHub. Firebase will pull and deploy automatically.

## What Firebase Will Do Automatically

When you deploy from Firebase Console:

```
1. Pull code from Git repository
2. Install all dependencies (npm install)
3. Build TypeScript Functions (npm run build)
4. Deploy Functions (30+ functions)
5. Build Module Manager (SvelteKit app)
6. Deploy to App Hosting
7. Configure environment variables from apphosting.yaml
8. Done! ✅
```

## Step-by-Step: Deploy from Firebase Console

### Option 1: App Hosting Rollout (Recommended)

1. **Go to Firebase Console:**
   ```
   https://console.firebase.google.com/
   ```

2. **Select your project:**
   - Click on: `lte-pci-mapper-65450042-bbf71` (or your project)

3. **Navigate to App Hosting:**
   - Left sidebar → Click: **"App Hosting"**

4. **Deploy from Git:**
   
   **If first time:**
   - Click: **"Get started"** or **"Connect repository"**
   - Select: **GitHub** (or GitLab/Bitbucket)
   - Authorize: Firebase to access your repository
   - Select repository: `lte-pci-mapper`
   - Select branch: `main`
   - Root directory: `/Module_Manager`
   - Click: **"Deploy"**

   **If already connected:**
   - Click: **"Deploy"** button
   - Or: **"New rollout"**
   - Select: `main` branch
   - Click: **"Deploy"**

5. **Monitor deployment:**
   - Watch the build logs
   - Build time: ~5-10 minutes
   - Deployment time: ~2-5 minutes
   - Total: ~10-15 minutes

6. **Wait for completion:**
   ```
   ✓ Build completed successfully
   ✓ Deployment completed successfully
   ```

### Option 2: Functions Deployment

**Important:** Functions should deploy automatically with App Hosting, but if needed:

1. **Go to Firebase Console → Functions**

2. **Deploy from source:**
   - Click: **"Deploy"**
   - Source: **Git repository**
   - Select: `main` branch
   - Directory: `/functions`

3. **Or they deploy automatically when App Hosting deploys**

## What Gets Configured Automatically

### From `apphosting.yaml`:

```yaml
# All environment variables configured:
✓ MONGODB_URI (with your password)
✓ PUBLIC_FIREBASE_FUNCTIONS_URL
✓ PUBLIC_GET_MONGO_PRESETS_URL
✓ PUBLIC_UPDATE_MONGO_PRESET_URL
✓ PUBLIC_DELETE_MONGO_PRESET_URL
✓ PUBLIC_GET_MONGO_FAULTS_URL
✓ PUBLIC_ACKNOWLEDGE_MONGO_FAULT_URL
✓ PUBLIC_DELETE_MONGO_FAULT_URL
✓ All Firebase config variables
✓ All GenieACS endpoints
```

### Build Configuration:

```yaml
# From apphosting.yaml:
buildCommand: npm install && NODE_OPTIONS="--max-old-space-size=6144" npm run build
runCommand: node server.js
```

Firebase executes these automatically!

## Monitoring the Deployment

### In Firebase Console:

1. **App Hosting page:**
   - Shows: Build status
   - Shows: Deployment status
   - Shows: Build logs (click to expand)

2. **Look for:**
   ```
   ✓ Installing dependencies
   ✓ Building application
   ✓ Deploying to Cloud Run
   ✓ Deployment complete
   ```

3. **Get your URL:**
   - Shows: `https://PROJECT-ID.web.app`
   - Click: **"View app"** button

### Check Functions:

1. **Go to: Functions page**
2. **Should see:**
   - checkMongoHealth
   - initializeMongoDatabase
   - getMongoPresets
   - updateMongoPreset
   - deleteMongoPreset
   - getMongoFaults
   - acknowledgeMongoFault
   - deleteMongoFault
   - Plus 20+ more functions

## After Deployment Completes

### Step 1: Visit Your App

Click the URL shown in Firebase Console:
```
https://lte-pci-mapper-65450042-bbf71.web.app
```

Or click: **"View app"** button

### Step 2: Navigate to Database Page

```
Your App → ACS CPE Management → Administration → Database
```

Direct URL:
```
https://your-app.web.app/modules/acs-cpe-management/admin/database
```

### Step 3: Automatic Initialization Appears!

**You'll see this:**

```
═══════════════════════════════════════════════════
🚀 Database is Empty

Would you like to automatically initialize the 
database with sample data?

This creates 4 presets and 3 faults for testing 
and development.

[ ✨ Yes, Initialize Now ]  [ Maybe Later ]
═══════════════════════════════════════════════════
```

### Step 4: Click the Button!

Click: **"✨ Yes, Initialize Now"**

**Wait 2 seconds...**

**Then see:**
```
✅ Database initialized!

Presets: 4 created, 0 existed (4 total)
Faults: 3 created, 0 existed (3 total)
```

### Step 5: Verify Everything Works

**Check Presets:**
```
Navigation: Admin → Presets
Should show: 4 presets
Try: Click "Edit" on any preset
Result: Edit form opens ✅
```

**Check Faults:**
```
Navigation: Faults (main menu)
Should show: 3 faults
Try: Click "Acknowledge" on any fault
Result: Fault marked as resolved ✅
```

**Check Services:**
```
Navigation: Admin → Services
Should show: All services online ✅
```

## Troubleshooting

### Deployment Failed

**Check build logs:**
1. Firebase Console → App Hosting
2. Click on failed deployment
3. View logs

**Common issues:**
- Dependencies installation failed → Retry deployment
- Build timeout → Increase timeout in settings
- Out of memory → Already configured with 6GB

### Deployment Succeeded But App Not Loading

**Check:**
1. URL is correct
2. Clear browser cache (Ctrl+Shift+R)
3. Check browser console for errors (F12)

### MongoDB Not Connected

**If you see:**
```
❌ MongoDB not connected
```

**Check in Firebase Console:**
1. App Hosting → Your backend
2. Environment variables
3. Find: `MONGODB_URI`
4. Should NOT contain: `<db_password>`

**If it still has placeholder:**
1. Your recent commit didn't sync yet
2. Wait 1 minute for Git to sync
3. Trigger new deployment

### Auto-Initialize Banner Doesn't Appear

**Possible reasons:**
1. **Database not empty** - Check MongoDB Atlas (data already exists)
2. **Functions not deployed** - Check Functions page
3. **Loading** - Wait a few seconds for health check

**Verify:**
```
Open browser console (F12)
Look for: "Database initialization page loaded"
Look for: "MongoDB connected: genieacs"
```

## What Happens Behind the Scenes

### Firebase App Hosting Build Process:

```
1. Clone repository from GitHub
   ↓
2. Navigate to /Module_Manager
   ↓
3. Run: npm install
   ↓
4. Run: npm run build
   ↓
5. Package application
   ↓
6. Deploy to Cloud Run
   ↓
7. Configure environment variables
   ↓
8. Route traffic to new version
   ↓
9. Done! ✅
```

### Firebase Functions Deployment:

```
1. Detect /functions directory
   ↓
2. Install dependencies
   ↓
3. Build TypeScript (npm run build)
   ↓
4. Deploy each function
   ↓
5. Configure triggers and environment
   ↓
6. Functions live! ✅
```

## Git Integration Features

### Automatic Deployments

**Once connected, Firebase automatically deploys when you:**

✅ **Push to main branch:**
```bash
git push origin main
```
→ Automatic production deployment

✅ **Create pull request:**
```bash
git push origin feature-branch
```
→ Automatic preview deployment

✅ **Merge pull request:**
→ Automatic production deployment

### Preview Deployments

**For each PR, Firebase creates:**
- ✅ Temporary preview URL
- ✅ Full environment with all features
- ✅ Isolated from production
- ✅ Auto-deleted when PR is closed

### Rollback

**If something goes wrong:**
1. Firebase Console → App Hosting
2. Click: **"Rollouts"**
3. Select: Previous working version
4. Click: **"Promote to production"**
5. Instant rollback! ✅

## Success Indicators

### ✅ Deployment Successful:

In Firebase Console:
```
Status: DEPLOYED
Traffic: 100%
URL: https://your-app.web.app
Last deployed: Just now
```

### ✅ MongoDB Connected:

Visit Database page:
```
Connection: ✅ Connected
Database: genieacs
Server Version: 7.x.x
Presets Count: 0 (before init)
Faults Count: 0 (before init)
```

### ✅ Auto-Initialization Works:

After clicking button:
```
✅ Database initialized!
Presets: 4 created (4 total)
Faults: 3 created (3 total)
```

### ✅ Everything Operational:

```
Admin → Presets: 4 items ✅
Faults: 3 items ✅
Can edit presets ✅
Can acknowledge faults ✅
Can delete faults ✅
Services all online ✅
```

## Configuration Already in Repository

Everything Firebase needs is in your Git repo:

### ✅ `Module_Manager/apphosting.yaml`
- Build commands
- Environment variables
- MongoDB connection (with password)
- All API endpoints

### ✅ `functions/`
- All 30+ functions
- package.json
- TypeScript configuration
- MongoDB integration

### ✅ `Module_Manager/`
- Complete SvelteKit app
- Database admin UI
- Service monitoring
- All components

## Timeline

**Expected deployment time:**

```
Git Pull:              30 seconds
Install dependencies:  2-3 minutes
Build Functions:       1-2 minutes
Build Module Manager:  3-5 minutes
Deploy:                2-3 minutes
Total:                 10-15 minutes
```

## After First Deployment

### Future Updates Are Easy!

```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push

# Firebase automatically:
# - Detects push
# - Builds new version
# - Deploys automatically
# - Routes traffic
# Done! ✅
```

## Summary

### What You Do:

1. ✅ Go to Firebase Console
2. ✅ Click "Deploy" or "New rollout"
3. ✅ Wait 10-15 minutes
4. ✅ Visit your app URL
5. ✅ Click initialization button
6. ✅ Done!

### What Firebase Does Automatically:

1. ✅ Pulls code from Git
2. ✅ Installs dependencies
3. ✅ Builds Functions
4. ✅ Builds Module Manager
5. ✅ Deploys everything
6. ✅ Configures environment
7. ✅ Makes app live
8. ✅ Initializes on button click

### What You Get:

✅ **Complete GenieACS system**
✅ **MongoDB-backed data**
✅ **Automatic initialization**
✅ **Full CRUD operations**
✅ **Service monitoring**
✅ **All features working**

---

## Ready to Deploy from Firebase Console!

**Your checklist:**
- ✅ Code in Git
- ✅ MongoDB password configured
- ✅ Committed and pushed
- ✅ apphosting.yaml correct
- ✅ All functions ready
- ✅ UI ready

**Go to Firebase Console and click "Deploy"!** 🚀

**Timeline:** 10-15 minutes → **Everything works!** ✨

