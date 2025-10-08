# Firebase App Hosting Start Command Fix

## Issue
Firebase App Hosting was trying to run `/workspace/index.js` which doesn't exist, causing:
```
Error: Cannot find module '/workspace/index.js'
```

## Root Cause
The buildpack wasn't detecting the correct entry point for the SvelteKit Node.js application.

## Solution
We added explicit instructions for Firebase App Hosting on how to build and run the application:

### 1. Added Procfile
Created `Procfile` to specify the start command for buildpacks:
```
web: node build/index.js
```

### 2. Updated apphosting.yaml
Added `buildCommand` and `runCommand` to explicitly tell Firebase how to build and start the app:
```yaml
# Build and run commands
buildCommand: npm install && npm run build
runCommand: node build/index.js
```

### 3. Added PORT Environment Variable
Added PORT=8080 to match Cloud Run's expected port:
```yaml
- variable: PORT
  value: "8080"
  availability:
    - RUNTIME
```

## How It Works
1. **Build Phase**: Firebase runs `npm install && npm run build`
   - Installs all dependencies
   - Runs Vite build using adapter-node
   - Outputs to `build/` directory with `index.js` entry point

2. **Run Phase**: Firebase runs `node build/index.js`
   - Starts the Node.js server
   - Listens on PORT 8080 (Cloud Run default)
   - Serves the SvelteKit application

## Files Modified
- `Procfile` (created)
- `apphosting.yaml` (added buildCommand, runCommand, PORT env var)

## Deployment
Now you can deploy with confidence:
```bash
firebase deploy
```

The buildpack will correctly:
- Build the SvelteKit app
- Create the Node.js server in `build/index.js`
- Start the server on port 8080

