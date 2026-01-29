# LTE/5G System Integration - Complete Implementation Guide

## Overview

This document describes the complete integration of the LTE/5G system into the WISP Tools platform, enabling operators to manage LTE deployments with local HSS servers and cloud failover.

## Implementation Summary

### ✅ Completed Features

1. **Enhanced Customer Model**
   - Added service type: `4G/5G`, `FWA`, `WiFi`, `Fiber`
   - Added LTE authentication credentials: `Ki`, `OP`, `OPc`
   - Added optional MAC address for ACS integration
   - Enhanced speed package with QoS parameters (QCI, max bandwidth, data quota)

2. **Cloud HSS Sync Service**
   - Automatic sync of customer data to cloud HSS (hss.wisptools.io)
   - Syncs when customers are added, updated, removed, or disabled
   - Stores subscriber data in MongoDB `subscribers` collection

3. **Remote HSS Sync**
   - Syncs customer data to all remote EPC local HSS instances
   - Automatically updates remote HSSs when tenant changes customers
   - Uses EPC API for secure communication

4. **Local HSS with Cloud Failover**
   - Local HSS uses local MongoDB first
   - Cloud HSS (hss.wisptools.io) acts as failover if local HSS dies
   - Automatic subscriber sync from cloud to local HSS

5. **MME Status Reporting**
   - Remote HSSs report customer online/offline status
   - Maintains live customer counts per EPC
   - Tracks subscriber attach/detach events

## Architecture

```
┌─────────────────┐
│  Customers DB   │
│  (MongoDB)      │
└────────┬────────┘
         │
         │ Sync on create/update/delete
         │
         ▼
┌─────────────────┐         ┌──────────────────┐
│  Cloud HSS      │────────▶│  Remote HSS #1   │
│  hss.wisptools.io│         │  (Local MongoDB) │
│  (Primary)      │         │  (Failover:      │
└─────────────────┘         │   Cloud HSS)     │
         │                  └──────────────────┘
         │
         │ Sync to all remote EPCs
         │
         ▼
┌──────────────────┐
│  Remote HSS #2   │
│  (Local MongoDB) │
│  (Failover:      │
│   Cloud HSS)     │
└──────────────────┘

         │
         │ MME Reports Status
         ▼
┌──────────────────┐
│  MME Status API  │
│  /api/mme/status │
└──────────────────┘
```

## Customer Model Enhancements

### Service Type
```javascript
serviceType: {
  type: String,
  enum: ['4G/5G', 'FWA', 'WiFi', 'Fiber']
}
```

### LTE Authentication
```javascript
lteAuth: {
  ki: String,      // Authentication key (128-bit or 256-bit hex)
  op: String,      // Operator variant (OP)
  opc: String,     // Operator variant (OPc) - computed from OP and Ki
  sqn: Number      // Sequence number for AKA
}
```

### Enhanced Service Plan
```javascript
servicePlan: {
  planName: String,
  downloadMbps: Number,
  uploadMbps: Number,
  monthlyFee: Number,
  qci: Number,                    // Quality Class Identifier
  maxBandwidthDl: Number,         // Max downlink (bps)
  maxBandwidthUl: Number,         // Max uplink (bps)
  dataQuota: Number,              // Monthly quota (bytes, 0 = unlimited)
  priorityLevel: String           // 'low', 'medium', 'high', 'premium'
}
```

### MAC Address (Optional)
```javascript
macAddress: String  // Optional, for ACS integration
```

## API Endpoints

### MME Status Reporting

#### Report Single Subscriber Status
```http
POST /api/mme/status
Headers:
  X-EPC-ID: EPC-12345
  X-EPC-Auth: auth_code
  X-API-Key: api_key
Body:
{
  "imsi": "123456789012345",
  "status": "online",
  "mme_id": "mme1",
  "cell_id": "cell1",
  "ip_address": "10.45.0.1"
}
```

#### Report Batch Status
```http
POST /api/mme/status/batch
Headers:
  X-EPC-ID: EPC-12345
  X-EPC-Auth: auth_code
Body:
{
  "statuses": [
    {
      "imsi": "123456789012345",
      "status": "online",
      "mme_id": "mme1",
      "cell_id": "cell1",
      "ip_address": "10.45.0.1"
    }
  ]
}
```

#### Get Customer Count
```http
GET /api/mme/customer-count
Headers:
  X-EPC-ID: EPC-12345
  X-EPC-Auth: auth_code
Response:
{
  "success": true,
  "online": 15,
  "total": 25,
  "epc_id": "EPC-12345"
}
```

#### Get Online Subscribers
```http
GET /api/mme/online-subscribers
Headers:
  X-EPC-ID: EPC-12345
  X-EPC-Auth: auth_code
Response:
{
  "success": true,
  "subscribers": [
    {
      "imsi": "123456789012345",
      "status": "online",
      "mme_id": "mme1",
      "cell_id": "cell1",
      "ip_address": "10.45.0.1",
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 15,
  "epc_id": "EPC-12345"
}
```

