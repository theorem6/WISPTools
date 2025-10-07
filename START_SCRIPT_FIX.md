# Start Script Fix for Cloud Run

## 🐛 Error: "Cannot find module '/workspace/index.js'"

### Root Cause

Firebase App Hosting uses **Google Cloud Buildpacks** (not custom Dockerfiles) which rely on the `start` script in `package.json` to know how to run your Node.js application.

**The `package.json` was missing the `start` script!**

### What Was Wrong

```json
{
  "scripts": {
    "build": "vite build",
    "dev": "vite dev"
    // ❌ No "start" script!
  }
}
```

Firebase App Hosting buildpack:
1. ✅ Detected Node.js app
2. ✅ Ran `npm run build` 
3. ✅ Created `build/index.js`
4. ❌ Tried to run `npm start` → **Script not found!**
5. ❌ Fell back to looking for `/workspace/index.js` → **Not found!**

### The Fix

Added the `start` script to `package.json`:

```json
{
  "scripts": {
    "build": "node --max-old-space-size=4096 node_modules/vite/bin/vite.js build",
    "start": "node build/index.js",  // ✅ Added this!
    "dev": "vite dev",
    "preview": "vite preview"
  }
}
```

### Why We Removed the Dockerfile

Firebase App Hosting **does NOT use custom Dockerfiles**. It uses Google Cloud Buildpacks which:

- Automatically detect your app type (Node.js, Python, Go, etc.)
- Use standardized build processes
- Look for `package.json` and its `scripts`
- Expect `npm start` to run the server

Custom Dockerfiles are ignored by Firebase App Hosting.

## 🎯 How Firebase App Hosting Works

### Build Process

```
1. Detect Node.js project (package.json exists)
   ↓
2. Install dependencies
   npm ci --production=false
   ↓
3. Run build script
   npm run build
   ↓
4. Install production dependencies only
   npm prune --production
   ↓
5. Create container image
   ↓
6. Set entry point to: npm start
```

### Runtime Process

```
Container starts
   ↓
PORT=8080 npm start
   ↓
node build/index.js
   ↓
SvelteKit Node server starts
   ↓
Listens on 0.0.0.0:8080
   ↓
✅ Container ready!
```

## ✅ What Works Now

After adding the `start` script:

1. **Build Process**:
   ```bash
   npm run build
   # Creates: build/index.js, build/server/, build/client/
   ```

2. **Start Process**:
   ```bash
   npm start
   # Runs: node build/index.js
   # Server starts on port 8080
   ```

3. **Cloud Run**:
   ```
   Container starts → npm start → Server listens on port 8080 → Health check passes → ✅ Deploy succeeds!
   ```

## 📊 Files Changed

| File | Action | Reason |
|------|--------|--------|
| `package.json` | Added `"start": "node build/index.js"` | Required by buildpacks |
| `Dockerfile` | Deleted | Not used by Firebase App Hosting |
| `.dockerignore` | Deleted | Not needed without Dockerfile |

## 🧪 Testing Locally

You can test this locally:

```bash
# Build the application
npm run build

# Start the server
npm start

# Should see:
# Listening on 0.0.0.0:3000
# (or whatever PORT is set)
```

Visit http://localhost:3000 to test.

## 🔍 Debugging Tips

### Check Build Output

After `npm run build`, verify these files exist:
```
build/
├── index.js          ← Entry point (required!)
├── server/           ← Server-side code
└── client/           ← Static assets
```

### Check Start Script

Test the start script manually:
```bash
node build/index.js
```

Should output:
```
Listening on 0.0.0.0:8080
```

### Check Environment Variables

The server reads:
- `PORT` - Port to listen on (default: 3000, Cloud Run sets to 8080)
- `HOST` - Host to bind to (default: localhost, should be 0.0.0.0 for Cloud Run)

## 📚 Firebase App Hosting Buildpack Detection

Firebase App Hosting automatically detects Node.js projects when:

1. ✅ `package.json` exists in root
2. ✅ `package.json` has `"type": "module"` or uses `.mjs` files
3. ✅ `package.json` has a `build` script (optional)
4. ✅ `package.json` has a `start` script (required!)

## 🎯 SvelteKit Adapter Node Configuration

Our `svelte.config.js`:

```javascript
import adapter from '@sveltejs/adapter-node';

export default {
  kit: {
    adapter: adapter({
      out: 'build',        // Output directory
      precompress: false,  // Don't pre-compress
      envPrefix: '',       // Environment variable prefix
      polyfill: true       // Polyfill Node.js modules
    })
  }
};
```

This creates:
- `build/index.js` - Server entry point ✅
- `build/server/` - Server chunks
- `build/client/` - Static assets

## 🚀 Deploy Again!

With the `start` script added, your deployment should now succeed:

```bash
firebase deploy
```

Expected result:
- ✅ Build completes successfully
- ✅ Container starts without errors
- ✅ Server listens on port 8080
- ✅ Health check passes
- ✅ Application is live!

## 📝 Summary

**Problem**: Missing `start` script in `package.json`

**Solution**: Added `"start": "node build/index.js"`

**Result**: Cloud Run can now start the Node.js server correctly

---

**🎉 Your application should now deploy successfully to Firebase App Hosting!**

