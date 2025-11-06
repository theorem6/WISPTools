# Frontend Deployment Guide - Robust & Safe

This guide outlines the robust deployment process for the frontend application to Firebase Hosting. The deployment system includes pre-deployment checks, automatic backups, post-deployment verification, and rollback capabilities.

## Overview

The frontend deployment system has been designed to prevent breaking changes and ensure reliable deployments, similar to the backend API deployment system.

## Prerequisites

1. **Firebase CLI**: Must be installed and configured
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Node.js & npm**: Required for building the frontend
   ```bash
   node --version  # Should be v18 or higher
   npm --version
   ```

3. **Git**: For version control and tracking changes

## Deployment Script

The `deploy-frontend.sh` script automates the entire deployment process with safety checks.

### Features

- **Pre-deployment Checks**: Validates Firebase CLI, authentication, configuration files, and build output
- **Automatic Build**: Builds the frontend if build directory is missing or outdated
- **Backup System**: Creates timestamped backups of `firebase.json` before deployment
- **Post-deployment Verification**: Checks that the deployed site is accessible and serving content correctly
- **Automatic Rollback**: Restores previous configuration if deployment or verification fails

### Usage

#### On Linux/Mac:

```bash
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

#### On Windows (using Git Bash or WSL):

```bash
bash deploy-frontend.sh
```

### What the Script Does

1. **Pre-deployment Checks**:
   - Verifies Firebase CLI is installed
   - Checks Firebase authentication
   - Validates `firebase.json` structure
   - Ensures build directory exists
   - Verifies `index.html` and `404.html` are present

2. **Build** (if needed):
   - Runs `npm run build` in `Module_Manager/`
   - Verifies build output exists

3. **Backup**:
   - Creates timestamped backup directory
   - Saves current `firebase.json`
   - Saves current deployment status

4. **Deploy**:
   - Deploys to Firebase Hosting
   - Uses `firebase deploy --only hosting`

5. **Verify**:
   - Checks site accessibility (HTTP 200)
   - Verifies content is being served
   - Retries up to 5 times with 5-second delays

6. **Rollback** (if needed):
   - Restores `firebase.json` from backup
   - Redeploys previous version

## Manual Deployment Process

If you prefer to deploy manually or need to troubleshoot:

### Step 1: Pre-deployment Checks

```bash
# Verify Firebase CLI
firebase --version

# Check authentication
firebase projects:list

# Validate firebase.json
cat firebase.json | jq '.hosting'
```

### Step 2: Build Frontend

```bash
cd Module_Manager
npm run build
cd ..
```

### Step 3: Verify Build Output

```bash
# Check index.html exists
ls -la Module_Manager/build/client/index.html

# Check 404.html exists (created by postbuild script)
ls -la Module_Manager/build/client/404.html

# Verify _app directory exists
ls -la Module_Manager/build/client/_app
```

### Step 4: Backup Configuration

```bash
# Create backup
mkdir -p firebase-hosting-backup-$(date +%Y%m%d%H%M%S)
cp firebase.json firebase-hosting-backup-$(date +%Y%m%d%H%M%S)/
```

### Step 5: Deploy

```bash
firebase deploy --only hosting --project wisptools-production
```

### Step 6: Verify Deployment

```bash
# Check site is accessible
curl -I https://wisptools-production.web.app

