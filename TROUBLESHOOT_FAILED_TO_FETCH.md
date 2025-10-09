# Troubleshooting: "Failed to fetch"

## What This Error Means

**"Failed to fetch"** = The browser cannot reach your Firebase Functions

This is **NOT a MongoDB issue** - it's that the Functions aren't deployed or the URL is wrong.

## Quick Fix Steps

### Step 1: Check if Functions Are Deployed

**In Firebase Console:**
1. Go to: **Firebase Console → Functions**
2. Look for these functions:
   - `checkMongoHealth`
   - `initializeMongoDatabase`
   - `getMongoPresets`
   - etc.

**If you see them listed:** ✅ Functions are deployed - go to Step 2  
**If you DON'T see them:** ❌ Functions need to be deployed - go to Step 3

### Step 2: Verify Function URL in Browser

**Test the health check directly:**

Open this URL in your browser (replace PROJECT-ID):
```
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/checkMongoHealth
```

**Expected Response:**
```json
{
  "success": true,
  "connected": true,
  "database": "genieacs"
}
```

**If you get this:** ✅ Functions work - environment variable issue  
**If you get 404 or error:** ❌ Functions not deployed properly

### Step 3: Deploy Firebase Functions

Firebase App Hosting **does NOT automatically deploy Functions**. You need to deploy them separately.

**Option A: Deploy from Local Machine**

```bash
# If you have the code locally
firebase deploy --only functions
```

**Option B: Deploy from Firebase Console**

1. Go to: **Firebase Console → Functions**
2. Click: **"Get started"** or **"Deploy function"**
3. **Source code:** Upload or connect to Git
4. **Entry point:** Select `functions/` directory
5. Click: **"Deploy"**

**Option C: Use Cloud Shell in Firebase Console**

1. Firebase Console → Click the **terminal icon** (top right)
2. Opens Cloud Shell
3. Run:
   ```bash
   git clone https://github.com/YOUR-REPO/lte-pci-mapper.git
   cd lte-pci-mapper/functions
   npm install
   npm run build
   cd ..
   firebase deploy --only functions --project lte-pci-mapper-65450042-bbf71
   ```

### Step 4: Update Module_Manager/apphosting.yaml

Make sure your project ID is correct in **Module_Manager/apphosting.yaml**:

```yaml
- variable: PUBLIC_FIREBASE_FUNCTIONS_URL
  value: "https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net"
  availability:
    - BUILD
    - RUNTIME
```

**Check the project ID matches your actual project!**

### Step 5: Redeploy Module Manager After Functions

After Functions are deployed:

1. **Firebase Console → App Hosting**
2. Click: **"New rollout"**
3. Select: **main** branch
4. Click: **"Deploy"**

## Detailed Diagnosis

### Check Environment Variables

**In your deployed app, open browser console (F12) and run:**

```javascript
console.log(import.meta.env.PUBLIC_FIREBASE_FUNCTIONS_URL)
```

**Should show:**
```
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net
```

**If it shows `undefined`:**
- Environment variable not configured
- Redeploy Module Manager after updating apphosting.yaml

### Check Network Tab

**In browser (F12 → Network tab):**

Look for the failed request. Click on it.

**If you see:**
- **404 Not Found** → Functions not deployed
- **CORS error** → Functions deployed but CORS issue
- **Failed to fetch** → Wrong URL or network issue
- **403 Forbidden** → Authentication issue

### Check Firebase Functions Status

**Get your Functions URL from Firebase Console:**

1. Firebase Console → Functions
2. Find `checkMongoHealth` function
3. Look at its **Trigger URL**
4. Should be: `https://us-central1-PROJECT-ID.cloudfunctions.net/checkMongoHealth`

**Copy that URL** and update `PUBLIC_FIREBASE_FUNCTIONS_URL` in apphosting.yaml

## Common Issues & Fixes

### Issue 1: Functions Not Deployed

**Symptom:** 404 error when accessing function URL

**Fix:**
```bash
firebase deploy --only functions
```

**Or use Cloud Shell in Firebase Console**

### Issue 2: Wrong Project ID in URLs

**Symptom:** 404 error, functions deployed but URLs don't match

**Fix:** Update all URLs in `Module_Manager/apphosting.yaml`:

```yaml
# OLD (wrong project ID example)
PUBLIC_FIREBASE_FUNCTIONS_URL: "https://us-central1-lte-pci-mapper.cloudfunctions.net"

# NEW (correct - with full project ID)
PUBLIC_FIREBASE_FUNCTIONS_URL: "https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net"
```

### Issue 3: CORS Error

**Symptom:** "CORS policy blocked" in console

**Already fixed in code** - Functions have:
```typescript
const corsHandler = cors({ origin: true });
```

