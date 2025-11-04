# Step-by-Step: Delete Old Firebase Hosting Site

## Current View
You're currently viewing `wisptools-io` site. You need to find and delete `lte-pci-mapper-65450042-bbf71`.

## Steps to Delete Old Site

### Step 1: Find the Old Site
1. In Firebase Console → Hosting
2. Look for a site card named **"lte-pci-mapper-65450042-bbf71"**
3. It should show URL: `lte-pci-mapper-65450042-bbf71.web.app`

### Step 2: Check if Delete Option Exists
1. Click the **three dots menu (⋮)** on the old site card
2. Look for **"Delete site"** option
3. If it's there, click it and confirm

### Step 3: If Delete Option is Missing
If you don't see "Delete site" option, it's because `lte-pci-mapper-65450042-bbf71` is the **default site**.

**To make it deletable:**
1. First, make `wisptools-io` the default:
   - Click **three dots (⋮)** on `wisptools-io` card
   - Select **"Set as default site"** or **"Make default"**
2. Then go back to `lte-pci-mapper-65450042-bbf71`
3. The **"Delete site"** option should now appear

## Alternative: Leave It
If you can't delete it:
- ✅ **It's harmless** - it won't receive new deployments
- ✅ **firebase.json** only deploys to `wisptools-io` now
- ✅ **No impact** on your production site

## What to Look For
- Site name: `lte-pci-mapper-65450042-bbf71`
- URL: `lte-pci-mapper-65450042-bbf71.web.app`
- Should be in the same Hosting page as `wisptools-io`

