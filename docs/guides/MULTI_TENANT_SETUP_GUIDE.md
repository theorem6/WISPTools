# Multi-Tenant GenieACS Setup Guide

## 🎯 Overview

This guide explains how to set up and use the multi-tenant GenieACS system for managing TR-069/CWMP devices across multiple customer organizations.

## 🏗️ Architecture

### Multi-Tenancy Features

- **Tenant Isolation**: Complete data separation between organizations
- **Unique CWMP URLs**: Each tenant gets a unique connection URL
- **Role-Based Access**: Owner, Admin, Operator, and Viewer roles
- **Isolated Storage**: Separate file storage per tenant
- **MongoDB Filtering**: All queries automatically filtered by tenant ID

### Components

1. **Frontend (Module Manager)**
   - Tenant setup flow
   - Tenant selector
   - Tenant admin UI
   - User management

2. **Backend (Firebase Functions)**
   - Tenant middleware
   - Multi-tenant GenieACS bridge
   - Multi-tenant GenieACS services
   - Access control

3. **Database**
   - **Firestore**: Tenant metadata, user associations
   - **MongoDB**: Device data with tenant tagging

## 📋 Prerequisites

- Firebase project with Authentication enabled
- MongoDB Atlas cluster or self-hosted MongoDB
- Node.js 20+
- Domain name for CWMP connections

## 🚀 Installation

### Step 1: Install GenieACS with Multi-Tenant Support

```bash
# Make the installation script executable
chmod +x install-genieacs-multitenant.sh

# Run the installation script
./install-genieacs-multitenant.sh
```

Follow the prompts:
- Enter your MongoDB connection URI
- Enter your external domain/IP
- Enter base port (default: 7547)
- Confirm installation

The script will:
- Install GenieACS from npm
- Create tenant-aware virtual parameters
- Set up Nginx reverse proxy for tenant routing
- Create systemd services
- Start all services

### Step 2: Configure Firebase Functions

Update your Firebase Functions environment variables:

```bash
firebase functions:config:set \
  genieacs.nbi_url="http://your-server-ip:7557" \
  genieacs.cwmp_url="http://your-server-ip:7547" \
  genieacs.fs_url="http://your-server-ip:7567"
```

Deploy functions:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### Step 3: Deploy Frontend

```bash
cd Module_Manager
npm install
npm run build
cd ..
firebase deploy --only apphosting
```

## 👥 User Onboarding Flow

### New User Registration

1. User signs up via `/login`
2. After authentication, redirected to `/tenant-setup`
3. User creates their organization:
   - Organization name
   - Display name
   - Contact information
   - Subdomain (auto-generated, editable)
4. Tenant created in Firestore
5. User automatically assigned as "Owner"
6. Redirected to dashboard

### Existing User Login

1. User signs in via `/login`
2. System checks for existing tenants
3. If multiple tenants:
   - Show `/tenant-selector`
   - User selects organization
4. If single tenant:
   - Auto-select and redirect to dashboard
5. Selected tenant stored in localStorage

## 🔐 Roles and Permissions

### Owner
- Full access to everything
- Can manage settings
- Can manage users
- Can manage devices
- Can delete tenant

### Admin
- Manage devices
- Manage users (except owner)
- Manage settings
- View reports
- Export data

### Operator
- Manage devices
- View reports
- Export data
- Cannot manage users or settings

### Viewer
- View devices
- View reports
- Read-only access

## 🌐 Device Connection Setup

### CWMP URL Format

Each tenant gets a unique CWMP URL:

```
http://your-domain.com/cwmp/{tenant-subdomain}
```

Example:
```
http://acs.example.com/cwmp/acme-wireless-abc123
```

### Configure Devices

1. Access device's TR-069 configuration
2. Set **ACS URL** to tenant's CWMP URL (found in Tenant Admin → Connection)
3. Set credentials if required
4. Save and reboot device
5. Device appears in tenant's device list within 5 minutes

### Device Tagging

