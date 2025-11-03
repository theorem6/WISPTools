# Customer API 500 Error Fix

## Changes Made

### 1. Enhanced hssProxy Error Handling
**File**: `functions/src/index.ts`

- Added detailed logging for backend responses
- Improved error forwarding to show actual backend error messages
- Better connection error detection (ECONNREFUSED, ETIMEDOUT)
- Logs error details to Firebase Functions console

### 2. Improved Customer Route Error Handling
**File**: `backend-services/routes/customers.js`

- Added input validation for required fields
- Enhanced error logging with structured data
- Better MongoDB error handling
- Validation before database save
- Specific error messages for different failure types

## Next Steps

### 1. Deploy Updated hssProxy Function
✅ **Already deployed** - The improved hssProxy has been deployed to Firebase Functions.

### 2. Update Backend Server
You need to update and restart the backend server on your GCE instance:

```bash
# SSH into your GCE instance
gcloud compute ssh <instance-name> --zone=<zone>

# Navigate to backend directory
cd /opt/hss-api  # or wherever your backend code is

# Pull latest changes (if using git)
git pull origin main

# Or manually update the file:
# Copy backend-services/routes/customers.js to the server

# Restart the backend service
sudo systemctl restart hss-api
# OR if using PM2:
pm2 restart hss-api
# OR if running directly:
pkill -f "node.*server.js"
node server.js &
```

### 3. Check Backend Logs
After restarting, monitor the logs when trying to create a customer:

```bash
# View logs
sudo journalctl -u hss-api -f
# OR
pm2 logs hss-api
# OR if running directly, check console output
```

### 4. Test Customer Creation
Try creating a customer again. You should now see:

- **Better error messages** if validation fails
- **Detailed logs** in backend console showing what went wrong
- **Connection errors** properly identified if backend is unreachable

### 5. Check Firebase Function Logs
If the backend is reachable but returning errors, check Firebase Functions logs:

```bash
firebase functions:log --only hssProxy
```

Or in Firebase Console:
- Go to Functions → hssProxy → Logs

## Common Issues

### Backend Not Running
If you see "Backend service unavailable" error:
- Check if backend is running: `systemctl status hss-api` or `pm2 list`
- Verify port 3001 is accessible from Firebase Functions
- Check firewall rules allow connections

### MongoDB Connection Error
If you see "Database connection error":
- Verify MongoDB Atlas connection string in `.env`
- Check MongoDB Atlas allows connections from GCE IP
- Verify database credentials

### Validation Errors
If you see "Validation failed":
- Check that firstName, lastName, and primaryPhone are provided
- Verify the data format matches the schema

## Debugging Tips

1. **Check the actual error message** in the browser console - it should now show the backend error details
2. **Check backend logs** on GCE instance to see what's happening
3. **Check Firebase Functions logs** to see the proxy layer
4. **Test the backend directly** using curl:

```bash
curl -X POST http://136.112.111.167:3001/api/customers \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR-TENANT-ID" \
  -d '{"firstName":"Test","lastName":"User","primaryPhone":"1234567890"}'
```

This will help identify if the issue is in the proxy or the backend itself.

