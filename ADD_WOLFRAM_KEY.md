# 🔑 Add Wolfram Alpha API Key

## Quick Setup

### For Local Development (.env file)

Add this line to your `.env` file:

```env
# Wolfram Alpha Configuration
PUBLIC_WOLFRAM_APP_ID="WQPAJ72446"
```

### Complete .env File

Your `.env` file should now include:

```env
# Firebase Configuration - NEW PROJECT
PUBLIC_FIREBASE_API_KEY="AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0"
PUBLIC_FIREBASE_AUTH_DOMAIN="lte-pci-mapper-65450042-bbf71.firebaseapp.com"
PUBLIC_FIREBASE_PROJECT_ID="lte-pci-mapper-65450042-bbf71"
PUBLIC_FIREBASE_STORAGE_BUCKET="lte-pci-mapper-65450042-bbf71.firebasestorage.app"
PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1044782186913"
PUBLIC_FIREBASE_APP_ID="1:1044782186913:web:a5367441ce136118948be0"
PUBLIC_FIREBASE_MEASUREMENT_ID=""

# ArcGIS Configuration
PUBLIC_ARCGIS_API_KEY="AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ"

# Gemini AI Configuration
PUBLIC_GEMINI_API_KEY="AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg"

# Wolfram Alpha Configuration
PUBLIC_WOLFRAM_APP_ID="WQPAJ72446"

# Development Settings
NODE_ENV=development
PORT=5173
```

### For Firebase App Hosting (Production)

In Firebase Console, add the environment variable:

1. Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
2. Click on your backend → **Environment variables**
3. Add new variable:
   - **Name**: `PUBLIC_WOLFRAM_APP_ID`
   - **Value**: `WQPAJ72446`
4. Click **Save**
5. Redeploy your app

## What This Enables

Wolfram Alpha is used in the PCI optimizer for:

- **Mathematical validation** of optimization results
- **Constraint satisfaction** problem solving
- **Advanced calculations** for PCI assignment verification

The service is called in `pciOptimizerSimple.ts` during the validation phase.

## Testing

After adding the key, test that it works:

```javascript
// In browser console
import { wolframService } from '$lib/wolframService';

// Simple test query
const result = await wolframService.query('2+2');
console.log('Wolfram result:', result);
```

## API Limits

Your Wolfram Alpha AppID `WQPAJ72446` has these limits:

- **Free Tier**: 2,000 queries/month
- **Non-commercial use only**

If you need more queries, upgrade at: https://products.wolframalpha.com/api/pricing/

## Fallback Behavior

If the Wolfram Alpha API fails or quota is exceeded:

1. The optimizer will still work (it's optional validation)
2. You'll see warnings in console but optimization continues
3. Results are validated locally without Wolfram

## Where It's Used

1. **`src/lib/wolframService.ts`** - Main service class
2. **`src/lib/pciOptimizerSimple.ts`** - Calls validation
3. **`src/lib/config.ts`** - Configuration storage

## Troubleshooting

### "Wolfram Query failed"

**Possible causes:**
- API key not set in .env
- Quota exceeded (2,000/month limit)
- Network/CORS issues
- API service down

**Check:**
```javascript
// Verify key is loaded
import { config } from '$lib/config';
console.log('Wolfram AppID:', config.wolfram.appId);
// Should show: WQPAJ72446
```

### CORS Errors

Wolfram Alpha Simple API may have CORS restrictions. If you see CORS errors:

1. This is non-critical - optimizer will work without it
2. For production, use Wolfram Full Results API with server-side calls
3. Or implement a proxy through Firebase Functions

## Upgrade Instructions

To use Wolfram Full Results API (more features):

1. Sign up for paid tier: https://products.wolframalpha.com/api/
2. Update `src/lib/wolframService.ts`:
   ```typescript
   private readonly BASE_URL = 'http://api.wolframalpha.com/v2/query';
   ```
3. Update query methods to parse XML/JSON responses

---

✅ **Your Wolfram Alpha API is now configured!**

