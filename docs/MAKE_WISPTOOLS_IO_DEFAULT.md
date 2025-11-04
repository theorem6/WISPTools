# How to Make wisptools-io the Default Site

## Steps in Firebase Console

1. **Go to Firebase Hosting**
   - Navigate to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/hosting

2. **Find the wisptools-io Site Card**
   - Look for the site card showing "wisptools-io"
   - Should display URL: `wisptools-io.web.app`

3. **Open the Context Menu**
   - Click the **three dots (⋮)** in the top right corner of the `wisptools-io` card
   - This opens a dropdown menu

4. **Set as Default**
   - In the dropdown menu, look for one of these options:
     - "Set as default site"
     - "Make default"
     - "Set default"
   - Click that option

5. **Confirm**
   - Firebase may ask for confirmation
   - Confirm the action

6. **Verify**
   - The site should now show as "Default" or have a default indicator
   - You can verify by checking the site list

## After Setting as Default

Once `wisptools-io` is the default:
- The old site (`lte-pci-mapper-65450042-bbf71`) should no longer be the default
- You should now be able to delete the old site
- Go to the old site card and check if "Delete site" option appears

## Alternative: Via Firebase CLI (if supported)

Try running:
```bash
firebase hosting:sites:update wisptools-io --set-default --project lte-pci-mapper-65450042-bbf71
```

If this command doesn't exist, you'll need to use the Firebase Console method above.

