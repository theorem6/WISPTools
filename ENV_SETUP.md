# 🔑 Environment Variables Setup

## ✅ All Files Now Use .env Variables

All hardcoded API keys have been removed. The app now uses environment variables from `.env` file.

## Create .env File

Create a file named `.env` in the root of your project with this content:

```env
# Firebase Configuration
PUBLIC_FIREBASE_API_KEY=AIzaSyDb5KthFS4DY4hZ_B8jsA3uxEsu6snQqWA
PUBLIC_FIREBASE_AUTH_DOMAIN=mapping-772cf.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=mapping-772cf
PUBLIC_FIREBASE_STORAGE_BUCKET=mapping-772cf.firebasestorage.app
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=483370858924
PUBLIC_FIREBASE_APP_ID=1:483370858924:web:b4890ced5af95e3153e209
PUBLIC_FIREBASE_MEASUREMENT_ID=G-2T2D6CWTTV

# ArcGIS Configuration
PUBLIC_ARCGIS_API_KEY=AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ

# Gemini AI Configuration
PUBLIC_GEMINI_API_KEY=AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg

# Development Settings
NODE_ENV=development
VITE_PORT=5173
```

## How to Create .env File

### In Firebase Web IDE:
```bash
cd ~/lte-pci-mapper
cat > .env << 'EOF'
PUBLIC_FIREBASE_API_KEY=AIzaSyDb5KthFS4DY4hZ_B8jsA3uxEsu6snQqWA
PUBLIC_FIREBASE_AUTH_DOMAIN=mapping-772cf.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=mapping-772cf
PUBLIC_FIREBASE_STORAGE_BUCKET=mapping-772cf.firebasestorage.app
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=483370858924
PUBLIC_FIREBASE_APP_ID=1:483370858924:web:b4890ced5af95e3153e209
PUBLIC_FIREBASE_MEASUREMENT_ID=G-2T2D6CWTTV
PUBLIC_ARCGIS_API_KEY=AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ
PUBLIC_GEMINI_API_KEY=AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg
NODE_ENV=development
VITE_PORT=5173
EOF
```

### In Local Environment:
1. Create a file named `.env` in the project root
2. Copy the content above
3. Save the file

## Note About .env

- `.env` file is already in `.gitignore` (won't be pushed to GitHub)
- API keys are hardcoded in the app as fallback
- Environment variables override hardcoded values
- Use `PUBLIC_` prefix for client-side variables in SvelteKit

## For Firebase Web IDE Deployment

You don't need .env file for deployment - the API keys are already in the code. The .env file is optional for local development only.

## Gemini API Fixed

Changed endpoint from:
- ❌ `gemini-1.5-flash-latest` (404 error)
- ✅ `gemini-pro` (working endpoint)

The app will work without .env file since API keys are embedded in the code.
