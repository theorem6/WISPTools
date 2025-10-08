# Deploy from Git to Firebase App Hosting

Complete guide for deploying this application directly from a Git repository to Firebase App Hosting.

## Prerequisites

### 1. Node.js and npm
```bash
node --version  # Should be v18 or higher
npm --version
```

**Install Node.js**: https://nodejs.org/

### 2. Firebase CLI
```bash
npm install -g firebase-tools
```

**Verify installation**:
```bash
firebase --version
```

### 3. Git
```bash
git --version
```

### 4. Firebase Account
- Create a Firebase project at https://console.firebase.google.com/
- Note your project ID

## Quick Start (5 Minutes)

### Option 1: Automated PowerShell Deployment (Windows)

```powershell
# 1. Clone the repository
git clone https://github.com/YOUR-USERNAME/lte-pci-mapper.git
cd lte-pci-mapper

# 2. Login to Firebase
firebase login

# 3. Select your project
firebase use YOUR-PROJECT-ID

# 4. Deploy everything
./deploy-from-git.ps1

# 5. Initialize database (optional)
./deploy-from-git.ps1 -InitializeDB
```

### Option 2: Automated Bash Deployment (Mac/Linux)

```bash
# 1. Clone the repository
git clone https://github.com/YOUR-USERNAME/lte-pci-mapper.git
cd lte-pci-mapper

# 2. Make script executable
chmod +x deploy-from-git.sh

# 3. Login to Firebase
firebase login

# 4. Select your project
firebase use YOUR-PROJECT-ID

# 5. Deploy everything
./deploy-from-git.sh

# 6. Initialize database (optional)
./deploy-from-git.sh --initialize-db
```

## Step-by-Step Manual Deployment

If you prefer to deploy manually or want to understand each step:

### Step 1: Clone Repository

```bash
git clone https://github.com/YOUR-USERNAME/lte-pci-mapper.git
cd lte-pci-mapper
```

### Step 2: Configure Firebase

```bash
# Login to Firebase
firebase login

# List your projects
firebase projects:list

# Select your project
firebase use YOUR-PROJECT-ID
```

### Step 3: Configure MongoDB Connection

Edit `apphosting.yaml`:

```yaml
- variable: MONGODB_URI
  value: "mongodb+srv://genieacs-user:YOUR_PASSWORD@cluster0.1radgkw.mongodb.net/..."
  availability:
    - RUNTIME
```

**Replace**:
- `YOUR_PASSWORD` with your actual MongoDB password
- Update connection string if needed

### Step 4: Deploy Firebase Functions

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Build TypeScript
npm run build

# Go back to root
cd ..

# Deploy functions
firebase deploy --only functions
```

**This deploys 30+ functions including**:
- MongoDB CRUD operations (presets, faults)
- Database initialization functions
- GenieACS integration functions
- PCI analysis functions

### Step 5: Deploy Module Manager (App Hosting)

```bash
# Navigate to Module Manager
cd Module_Manager

# Install dependencies
npm install

# Deploy to Firebase App Hosting
firebase apphosting:backends:deploy

# Go back to root
cd ..
```

### Step 6: Initialize MongoDB Database

**Option A: Via UI (Recommended)**

1. Go to your deployed app URL
2. Navigate to: **ACS CPE Management → Administration → Database**
3. Click **"Initialize Database"** button
4. Wait for success message
5. Verify: Presets = 4, Faults = 3

**Option B: Via Command Line**

```bash
# Get your project ID
PROJECT_ID=$(firebase use | grep Active | awk '{print $3}')

# Check MongoDB health
curl https://us-central1-$PROJECT_ID.cloudfunctions.net/checkMongoHealth

