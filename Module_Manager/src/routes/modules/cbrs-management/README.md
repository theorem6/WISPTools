# CBRS Management Module

## Overview

The CBRS Management module provides comprehensive Citizens Broadband Radio Service spectrum management capabilities for the 3.5 GHz band (3550-3700 MHz).

## Features

### 🎯 Core Functionality
- **CBSD Device Management** - Register and manage Category A/B devices
- **SAS Integration** - Google SAS and Federated Wireless API support
- **Spectrum Authorization** - Request and manage spectrum grants
- **Automated Heartbeat** - Maintain authorization with automated heartbeats
- **Real-time Monitoring** - Track device status and grant state
- **Geographic Visualization** - ArcGIS map integration with device locations

### 📡 Supported Operations
1. **Device Registration** - Register CBSDs with SAS
2. **Spectrum Inquiry** - Query available spectrum
3. **Grant Request** - Request spectrum authorization
4. **Heartbeat** - Maintain active grants
5. **Grant Relinquishment** - Release spectrum grants
6. **Deregistration** - Remove devices from SAS

## Architecture

```
cbrs-management/
├── lib/
│   ├── api/
│   │   ├── googleSASClient.ts       # Google SAS API client
│   │   └── federatedWirelessClient.ts # Federated Wireless API client
│   ├── models/
│   │   └── cbsdDevice.ts            # CBRS data models
│   ├── services/
│   │   └── cbrsService.ts           # Unified service layer
│   └── utils/                       # Helper utilities
├── components/
│   ├── DeviceList.svelte            # Device table component
│   ├── GrantStatus.svelte           # Grant management component
│   └── SpectrumVisualization.svelte # Spectrum chart (future)
├── +page.svelte                     # Main module page
├── +page.ts                         # Page configuration
└── README.md                        # This file
```

## Technical Details

### API Integration

#### Google SAS
- Endpoint: `https://sas.googleapis.com/v1`
- Authentication: API Key + Certificate
- Protocol: WinnForum SAS-CBSD Interface

#### Federated Wireless
- Endpoint: `https://sas.federatedwireless.com/api/v1`
- Authentication: API Key + Customer ID
- Enhanced Features: Analytics, optimization, multi-site coordination

### Data Models

#### CBSDDevice
```typescript
{
  id: string;
  cbsdSerialNumber: string;
  fccId: string;
  cbsdCategory: 'A' | 'B';
  sasProviderId: 'google' | 'federated-wireless';
  installationParam: InstallationParams;
  state: CBSDState;
  activeGrants?: Grant[];
  tenantId: string;
}
```

#### Grant
```typescript
{
  grantId: string;
  cbsdId: string;
  grantExpireTime: Date;
  heartbeatInterval: number;
  channelType: 'GAA' | 'PAL';
  operationParam: {
    maxEirp: number;
    operationFrequencyRange: FrequencyRange;
  };
  grantState: 'IDLE' | 'GRANTED' | 'AUTHORIZED' | 'SUSPENDED' | 'TERMINATED';
}
```

### State Management

Device states follow WinnForum specification:
- `UNREGISTERED` - Device created, not registered
- `REGISTERED` - Registered with SAS
- `GRANTED` - Has active grants
- `AUTHORIZED` - Authorized to transmit
- `SUSPENDED` - Temporarily suspended
- `DEREGISTERED` - Removed from SAS

### Heartbeat Management

The service automatically manages heartbeats for active grants:
- Interval: Determined by SAS (typically 60-240 seconds)
- Automatic: Runs in background
- Renewal: Transmit authorization renewed on each heartbeat
- Failure Handling: Stops heartbeat on repeated failures

## Usage

### 1. Initialize Service

```typescript
import { createCBRSService } from './lib/services/cbrsService';

const config = {
  provider: 'google', // or 'federated-wireless' or 'both'
  tenantId: 'your-tenant-id',
  googleConfig: {
    apiEndpoint: 'https://sas.googleapis.com/v1',
    apiKey: 'your-api-key',
    tenantId: 'your-tenant-id'
  }
};

const cbrsService = createCBRSService(config);
```

