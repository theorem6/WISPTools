# Firebase App Hosting Deployment Fix

## 🐛 Issues Encountered

### 1. Invalid Firebase API Key Error
```
FirebaseError: Firebase: Error (auth/invalid-api-key)
```
**Cause**: Environment variables from `apphosting.yaml` weren't being properly accessed by the application.

### 2. Missing Entry Point Error
```
Error: Cannot find module '/workspace/index.js'
```
**Cause**: Using `@sveltejs/adapter-auto` which doesn't generate the correct output structure for Cloud Run.

### 3. Container Startup Failure
```
The user-provided container failed to start and listen on port 8080
```
**Cause**: Wrong adapter and missing proper Node.js server configuration.

## ✅ Solutions Implemented

### 1. Switched to SvelteKit Node Adapter
**Changed**: `@sveltejs/adapter-auto` → `@sveltejs/adapter-node`

**Why**: Firebase App Hosting uses Cloud Run, which requires a Node.js server. The `adapter-node` generates:
- `build/index.js` - Main server entry point
- `build/server/` - Server-side code
- `build/client/` - Static assets

**Configuration** (`svelte.config.js`):
```javascript
import adapter from '@sveltejs/adapter-node';

const config = {
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: false,
      envPrefix: '',
      polyfill: true
    })
  }
};
```

### 2. Added Proper Dockerfile
**File**: `Dockerfile`

**Features**:
- Uses Node.js 20 slim image
- Installs only production dependencies
- Sets PORT=8080 and HOST=0.0.0.0 for Cloud Run
- Includes health check endpoint
- Proper container structure

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY build ./build
COPY package.json ./
EXPOSE 8080
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production
HEALTHCHECK CMD node -e "require('http').get('http://localhost:8080/_health'...)"
CMD ["node", "build/index.js"]
```

### 3. Added Server-Side Environment Validation
**File**: `src/hooks.server.ts`

**Features**:
- Validates environment variables at startup
- Logs configuration status
- Creates `/_health` endpoint for Cloud Run
- Request logging for debugging

**Benefits**:
- Immediately identifies missing environment variables
- Provides health check for container readiness
- Helps debug environment issues

### 4. Moved Build Tools to Dependencies
**Why**: Firebase App Hosting runs `npm ci` with `NODE_ENV=production`, which skips `devDependencies`.

**Moved to dependencies**:
- `vite` - Build tool
- `@sveltejs/kit` - Framework
- `@sveltejs/adapter-node` - Adapter
- `typescript` - Compiler
- All build-essential packages

## 📊 Deployment Flow

### Old (Broken):
```
Build → adapter-auto → ??? → Cloud Run tries /workspace/index.js → ❌ Not found
```

### New (Working):
```
Build → adapter-node → build/index.js → Cloud Run runs node build/index.js → ✅ Server starts on port 8080
```

## 🧪 Testing Your Deployment

### 1. Check Health Endpoint
After deployment, test the health check:
```bash
curl https://YOUR-APP-URL/_health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-...",
  "environment": {
    "nodeVersion": "v20.x.x",
    "platform": "linux",
    "port": "8080",
    "hasFirebaseConfig": true
  }
}
```

### 2. Check Server Logs
View logs in Firebase Console or CLI:
```bash
firebase apphosting:logs
```

Look for:
```
🚀 Server starting...
📊 Environment variables loaded:
  - FIREBASE_API_KEY: ✅ Set
  - FIREBASE_AUTH_DOMAIN: ✅ Set
  - FIREBASE_PROJECT_ID: ✅ Set
  - PORT: 8080
  - HOST: 0.0.0.0
```

### 3. Test Main Application
Visit your app URL:
```
https://YOUR-APP-URL/
```

## 🔧 Environment Variables Configuration

All environment variables are configured in `apphosting.yaml`:

```yaml
env:
  - variable: PUBLIC_FIREBASE_API_KEY
    value: "YOUR_API_KEY"
    availability:
      - BUILD
      - RUNTIME
  
  # ... more variables ...
```

**availability**:
- `BUILD` - Available during build process
- `RUNTIME` - Available when container runs

Both are needed for Firebase configuration to work properly.

## 📝 What Changed

### Files Modified:
1. ✅ `package.json` - Switched adapter, moved dependencies
2. ✅ `svelte.config.js` - Configured adapter-node
3. ✅ `Dockerfile` - Created proper container configuration
4. ✅ `.dockerignore` - Optimized container size

### Files Created:
1. ✅ `src/hooks.server.ts` - Server-side validation and health check
2. ✅ `Dockerfile` - Container configuration
3. ✅ `.dockerignore` - Docker optimization

### Commits:
```
9c7e40b - Move build dependencies to dependencies
63ee37d - Fix Firebase App Hosting deployment with adapter-node
684209e - Add server hooks for env validation and health check
```

## 🚀 Ready to Deploy!

Your application is now properly configured for Firebase App Hosting / Cloud Run.

**Deploy command**:
```bash
firebase deploy
```

## 🎯 Expected Results

After deployment:
- ✅ Container starts successfully
- ✅ Listens on port 8080
- ✅ Health check passes
- ✅ Environment variables loaded
- ✅ Firebase SDK initializes correctly
- ✅ Application accessible via public URL

## 📚 Reference

- [SvelteKit Node Adapter](https://kit.svelte.dev/docs/adapter-node)
- [Firebase App Hosting](https://firebase.google.com/docs/app-hosting)
- [Cloud Run Container Runtime](https://cloud.google.com/run/docs/container-contract)
- [SvelteKit Hooks](https://kit.svelte.dev/docs/hooks)

## 🆘 Troubleshooting

### If you still see "Cannot find module '/workspace/index.js'":
1. Clear build cache: Delete `build/` directory
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Rebuild: `npm run build`
4. Verify `build/index.js` exists

### If environment variables are missing:
1. Check `apphosting.yaml` has correct values
2. Verify `availability` includes `RUNTIME`
3. Check server logs for validation output
4. Test health endpoint: `/_health`

### If container won't start:
1. Check it builds locally: `npm run build`
2. Test locally: `PORT=8080 node build/index.js`
3. Visit http://localhost:8080
4. Check Cloud Run logs for detailed errors

---

**🎉 Your application is now ready for Firebase App Hosting!**

