# How to Get Your Firebase API Key

## Option 1: Firebase Console
1. Go to: https://console.firebase.google.com/project/wisptools-production/settings/general
2. Scroll down to "Your apps" section
3. Click on the "wisptools-web" app
4. You'll see the config with `apiKey` - copy that value

## Option 2: Firebase CLI (after re-auth)
```bash
firebase login --reauth
firebase apps:sdkconfig WEB 1:1048161130237:web:160789736967985b655094 --project wisptools-production
```

Once you have the new API key, I'll update it in the code and redeploy.

