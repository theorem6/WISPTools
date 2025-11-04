# Clean Slate Firebase Setup Checklist

## Pre-Setup

- [ ] Decide on new Firebase project name
- [ ] Ensure billing is enabled on Google Cloud account
- [ ] Have access to `wisptools.io` DNS management
- [ ] Backup any important data from old project (if needed)

## Firebase Project Creation

- [ ] Create new Firebase project
- [ ] Note the new Project ID
- [ ] Enable required APIs (Firestore, Functions, Hosting, Auth, Storage)

## Hosting Setup

- [ ] Create hosting site: `wisptools-io`
- [ ] Verify site URL: `wisptools-io.web.app`
- [ ] Add custom domain: `wisptools.io`
- [ ] Configure DNS records (A, AAAA)
- [ ] Wait for SSL certificate provisioning

## Firebase App Setup

- [ ] Create Web app: `wisptools-web`
- [ ] Copy Firebase configuration
- [ ] Link Web app to hosting site `wisptools-io`
- [ ] Note the App ID

## Configuration Updates

- [ ] Update `.firebaserc` with new project ID
- [ ] Update `firebase.json` (single site configuration)
- [ ] Update `Module_Manager/src/lib/firebase.ts` with new config
- [ ] Update `.github/workflows/firebase-hosting.yml` with new project ID
- [ ] Update `backend-services/server.js` CORS origins (if needed)
- [ ] Update `functions/src/index.ts` CORS origins (if needed)

## Security & Authentication

- [ ] Add authorized domains to Firebase Auth:
  - `wisptools.io`
  - `wisptools-io.web.app`
  - `wisptools-io.firebaseapp.com`
  - `localhost`
- [ ] Configure OAuth redirect URIs in Google Cloud Console
- [ ] Set up Firebase Auth providers (Email/Password, Google)

## Deployment

- [ ] Deploy Firebase Functions to new project
- [ ] Build frontend: `cd Module_Manager && npm run build`
- [ ] Deploy to hosting: `firebase deploy --only hosting:wisptools-io`
- [ ] Verify deployment works

## Testing

- [ ] Test `wisptools-io.web.app` loads
- [ ] Test `wisptools.io` loads (after DNS)
- [ ] Test authentication (email/password)
- [ ] Test authentication (Google OAuth)
- [ ] Test API calls work
- [ ] Test customer creation
- [ ] Test plan creation
- [ ] Verify all modules work

## GitHub Configuration

- [ ] Verify GitHub Actions workflow uses new project ID
- [ ] Update FIREBASE_TOKEN secret if needed
- [ ] Test automated deployment from Git push

## Cleanup (After Everything Works)

- [ ] Delete old Firebase project (optional)
- [ ] Remove old hosting sites
- [ ] Document new project configuration