# Check content
curl https://wisptools-production.web.app | grep -o "<title>.*</title>"
```

## Critical Configuration Files

### firebase.json

**DO NOT MODIFY** these critical sections without thorough testing:

```json
{
  "hosting": {
    "public": "Module_Manager/build/client",
    "errorDocument": "404.html",
    "rewrites": [
      {
        "source": "/api/deploy/**",
        "function": "isoProxy"
      },
      {
        "source": "/api/**",
        "function": "apiProxy"
      },
      {
        "source": "/admin/**",
        "function": "apiProxy"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

**Critical Rules:**
- **NEVER** add rewrite rules that redirect static assets (`.js`, `.css`, images, fonts) to anything other than themselves
- **ALWAYS** keep the `**` catch-all rewrite as the last rule
- **ALWAYS** ensure `errorDocument` is set to `"404.html"`
- **NEVER** remove the API function rewrites

### Module_Manager/package.json

The `postbuild` script automatically creates `404.html`:

```json
{
  "scripts": {
    "postbuild": "node -e \"const fs = require('fs'); const path = require('path'); const indexPath = path.join('build', 'client', 'index.html'); const error404Path = path.join('build', 'client', '404.html'); if (fs.existsSync(indexPath)) { fs.copyFileSync(indexPath, error404Path); console.log('✓ Created 404.html fallback'); } else { console.error('✗ index.html not found!'); process.exit(1); }\""
  }
}
```

**DO NOT REMOVE** this script - it's critical for SPA routing.

## Common Issues and Solutions

### Issue: "Page Not Found" after deployment

**Cause**: `index.html` or `404.html` missing, or rewrite rules broken

**Solution**:
1. Verify build output: `ls -la Module_Manager/build/client/index.html`
2. Check `firebase.json` rewrite rules
3. Ensure `errorDocument` is set
4. Redeploy using the deployment script

### Issue: Static assets (JS/CSS) return 404

**Cause**: Rewrite rule redirecting static assets incorrectly

**Solution**:
1. Check `firebase.json` for rules matching `**/*.js` or `**/*.css`
2. Remove any rules that redirect static assets
3. Redeploy

### Issue: API calls fail after deployment

**Cause**: API rewrite rules missing or incorrect

**Solution**:
1. Verify API rewrite rules in `firebase.json`
2. Check Firebase Functions are deployed
3. Verify function names match (`apiProxy`, `isoProxy`)

### Issue: Tenant system not working

**Cause**: Frontend build issues or API connectivity

**Solution**:
1. Check browser console for errors
2. Verify API endpoints are accessible
3. Check Firebase Functions logs
4. Verify tenant store is initialized correctly

## Rollback Procedure

If deployment fails and automatic rollback doesn't work:

1. **Restore firebase.json**:
   ```bash
   cp firebase-hosting-backup-YYYYMMDDHHMMSS/firebase.json firebase.json
   ```

2. **Redeploy**:
   ```bash
   firebase deploy --only hosting --project wisptools-production
   ```

3. **Verify**:
   ```bash
   curl -I https://wisptools-production.web.app
   ```

## Best Practices

1. **Always use the deployment script** for production deployments
2. **Test locally** before deploying: `npm run preview` in `Module_Manager/`
3. **Commit changes** to Git before deploying
4. **Review firebase.json changes** carefully before committing
5. **Monitor deployment** logs for errors
6. **Verify deployment** after completion
7. **Keep backups** of working configurations

## Deployment Checklist

Before deploying:

- [ ] All changes committed to Git
- [ ] Firebase CLI installed and authenticated
- [ ] `firebase.json` validated
- [ ] Frontend builds successfully
- [ ] `index.html` and `404.html` exist in build output
- [ ] No breaking changes to rewrite rules
- [ ] API function names are correct
- [ ] Backup created

After deploying:

- [ ] Site is accessible (HTTP 200)
- [ ] Content loads correctly
- [ ] Static assets load (JS, CSS, images)
- [ ] API calls work
- [ ] Tenant system functions correctly
- [ ] No console errors in browser

## Emergency Contacts

If deployment fails and rollback doesn't work:

1. Check Firebase Console: https://console.firebase.google.com/project/wisptools-production/hosting
2. Review deployment logs in Firebase Console
3. Check Firebase Functions status
4. Verify GCE backend is running

## Architecture Notes

The frontend deployment system is designed to work with:

- **Firebase Hosting**: Static file hosting
- **Firebase Functions**: API proxies (`apiProxy`, `isoProxy`)
- **GCE Backend**: Main API server (port 3001) and EPC API (port 3002)
- **SvelteKit**: Frontend framework with static adapter

All systems must be properly configured and deployed for the application to function correctly.


