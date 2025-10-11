/**
 * CBRS Management Module Documentation
 */

export const cbrsManagementDocs = `
# CBRS Management Module

## Overview

The CBRS (Citizens Broadband Radio Service) Management module provides comprehensive spectrum management capabilities for the 3.5 GHz CBRS band (3550-3700 MHz) with integrated support for:

- **Google SAS (Spectrum Access System)** - Google's commercial SAS platform
- **Federated Wireless** - Enhanced SAS with advanced analytics and optimization

## Key Features

### 🎯 CBSD Device Management
- Register and manage Citizens Broadband Service Devices (CBSDs)
- Support for both Category A (indoor) and Category B (outdoor) devices
- Real-time device status monitoring
- GPS-based device mapping with ArcGIS integration

### 📡 Spectrum Authorization
- Request spectrum grants from SAS providers
- Automated heartbeat management
- Real-time grant status tracking
- Grant relinquishment and renewal

### 🗺️ Geographic Visualization
- Interactive ArcGIS map showing CBSD locations
- Color-coded device status indicators
- Multi-site coordination visualization
- Coverage area analysis

### 📊 Analytics & Monitoring
- Real-time device performance metrics
- Spectrum utilization tracking
- Interference detection and monitoring
- Historical data analysis

## CBRS Basics

### What is CBRS?

Citizens Broadband Radio Service (CBRS) is a 150 MHz wide broadcast radio frequency band in the United States (3550-3700 MHz). It operates under an innovative three-tiered spectrum sharing framework:

1. **Incumbent Access** - Federal and fixed satellite service users (highest priority)
2. **Priority Access License (PAL)** - Licensed users with protected spectrum
3. **General Authorized Access (GAA)** - Unlicensed users on available spectrum

### Spectrum Access System (SAS)

The SAS is a cloud-based database and spectrum management system that:
- Protects incumbent users from harmful interference
- Manages spectrum assignments for PAL and GAA users
- Provides dynamic spectrum allocation
- Enforces FCC rules and regulations

## Getting Started

### 1. Add a CBSD Device

Click **"+ Add CBSD Device"** and provide:
- **CBSD Serial Number** - Unique device identifier
- **FCC ID** - FCC equipment authorization identifier
- **Category** - A (indoor, lower power) or B (outdoor, higher power)
- **SAS Provider** - Google SAS or Federated Wireless
- **Installation Parameters**:
  - Latitude and Longitude (decimal degrees)
  - Height above ground (meters)
  - Antenna gain (dBi)

### 2. Register with SAS

Once added, devices must be registered with the selected SAS provider:
1. Select device from the list
2. Click **"Register"** button
3. SAS validates device and installation parameters
4. Upon success, device receives a CBSD ID

### 3. Request Spectrum Grant

After registration, request a spectrum grant:
1. Select registered device
2. Click **"Request New Grant"**
3. Specify:
   - Maximum EIRP (Effective Isotropic Radiated Power)
   - Frequency range (within 3550-3700 MHz)
4. SAS evaluates request and assigns available spectrum

### 4. Automated Heartbeat

Once granted, the system automatically:
- Sends periodic heartbeats to SAS
- Maintains spectrum authorization
- Updates transmit expiration times
- Reports device status

## Device States

### UNREGISTERED
Device is created but not yet registered with SAS. Cannot transmit.

### REGISTERED
Device is registered with SAS and can request spectrum grants.

### GRANTED
Device has one or more active spectrum grants but is not authorized to transmit.

### AUTHORIZED
Device is authorized to transmit on granted frequencies. Active heartbeat required.

### SUSPENDED
Spectrum grant is temporarily suspended. Cannot transmit until restored.

### DEREGISTERED
Device is removed from SAS registration. All grants are terminated.

## Grant Management

### Requesting Grants

When requesting a grant, consider:

**Frequency Range**
- Must be within CBRS band (3550-3700 MHz)
- Typically 10-20 MHz channels
- Avoid incumbent protection zones

**Maximum EIRP**
- Category A: Up to 30 dBm/10MHz
- Category B: Up to 47 dBm/10MHz
- SAS may reduce based on interference analysis

**Channel Type**
- **PAL** - Priority Access License (if you hold PAL)
- **GAA** - General Authorized Access (most common)

### Heartbeat Requirements

SAS requires periodic heartbeats (typically 60-240 seconds) to:
- Confirm device operational status
- Renew transmit authorization
- Update interference measurements
- Receive SAS commands

**Heartbeat Process:**
1. System automatically sends heartbeats
2. SAS responds with transmit authorization
3. Authorization expires if heartbeat missed
4. Device must stop transmitting if expired

### Relinquishing Grants

Relinquish grants when:
- Device is no longer transmitting
- Spectrum is not needed
- Preparing for deregistration
- Changing frequency assignments

## API Integration

### Google SAS

**Features:**
- WinnForum compliant SAS implementation
- Integration with Google Cloud Platform
- Real-time spectrum coordination
- Automated interference protection

**Best For:**
- Standard CBRS deployments
- Cost-effective spectrum management
- Google Cloud integration
- Basic compliance requirements

### Federated Wireless

**Features:**
- Enhanced spectrum optimization
- Advanced interference monitoring
- Multi-site coordination
- Real-time analytics and insights
- Automated power optimization

**Best For:**
- Enterprise deployments
- Multi-site networks
- Advanced analytics needs
- Maximum spectrum efficiency

## Best Practices

### Device Installation

1. **Accurate GPS Coordinates**
   - Use professional GPS equipment
   - Verify coordinates before registration
   - Update if device is relocated

2. **Height Measurements**
   - Measure from ground level (AGL)
   - Include antenna height
   - Account for building height for rooftop installations

3. **Antenna Parameters**
   - Accurate antenna gain critical for power calculations
   - Provide azimuth and downtilt if directional
   - Keep documentation updated

### Spectrum Management

1. **Request Appropriate Bandwidth**
   - Match to actual needs
   - Consider traffic patterns
   - Plan for growth

2. **Monitor Grant Status**
   - Check expiration times
   - Renew before expiration
   - Monitor heartbeat success rate

3. **Handle Suspensions Gracefully**
   - Implement immediate transmit stop
   - Wait for SAS clearance
   - Log suspension events

### Network Optimization

1. **Use Available Spectrum Efficiently**
   - Deploy only needed CBSDs
   - Use appropriate power levels
   - Avoid over-provisioning

2. **Coordinate Multiple Sites**
   - Use Federated Wireless multi-site coordination
   - Plan frequency reuse
   - Monitor inter-site interference

3. **Regular Maintenance**
   - Update device firmware
   - Verify GPS sync
   - Test emergency shutdown procedures

## Compliance & Regulations

### FCC Requirements

All CBSD operations must comply with FCC Part 96 rules:
- Use certified CBSD equipment (FCC ID required)
- Register all devices with SAS
- Respond to SAS commands immediately
- Maintain accurate installation records
- Stop transmitting when required

### Incumbent Protection

SAS automatically protects:
- Federal radar systems (Navy shipboard radar)
- Fixed Satellite Service (FSS) earth stations
- Grandfathered Fixed Service operations

**Protection Zones:**
- Coastal areas (0-80 km inland)
- FSS earth station locations
- Military installation perimeters

### Record Keeping

Maintain records of:
- Device registration details
- Grant requests and approvals
- Heartbeat logs
- Suspension/termination events
- Installation changes

## Troubleshooting

### Device Won't Register

**Check:**
- FCC ID is valid and certified for CBRS
- GPS coordinates are accurate
- Device category matches equipment specs
- No duplicate serial numbers
- SAS API credentials are valid

### Grant Request Denied

**Possible Causes:**
- Requested frequency unavailable
- Excessive interference predicted
- In incumbent protection zone
- Installation parameters invalid
- Power level too high

**Solutions:**
- Request different frequency range
- Reduce max EIRP
- Verify installation parameters
- Check for nearby PAL holders
- Contact SAS provider support

### Heartbeat Failures

**Check:**
- Network connectivity
- SAS API endpoint accessibility
- System clock synchronization
- Certificate validity (if using SSL)
- Grant expiration status

**Actions:**
- Review error logs
- Test network connection
- Verify API credentials
- Restart heartbeat service
- Contact SAS support if persistent

### Unexpected Suspension

**Causes:**
- Incumbent activity detected
- Interference reported
- Missed heartbeats
- SAS maintenance
- Policy violation

**Response:**
1. Immediately stop transmitting
2. Check SAS messages
3. Wait for AUTHORIZED state
4. Resume only when cleared
5. Investigate root cause

## Support & Resources

### Documentation
- [FCC Part 96 Rules](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-96)
- [WinnForum SAS Specifications](https://www.wirelessinnovation.org/cbrs-spectrum-access-system)
- [Google SAS Documentation](https://cloud.google.com/spectrum-access-system)
- [Federated Wireless Portal](https://www.federatedwireless.com/)

### Getting Help
- Technical support: support@yourcompany.com
- SAS Provider support links in module settings
- Community forums and user groups
- Professional services for deployment assistance

### Additional Training
- CBRS fundamentals course
- SAS integration workshop
- Network planning services
- Compliance training

---

**Module Version:** 1.0.0  
**Last Updated:** ${new Date().toISOString().split('T')[0]}  
**WinnForum Spec:** WINNF-TS-0016 (Latest)
`;

