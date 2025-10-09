# Deploy Functions from Firebase Console (No CLI Required)

## The Simple Solution

You can deploy Functions directly from the Firebase Console web interface. No CLI access needed!

## Step-by-Step Instructions

### Step 1: Go to Firebase Console Functions

1. **Visit:** `https://console.firebase.google.com/`
2. **Select project:** `lte-pci-mapper-65450042-bbf71`
3. **Left sidebar** → Click: **"Functions"**

### Step 2: Create First Function from Console

**If you see "Get started":**

1. Click: **"Get started"** button
2. Click: **"Continue"** on the upgrade prompt (if shown)
3. You'll see: "Create your first function"

**Choose deployment method:**

#### Option A: Upload ZIP (Simplest)

1. **On your computer:**
   - Download the repository as ZIP from GitHub
   - Extract it
   - Create a new ZIP of just the `functions` folder
   
2. **In Firebase Console:**
   - Click: **"Upload a ZIP or folder"**
   - Upload: The `functions` folder ZIP
   - Click: **"Deploy"**

#### Option B: Connect to GitHub (Automatic for future)

1. Click: **"2nd gen"** tab
2. Click: **"Create function"**
3. **Configuration:**
   - Name: `checkMongoHealth`
   - Region: `us-central1`
   - **Source code:** Cloud Source Repository or GitHub
   - **Repository:** Select your repo
   - **Branch:** `main`
   - **Directory:** `/functions`
   - **Entry point:** `checkMongoHealth`
4. Click: **"Deploy"**

#### Option C: Use Cloud Console (Direct Link)

1. **Visit:** `https://console.cloud.google.com/functions/list?project=lte-pci-mapper-65450042-bbf71`

2. **Click:** "Create Function"

3. **Configure:**
   - Environment: 2nd gen
   - Function name: `checkMongoHealth`
   - Region: `us-central1 (Iowa)`
   - Trigger: HTTPS
   - Authentication: Allow unauthenticated
   
4. **Runtime, build, connections and security settings:**
   - Runtime: Node.js 20
   - Source code: **Cloud Source Repository**
   - Connect repository
   - Select: Your GitHub repository
   - Branch: `main`
   - Directory: `functions`
   
5. **Entry point:** `checkMongoHealth`

6. **Click:** "Deploy"

### Step 3: Deploy All Functions at Once

The easier way is to deploy all functions from source:

1. **Cloud Console** → **Functions**
2. Click: **"Create function"**
3. **Source:** Select your GitHub repository
4. **Build configuration:**
   - Runtime: Node.js 20
   - Entry point: Leave blank (deploys all)
   - Build command: `npm install && npm run build`
   - Source directory: `functions`

5. **Click:** "Deploy all functions"

## Even Simpler: Use Cloud Shell Editor

If the above doesn't work, try Cloud Shell Editor:

### Step 1: Open Cloud Shell Editor

1. **Firebase Console** (top right)
2. Click: **Terminal icon** or **Cloud Shell icon**
3. Cloud Shell opens
4. Click: **"Open Editor"** button

### Step 2: Clone and Deploy

In Cloud Shell terminal:

```bash
# Clone your repo
git clone https://github.com/theorem6/lte-pci-mapper.git
cd lte-pci-mapper

# Deploy Functions (uses Google service account automatically)
gcloud functions deploy checkMongoHealth \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=functions \
  --entry-point=checkMongoHealth \
  --trigger-http \
  --allow-unauthenticated

# Or deploy all at once
cd functions
npm install
npm run build
cd ..

# Use gcloud to deploy all
gcloud functions deploy --source=functions
```

**Cloud Shell uses Google's service account** - no firebase login needed!

## Verify Deployment

After deploying, test:

```
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/checkMongoHealth
```

**Should return:**
```json
{"success":true,"connected":true,"database":"genieacs"}
```

## Alternative: Request Firebase Support

Contact Firebase support and ask them to:

1. **Link your GitHub repository to Cloud Functions**
2. **Enable automatic deployment** on push
3. **Use Firebase's service account** for authentication

They can do this without requiring CLI access from you!

## Why This Is Needed

Firebase has two separate systems:
- **App Hosting** (your UI) ✅ Already deployed
- **Functions** (your API) ❌ Need to deploy separately

They don't automatically deploy together unless you use one of the methods above.

## Summary

**Simplest solutions (pick one):**

1. ✅ **Cloud Shell** - Use terminal in Firebase Console
2. ✅ **Cloud Console** - Deploy from Functions page
3. ✅ **GitHub Connection** - Connect repo in Functions page
4. ✅ **Firebase Support** - Ask them to enable it

**All methods use Google's service account - no manual login!**

---

**Try Cloud Shell - it's already available in your Firebase Console!** 🚀

