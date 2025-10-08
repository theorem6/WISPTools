# Pre-Deployment Checklist for Firebase Rollout

## Critical Items to Verify Before Deploying

### ✅ Step 1: Verify MongoDB Connection String

**Check `apphosting.yaml`:**

```yaml
- variable: MONGODB_URI
  value: "mongodb+srv://genieacs-user:<db_password>@cluster0.1radgkw.mongodb.net/..."
```

**❌ WILL NOT WORK if:**
- Contains `<db_password>` placeholder
- Password is incorrect
- Connection string is malformed

**✅ WILL WORK if:**
- Real password is inserted
- Connection string is valid
- MongoDB Atlas IP whitelist allows 0.0.0.0/0

**How to fix:**
1. Get MongoDB password from Atlas
2. Replace `<db_password>` with actual password
3. Save `apphosting.yaml`
4. Commit changes

**Example of correct configuration:**
```yaml
- variable: MONGODB_URI
  value: "mongodb+srv://genieacs-user:MyRealPassword123@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  availability:
    - RUNTIME
```

### ✅ Step 2: Deploy Firebase Functions FIRST

**Before deploying App Hosting**, deploy Functions:

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

**Verify deployment:**
```bash
firebase functions:list
```

**You should see these functions:**
- ✅ `checkMongoHealth`
- ✅ `initializeMongoDatabase`
- ✅ `initializeMongoPresets`
- ✅ `initializeMongoFaults`
- ✅ `getMongoPresets`
- ✅ `updateMongoPreset`
- ✅ `deleteMongoPreset`
- ✅ `getMongoFaults`
- ✅ `acknowledgeMongoFault`
- ✅ `deleteMongoFault`
- ✅ Plus 20+ more functions

**❌ If functions are not deployed:**
- Auto-initialization will fail
- Database page will show errors
- No MongoDB operations will work

### ✅ Step 3: Verify Environment Variables

**Check that all these are in `apphosting.yaml`:**

```yaml
# Required for initialization
PUBLIC_FIREBASE_FUNCTIONS_URL: "https://us-central1-PROJECT-ID.cloudfunctions.net"

# MongoDB endpoints
PUBLIC_GET_MONGO_PRESETS_URL: "https://us-central1-PROJECT-ID.cloudfunctions.net/getMongoPresets"
PUBLIC_UPDATE_MONGO_PRESET_URL: "https://us-central1-PROJECT-ID.cloudfunctions.net/updateMongoPreset"
PUBLIC_DELETE_MONGO_PRESET_URL: "https://us-central1-PROJECT-ID.cloudfunctions.net/deleteMongoPreset"
PUBLIC_GET_MONGO_FAULTS_URL: "https://us-central1-PROJECT-ID.cloudfunctions.net/getMongoFaults"
PUBLIC_ACKNOWLEDGE_MONGO_FAULT_URL: "https://us-central1-PROJECT-ID.cloudfunctions.net/acknowledgeMongoFault"
PUBLIC_DELETE_MONGO_FAULT_URL: "https://us-central1-PROJECT-ID.cloudfunctions.net/deleteMongoFault"
```

**Replace `PROJECT-ID` with your actual Firebase project ID:**
- For example: `lte-pci-mapper-65450042-bbf71`

### ✅ Step 4: Verify MongoDB Atlas Settings

**In MongoDB Atlas Console:**

1. **Network Access:**
   - ✅ Allow access from anywhere: `0.0.0.0/0`
   - Or add Firebase/Google Cloud IP ranges

2. **Database User:**
   - ✅ Username: `genieacs-user` (or your username)
   - ✅ Password: Correct password (no placeholder)
   - ✅ Permissions: Read/Write on `genieacs` database

3. **Database:**
   - ✅ Database name: `genieacs`
   - ✅ Collections will be created automatically

### ✅ Step 5: Test Functions Before App Hosting

**Test the health check function:**

```bash
# Get your project ID
PROJECT_ID=$(firebase use | grep Active | awk '{print $3}')

# Test health check
curl https://us-central1-$PROJECT_ID.cloudfunctions.net/checkMongoHealth
```

**Expected response:**
```json
{
  "success": true,
  "connected": true,
  "database": "genieacs",
  "serverVersion": "7.x.x",
  "collections": {
    "presets": 0,
    "faults": 0
  }
}
```

