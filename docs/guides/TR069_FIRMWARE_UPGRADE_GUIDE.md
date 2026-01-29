---
title: TR-069 Firmware Upgrade Guide
description: URL-based download and firmware upgrade methods for TR-069/GenieACS.
---

# TR-069 Firmware Upgrade Implementation Guide

## 📚 TR-069 Firmware Upgrade Methods

### ✅ Recommended Method: URL-based Download

**TR-069 RPC**: `Download`

This is the **most widely supported** and **standardized** method for firmware upgrades.

#### How It Works:

```
1. Upload firmware file to GenieACS File Server
   ↓
2. File stored in MongoDB GridFS (tenant-isolated)
   ↓
3. Generate URL: http://your-domain.com/fs/{tenant-subdomain}/firmware.bin
   ↓
4. ACS sends Download RPC to CPE:
   {
     CommandKey: "upgrade_v2.4.1",
     FileType: "1 Firmware Upgrade Image",
     URL: "http://your-domain.com/fs/tenant-abc/firmware.bin",
     Username: "admin",  // Optional
     Password: "secret"   // Optional
   }
   ↓
5. CPE downloads file from URL
   ↓
6. CPE installs and reboots
   ↓
7. CPE sends TransferComplete event to ACS
```

#### TR-069 FileType Values:

| Code | Type | Description |
|------|------|-------------|
| 1 | Firmware Upgrade Image | Main firmware/software |
| 2 | Web Content | Web UI files |
| 3 | Vendor Configuration File | Config backup/restore |
| 4 | Vendor Log File | Log files |
| 5+ | Vendor Specific | Custom file types |

## 🏗️ GenieACS File Server Architecture

### File Storage

```
MongoDB GridFS (per tenant):
├─ fs_{tenantId}/
│   ├─ firmware/
│   │   ├─ nokia-v2.4.1.bin
│   │   └─ huawei-v3.1.0.tar.gz
│   ├─ config/
│   │   └─ default-config.xml
│   └─ web/
│       └─ custom-ui.zip
```

### File Server URLs

**Format:**
```
http://your-domain.com/fs/{tenant-subdomain}/{filename}
```

**Example:**
```
http://acs.example.com/fs/acme-wireless-abc123/nokia-fw-2.4.1.bin
```

## 🔧 Implementation Steps

### Step 1: Upload File

**Via UI:**
```
ACS Module → Files → Upload File
- Select file: firmware-v2.4.1.bin
- File Type: 1 Firmware Upgrade Image
- Description: Nokia firmware v2.4.1
- Click Upload
```

**Via API:**
```bash
# Upload to GenieACS FS
curl -T firmware.bin \
  -H "X-Tenant-ID: tenant-abc123" \
  http://your-server:7567/firmware-v2.4.1.bin
```

**Via Firebase Function:**
```javascript
// Upload through multi-tenant FS proxy
const formData = new FormData();
formData.append('file', fileBlob);

await fetch('/genieacsFSMultitenant/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'X-Tenant-ID': tenantId
  },
  body: formData
});
```

### Step 2: Create Download Task

**Via Preset (Automatic):**

Create preset in Admin → Presets:
```javascript
// File: /opt/genieacs/ext/provisions/firmware-upgrade.js
const url = "http://your-domain.com/fs/tenant-abc/firmware-v2.4.1.bin";
const fileType = "1 Firmware Upgrade Image";

// Only upgrade if current version is old
const currentVersion = declare("InternetGatewayDevice.DeviceInfo.SoftwareVersion", {value: now});

if (currentVersion.value && currentVersion.value[0] < "2.4.1") {
  // Create download task
  const task = {
    name: "download",
    file: url,
    fileType: fileType
  };
  
  log("Initiating firmware upgrade to v2.4.1");
  
  // Schedule download
  declare("Downloads." + Date.now(), null, task);
}
```

**Via Manual Task:**

```bash
# Create download task via NBI
curl -X POST http://localhost:7557/tasks \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant-abc123" \
  -d '{
    "name": "download",
    "device": "device-serial-123",
    "file": "http://domain.com/fs/tenant-abc/firmware.bin",
    "fileType": "1 Firmware Upgrade Image"
  }'
```

### Step 3: Monitor Progress

**Download States:**

1. **Requested** - Task created
2. **In Progress** - CPE downloading
3. **Completed** - Download finished
4. **Failed** - Error occurred

**Track via Events:**

```javascript
// Listen for TransferComplete event
// In GenieACS, this is automatic
// Check device faults for any download errors
```