# Initialize database
curl -X POST https://us-central1-$PROJECT_ID.cloudfunctions.net/initializeMongoDatabase
```

## Deployment Scripts

### PowerShell Script (`deploy-from-git.ps1`)

**Full deployment**:
```powershell
./deploy-from-git.ps1
```

**Deploy functions only**:
```powershell
./deploy-from-git.ps1 -SkipAppHosting
```

**Deploy app hosting only**:
```powershell
./deploy-from-git.ps1 -SkipFunctions
```

**Deploy and initialize database**:
```powershell
./deploy-from-git.ps1 -InitializeDB
```

### Bash Script (`deploy-from-git.sh`)

**Full deployment**:
```bash
./deploy-from-git.sh
```

**Deploy functions only**:
```bash
./deploy-from-git.sh --skip-app-hosting
```

**Deploy app hosting only**:
```bash
./deploy-from-git.sh --skip-functions
```

**Deploy and initialize database**:
```bash
./deploy-from-git.sh --initialize-db
```

## Firebase App Hosting Direct Git Integration

Firebase App Hosting can automatically deploy from your Git repository.

### Setup Git Integration

1. Go to Firebase Console → App Hosting
2. Click **"Connect repository"**
3. Select your GitHub/GitLab repository
4. Configure:
   - **Root directory**: `/Module_Manager`
   - **Build command**: `npm install && npm run build`
   - **Output directory**: `build`
   - **Environment variables**: Load from `apphosting.yaml`

### Auto-deploy on Push

Once configured, Firebase will automatically deploy when you:
- Push to the main branch
- Create a pull request (preview deployment)
- Merge a PR (production deployment)

### Manual Trigger

```bash
cd Module_Manager
firebase apphosting:backends:create
```

## Environment Variables

All environment variables are configured in `apphosting.yaml`:

### Required Variables

```yaml
# MongoDB Connection (REQUIRED)
MONGODB_URI: "mongodb+srv://..."
MONGODB_DATABASE: "genieacs"

# Firebase Configuration (Auto-configured)
PUBLIC_FIREBASE_API_KEY: "..."
PUBLIC_FIREBASE_PROJECT_ID: "..."
PUBLIC_FIREBASE_FUNCTIONS_URL: "https://us-central1-PROJECT.cloudfunctions.net"

# MongoDB Endpoints (Auto-configured)
PUBLIC_GET_MONGO_PRESETS_URL: "https://..."
PUBLIC_UPDATE_MONGO_PRESET_URL: "https://..."
PUBLIC_DELETE_MONGO_PRESET_URL: "https://..."
PUBLIC_ACKNOWLEDGE_MONGO_FAULT_URL: "https://..."
PUBLIC_DELETE_MONGO_FAULT_URL: "https://..."
```

### Update Environment Variables

After changing `apphosting.yaml`:

```bash
cd Module_Manager
firebase apphosting:backends:deploy
```

## Troubleshooting

### "Firebase CLI not found"

```bash
npm install -g firebase-tools
```

### "Not authenticated with Firebase"

```bash
firebase login
firebase login:list  # Check authentication
```

### "No Firebase project selected"

```bash
firebase projects:list  # List all projects
firebase use PROJECT-ID  # Select project
```

### "MongoDB not connected"

1. Check `MONGODB_URI` in `apphosting.yaml`
2. Verify password is correct
3. Check MongoDB Atlas IP whitelist (allow all: 0.0.0.0/0)
4. Test connection:
   ```bash
   curl https://PROJECT.cloudfunctions.net/checkMongoHealth
   ```

### "Functions deployment failed"

```bash
cd functions
npm install
npm run build
firebase deploy --only functions --debug
```

### "App Hosting deployment failed"

```bash
cd Module_Manager
rm -rf node_modules build .svelte-kit
npm install
npm run build
firebase apphosting:backends:deploy --debug
```

### "Build command failed"

Check Node.js version:
```bash
node --version  # Should be v18 or higher
```

Update Node.js:
- Windows: Download from https://nodejs.org/
- Mac: `brew install node@18`
- Linux: Use nvm

## Verification Checklist

After deployment, verify:

### ✅ Firebase Functions

```bash
# List all functions
firebase functions:list

# Should show:
# - checkMongoHealth
# - initializeMongoDatabase
# - getMongoPresets
# - updateMongoPreset
# - deleteMongoPreset
# - getMongoFaults
# - acknowledgeMongoFault
# - deleteMongoFault
# + 20 more functions
```

### ✅ Firebase App Hosting

```bash
# List backends
firebase apphosting:backends:list