**❌ If you get an error:**
- Check MongoDB connection string
- Verify MongoDB Atlas network access
- Check function logs: `firebase functions:log`

### ✅ Step 6: Deploy Module Manager (App Hosting)

**Now you can safely deploy:**

```bash
cd Module_Manager
firebase apphosting:backends:deploy
```

**Or use the deployment script:**

```bash
./deploy-from-git.ps1
```

## What Will Happen After Deployment

### Automatic Flow

```
1. User visits: https://your-app.web.app/modules/acs-cpe-management/admin/database

2. Page loads and calls: checkMongoHealth

3. If MongoDB connected and empty:
   → Purple banner appears: "Database is Empty"
   → Shows: "Yes, Initialize Now" button

4. User clicks button

5. Browser calls: initializeMongoDatabase

6. Function executes in Google Cloud:
   → Connects to MongoDB Atlas
   → Inserts 4 presets
   → Inserts 3 faults
   → Returns success

7. UI updates:
   → Shows success message
   → Hides banners
   → Updates counts

8. Done! ✅
```

## Potential Issues and Solutions

### Issue 1: "MongoDB not connected"

**Cause:** MongoDB URI not configured or wrong password

**Solution:**
1. Update `MONGODB_URI` in `apphosting.yaml`
2. Ensure password is correct (no `<db_password>`)
3. Redeploy Module Manager:
   ```bash
   cd Module_Manager
   firebase apphosting:backends:deploy
   ```

### Issue 2: "Failed to fetch" or "Network error"

**Cause:** Firebase Functions not deployed

**Solution:**
```bash
firebase deploy --only functions
firebase functions:list  # Verify
```

### Issue 3: Initialization button disabled

**Cause:** `PUBLIC_FIREBASE_FUNCTIONS_URL` not configured

**Solution:**
1. Check `apphosting.yaml` has the variable
2. Ensure it matches your project ID
3. Redeploy Module Manager

### Issue 4: CORS error in browser console

**Cause:** Functions CORS not configured

**Solution:**
- Functions already have CORS enabled: `cors({ origin: true })`
- Should work automatically
- If issues persist, check Firebase Console → Functions → Logs

### Issue 5: Auto-initialization banner doesn't appear

**Possible causes:**
1. **Database not empty** - Already has data (expected)
2. **MongoDB health check failed** - Check connection
3. **Environment variable missing** - Check `PUBLIC_FIREBASE_FUNCTIONS_URL`

**Verify:**
```bash
# Check if database is really empty
curl https://us-central1-PROJECT-ID.cloudfunctions.net/checkMongoHealth
```

## Pre-Deployment Testing Script

**Run this before deploying:**

```powershell
# Pre-deployment test script
Write-Host "🔍 Pre-Deployment Checklist" -ForegroundColor Cyan

# 1. Check MongoDB URI
Write-Host "`n1. Checking MongoDB URI..." -ForegroundColor Yellow
$mongoUri = Select-String -Path "apphosting.yaml" -Pattern "MONGODB_URI"
if ($mongoUri -match "<db_password>") {
    Write-Host "   ❌ FAIL: MongoDB URI contains placeholder password" -ForegroundColor Red
    Write-Host "   Fix: Update MONGODB_URI in apphosting.yaml" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "   ✅ PASS: MongoDB URI configured" -ForegroundColor Green
}

# 2. Check if Functions are built
Write-Host "`n2. Checking Functions build..." -ForegroundColor Yellow
if (Test-Path "functions/lib") {
    Write-Host "   ✅ PASS: Functions are built" -ForegroundColor Green
} else {
    Write-Host "   ❌ FAIL: Functions not built" -ForegroundColor Red
    Write-Host "   Fix: cd functions && npm run build" -ForegroundColor Yellow
    exit 1
}

