# Auto-Deployment Setup

This project uses GitHub Actions to automatically deploy changes when code is pushed to the `main` branch.

## What Gets Deployed

When you push to the `main` branch, GitHub Actions will automatically:

1. **Deploy Cloud Functions** (`deploy-functions` job)
   - Builds and deploys all Firebase Cloud Functions
   - Includes `hssProxy` and `isoProxy` for backend API proxying

2. **Deploy Frontend** (`deploy-frontend` job)
   - Builds the SvelteKit application in `Module_Manager/`
   - Deploys to Firebase Hosting
   - Accessible at: `https://lte-pci-mapper-65450042-bbf71.web.app`

3. **Deploy Firestore Rules** (`deploy-rules` job)
   - Deploys Firestore security rules
   - Deploys Firestore indexes

## Required GitHub Secrets

For the auto-deployment to work, you need to set up these GitHub Secrets in your repository settings:

### FIREBASE_TOKEN
1. Install Firebase CLI locally: `npm install -g firebase-tools`
2. Login: `firebase login:ci`
3. Copy the token that's displayed
4. Go to GitHub → Settings → Secrets and variables → Actions
5. Add a new secret named `FIREBASE_TOKEN` with the token value

### Verifying Auto-Deploy

After pushing to GitHub, you can:
1. Go to your repository on GitHub
2. Click on "Actions" tab
3. You should see the workflow running
4. Check each job to ensure they complete successfully

## Manual Deployment

If you need to deploy manually (without pushing to git):

```bash
# Deploy Functions only
cd functions
npm run build
cd ..
firebase deploy --only functions

# Deploy Frontend only
cd Module_Manager
npm run build
cd ..
firebase deploy --only hosting

# Deploy Everything
firebase deploy
```

## Current Status

✅ GitHub Actions workflow configured  
✅ Auto-deploys on push to main branch  
✅ Separate jobs for Functions, Frontend, and Firestore Rules  
✅ Runs in parallel for faster deployment  

## Next Steps

1. **Set up FIREBASE_TOKEN secret** if not already done
2. **Test the workflow** by making a small change and pushing to GitHub
3. **Monitor deployments** in the GitHub Actions tab