# Should show:
# - Backend ID
# - Region: us-central1
# - Status: READY
```

### ✅ MongoDB Connection

Visit: `/modules/acs-cpe-management/admin/database`

Should show:
- ✅ Connection: Connected
- Database: genieacs
- Server Version: 7.x.x

### ✅ Database Data

1. **Check Presets**: `/modules/acs-cpe-management/admin/presets`
   - Should show 4 presets after initialization

2. **Check Faults**: `/modules/acs-cpe-management/faults`
   - Should show 3 faults after initialization

### ✅ CRUD Operations

Test editing:
1. Go to Admin → Presets
2. Click "Edit" on any preset
3. Change name or description
4. Click "Save"
5. Verify changes persist

Test acknowledging:
1. Go to Faults
2. Click on any fault
3. Click "Acknowledge"
4. Add resolution note
5. Verify status changes to "Resolved"

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      
      - name: Deploy Functions
        run: |
          cd functions
          npm install
          npm run build
          cd ..
          firebase deploy --only functions --token ${{ secrets.FIREBASE_TOKEN }}
      
      - name: Deploy App Hosting
        run: |
          cd Module_Manager
          npm install
          firebase apphosting:backends:deploy --token ${{ secrets.FIREBASE_TOKEN }}
```

### GitLab CI Example

Create `.gitlab-ci.yml`:

```yaml
deploy:
  image: node:18
  script:
    - npm install -g firebase-tools
    - cd functions && npm install && npm run build && cd ..
    - firebase deploy --only functions --token $FIREBASE_TOKEN
    - cd Module_Manager && npm install
    - firebase apphosting:backends:deploy --token $FIREBASE_TOKEN
  only:
    - main
```

## Performance Optimization

### Build Time Optimization

**Cache node_modules**:
```yaml
# In CI/CD
cache:
  paths:
    - functions/node_modules
    - Module_Manager/node_modules
```

**Parallel deployment**:
```bash
# Deploy functions and app hosting simultaneously
firebase deploy --only functions &
cd Module_Manager && firebase apphosting:backends:deploy &
wait
```

### Cold Start Optimization

Functions will be cold on first request. To keep them warm:

1. Enable minimum instances in `functions/src/index.ts`:
   ```typescript
   export const getMongoPresets = onRequest({
     region: 'us-central1',
     memory: '256MiB',
     minInstances: 1  // Keep warm
   }, async (req, res) => { ... });
   ```

2. Or use Cloud Scheduler to ping functions every 5 minutes

## Cost Optimization

### Free Tier Limits
- Firebase Functions: 2M invocations/month
- Cloud Build: 120 minutes/day
- App Hosting: Free tier available

### Reduce Costs
- Set `minInstances: 0` for rarely-used functions
- Use Cloud Scheduler only for critical functions
- Enable function timeout (max 540s)
- Use appropriate memory allocation (256MiB default)

## Support

If deployment fails:

1. **Check Firebase Status**: https://status.firebase.google.com/
2. **View Function Logs**: `firebase functions:log`
3. **View App Hosting Logs**: `firebase apphosting:logs`
4. **Debug Mode**: Add `--debug` flag to any command
5. **Clear Build Cache**: Delete `node_modules` and `.svelte-kit` directories

## Summary

✅ **What you get after deployment**:
- Complete GenieACS ACS management system
- MongoDB-backed presets and faults management
- Real-time service monitoring
- Database initialization UI
- PCI conflict analysis
- All CRUD operations working

✅ **Deployment methods**:
- Automated scripts (PowerShell/Bash)
- Manual step-by-step
- CI/CD integration
- Firebase App Hosting Git integration

✅ **Time to deploy**:
- Initial setup: ~5 minutes
- Full deployment: ~10-15 minutes
- Updates: ~5 minutes

**Ready to deploy!** 🚀

```bash
git clone YOUR-REPO
cd lte-pci-mapper
firebase login
firebase use YOUR-PROJECT
./deploy-from-git.ps1
```

