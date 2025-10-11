# 🔍 DEPLOYMENT CHECKLIST - Troubleshooting

## ❌ You're Still Getting the Error?

The error "src/app.html does not exist" means the build is running in the wrong directory.

---

## ✅ STEP 1: Verify You Have the Latest Code

### In Your Cloud IDE, run:

```bash
cd lte-pci-mapper

# Check current commit
git log --oneline -1

# Should show: "Add cloud deploy quick reference commands" or later
```

If you see an older commit, pull the latest:

```bash
git pull origin main
```

---

## ✅ STEP 2: Verify Files Exist

```bash
# Check that app.html exists
ls -la Module_Manager/src/app.html
# Should show the file

# Check rootDirectory is set
grep "rootDirectory" apphosting.yaml
# Should show: rootDirectory: Module_Manager

# Check tsconfig has extends
grep "extends" Module_Manager/tsconfig.json
# Should show: "extends": "./.svelte-kit/tsconfig.json",
```

---

## ✅ STEP 3: Test Build Locally First

```bash
cd Module_Manager

# Install dependencies
npm install

# Run sync
npx svelte-kit sync

# Check that .svelte-kit was created
ls -la .svelte-kit/tsconfig.json
# Should exist!

# Try building
npm run build

# If build succeeds, you're ready to deploy!
```

---

## ✅ STEP 4: Deploy from Correct Location

Make sure you're deploying from the **ROOT** of the repository:

```bash
# Go to root
cd ~/lte-pci-mapper

# Verify you're in the right place
pwd
# Should show: /home/YOUR_USERNAME/lte-pci-mapper

ls apphosting.yaml
# Should exist

# NOW deploy
firebase deploy --only apphosting
```

---

## 🐛 IF STILL FAILING: Alternative Approach

The issue might be with how Firebase App Hosting buildpacks handle `rootDirectory`. Let's try a different approach - **deploy from the Module_Manager directory directly**:

### Option A: Use Module_Manager's apphosting.yaml

```bash
cd Module_Manager

# Deploy using the local apphosting.yaml (which has rootDirectory: .)
firebase apphosting:backends:create \
  --project lte-pci-mapper-65450042-bbf71 \
  --location us-central1

# Or update existing backend
firebase deploy --only apphosting --config apphosting.yaml
```

### Option B: Modify firebase.json

Check your `firebase.json` - it should have:

```json
{
  "apphosting": {
    "backendId": "lte-pci-mapper",
    "rootDir": "/Module_Manager",
    "deployFunctions": true
  }
}
```

The `rootDir` field here is critical!

---

## 🔍 DETAILED DIAGNOSIS

Run this diagnostic script in Cloud IDE:

```bash
#!/bin/bash
echo "=== Diagnostic Report ==="
echo ""
echo "1. Current directory:"
pwd
echo ""
echo "2. Git status:"
git log --oneline -1
echo ""
echo "3. apphosting.yaml exists:"
ls -la apphosting.yaml
echo ""
echo "4. Root directory setting:"
grep "rootDirectory" apphosting.yaml
echo ""
echo "5. Module_Manager exists:"
ls -d Module_Manager/
echo ""
echo "6. src/app.html exists:"
ls -la Module_Manager/src/app.html
echo ""
echo "7. tsconfig.json:"
head -3 Module_Manager/tsconfig.json
echo ""
echo "8. Firebase project:"
firebase projects:list | grep lte-pci-mapper
echo ""
echo "=== End Report ==="
```

Save this as `diagnose.sh`, run it, and share the output.

---

## 🆘 NUCLEAR OPTION: Deploy from Module_Manager

If nothing else works, deploy directly from Module_Manager:

```bash
cd lte-pci-mapper/Module_Manager

# Use the Module_Manager apphosting.yaml
firebase deploy --only apphosting --config apphosting.yaml
```

This uses `rootDirectory: .` which means "current directory" and should work.

---

## 💡 Common Issues

### Issue: Old code in cloud IDE
**Solution**: `git pull origin main`

### Issue: Wrong directory when deploying
**Solution**: Make sure you're in `/lte-pci-mapper` (root), not `/lte-pci-mapper/Module_Manager`

### Issue: Firebase using wrong apphosting.yaml
**Solution**: Ensure `firebase.json` has `"rootDir": "/Module_Manager"`

### Issue: Build cache problems
**Solution**: Try adding `--force` flag: `firebase deploy --only apphosting --force`

---

## 📊 Expected vs Actual

### What SHOULD Happen:
```
1. Firebase reads firebase.json
2. Sees rootDir: /Module_Manager
3. Reads apphosting.yaml from root
4. Sees rootDirectory: Module_Manager
5. Changes to Module_Manager directory
6. Runs: npm install
7. Runs: npx svelte-kit sync (creates .svelte-kit/tsconfig.json)
8. Runs: npm run build (finds src/app.html)
9. Success!
```

### What IS Happening (based on error):
```
1-4. Same as above
5. ❌ NOT changing to Module_Manager?
6-7. Running in wrong directory
8. ❌ Can't find src/app.html
9. ❌ Build fails
```

---

## 🎯 SOLUTION: Let's Debug Step by Step

### Step 1: Confirm Latest Code

```bash
cd ~/lte-pci-mapper
git pull origin main
git log --oneline -5
```

You should see these commits:
- Add cloud deploy quick reference commands
- Add final configuration fix documentation  
- Fix tsconfig paths conflict: move path aliases to svelte.config.js
- Fix frontend deployment: add rootDirectory, fix tsconfig extends, add svelte-kit sync

### Step 2: Test Local Build

```bash
cd Module_Manager
npm install
npx svelte-kit sync
npm run build
```

If this works, the code is fine - it's a deployment configuration issue.

### Step 3: Try Different Deploy Method

```bash
# From root
cd ~/lte-pci-mapper

# Try with explicit config
firebase deploy --only apphosting --config firebase.json
```

---

## 🔧 ALTERNATIVE FIX: Simplify Build Command

Edit `apphosting.yaml` and change the buildCommand to be more explicit:

```yaml
buildCommand: ls -la && pwd && npm install && npx svelte-kit sync && npm run build
```

The `ls -la && pwd` will show us WHERE the build is running.

---

**Next Steps:**
1. Run the diagnostic script above
2. Verify you have latest code (`git pull`)
3. Try local build in Module_Manager
4. Share the full error output if still failing

The src/app.html file EXISTS in your repo - the issue is that the build process isn't running in the correct directory despite our rootDirectory setting.

