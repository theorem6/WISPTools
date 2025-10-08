# Deploy Latest Entry Point Fix

## The Error You're Seeing
```
Error: Cannot find module '/workspace/index.js'
revision_name: lte-pci-mapper-build-2025-10-07-026
```

This is from the **OLD BUILD** before the fix was applied.

## Solution: Pull and Deploy

### Step 1: Pull Latest Changes (Firebase Web IDE)
```bash
cd ~/lte-pci-mapper
git pull origin main
```

### Step 2: Verify the Fix Files Are Present
```bash
# Check for Procfile
cat Procfile
# Should show: web: node build/index.js

# Check apphosting.yaml has buildCommand and runCommand
head -20 apphosting.yaml
# Should show buildCommand and runCommand near the top
```

### Step 3: Deploy to Firebase
```bash
firebase deploy
```

This will trigger a **NEW BUILD** (e.g., `lte-pci-mapper-build-2025-10-07-027`) with:
- ✅ `Procfile` telling buildpacks to run `node build/index.js`
- ✅ `buildCommand: npm install && npm run build` in apphosting.yaml
- ✅ `runCommand: node build/index.js` in apphosting.yaml
- ✅ `PORT: "8080"` environment variable

### Step 4: Monitor the New Build
After deployment starts, watch the logs to ensure the new revision is created and doesn't have the `/workspace/index.js` error.

## What Changed
The latest commit includes:
1. **Procfile** - Explicit start command for buildpacks
2. **apphosting.yaml** - Added buildCommand and runCommand
3. **Cleaned up 31 outdated .md files**

## Expected Result
The new build should:
1. Successfully find `build/index.js`
2. Start the Node.js server on port 8080
3. Pass health checks
4. Serve your application

If you see a NEW revision name (not `-026`), the fix is being applied! 🎉

