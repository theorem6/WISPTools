# Create Google SAS Service Account

## Overview

Creating a service account for Google SAS provides more secure authentication than API keys for server-to-server communication.

## Step-by-Step Instructions

### 1. Go to Google Cloud Console

**Direct Link to Service Accounts**:
```
https://console.cloud.google.com/iam-admin/serviceaccounts?project=lte-pci-mapper-65450042-bbf71
```

Or navigate:
- https://console.cloud.google.com/
- Select project: `lte-pci-mapper-65450042-bbf71`
- Menu > "IAM & Admin" > "Service Accounts"

### 2. Create Service Account

1. Click **"+ CREATE SERVICE ACCOUNT"** at the top

2. **Service account details**:
   - **Service account name**: `google-sas`
   - **Service account ID**: `google-sas` (auto-filled)
   - **Description**: `Service account for Google Spectrum Access System API integration`
   - Click **"CREATE AND CONTINUE"**

3. **Grant this service account access to project**:
   - Click "Select a role"
   - Search for: `SAS` or `Spectrum`
   - If available, select: "SAS Administrator" or "SAS User"
   - If not available, select: "Editor" (you can refine later)
   - Click **"CONTINUE"**

4. **Grant users access** (Optional):
   - Skip this step (not needed)
   - Click **"DONE"**

### 3. Create Service Account Key

1. Find your new `google-sas` service account in the list

2. Click on the **email** (google-sas@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com)

3. Go to the **"KEYS"** tab

4. Click **"ADD KEY"** > **"Create new key"**

5. **Key type**: Select **"JSON"**

6. Click **"CREATE"**

7. **Important**: A JSON file will download automatically
   - Filename: `lte-pci-mapper-65450042-bbf71-xxxxxxxxx.json`
   - **SAVE THIS FILE SECURELY**
   - This contains your private key (never share it!)

### 4. Service Account JSON Structure

The downloaded file looks like:

```json
{
  "type": "service_account",
  "project_id": "lte-pci-mapper-65450042-bbf71",
  "private_key_id": "xxxxxxxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\nXXXXXXX...\n-----END PRIVATE KEY-----\n",
  "client_email": "google-sas@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com",
  "client_id": "xxxxxxxxxxxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/google-sas%40lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com"
}
```

### 5. Store as Firebase Secret

**Option A: Using Firebase CLI** (if installed):

```bash
# Store the entire JSON file as a secret
firebase functions:secrets:set GOOGLE_SAS_SERVICE_ACCOUNT \
  --data-file=./lte-pci-mapper-65450042-bbf71-xxxxxxxxx.json \
  --project=lte-pci-mapper-65450042-bbf71
```

**Option B: Using Google Cloud Console**:

1. Go to: https://console.cloud.google.com/security/secret-manager?project=lte-pci-mapper-65450042-bbf71
2. Click **"CREATE SECRET"**
3. Name: `GOOGLE_SAS_SERVICE_ACCOUNT`
4. Secret value: Paste the entire JSON content
5. Click **"CREATE SECRET"**

**Option C: PowerShell** (for your Windows environment):

```powershell
# Read the JSON file and set as secret
$jsonContent = Get-Content -Path ".\lte-pci-mapper-65450042-bbf71-xxxxxxxxx.json" -Raw
$jsonContent | firebase functions:secrets:set GOOGLE_SAS_SERVICE_ACCOUNT --project=lte-pci-mapper-65450042-bbf71 --data-file=-
```

### 6. Configure in Firebase Functions

The service account will be available as an environment variable:

```typescript
// In your Firebase Function
const serviceAccountJson = process.env.GOOGLE_SAS_SERVICE_ACCOUNT;
const serviceAccount = JSON.parse(serviceAccountJson);

// Use with Google APIs
const auth = new GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});
```

### 7. Update Platform Configuration

After creating the service account:

**Go to**: Tenant Management > CBRS Platform Keys

**Enter**:
```
Google SAS Service Account Email: google-sas@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com
Or use the API key field for the service account JSON path
```

## Security Best Practices

### ✅ DO:
- Store service account JSON in Firebase Secrets
- Never commit JSON file to git
- Use `.gitignore` to exclude service account files
- Rotate keys periodically
- Use least-privilege roles

### ❌ DON'T:
- Commit service account JSON to version control
- Share the private key
- Use Editor role (use specific SAS role if available)
- Store in client-side code
- Email the JSON file

## .gitignore Entry

Add this to your `.gitignore`:

```
# Service Account Keys
*-service-account.json
*-firebase-adminsdk-*.json
lte-pci-mapper-*.json
google-sas-*.json
```

## Verification

After setup, verify the service account:

```bash
# List service accounts
gcloud iam service-accounts list --project=lte-pci-mapper-65450042-bbf71

# Should show:
# NAME: google-sas
# EMAIL: google-sas@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com
```

## Next Steps

1. **Create the service account** (follow steps above)
2. **Download the JSON key**
3. **Store in Firebase Secrets**
4. **Configure in platform** (Tenant Management > CBRS Platform Keys)
5. **Deploy functions**: `firebase deploy --only functions`
6. **Test**: Try registering a CBSD device

---

**Service Account Email**: `google-sas@lte-pci-mapper-65450042-bbf71.iam.gserviceaccount.com`  
**Purpose**: Secure authentication for Google SAS API  
**Storage**: Firebase Secrets (secure)  
**Status**: Ready to create

