# How to Remove Old Firebase Hosting Site

## Issue

The default Firebase Hosting site (`lte-pci-mapper-65450042-bbf71`) **cannot be deleted** via CLI because it's the default site for the project. Firebase doesn't allow deleting the default hosting site.

## Options

### Option 1: Make wisptools-io the Default Site (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/hosting)
2. Click on **Hosting** in the left sidebar
3. Find the site `wisptools-io`
4. Click the **three dots menu** (⋮) next to `wisptools-io`
5. Select **"Set as default site"** or **"Make default"**
6. Once `wisptools-io` is the default, you may be able to delete the old site

### Option 2: Delete via Firebase Console (If Available)

1. Go to [Firebase Console](https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/hosting)
2. Click on **Hosting** in the left sidebar
3. Find the site `lte-pci-mapper-65450042-bbf71`
4. Click the **three dots menu** (⋮) next to the site
5. If **"Delete site"** option is available, click it
6. Confirm the deletion

### Option 3: Keep It (Recommended for Now)

Since it's the default site and cannot be deleted:
- **Keep it** - It won't receive new deployments (we're only deploying to `wisptools-io`)
- It will remain as a backup/legacy site
- No harm in keeping it - it just won't be updated
- Firebase may allow deletion later if you make `wisptools-io` the default first

## Current Status

✅ **firebase.json** - Updated to only deploy to `wisptools-io`
✅ **Deployments** - Will only go to `wisptools-io` going forward
⚠️ **Old site** - Still exists but won't receive updates

## Verification

After making changes, verify:
```bash
firebase hosting:sites:list --project lte-pci-mapper-65450042-bbf71
```

You should see:
- `wisptools-io` as the primary/default site
- `lte-pci-mapper-65450042-bbf71` may still exist but won't be updated

## Next Steps

1. Try making `wisptools-io` the default site in Firebase Console
2. Then attempt to delete the old site (if option becomes available)
3. Or keep it as-is - it won't interfere with deployments