When a device connects:
1. GenieACS extracts tenant ID from connection URL
2. Device automatically tagged with `tenant:{tenantId}`
3. All queries filtered by tenant tag
4. Data isolation maintained

## 💾 Data Model

### Firestore Collections

#### `tenants`
```javascript
{
  id: "tenant-123",
  name: "acme-wireless",
  displayName: "Acme Wireless ISP",
  subdomain: "acme-wireless-abc123",
  cwmpUrl: "http://acs.example.com/cwmp/acme-wireless-abc123",
  contactEmail: "admin@acme.com",
  settings: {
    informInterval: 300,
    enableAutoDiscovery: true,
    enablePCIMonitoring: true,
    // ...
  },
  limits: {
    maxDevices: 100,
    maxUsers: 5,
    // ...
  },
  status: "active",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `user_tenants`
```javascript
{
  userId: "user-123",
  tenantId: "tenant-123",
  role: "owner",
  permissions: {
    canManageDevices: true,
    canManageUsers: true,
    // ...
  },
  createdAt: Timestamp
}
```

#### `tenant_invitations`
```javascript
{
  id: "inv-123",
  tenantId: "tenant-123",
  email: "user@example.com",
  role: "operator",
  status: "pending",
  invitedBy: "user-123",
  invitedAt: Timestamp,
  expiresAt: Timestamp
}
```

### MongoDB Collections

#### `devices`
All documents include `_tenantId` field:

```javascript
{
  _id: "device-123",
  _tenantId: "tenant-123",  // ← Tenant isolation
  _deviceId: {...},
  _lastInform: Date,
  "Device.DeviceInfo.Manufacturer": {...},
  "Device.DeviceInfo.ModelName": {...},
  // ... all TR-069 parameters
}
```

#### `tasks`, `faults`, `presets`, `operations`
All include `_tenantId` for isolation.

## 🔧 Tenant Management

### Tenant Settings

Access via `/tenant-admin`:

#### General Settings
- Organization name
- Contact information
- Status (active/trial/suspended)

#### Device Settings
- Inform interval (60-3600 seconds)
- Auto discovery (on/off)
- PCI monitoring (on/off)
- Performance monitoring (on/off)
- Data retention (7-365 days)

#### Connection Info
- CWMP URL (read-only)
- Subdomain (read-only)
- Connection instructions

#### Limits & Quotas
- Max devices
- Max users
- Max networks
- Storage quota (MB)

### User Management

Coming in next update:
- Invite users to tenant
- Assign roles
- Manage permissions
- Remove users

## 🔌 API Usage

### Authentication

All API requests require Firebase ID token:

```javascript
const user = firebase.auth().currentUser;
const token = await user.getIdToken();

fetch('https://your-region-your-project.cloudfunctions.net/syncGenieACSDevicesMultitenant', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tenantId: 'tenant-123'  // Optional if user has default tenant
  })
});
```

### Multi-Tenant Functions

#### Sync Devices
```
syncGenieACSDevicesMultitenant
```
Syncs devices from GenieACS to Firestore (tenant-filtered)

#### Proxy NBI
```
proxyGenieACSNBIMultitenant
```
Proxies requests to GenieACS NBI with tenant filtering

#### Handle CWMP
```
handleCWMPMultitenant
```
Handles CWMP connections from devices (extracts tenant from URL)

#### Get Device Parameters
```
getDeviceParametersMultitenant
```
Gets device parameters (tenant-validated)

#### Execute Task
```
executeDeviceTaskMultitenant
```
Executes task on device (permission-checked)

## 🚨 Security Best Practices

### 1. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Tenants - only authenticated users
    match /tenants/{tenantId} {
      allow read: if request.auth != null && 
                    exists(/databases/$(database)/documents/user_tenants/$(request.auth.uid + '_' + tenantId));
      allow write: if request.auth != null && 
                     get(/databases/$(database)/documents/user_tenants/$(request.auth.uid + '_' + tenantId)).data.role == 'owner';
    }
    
    // User-Tenant associations
    match /user_tenants/{associationId} {
      allow read: if request.auth != null && 
                    associationId.matches('^' + request.auth.uid + '_.*');
      allow write: if request.auth != null;
    }
  }
}
```

