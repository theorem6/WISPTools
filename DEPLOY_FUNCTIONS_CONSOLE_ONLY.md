# Deploy Functions from Firebase Console - Step by Step

## The CORS Error Explained

```
Access to fetch at 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/checkMongoHealth' 
from origin 'https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app' 
has been blocked by CORS policy
```

**This means:** Functions aren't deployed yet, OR they're deployed but not responding.

## Solution: Deploy Functions from Firebase Console

### Option 1: Use Firebase Extensions (Easiest!)

1. **Go to:** `https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/functions`

2. **Click:** "Create function" or "Get started"

3. **For EACH function**, create manually:**

   **First Function: checkMongoHealth**
   - Name: `checkMongoHealth`
   - Region: `us-central1`
   - Trigger: HTTPS
   - Memory: 256 MiB
   - Timeout: 60s
   - Runtime: Node.js 20
   - Source: Inline editor
   
   **Copy-paste this code:**
   ```javascript
   const functions = require('firebase-functions/v2');
   const {onRequest} = require('firebase-functions/v2/https');
   const cors = require('cors')({origin: true});
   const {MongoClient} = require('mongodb');

   exports.checkMongoHealth = onRequest(async (req, res) => {
     return cors(req, res, async () => {
       try {
         const mongoUri = process.env.MONGODB_URI;
         const client = new MongoClient(mongoUri);
         await client.connect();
         const db = client.db('genieacs');
         const stats = await db.stats();
         
         res.json({
           success: true,
           connected: true,
           database: 'genieacs',
           collections: {
             presets: await db.collection('presets').countDocuments(),
             faults: await db.collection('faults').countDocuments()
           }
         });
         
         await client.close();
       } catch (error) {
         res.status(500).json({
           success: false,
           error: error.message
         });
       }
     });
   });
   ```

   **package.json:**
   ```json
   {
     "dependencies": {
       "cors": "^2.8.5",
       "firebase-functions": "^6.4.0",
       "mongodb": "^6.20.0"
     }
   }
   ```

   **Environment variables:**
   - MONGODB_URI: `mongodb+srv://genieacs-user:5UDFrunhXI8FfqPZ@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority`

   **Click:** "Deploy"

### Option 2: Use Cloud Build Trigger (Automatic)

This is the BEST solution for automatic deployment:

1. **Go to Google Cloud Console:**
   ```
   https://console.cloud.google.com/cloud-build/triggers?project=lte-pci-mapper-65450042-bbf71
   ```

2. **Click:** "Create Trigger"

3. **Configure:**
   - Name: `deploy-functions-on-push`
   - Event: **Push to a branch**
   - Source: **Connect new repository**
   - Select: **GitHub** → Authorize → Select your repo
   - Branch: `^main$`
   - Configuration: **Cloud Build configuration file**
   - Location: `/cloudbuild.yaml`

4. **Click:** "Create"

5. **Click:** "Run trigger" to deploy now

**This uses Google's service account - fully automatic!**

### Option 3: Manual Deploy from Cloud Shell

1. **Firebase Console** → Click **terminal icon** (top right)

2. **In Cloud Shell, run:**
   ```bash
   gcloud config set project lte-pci-mapper-65450042-bbf71
   git clone https://github.com/theorem6/lte-pci-mapper.git
   cd lte-pci-mapper/functions
   npm install
   npm run build
   cd ..
   
   # Deploy using gcloud (uses Google service account automatically)
   gcloud functions deploy checkMongoHealth \
     --gen2 \
     --runtime=nodejs20 \
     --region=us-central1 \
     --source=functions \
     --entry-point=checkMongoHealth \
     --trigger-http \
     --allow-unauthenticated \
     --set-env-vars MONGODB_URI="mongodb+srv://genieacs-user:5UDFrunhXI8FfqPZ@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
   ```

**Repeat for each function or deploy all at once:**
   ```bash
   # Deploy all functions from package
   cd functions
   npm run deploy
   ```

## After Functions Deploy

### Test the endpoint:

Visit in browser:
```
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/checkMongoHealth
```

**Should return:**
```json
{"success":true,"connected":true,"database":"genieacs"}
```

### Test Database Page:

Visit:
```
https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/modules/acs-cpe-management/admin/database
```

**Should show:**
- ✅ Connection: Connected
- 🚀 Purple banner: "Database is Empty"
- Button: "Yes, Initialize Now"

## Why Functions Need Separate Deployment

**Firebase has 2 services:**
- **App Hosting** - Deploys your UI (SvelteKit app)
- **Functions** - Deploys your API (Node.js functions)

**They deploy separately by default.**

To deploy both automatically, you need to use **Cloud Build triggers** (Option 2 above).

## Recommended Approach

**Use Cloud Build Trigger (Option 2):**

1. One-time setup in Google Cloud Console
2. After setup, every push to Git automatically:
   - Deploys Functions
   - Deploys App Hosting
   - Uses Google service account
   - No manual steps!

**This is TRUE automatic deployment!** 🚀

## Summary

**Current state:**
- ✅ App Hosting deployed
- ✅ MongoDB configured
- ✅ CORS origins updated
- ❌ Functions not deployed (causing error)

**Fix (pick easiest for you):**
1. ✅ Cloud Build Trigger (automatic forever)
2. ✅ Cloud Shell (one-time, 5 minutes)
3. ✅ Manual function creation (tedious but works)

**After fix:**
- ✅ Functions deployed
- ✅ CORS working
- ✅ Database page works
- ✅ Initialize button works

---

**Recommendation: Use Cloud Build Trigger for fully automatic deployment!**

All changes pushed to Git! ✅

