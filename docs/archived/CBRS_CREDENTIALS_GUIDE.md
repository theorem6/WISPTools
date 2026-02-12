# CBRS Credentials Setup Guide

**Last Updated:** October 14, 2025  
**Module:** CBRS Management (Shared Platform Mode)

## 📋 What You Need

To use the CBRS Management module, you need to provide the following Google SAS credentials:

### **Required Credentials:**

1. **Google SAS User ID** ✅ *Required*
   - Your FCC Registration Number (FRN) or assigned User ID
   - Format: `FRN-0123456789` or `your-organization-name`
   - This identifies your organization in the Google SAS system

2. **Google Account Email** ✅ *Required*
   - The Google account (Gmail) registered with Google SAS
   - Format: `your-account@gmail.com` or `your-account@yourdomain.com`
   - Used for OAuth authentication

3. **Client Certificate** ⚠️ *Optional but Recommended*
   - File format: `.pem`, `.crt`, or `.cer`
   - Obtained from Google Cloud Console
   - Enables mTLS (mutual TLS) for enhanced security

4. **Private Key** ⚠️ *Optional but Recommended*
   - File format: `.key` or `.pem`
   - Corresponds to your client certificate
   - Required if you uploaded a certificate

---

## 🔧 How to Configure

### **Step 1: Open CBRS Settings**
1. Navigate to **CBRS Management** module
2. Click the **⚙️ Settings** button in the top right

### **Step 2: Fill in Required Fields**

```
🔵 Google SAS Configuration

Google User ID *
┌──────────────────────────┐
│ FRN-1234567890           │
└──────────────────────────┘
Your unique Google SAS User ID

Google Account Email *
┌──────────────────────────────┐
│ your-account@gmail.com       │
└──────────────────────────────┘
Google account registered with SAS

Client Certificate (.pem or .crt)
[Choose File] ✅ client-cert.pem
Optional - For mTLS authentication

Private Key (.key or .pem)
[Choose File] ✅ private-key.key
Optional - Corresponds to certificate
```

### **Step 3: Configure Enhanced Features (Optional)**

Toggle any features you want to enable:
- ☐ Enable Advanced Analytics
- ☐ Enable Automated Optimization
- ☐ Enable Multi-Site Coordination
- ☐ Enable Interference Monitoring

### **Step 4: Save Configuration**

Click **💾 Save Settings**

---

## 🔑 How to Obtain Google SAS Credentials

### **1. Google SAS User ID**

**Option A: Use Your FCC Registration Number (FRN)**
- If you're registered with the FCC for CBRS operations
- Format: `FRN-` followed by your 10-digit number
- Example: `FRN-0012345678`

**Option B: Request from Google SAS**
- Contact Google Cloud SAS Support
- Complete onboarding process
- Receive assigned User ID
- Example: `acme-wireless-prod`

### **2. Google Account Email**

- Use an existing Google account (Gmail or Google Workspace)
- **OR** create a new Google account specifically for CBRS
- This account must be registered with Google SAS
- Contact Google to register your account for SAS access

### **3. Client Certificate & Private Key**

**Obtain from Google Cloud Console:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **Service Account**
5. Fill in service account details
6. Click **Done**
7. Click on the service account you created
8. Go to **Keys** tab
9. Click **Add Key** → **Create new key**
10. Select **P12** or **JSON** format
11. Download the certificate and key

**Convert to PEM format (if needed):**
```bash
# If you have a .p12 file
openssl pkcs12 -in certificate.p12 -out certificate.pem -nodes
openssl pkcs12 -in certificate.p12 -nocerts -out private-key.key -nodes

# If you have a JSON service account key
# Use it directly - the system will handle it
```

---

## 🏢 Shared Platform Mode

### **What the Platform Provides:**
✅ **Google SAS API Key** - Managed by platform admin  
✅ **API Endpoint** - Pre-configured  
✅ **Infrastructure** - Servers and networking  

### **What You Provide:**
🔑 **Your User ID** - Identifies your organization  
📧 **Your Google Email** - Your Google account  
📜 **Your Certificate** - Your client certificate (optional)  
🔐 **Your Private Key** - Your private key (optional)  