## 🔐 Secure Firmware Distribution

### Option 1: Basic Auth

```javascript
{
  "URL": "http://domain.com/fs/firmware.bin",
  "Username": "fwuser",
  "Password": "secure123"
}
```

Configure in Nginx:
```nginx
location /fs/ {
  auth_basic "Firmware Server";
  auth_basic_user_file /etc/nginx/.htpasswd;
  proxy_pass http://localhost:7567/;
}
```

### Option 2: HTTPS with Signed URLs (Advanced)

```javascript
// Generate signed URL with expiry
const signedUrl = generateSignedUrl(filename, tenantId, expiresIn);

{
  "URL": "https://domain.com/fs/firmware.bin?token=xyz&expires=123456"
}
```

### Option 3: Tenant-Isolated URLs (Current Implementation)

```
http://domain.com/fs/{tenant-subdomain}/{filename}
```

- Nginx extracts tenant from URL
- Routes to tenant-specific GridFS bucket
- No cross-tenant access

## 📊 Best Practices

### 1. File Naming Convention

```
{vendor}-{model}-fw-{version}.{ext}

Examples:
- nokia-fastmile-fw-2.4.1.bin
- huawei-5g-cpe-fw-3.1.0.tar.gz
- zte-mf920u-fw-1.2.3.img
```

### 2. Firmware Staging

```
Development:
  Upload → Test on 1 device → Monitor 24h
  ↓
Staging:
  Deploy to 10% of fleet → Monitor 48h
  ↓
Production:
  Full rollout → Monitor continuously
```

### 3. Rollback Plan

Always keep previous firmware version available:
```
- nokia-fastmile-fw-2.3.0.bin (previous)
- nokia-fastmile-fw-2.4.1.bin (current)
```

### 4. Pre-Download Checks

```javascript
// In provision script
const model = declare("InternetGatewayDevice.DeviceInfo.ModelName", {value: now});
const hwVersion = declare("InternetGatewayDevice.DeviceInfo.HardwareVersion", {value: now});

// Only download if correct model and hardware
if (model.value[0] === "Nokia FastMile" && hwVersion.value[0] === "HW-2.0") {
  // Proceed with download
}
```

## 🚀 Quick Commands

### Upload Firmware

```bash
# Via curl to GenieACS FS
curl -T firmware.bin \
  http://your-server:7567/tenant-abc123/firmware-v2.4.1.bin

# Check upload
curl http://your-server:7567/tenant-abc123/firmware-v2.4.1.bin
```

### Create Download Task

```bash
# For single device
curl -X POST http://localhost:7557/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "download",
    "device": "SERIAL-123",
    "file": "http://server:7567/tenant-abc/firmware.bin",
    "fileType": "1 Firmware Upgrade Image"
  }'

# For all devices (via preset)
# Create preset with precondition matching your criteria
```

### List Files

```bash
# List all files in tenant bucket
mongo your-connection-string --eval '
  db.fs_tenant-abc123.files.find().pretty()
'
```

### Delete File

```bash
# Delete via HTTP DELETE
curl -X DELETE \
  http://your-server:7567/tenant-abc123/firmware-old.bin
```

## 🐛 Troubleshooting

### CPE Can't Download File

1. **Check URL is accessible**
   ```bash
   curl -I http://your-server:7567/tenant-abc/firmware.bin
   ```

2. **Check GenieACS FS is running**
   ```bash
   systemctl status genieacs-fs
   ```

3. **Check device can reach server**
   - Firewall rules
   - NAT configuration
   - DNS resolution

4. **Check file exists in GridFS**
   ```bash
   mongo connection-string --eval 'db.fs_tenant-abc.files.find()'
   ```

### Transfer Fails

Common causes:
- Insufficient device storage
- Network timeout (file too large)
- Wrong file type for device
- Incompatible firmware version
- Device doesn't support Download RPC

Check device faults:
```bash
curl http://localhost:7557/faults?query={"device":"SERIAL-123"}
```

## 📖 Additional Resources

- [TR-069 Specification](https://www.broadband-forum.org/technical/download/TR-069.pdf)
- [GenieACS Documentation](https://docs.genieacs.com/)
- [File Server Setup](https://docs.genieacs.com/en/latest/file-server.html)

---

**Recommendation**: Use URL-based Download with GenieACS File Server  
**Security**: Use HTTPS + tenant-isolated URLs  
**Best Practice**: Test on single device before mass rollout

**Last Updated**: 2025-10-11