## Deployment Guide

### 1. Configure Local HSS with Cloud Failover

On each remote EPC server:

```bash
# Make script executable
chmod +x backend-services/scripts/configure-local-hss-failover.sh

# Run configuration
sudo ./backend-services/scripts/configure-local-hss-failover.sh EPC-ID TENANT-ID

# Set environment variables
export AUTH_CODE="your-auth-code"
export API_KEY="your-api-key"

# Start MME status reporter
sudo systemctl start mme-status-reporter.service
```

### 2. Verify HSS Configuration

```bash
# Check HSS status
systemctl status open5gs-hss

# Check sync service
systemctl status hss-sync.timer

# Check MME status reporter
systemctl status mme-status-reporter

# View logs
journalctl -u open5gs-hss -f
journalctl -u hss-sync -f
journalctl -u mme-status-reporter -f
```

### 3. Sync All Customers

To manually sync all customers for a tenant:

```javascript
const { syncAllCustomersToHSS } = require('./services/hss-sync-service');
await syncAllCustomersToHSS('tenant-id');
```

## Usage

### Adding a 4G/5G Customer

1. Navigate to Customers module
2. Click "Add Customer"
3. Fill in customer information
4. Set **Service Type** to `4G/5G`
5. Fill in **LTE Authentication**:
   - IMSI (15 digits)
   - Ki (128-bit or 256-bit hex)
   - OPc (128-bit hex)
   - Optional: OP (if using OP instead of OPc)
6. Fill in **Speed Package**:
   - Plan name
   - Download/Upload speeds (Mbps)
   - QCI (Quality Class Identifier)
   - Max bandwidth (bps)
   - Data quota (bytes, 0 = unlimited)
7. Optional: Add MAC address for ACS integration
8. Save customer

The system will automatically:
- Create subscriber in cloud HSS
- Sync to all remote HSSs for the tenant
- Update subscriber when customer changes

### Monitoring Customer Status

Customer online/offline status is automatically tracked via MME status reports. View live customer counts in:
- EPC monitoring dashboard
- Customer list (shows last online timestamp)
- EPC details page (shows online/total customer counts)

## Files Modified/Created

### Backend Services
- `backend-services/models/customer.js` - Enhanced customer schema
- `backend-services/services/hss-sync-service.js` - HSS sync service
- `backend-services/services/mme-status-service.js` - MME status tracking
- `backend-services/routes/customers.js` - Added HSS sync hooks
- `backend-services/routes/mme-status.js` - MME status API endpoints
- `backend-services/models/distributed-epc-schema.js` - Added customer metrics
- `backend-services/server.js` - Registered MME status routes

### Scripts
- `backend-services/scripts/configure-local-hss-failover.sh` - HSS configuration script

### Frontend ✅
- `AddEditCustomerModal.svelte` includes:
  - Service type selector (4G/5G, FWA, WiFi, Fiber)
  - LTE authentication section when 4G/5G: IMSI, MSISDN, Ki, OPc, OP, SQN
  - MAC address field (optional)
  - QoS when 4G/5G: QCI, Data Quota, Priority Level; plan download/upload from group

## Next Steps

1. **Update Frontend Form**
   - Add service type selector
   - Add LTE authentication fields
   - Add MAC address field
   - Enhance speed package form with QoS fields

2. **Testing**
   - Test customer creation/update with 4G/5G service type
   - Verify cloud HSS sync
   - Verify remote HSS sync
   - Test MME status reporting
   - Verify failover behavior

3. **Monitoring**
   - Add customer count widgets to dashboard
   - Add online/offline status indicators
   - Create alerts for HSS sync failures

## Security Notes

- Ki, OP, OPc should be encrypted at rest in the database
- Use secure channels (HTTPS) for API communication
- Validate IMSI format (15 digits)
- Validate authentication key formats (hex strings)
- Use EPC authentication tokens for remote HSS sync

## Troubleshooting

### HSS Sync Not Working
1. Check customer has `serviceType: '4G/5G'`
2. Verify IMSI is set in `networkInfo.imsi`
3. Verify Ki and OPc are set in `lteAuth`
4. Check backend logs for sync errors

### Remote HSS Not Syncing
1. Verify EPC is registered and online
2. Check EPC has valid `auth_code` or `api_key`
3. Verify EPC IP address is accessible
4. Check remote HSS API endpoint is accessible

### MME Status Not Reporting
1. Verify MME status reporter service is running
2. Check `EPC_ID` and `AUTH_CODE` environment variables
3. Verify API endpoint is accessible from remote EPC
4. Check network connectivity