### 2. MongoDB Access

- Use separate MongoDB users per tenant (advanced)
- Or rely on application-level filtering (current implementation)
- Enable MongoDB authentication
- Use SSL/TLS for connections
- Regularly backup data

### 3. API Security

- All functions use `withTenantContext()` middleware
- Validates Firebase ID token
- Checks tenant association
- Enforces role-based permissions

## 📊 Monitoring

### GenieACS Logs

```bash
# View CWMP logs
tail -f /opt/genieacs/logs/genieacs-cwmp.log

# View NBI logs
tail -f /opt/genieacs/logs/genieacs-nbi.log

# Filter by tenant
tail -f /opt/genieacs/logs/genieacs-cwmp.log | grep "tenant-123"
```

### Service Status

```bash
# Check all services
systemctl status genieacs-*
systemctl status nginx

# Restart services
sudo systemctl restart genieacs-cwmp
sudo systemctl restart nginx
```

### Nginx Logs

```bash
# Access log
tail -f /var/log/nginx/access.log

# Error log
tail -f /var/log/nginx/error.log
```

## 🐛 Troubleshooting

### Device Not Connecting

1. Check CWMP URL is correct
2. Verify tenant subdomain exists
3. Check Nginx is routing correctly:
   ```bash
   curl -v http://your-domain/cwmp/your-subdomain
   ```
4. Check GenieACS CWMP service is running
5. Review device logs for connection errors

### User Can't Access Tenant

1. Verify user is authenticated
2. Check user-tenant association in Firestore
3. Verify tenant exists
4. Check role and permissions

### Data Not Filtering Correctly

1. Verify `_tenantId` field exists on MongoDB documents
2. Check middleware is attached to function
3. Review function logs for tenant context
4. Verify MongoDB query includes tenant filter

## 🔄 Migrations

### Adding Tenant ID to Existing Devices

If you have existing GenieACS data:

```javascript
// MongoDB script
db.devices.updateMany(
  { _tenantId: { $exists: false } },
  { $set: { _tenantId: "default-tenant-id" } }
);

// Tag devices in GenieACS
db.devices.updateMany(
  { _tenantId: "tenant-123" },
  { $set: { "Tags.tenant:tenant-123._value": true } }
);
```

## 📈 Scaling Considerations

### Performance

- Each tenant isolated = no cross-contamination
- MongoDB indexes on `_tenantId` recommended:
  ```javascript
  db.devices.createIndex({ "_tenantId": 1 });
  db.tasks.createIndex({ "_tenantId": 1 });
  ```

### Limits

- Default limits per tenant:
  - 100 devices
  - 5 users
  - 10 networks
  - 1000 MB storage

Adjust in tenant settings or update defaults in `tenant.ts`.

## 🎯 Next Steps

1. **User Invitations**: Implement email invitations for adding users to tenants
2. **Audit Logs**: Track all changes and actions per tenant
3. **Billing Integration**: Track usage and implement billing
4. **Advanced Permissions**: Fine-grained permissions per user
5. **Tenant Analytics**: Usage statistics and reports per tenant
6. **API Keys**: Generate API keys for programmatic access
7. **Webhooks**: Notify external systems of events

## 📚 Additional Resources

- [GenieACS Documentation](https://docs.genieacs.com/)
- [TR-069 Protocol](https://en.wikipedia.org/wiki/TR-069)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [MongoDB Documentation](https://docs.mongodb.com/)

## 🤝 Support

For issues or questions:
1. Check logs (`/opt/genieacs/logs/`)
2. Review Firestore security rules
3. Verify MongoDB connectivity
4. Check Firebase Functions logs
5. Review this documentation

## 📝 License

Private - LTE WISP Management Platform

---

**Last Updated**: 2025-10-11  
**Version**: 1.0.0

