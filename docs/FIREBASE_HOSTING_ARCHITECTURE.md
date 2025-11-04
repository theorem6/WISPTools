# Firebase Hosting Architecture

## Current Setup

### Firebase Hosting (Static Hosting)
Two sites configured in `firebase.json`:

1. **wisptools-io** (Custom Domain)
   - URL: `https://wisptools-io.web.app`
   - Custom Domain: `https://wisptools.io`
   - Purpose: Primary production site with custom domain
   - Status: ✅ Active

2. **lte-pci-mapper-65450042-bbf71** (Default Site)
   - URL: `https://lte-pci-mapper-65450042-bbf71.web.app`
   - Purpose: Default Firebase Hosting site (legacy/backup)
   - Status: ✅ Active

### Firebase App Hosting (Server-Side Rendering)
- Different service from Firebase Hosting
- Uses Cloud Run under the hood
- URLs end in `.hosted.app` (e.g., `lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app`)
- Status: ⚠️ One instance exists (original app)

## Key Differences

### Firebase Hosting (What We're Using)
- **Static file hosting** - Serves pre-built HTML/CSS/JS
- **SvelteKit adapter-static** - Generates static files
- **Rewrite rules** - Routes `/api/**` to Cloud Functions
- **Custom domains** - Supports `wisptools.io`
- **CDN** - Fast global delivery

### Firebase App Hosting (Original Setup)
- **Server-side rendering** - Runs Node.js server
- **Cloud Run** - Container-based deployment
- **Different URL structure** - `.hosted.app` domains
- **No custom domain support** - Only `.hosted.app` URLs

## Current Configuration

### firebase.json
```json
{
  "hosting": [
    {
      "site": "wisptools-io",
      "public": "Module_Manager/build/client",
      "rewrites": [
        { "source": "/api/**", "function": "apiProxy" },
        { "source": "**", "destination": "/index.html" }
      ]
    },
    {
      "site": "lte-pci-mapper-65450042-bbf71",
      "public": "Module_Manager/build/client",
      "rewrites": [
        { "source": "/api/**", "function": "apiProxy" },
        { "source": "**", "destination": "/index.html" }
      ]
    }
  ]
}
```

## Recommendation

### Option 1: Keep Both Hosting Sites (Current)
- **wisptools-io** - Primary site with custom domain
- **lte-pci-mapper-65450042-bbf71** - Backup/default site
- **Pros**: Redundancy, fallback option
- **Cons**: Deploy to both sites (or use one as primary)

### Option 2: Use Only wisptools-io
- Remove default site from `firebase.json`
- Deploy only to `wisptools-io`
- **Pros**: Simpler, single deployment target
- **Cons**: No fallback if custom domain has issues

### Option 3: Keep Default, Make wisptools-io Primary
- Keep both sites
- Deploy to both (automatic with current config)
- Use `wisptools.io` as primary URL
- Use default site as backup/testing

## Deployment

### Current Deployment Process
1. GitHub Actions triggers on frontend changes
2. Builds SvelteKit app with `adapter-static`
3. Deploys to **both** hosting sites automatically
4. Both sites serve the same content

### Deployment Command
```bash
# Deploys to ALL sites in firebase.json
firebase deploy --only hosting

# Deploy to specific site
firebase deploy --only hosting:wisptools-io
firebase deploy --only hosting:lte-pci-mapper-65450042-bbf71
```

## App Hosting Status

The original App Hosting instance (`.hosted.app`) is separate:
- Not managed by `firebase.json`
- Would need `apphosting.yaml` configuration
- Currently using Firebase Hosting instead (static hosting)

## Action Items

✅ **Current Status**: Both hosting sites configured and working
- `wisptools-io` connected to `wisptools.io` custom domain
- Default site available as backup
- Both sites have same rewrite rules to `apiProxy`

⚠️ **Consider**: 
- Do you want to keep both sites?
- Or consolidate to just `wisptools-io`?

