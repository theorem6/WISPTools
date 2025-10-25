# Firebase Functions Deployment Notes

## ⚠️ IMPORTANT: Manual Deployment Required

**Firebase Cloud Functions DO NOT auto-deploy when pushing to Git.**

Unlike the frontend (which auto-deploys via Firebase App Hosting) and the backend (which can be pulled via Git on the GCE server), **Firebase Cloud Functions must be manually deployed** after any code changes.

## Deployment Process

### 1. Make Changes to Functions Code
Edit files in the `functions/src/` directory:
- `functions/src/index.ts` - Main entry point, includes `hssProxy`
- `functions/src/billing.ts` - Billing functions
- Other function files

### 2. Test Locally (Optional)
```bash
cd functions
npm run build
firebase emulators:start
```

### 3. Deploy to Firebase
```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function (faster)
firebase deploy --only functions:hssProxy
firebase deploy --only functions:analyzePCI
```

### 4. Verify Deployment
```bash
# Check deployment logs
firebase functions:log --only hssProxy

# Or via Google Cloud Console
# https://console.cloud.google.com/functions/list
```

## Common Functions in This Project

| Function Name | Purpose | Port/URL |
|---------------|---------|----------|
| `hssProxy` | HTTPS proxy to GCE backend (port 3001) | `https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy` |
| `analyzePCI` | PCI conflict analysis | Cloud Function |
| `setupAdmin` | Admin setup | Cloud Function |
| `onWorkOrderAssigned` | Work order notifications | Triggered |

## Why Manual Deployment?

Firebase Cloud Functions are:
1. **Compiled** - TypeScript must be built to JavaScript
2. **Deployed to Google Cloud** - Separate infrastructure from Git
3. **Versioned** - Each deployment creates a new revision
4. **Independently scaled** - Different from frontend/backend

## Troubleshooting

### Authentication Errors
If you see `Authentication Error: Your credentials are no longer valid`:
```bash
firebase login --reauth
```

### TypeScript Errors
Fix TypeScript errors before deploying:
```bash
cd functions
npm run build
```

### Check Deployed Function
```bash
# Check if function is deployed and active
gcloud functions list --filter="name:hssProxy"
```

## Key Difference from Backend

| Component | Deployment Method | Auto-Deploy on Git Push? |
|-----------|-------------------|--------------------------|
| **Frontend** (Module_Manager) | Firebase App Hosting | ✅ YES |
| **Backend** (GCE) | Git pull + PM2 restart | ❌ NO (manual pull) |
| **Cloud Functions** | `firebase deploy` | ❌ NO (manual deploy) |

## Recent Fixes Requiring Deployment

- **2025-10-25**: Fixed `hssProxy` to use port 3001 instead of 3000
- **2025-10-25**: Fixed TypeScript errors in `billing.ts` (added `any` types)

## Remember

> 🔴 **After ANY changes to `functions/src/*` files:**
> 1. Commit to Git
> 2. **MANUALLY run `firebase deploy --only functions`**
> 3. Verify deployment in logs

Without step 2, your changes will NOT be live!