# 3. Check Firebase project
Write-Host "`n3. Checking Firebase project..." -ForegroundColor Yellow
$project = firebase use 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ PASS: Firebase project selected" -ForegroundColor Green
} else {
    Write-Host "   ❌ FAIL: No Firebase project selected" -ForegroundColor Red
    Write-Host "   Fix: firebase use PROJECT-ID" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ All checks passed! Ready to deploy." -ForegroundColor Green
```

**Save as `pre-deployment-check.ps1` and run:**
```powershell
./pre-deployment-check.ps1
```

## Deployment Order (Critical!)

**Must deploy in this order:**

```
1. Functions FIRST
   ↓
2. Verify Functions work
   ↓
3. Module Manager (App Hosting)
   ↓
4. Test initialization in browser
```

**Wrong order = Broken initialization**

## Complete Deployment Sequence

```powershell
# Step 1: Update MongoDB URI
# Edit apphosting.yaml and replace <db_password>

# Step 2: Commit changes
git add apphosting.yaml
git commit -m "Configure MongoDB connection"
git push

# Step 3: Deploy Functions
firebase deploy --only functions

# Step 4: Verify Functions
firebase functions:list

# Step 5: Test health check
curl https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/checkMongoHealth

# Step 6: Deploy Module Manager
cd Module_Manager
firebase apphosting:backends:deploy

# Step 7: Visit app and test
# Go to: https://your-app.web.app/modules/acs-cpe-management/admin/database
```

## Success Indicators

### ✅ Functions Deployed Successfully

```bash
firebase functions:list
```

Output should show:
```
✔ functions: 30+ functions listed
```

### ✅ MongoDB Connected

Visit: `/modules/acs-cpe-management/admin/database`

Should show:
```
Connection: ✅ Connected
Database: genieacs
Server Version: 7.x.x
```

### ✅ Auto-Initialization Works

If database is empty, should see:
```
[Purple Banner]
🚀 Database is Empty
[Yes, Initialize Now button]
```

### ✅ Initialization Completes

After clicking button:
```
✅ Database initialized!

Presets: 4 created, 0 existed (4 total)
Faults: 3 created, 0 existed (3 total)
```

### ✅ Data Accessible

- Admin → Presets: Shows 4 presets
- Faults: Shows 3 faults
- Can edit presets ✅
- Can acknowledge faults ✅
- Can delete faults ✅

## Final Verification Checklist

Before you click "Deploy" in Firebase Console:

- [ ] MongoDB URI has real password (no placeholder)
- [ ] Firebase Functions are deployed
- [ ] Functions health check returns success
- [ ] apphosting.yaml has all environment variables
- [ ] Project ID is correct in all URLs
- [ ] MongoDB Atlas allows Firebase IP addresses
- [ ] Database user has read/write permissions
- [ ] Git repository is up to date
- [ ] Functions are built (`functions/lib` exists)

## After Deployment

### Immediate Testing

1. **Visit Database page**
   ```
   https://your-app.web.app/modules/acs-cpe-management/admin/database
   ```

2. **Check MongoDB status**
   - Should show: "Connected"
   - Shows: Server version, collections count

3. **Initialize database**
   - Click: "Yes, Initialize Now"
   - Wait: 1-2 seconds
   - See: Success message

4. **Verify data**
   - Admin → Presets: 4 items
   - Faults: 3 items

### If Something Goes Wrong

**Check browser console (F12):**
```javascript
// Should see:
"Database initialization page loaded"
"Checking MongoDB connection..."
"✅ MongoDB connected: genieacs"
```

**Check Firebase Functions logs:**
```bash
firebase functions:log --limit 20
```

**Re-deploy if needed:**
```bash
# Re-deploy functions
firebase deploy --only functions

# Re-deploy app hosting
cd Module_Manager
firebase apphosting:backends:deploy
```

## Summary

### Will It Work? YES, if:

✅ MongoDB URI is configured correctly (real password)  
✅ Firebase Functions are deployed first  
✅ MongoDB Atlas network access allows Firebase  
✅ Environment variables are in apphosting.yaml  
✅ Functions are built (`npm run build`)  

### Will It NOT Work? NO, if:

❌ MongoDB URI has `<db_password>` placeholder  
❌ Functions not deployed  
❌ Wrong project ID in URLs  
❌ MongoDB Atlas blocks Firebase IPs  
❌ Functions not built  

### Deployment Safety

✅ **Safe to deploy multiple times**  
✅ **Won't break existing data**  
✅ **Can re-initialize safely**  
✅ **Clear error messages if issues**  
✅ **Easy to troubleshoot**  

---

**You're ready to deploy!** Just follow the checklist above. 🚀

**Most important:** Update MongoDB URI before deploying!

