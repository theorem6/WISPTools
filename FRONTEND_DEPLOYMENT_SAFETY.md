# Frontend Deployment Safety Guidelines

## Critical Rules - NEVER Break These

### 1. Firebase.json Rewrite Rules

**NEVER** modify these rewrite rules without extensive testing:

```json
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
```

**Rules:**
- The `**` catch-all MUST be the last rule
- NEVER add rules that redirect static assets (`.js`, `.css`, `.png`, etc.) to `/404.html` or any other destination
- NEVER remove the API function rewrites
- NEVER change the order of these rules

### 2. Error Document

**ALWAYS** ensure this is set:

```json
"errorDocument": "404.html"
```

**NEVER** remove or change this.

### 3. Public Directory

**NEVER** change this path:

```json
"public": "Module_Manager/build/client"
```

### 4. Postbuild Script

**NEVER** remove or modify the `postbuild` script in `Module_Manager/package.json`:

```json
"postbuild": "node -e \"const fs = require('fs'); const path = require('path'); const indexPath = path.join('build', 'client', 'index.html'); const error404Path = path.join('build', 'client', '404.html'); if (fs.existsSync(indexPath)) { fs.copyFileSync(indexPath, error404Path); console.log('✓ Created 404.html fallback'); } else { console.error('✗ index.html not found!'); process.exit(1); }\""
```

This script ensures `404.html` is created for SPA routing.

## Pre-Deployment Checklist

Before ANY deployment, verify:

- [ ] `firebase.json` has not been modified incorrectly
- [ ] Rewrite rules are in the correct order
- [ ] `errorDocument` is set to `"404.html"`
- [ ] No new rewrite rules redirect static assets
- [ ] Build completes successfully
- [ ] `index.html` exists in build output
- [ ] `404.html` exists in build output (created by postbuild)
- [ ] Git changes are committed

## What Breaks the Site

### Common Mistakes That Cause 404 Errors:

1. **Redirecting static assets**: Adding a rewrite rule like:
   ```json
   {
     "source": "**/*.js",
     "destination": "/404.html"  // ❌ NEVER DO THIS
   }
   ```

2. **Removing the catch-all rewrite**: The `**` rule must always be present

3. **Changing rewrite order**: API rules must come before the catch-all

4. **Removing errorDocument**: This breaks SPA routing

5. **Changing public directory**: This breaks the deployment path

## Testing Before Deployment

Always test locally first:

```bash
cd Module_Manager
npm run build
npm run preview
```

Visit `http://localhost:4173` and verify:
- Site loads correctly
- No console errors
- Static assets load (check Network tab)
- Navigation works
- API calls work (if backend is running)

## Deployment Process

**ALWAYS** use the deployment script:

**Windows:**
```powershell
.\deploy-frontend.ps1
```

**Linux/Mac:**
```bash
./deploy-frontend.sh
```

**NEVER** deploy manually unless you understand all the checks the script performs.

## Emergency Recovery

If the site is broken:

1. **Check Firebase Console**: https://console.firebase.google.com/project/wisptools-production/hosting
2. **Review recent deployments**: Look for failed deployments
3. **Check firebase.json**: Verify it matches the safe configuration above
4. **Restore from backup**: Use the most recent backup directory
5. **Redeploy**: Use the deployment script

## Tenant System Safety

The tenant system depends on:

1. **Frontend**: Properly built and deployed
2. **Firebase Functions**: `apiProxy` function working correctly
3. **GCE Backend**: Main API (port 3001) running and healthy
4. **Authentication**: Firebase Auth configured correctly

**If tenant system breaks:**

1. Check browser console for errors
2. Verify API endpoints are accessible: `curl https://wisptools-production.web.app/api/test-auth`
3. Check Firebase Functions logs
4. Verify GCE backend health: `curl http://<GCE_IP>:3001/health`
5. Check Firebase Auth configuration

## Version Control

**ALWAYS** commit `firebase.json` changes to Git before deploying:

```bash
git add firebase.json
git commit -m "Description of changes"
git push origin main
```

This ensures:
- Changes are tracked
- Rollback is possible
- Team members see changes
- Deployment history is maintained

## Monitoring

After deployment, monitor:

1. **Site accessibility**: Check main page loads
2. **Console errors**: Check browser console
3. **API calls**: Verify API endpoints respond
4. **Static assets**: Verify JS/CSS load correctly
5. **Tenant system**: Test tenant selection and switching

## Summary

**DO:**
- ✅ Use the deployment script
- ✅ Test locally before deploying
- ✅ Commit changes to Git
- ✅ Verify deployment after completion
- ✅ Keep backups

**DON'T:**
- ❌ Modify rewrite rules without testing
- ❌ Redirect static assets
- ❌ Remove errorDocument
- ❌ Deploy without verification
- ❌ Skip the deployment script


