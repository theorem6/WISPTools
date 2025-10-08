# SSR Firebase Auth Fix

## Issues Fixed

### 1. `FirebaseError: Firebase: Error (auth/invalid-api-key)` During SSR
**Problem**: Firebase Auth was being initialized during server-side rendering, causing authentication errors.

**Root Cause**: 
- `authStore.ts` was importing `authService` at module level
- This caused Firebase client SDK to be bundled into server chunks
- When the server tried to initialize Firebase Auth, it failed because:
  - Firebase client SDK is not meant for server-side use
  - Environment variables weren't accessible the same way on the server

**Solution**: 
- Changed `authStore.ts` to use **dynamic imports** for `authService`
- The import only happens on the client side (`if (browser)`)
- Server-side immediately sets auth state to "not authenticated"
- This prevents Firebase from being bundled in SSR chunks

### 2. `Error: Cannot find module '/workspace/index.js'` 
**Problem**: Firebase App Hosting buildpack couldn't find the correct entry point.

**Root Cause**:
- No explicit start command defined
- Buildpack defaulted to looking for `/workspace/index.js`
- Actual SvelteKit build output is at `/workspace/build/index.js`

**Solution**:
- Added `Procfile` with: `web: node build/index.js`
- Added `buildCommand` and `runCommand` to `apphosting.yaml`
- Added `PORT=8080` environment variable

## Files Modified

### src/lib/stores/authStore.ts
- Removed static import of `authService`
- Added dynamic import inside browser guard:
  ```typescript
  if (browser) {
    import('../services/authService').then(({ authService }) => {
      // Initialize auth listener
    });
  } else {
    // Server: set to not authenticated immediately
  }
  ```

### apphosting.yaml
- Added build and run commands:
  ```yaml
  buildCommand: npm install && npm run build
  runCommand: node build/index.js
  ```
- Added PORT environment variable

### Procfile
- Created new file with:
  ```
  web: node build/index.js
  ```

## How to Deploy

### From Firebase Web IDE (Linux Terminal):

```bash
# 1. Pull latest fixes
cd ~/lte-pci-mapper
git pull origin main

# 2. Verify files
cat Procfile
head -20 apphosting.yaml

# 3. Deploy
firebase deploy
```

## Expected Results

### ✅ What Should Work Now:
1. **No more SSR auth errors** - Firebase Auth only initializes on client
2. **Container starts successfully** - Correct entry point is used
3. **Health checks pass** - Server listens on port 8080
4. **App loads correctly** - No more 500/503 errors

### 📊 What to Monitor:
- New build revision number (should be > `pci-mapper-build-2025-10-07-003`)
- No "Cannot find module" errors
- No "auth/invalid-api-key" errors
- Successful startup and health check passes

## Technical Details

### Why Dynamic Imports?
Dynamic imports (`import()`) are:
1. **Asynchronous** - Only load when executed
2. **Code-split** - Not bundled in initial server chunk
3. **Conditional** - Can be wrapped in `if (browser)` 
4. **Tree-shakeable** - Server build won't include them

### SSR-Safe Pattern:
```typescript
if (browser) {
  // Client-only code - use dynamic imports for Firebase
  import('./firebaseModule').then(({ service }) => {
    // Use service
  });
} else {
  // Server-side fallback - no Firebase
  return defaultValue;
}
```

## Deployment Timeline

1. **Before**: Builds failing with SSR auth errors and entry point issues
2. **After fix committed**: Changes pushed to GitHub
3. **After deployment**: New build with fixes applied
4. **Expected**: Clean startup, no errors, app fully functional

## Troubleshooting

If you still see errors after deployment:

### Check Build Number
Make sure you're looking at a NEW build (>= `pci-mapper-build-2025-10-07-004`)

### Check Logs for Import Errors
If you see errors about imports, there might be other modules importing Firebase at top level

### Check Environment Variables
Verify all `PUBLIC_FIREBASE_*` variables are set in apphosting.yaml

### Check Browser Console
Client-side errors should show in browser console, not server logs

