# Solution for Rollout-Only Deployment

## The Problem

You're getting CORS errors because:
- ✅ App Hosting is deployed (your UI works)
- ❌ Functions are NOT deployed (APIs don't exist)
- The buildCommand approach won't work because rollouts don't have firebase-tools authentication

## The Real Solution

**Firebase App Hosting rollouts CANNOT deploy Functions automatically** because they don't have the necessary authentication to deploy Functions.

You need **someone with Firebase admin access** to run this **ONE TIME**:

```bash
firebase deploy --only functions --project lte-pci-mapper-65450042-bbf71
```

**After this one-time deployment:**
- ✅ Functions stay deployed (don't need redeployment often)
- ✅ App Hosting rollouts work for UI updates
- ✅ Only redeploy Functions when you change them

## Alternative: Use Firestore Instead of MongoDB (Temporary)

Until Functions are deployed, I can configure the app to use **Firestore directly** for initialization, which App Hosting already has access to.

### Advantages:
- ✅ Works immediately with rollouts
- ✅ No Functions deployment needed
- ✅ Uses Firebase's built-in database
- ✅ No CORS issues

### Disadvantages:
- ⚠️ Not using GenieACS MongoDB
- ⚠️ Separate from GenieACS data
- ⚠️ Need to migrate to MongoDB later

## Recommendation

**Best approach:**

1. **Short term:** Ask Firebase support or a team member to deploy Functions once
2. **Long term:** Functions stay deployed, rollouts handle UI updates
3. **Alternative:** Use Firestore temporarily until Functions are deployed

## How to Deploy Functions (For Whoever Has Access)

**Option 1: Cloud Shell (in Firebase Console)**
```bash
git clone https://github.com/theorem6/lte-pci-mapper.git
cd lte-pci-mapper/functions
npm install
npm run build
cd ..
firebase deploy --only functions --project lte-pci-mapper-65450042-bbf71
```

**Option 2: Local CLI**
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

**Option 3: Request Firebase Support**
Contact Firebase support and ask them to deploy Functions from your Git repository.

## Once Functions Are Deployed

They will stay deployed! You only need to redeploy Functions when you:
- Change function code
- Update dependencies
- Change environment variables

**UI updates (rollouts) work independently!**

---

**The buildCommand approach doesn't work because rollouts don't have authentication to deploy Functions.**

You need one-time Functions deployment from someone with CLI access or Firebase support.