### **Benefits:**
- ✅ **Lower Cost** - Share platform API subscription
- ✅ **Easier Setup** - No API key management
- ✅ **Full Isolation** - Your data is separated by User ID
- ✅ **Secure** - Certificates encrypted in Firestore
- ✅ **Managed** - Platform handles API infrastructure

---

## 🔒 Security

### **How Credentials Are Stored:**

1. **Google Email** - Stored in Firestore (encrypted at rest)
2. **Client Certificate** - Stored as base64 in Firestore (encrypted)
3. **Private Key** - Stored as base64 in Firestore (encrypted)
4. **User ID** - Stored in plain text (not sensitive)

### **Data Encryption:**
- ✅ All Firestore data encrypted at rest
- ✅ All transmission over HTTPS
- ✅ Certificates sent to backend via secure headers
- ✅ Backend uses certificates for mTLS with Google SAS
- ✅ Browser never directly accesses Google SAS

### **Access Control:**
- ✅ Only tenant members can read their config
- ✅ Only tenant members can update their config
- ✅ Platform admins can access for support
- ✅ Firestore rules enforce isolation

---

## 🧪 Testing Your Configuration

After saving your configuration:

1. **Check Status Badge** - Should show "Complete" with green checkmark
2. **Status Message** - Should show:
   ```
   Google SAS configured (your-email@gmail.com) with mTLS
   ```
   Or without certificate:
   ```
   Google SAS configured (your-email@gmail.com)
   ```

3. **Try Adding a Device** - Click "➕ Add CBSD Device"
4. **Register Device** - Should successfully register with Google SAS
5. **View on Map** - Device should appear on the map

---

## ❗ Troubleshooting

### **Issue: "Configuration incomplete"**

**Check:**
- ✅ Did you provide Google User ID?
- ✅ Did you provide Google Account Email?
- ✅ Is email in valid format?
- ✅ If you uploaded certificate, did you also upload private key?

### **Issue: "Failed to register device"**

**Check:**
- ✅ Is your User ID valid and registered with Google?
- ✅ Is your Google account registered with Google SAS?
- ✅ Does your account have SAS API access?
- ✅ Are certificates valid and not expired?

### **Issue: "API error 401 Unauthorized"**

**Possible causes:**
- ❌ Google account not authorized for SAS
- ❌ User ID not registered
- ❌ Certificate expired or invalid
- ❌ Platform API key not configured

**Solution:**
- Contact platform administrator to verify platform API key
- Verify your Google account with Google SAS
- Check certificate expiration date

### **Issue: "API error 403 Forbidden"**

**Possible causes:**
- ❌ User ID doesn't match registered FRN
- ❌ Google account doesn't have permission

**Solution:**
- Verify User ID with Google SAS support
- Request access for your Google account

---

## 📞 Support

### **Platform Issues:**
Contact your platform administrator for:
- Platform API key issues
- Infrastructure problems
- General platform support

### **Google SAS Issues:**
Contact Google Cloud SAS Support for:
- User ID registration
- Account authorization
- API access requests
- Certificate issuance

### **Configuration Help:**
Check the module documentation:
- User ID format
- Certificate requirements
- API endpoint information

---

## 📚 Related Documentation

- [CBRS Module Complete](../guides/CBRS_MODULE_COMPLETE.md)
- [CBRS API Key Setup](../guides/CBRS_API_KEY_SETUP_GUIDE.md)
- [CBRS Hybrid Model](../guides/CBRS_HYBRID_MODEL_GUIDE.md)

---

## ✅ Quick Checklist

Before contacting support, verify:

- [ ] Google User ID provided and valid
- [ ] Google Account Email provided and valid
- [ ] Email is in correct format (contains @)
- [ ] If certificate uploaded, private key also uploaded
- [ ] Certificate and key files are valid PEM format
- [ ] Configuration shows "Complete" status
- [ ] Platform administrator has configured platform API key

---

**Status:** Production Ready  
**Mode:** Shared Platform - Google SAS Only  
**Authentication:** OAuth + mTLS (optional)