### 2. Register Device

```typescript
const device = {
  id: 'cbsd-001',
  cbsdSerialNumber: 'SN123456',
  fccId: 'ABC123XYZ',
  cbsdCategory: 'A',
  sasProviderId: 'google',
  installationParam: {
    latitude: 40.7128,
    longitude: -74.0060,
    height: 10,
    heightType: 'AGL',
    antennaGain: 5
  },
  state: 'UNREGISTERED',
  tenantId: 'your-tenant-id',
  createdAt: new Date(),
  updatedAt: new Date()
};

const registeredDevice = await cbrsService.registerDevice(device);
```

### 3. Request Grant

```typescript
const grant = await cbrsService.requestGrant(device, {
  maxEirp: 20,
  lowFrequency: 3550000000, // 3550 MHz
  highFrequency: 3560000000  // 3560 MHz
});
```

### 4. Relinquish Grant

```typescript
await cbrsService.relinquishGrant(device, grantId);
```

### 5. Deregister Device

```typescript
await cbrsService.deregisterDevice(device);
```

## Configuration

### Environment Variables

Required for production:
```
GOOGLE_SAS_API_KEY=your-google-sas-key
GOOGLE_SAS_CERTIFICATE_PATH=/path/to/cert.pem
GOOGLE_SAS_PRIVATE_KEY_PATH=/path/to/key.pem
FEDERATED_WIRELESS_API_KEY=your-fw-key
FEDERATED_WIRELESS_CUSTOMER_ID=your-customer-id
```

### Firebase Configuration

Devices are stored in Firestore:
- Collection: `cbrs_devices`
- Tenant filtering: `tenantId` field
- Real-time updates supported

## Compliance

### FCC Part 96

This module implements FCC Part 96 requirements:
- Device certification (FCC ID)
- SAS registration
- Incumbent protection
- Interference avoidance
- Operational compliance

### WinnForum Specifications

Implements WinnForum SAS-CBSD Interface:
- WINNF-TS-0016 (SAS-CBSD Interface)
- WINNF-TS-0112 (Spectrum Inquiry)
- WINNF-TS-0245 (Heartbeat Protocol)

## Testing

### Development Mode

In development, the module uses simulated API responses. To test:

1. Add test devices
2. Register with SAS (simulated)
3. Request grants (simulated responses)
4. Monitor heartbeat logs

### Production Testing

Before production deployment:
1. Verify SAS API credentials
2. Test device registration
3. Verify heartbeat operation
4. Test grant request/relinquish
5. Validate deregistration

## Troubleshooting

### Common Issues

#### "Device registration failed"
- Check FCC ID is valid
- Verify GPS coordinates
- Ensure SAS API credentials are correct

#### "Grant request denied"
- Frequency may be unavailable
- Check interference predictions
- Verify in allowed geographic area
- Reduce max EIRP if needed

#### "Heartbeat failures"
- Check network connectivity
- Verify SAS endpoint accessible
- Check certificate validity
- Review grant expiration times

## Roadmap

### Phase 1 (Current)
- [x] Google SAS integration
- [x] Federated Wireless integration
- [x] Basic device management
- [x] Grant request/relinquishment
- [x] Automated heartbeat
- [x] ArcGIS map visualization

### Phase 2 (Planned)
- [ ] Spectrum visualization charts
- [ ] Interference analysis
- [ ] Power optimization
- [ ] Multi-site coordination
- [ ] Advanced analytics dashboard
- [ ] Automated optimization

### Phase 3 (Future)
- [ ] AI-powered spectrum selection
- [ ] Predictive analytics
- [ ] Automated compliance reporting
- [ ] Integration with RAN equipment
- [ ] Network slicing support

## Support

For questions or issues:
- Documentation: See in-module help
- Technical Support: support@yourcompany.com
- SAS Provider Support: Contact Google or Federated Wireless

## License

Proprietary - Part of LTE WISP Management Platform

---

**Version:** 1.0.0  
**Last Updated:** 2025-10-11  
**Module Status:** Active

