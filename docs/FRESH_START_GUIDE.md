# Fresh Start: New Firebase Project Setup

## Philosophy

**GitHub is the source of truth.** All configuration should be version-controlled and deployed from Git.

## Step-by-Step Setup

### Phase 1: Create New Firebase Project

1. **Create Project**
   ```bash
   firebase projects:create wisptools-production --display-name "WISPTools Production"
   ```
   OR via [Firebase Console](https://console.firebase.google.com/)

2. **Note Project ID**
   - Example: `wisptools-production-abc123`
   - Save this for later steps

### Phase 2: Set Up Hosting

1. **Create Hosting Site**
   ```bash
   firebase hosting:sites:create wisptools-io --project YOUR_PROJECT_ID
   ```

2. **Add Custom Domain** (via Console)
   - Go to Hosting → Sites → wisptools-io
   - Add custom domain: `wisptools.io`
   - Follow DNS setup instructions

### Phase 3: Create Web App

1. **Create App** (via Console)
   - Project Settings → Your apps → Add app → Web
   - Nickname: `wisptools-web`
   - Copy configuration

2. **Link to Hosting**
   - Hosting → Sites → wisptools-io → Connect app
   - Select `wisptools-web`

### Phase 4: Update Local Configuration

1. **Update .firebaserc**
   ```json
   {
     "projects": {
       "default": "YOUR_NEW_PROJECT_ID"
     }
   }
   ```

2. **Update firebase.json**
   - Use template provided in `firebase.json.template`
   - Single site configuration for `wisptools-io`

3. **Update Module_Manager/src/lib/firebase.ts**
   - Replace with new Firebase config from Web app creation

### Phase 5: Configure Authentication

1. **Enable Auth Providers**
   - Authentication → Sign-in method
   - Enable Email/Password
   - Enable Google

2. **Add Authorized Domains**
   - Authentication → Settings → Authorized domains
   - Add: `wisptools.io`, `wisptools-io.web.app`, `wisptools-io.firebaseapp.com`, `localhost`

### Phase 6: Deploy Functions

```bash
firebase deploy --only functions --project YOUR_NEW_PROJECT_ID
```

### Phase 7: Update GitHub Actions

Update `.github/workflows/firebase-hosting.yml`:
```yaml
env:
  FIREBASE_PROJECT_ID: YOUR_NEW_PROJECT_ID
```

### Phase 8: Deploy Frontend

```bash
cd Module_Manager
npm install
npm run build
cd ..
firebase deploy --only hosting:wisptools-io --project YOUR_NEW_PROJECT_ID
```

## What Gets Created

### Firebase Services

- ✅ **Firebase Hosting**: Single site `wisptools-io`
- ✅ **Firebase Web App**: `wisptools-web` (linked to hosting)
- ✅ **Firebase Auth**: Email/Password + Google
- ✅ **Firebase Functions**: apiProxy, isoProxy
- ✅ **Firestore**: Database (if needed)
- ✅ **Storage**: File storage (if needed)

### Domains

- ✅ `wisptools-io.web.app` (default hosting URL)
- ✅ `wisptools-io.firebaseapp.com` (legacy URL)
- ✅ `wisptools.io` (custom domain)

## Configuration Files to Update

1. `.firebaserc` - Project ID
2. `firebase.json` - Hosting configuration
3. `Module_Manager/src/lib/firebase.ts` - Firebase config
4. `.github/workflows/firebase-hosting.yml` - Project ID
5. `backend-services/server.js` - CORS origins (if needed)
6. `functions/src/index.ts` - CORS origins (if needed)

## Testing Checklist

- [ ] `wisptools-io.web.app` loads
- [ ] `wisptools.io` loads (after DNS)
- [ ] Authentication works
- [ ] API calls work
- [ ] All modules functional

## Key Principles

1. **Single Source of Truth**: GitHub
2. **Single Hosting Site**: `wisptools-io`
3. **Single Web App**: Linked to hosting
4. **Clean Configuration**: No duplicates or legacy configs
5. **Version Controlled**: All configs in Git

