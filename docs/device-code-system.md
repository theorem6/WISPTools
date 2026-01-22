# Device Code System for Multi-Device Deployment

## Overview

The device code system allows multiple EPC/SNMP devices to be deployed simultaneously by matching hardware to EPC configurations using a unique alphanumeric code displayed on each device.

## How It Works

### 1. Device Code Generation (On Hardware)

When hardware boots from the generic ISO:
- The `wisptools-epc-installer` package generates a unique 8-character device code
- Format: `ABCD1234` (4 uppercase letters + 4 digits)
- Code is stored in `/etc/wisptools/device-code`
- Code persists across reboots (same device = same code)

### 2. Device Code Display

The device code is displayed in two ways:

**A. Web Interface:**
- URL: `http://<device-ip>/device-status.html`
- Shows the device code prominently
- Includes instructions for registration
- Accessible from any browser on the network

**B. Console Output:**
- Device code is logged to system console
- Visible during boot process
- Can be retrieved via SSH: `cat /etc/wisptools/device-code`

### 3. Registration Process

**Step 1: Boot Hardware**
- Boot device from generic ISO
- Device installs Ubuntu and `wisptools-epc-installer` package
- Device code is generated and displayed

**Step 2: Get Device Code**
- Option A: Open `http://<device-ip>/device-status.html` in browser
- Option B: Check console output
- Option C: SSH to device and run `cat /etc/wisptools/device-code`

**Step 3: Register EPC in Frontend**
- Go to deployment interface
- Enter device code in the registration form
- Complete EPC configuration (site name, network config, etc.)
- Submit registration

**Step 4: Automatic Check-in**
- Device periodically checks in with server
- Sends device code and hardware ID
- Server matches device code to registered EPC
- Device downloads and runs deployment script

## API Endpoints

### POST /api/deploy/register-epc

Register a new EPC with device code.

**Request:**
```json
{
  "device_code": "ABCD1234",
  "siteName": "Site Name",
  "location": {...},
  "networkConfig": {...},
  ...
}
```

**Response:**
```json
{
  "success": true,
  "epc_id": "epc_...",
  "device_code": "ABCD1234",
  "message": "EPC registered with device code ABCD1234..."
}
```

**Validation:**
- `device_code` is required
- Device code must be unique (not already registered)
- Returns error if device code already exists

### POST /api/epc/checkin

Hardware check-in endpoint (called by device).

**Request:**
```json
{
  "device_code": "ABCD1234",
  "hardware_id": "aabbccddeeff"
}
```

**Response:**
```json
{
  "epc_id": "epc_...",
  "checkin_token": "...",
  "apt_repo_url": "http://.../apt-repos/main",
  "gce_server": "136.112.111.167",
  "hss_port": "3001",
  "origin_host_fqdn": "mme-....wisptools.io"
}
```

**Error Response (if device code not found):**
```json
{
  "error": "No EPC configuration found for this device code",
  "message": "Device code ABCD1234 not found. Please register this device code in the deployment interface first.",
  "device_code": "ABCD1234",
  "help": "The device code should be entered when registering the EPC in the frontend."
}
```

## Database Schema

The `RemoteEPC` schema includes:

```javascript
{
  device_code: { 
    type: String, 
    unique: true, 
    sparse: true, 
    index: true 
  },
  // ... other fields
}
```

## Benefits

1. **Multi-Device Support**: Multiple devices can be deployed simultaneously
2. **Explicit Matching**: User explicitly links device to EPC configuration
3. **No Auto-Assignment**: Prevents accidental assignment to wrong tenant
4. **User-Friendly**: Simple 8-character code easy to enter
5. **Persistent**: Same device always has same code
6. **Visible**: Code displayed on device for easy access

## Workflow Example

1. **Field Technician boots 3 devices:**
   - Device 1: Code `ABCD1234`
   - Device 2: Code `EFGH5678`
   - Device 3: Code `IJKL9012`

2. **Admin registers EPCs in frontend:**
   - EPC "Site A" → Device Code `ABCD1234`
   - EPC "Site B" → Device Code `EFGH5678`
   - EPC "Site C" → Device Code `IJKL9012`

3. **Devices check in:**
   - Each device sends its device code
   - Server matches code to correct EPC
   - Each device gets its specific configuration
   - No mix-ups or wrong assignments

## Troubleshooting

**Device code not found:**
- Verify device code is entered correctly (case-sensitive)
- Check that EPC was registered with that device code
- Ensure device code matches exactly (no spaces, correct case)

**Device code already registered:**
- Each device code can only be used once
- If reusing hardware, use a different device code or unregister the old EPC first

**Device status page not accessible:**
- Ensure network is configured
- Check firewall rules
- Verify nginx/web server is running on device
- Try accessing via IP address directly

