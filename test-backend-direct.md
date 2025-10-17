# Test Backend Directly to Verify It Works

While waiting for Firebase deployment, **test port 3000 directly** to confirm it's working:

## On the Server (136.112.111.167):

```bash
# Register a test EPC
curl -X POST http://localhost:3000/api/epc/register \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant-1760406477984-6a7nu20cj" \
  -H "Authorization: Bearer test" \
  -d '{
    "site_name": "Direct Test",
    "location": {
      "city": "TestCity",
      "state": "TS",
      "coordinates": {
        "latitude": 40.5,
        "longitude": -110.5
      }
    }
  }'

# Copy the epc_id from the response, then:
curl http://localhost:3000/api/epc/YOUR_EPC_ID/deployment-script \
  -H "X-Tenant-ID: tenant-1760406477984-6a7nu20cj" \
  > test-deploy.sh

# Check if script was generated
cat test-deploy.sh | head -30
```

If that shows a complete script with credentials, then **port 3000 is working perfectly**!

The issue is just that Firebase hasn't deployed the proxy update yet.

## Firebase Deployment Status

Check here: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/functions

Look for `hssProxy` and the deployment time. It should deploy within 10 minutes of the git push.

## Once Deployed

The 500 errors will stop and downloads will work from the browser!