**If still seeing CORS:**
- Clear browser cache
- Try incognito mode
- Redeploy Functions

### Issue 4: Environment Variables Not Loading

**Symptom:** `PUBLIC_FIREBASE_FUNCTIONS_URL` is undefined

**Fix:**
1. Verify `Module_Manager/apphosting.yaml` has the variable
2. Commit and push changes
3. Trigger new App Hosting rollout
4. Wait 5 minutes for new build
5. Hard refresh browser (Ctrl+Shift+R)

## Step-by-Step Fix Process

### 1. Verify Your Project ID

**Find your actual project ID:**
- Firebase Console → Project Settings (gear icon)
- Look for: **Project ID**
- Should be: `lte-pci-mapper-65450042-bbf71` (or similar)

### 2. Check Module_Manager/apphosting.yaml

Verify it has this section with YOUR project ID:

```yaml
env:
  - variable: PUBLIC_FIREBASE_FUNCTIONS_URL
    value: "https://us-central1-YOUR-ACTUAL-PROJECT-ID.cloudfunctions.net"
    availability:
      - BUILD
      - RUNTIME
```

### 3. Deploy Functions First

**Most important:** Functions must be deployed separately from App Hosting!

**Use Cloud Shell:**
```bash
# In Firebase Console, click terminal icon
git clone YOUR-REPO-URL
cd lte-pci-mapper
firebase login
firebase use lte-pci-mapper-65450042-bbf71
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### 4. Wait for Functions Deployment

**Watch for:**
```
✔  functions: Finished running predeploy script.
✔  functions[checkMongoHealth(us-central1)]: Successful create operation.
✔  functions[initializeMongoDatabase(us-central1)]: Successful create operation.
...
✔  Deploy complete!
```

### 5. Test Functions Directly

```bash
curl https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/checkMongoHealth
```

**Expected:**
```json
{"success":true,"connected":true,"database":"genieacs"}
```

### 6. Redeploy Module Manager

After Functions work:
1. Firebase Console → App Hosting
2. New rollout
3. Wait for deployment
4. Test again

## Quick Verification Script

**Run this in browser console (F12) on your app:**

```javascript
// Test 1: Check if environment variable is set
console.log('Functions URL:', import.meta.env.PUBLIC_FIREBASE_FUNCTIONS_URL);

// Test 2: Try to call the function
fetch(import.meta.env.PUBLIC_FIREBASE_FUNCTIONS_URL + '/checkMongoHealth')
  .then(r => r.json())
  .then(data => console.log('✅ Success:', data))
  .catch(err => console.error('❌ Error:', err));
```

**Expected output:**
```
Functions URL: https://us-central1-PROJECT-ID.cloudfunctions.net
✅ Success: {success: true, connected: true, ...}
```

## If Still Not Working

### Get Detailed Error Info

**In browser console, run:**

```javascript
// Check what's failing
const functionsUrl = import.meta.env.PUBLIC_FIREBASE_FUNCTIONS_URL;
console.log('1. Functions URL:', functionsUrl);
console.log('2. Is undefined?', functionsUrl === undefined);

if (functionsUrl) {
  console.log('3. Testing health check...');
  fetch(functionsUrl + '/checkMongoHealth')
    .then(async response => {
      console.log('4. Response status:', response.status);
      console.log('5. Response OK?', response.ok);
      const data = await response.json();
      console.log('6. Response data:', data);
    })
    .catch(error => {
      console.error('7. Fetch error:', error.message);
      console.error('8. Full error:', error);
    });
} else {
  console.error('❌ PUBLIC_FIREBASE_FUNCTIONS_URL is not set!');
  console.log('Check apphosting.yaml and redeploy');
}
```

### Check Firebase Console Logs

1. **Functions logs:**
   - Firebase Console → Functions
   - Click on `checkMongoHealth`
   - View logs
   - Look for errors

2. **App Hosting logs:**
   - Firebase Console → App Hosting
   - Click on your backend
   - View logs
   - Check for build errors

## Summary: Most Likely Causes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Failed to fetch | Functions not deployed | Deploy Functions first |
| 404 Not Found | Wrong URL or not deployed | Check project ID in URLs |
| Undefined URL | Env var not set | Update apphosting.yaml |
| CORS error | Rare, already fixed | Redeploy Functions |
| Timeout | MongoDB not configured | Check MONGODB_URI |

## Next Steps

1. ✅ **Deploy Functions** (most important!)
2. ✅ **Verify project ID** in apphosting.yaml
3. ✅ **Test function URL** directly in browser
4. ✅ **Redeploy Module Manager**
5. ✅ **Test database page** again

---

**The issue is almost certainly that Functions aren't deployed yet.**

Firebase App Hosting only deploys the Module Manager app, **not the Functions**. You need to deploy Functions separately!

