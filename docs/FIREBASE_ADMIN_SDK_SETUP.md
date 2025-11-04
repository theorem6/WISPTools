# Firebase Admin SDK Service Account Key Setup

## Files Updated

1. **backend-services/config/firebase.js**
   - Updated to look for service account key file
   - Checks: Environment variable → Key file in project → Application default credentials
   - Falls back gracefully if key file not found

2. **functions/src/firebaseInit.ts**
   - Updated to use service account key file
   - Checks: Environment variable → Key file in project → Application default credentials
   - Handles errors gracefully

3. **Service Account Key Files**
   - `backend-services/wisptools-production-firebase-adminsdk.json`
   - `functions/wisptools-production-firebase-adminsdk.json`
   - **Note**: These are in `.gitignore` for security (not committed to Git)

## Deployment

### Functions (Firebase Cloud Functions)
✅ Deployed - Functions will use the service account key automatically

### Backend (GCE Server)
⚠️ **Manual Step Required**: Copy the service account key to GCE server

```bash
# Copy key file to GCE server
gcloud compute scp backend-services/wisptools-production-firebase-adminsdk.json \
  acs-hss-server:/opt/hss-api/wisptools-production-firebase-adminsdk.json \
  --zone=us-central1-a

# Restart backend service
gcloud compute ssh acs-hss-server --zone=us-central1-a -- \
  "sudo systemctl restart main-api"
```

## Environment Variables (Optional)

You can also set these environment variables instead of using the key file:

```bash
# For GCE backend
export FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/wisptools-production-firebase-adminsdk.json
export FIREBASE_PROJECT_ID=wisptools-production

# For Firebase Functions
# Set in Firebase Console → Functions → Configuration → Environment variables
```

## Verification

After deployment, check backend logs for:
```
✅ Firebase Admin initialized with service account file: /path/to/key.json
✅ Firebase Admin initialized successfully
✅ Firebase Admin project: wisptools-production
```

If you see these logs, the backend can now verify Firebase tokens from the new `wisptools-production` project.

