# Get Firebase Web API Key

To get your Firebase Web API key:

1. **Go to Firebase Console:**
   https://console.firebase.google.com/project/wisptools-production/settings/general

2. **Scroll to "Your apps" section**

3. **Click on "wisptools-web" app**

4. **In the config object, copy the `apiKey` value**

The config will look like:
```javascript
{
  apiKey: "AIzaSy...",
  authDomain: "wisptools-production.firebaseapp.com",
  projectId: "wisptools-production",
  ...
}
```

**OR** check your browser console on the login page - the `🔥 Firebase Config Values:` log shows which API key is actually being used.

Once you have the API key, I can update `Module_Manager/src/lib/firebase.ts` and redeploy.

