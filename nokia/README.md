# Nokia Configuration Template

This folder contains the Nokia LTE configuration template used as a reference for the configuration export feature.

## Template File

**File**: `nokia-3s-3c.xml`

**Description**: Working Nokia AirScale LTE configuration for a Band 48 (CBRS) base station

**Configuration**:
- **Base Station**: BBU-NKASIA-ALW-CENTREVILLE (MRBTS-10219)
- **Sectors**: 3 (labeled as RMOD-1, RMOD-2, RMOD-3)
- **Carriers per Sector**: 3 (total 9 cells)
- **Band**: Band 48 (CBRS, 3550-3700 MHz)
- **Bandwidth**: 20 MHz per carrier
- **Technology**: LTE TDD

## Structure

The template includes:

### 1. Equipment Configuration
- **MRBTS**: Base station identifier and name
- **EQM**: Equipment management module
- **APEQM**: AP equipment manager
- **CABINET**: Physical cabinet
- **BBMOD**: 2x Baseband modules
- **SMOD**: System module (timing, control)
- **RMOD**: 3x Radio modules (one per sector)
- **ANTL**: 4x Antenna lines per RMOD (for 4T4R MIMO)

### 2. Hardware Topology (HWTOP)
- CPRI links between baseband and radio modules
- Link compression settings (9-bit IQ)
- Link speed (CPRI7)

### 3. LTE Configuration
- **LNBTS**: LTE BTS with ID and TAC
- **LNCEL**: 9x LTE cells (3 sectors × 3 carriers)
- Cell parameters (PCI, EARFCN, bandwidth, power)
- TDD configuration (special subframe, subframe assignment)

### 4. Network Configuration
- **TNLSVC/TNL**: Transport network layer
- **IPNO**: IP node configuration
- **ETHSVC**: Ethernet service
- **ETHIF**: Physical Ethernet interface (SFP)
- **VLANIF**: 2x VLANs (management and transport)
- **IPIF**: IP interfaces
- **IPADDRESSV4**: IPv4 address assignments
  - Management: 100.71.2.9/24 (VLAN 1)
  - Transport: 10.71.2.9/24 (VLAN 2)
- **IPRT**: Static routing configuration

## Cell Configuration Example

### Sector 1 (RMOD-1, Azimuth 0°)
- **LNCEL-1**: PCI 84, EARFCN 55640, 20MHz
- **LNCEL-4**: PCI 85, EARFCN 55840, 20MHz  
- **LNCEL-7**: PCI 86, EARFCN 56040, 20MHz

### Sector 2 (RMOD-2, Azimuth 120°)
- **LNCEL-2**: PCI 84, EARFCN 55640, 20MHz
- **LNCEL-5**: PCI 85, EARFCN 55840, 20MHz
- **LNCEL-8**: PCI 86, EARFCN 56040, 20MHz

### Sector 3 (RMOD-3, Azimuth 240°)
- **LNCEL-3**: PCI 84, EARFCN 55640, 20MHz
- **LNCEL-6**: PCI 85, EARFCN 55840, 20MHz
- **LNCEL-9**: PCI 86, EARFCN 56040, 20MHz

## EARFCN Mapping (Band 48)

| EARFCN | Center Frequency | Channel |
|--------|------------------|---------|
| 55640  | 3625.0 MHz      | Mid     |
| 55840  | 3645.0 MHz      | Upper   |
| 56040  | 3665.0 MHz      | Upper   |

**Band 48 Range**: 
- EARFCN DL: 55240 - 56739
- Frequency: 3550 - 3700 MHz (150 MHz total)

## Network Topology

```
Internet/Core Network
        ↓
   [Router/Gateway]
        ↓
   100.71.2.1 (Management)
   10.71.2.1 (Transport)
        ↓
    ┌───────┐
    │  BBU  │ (MRBTS-10219)
    │       │ Management: 100.71.2.9/24 (VLAN 1)
    │       │ Transport:  10.71.2.9/24  (VLAN 2)
    └───┬───┘
        │ CPRI
    ┌───┴────────┬─────────┐
    │            │         │
[RMOD-1]    [RMOD-2]  [RMOD-3]
 0° Az       120° Az    240° Az
3 Carriers  3 Carriers 3 Carriers
```

## File Size

- **Original File**: ~3.5 MB
- **Lines**: ~20,000 lines
- **Format**: XML (Nokia RAML 2.1)

## Software Versions

Based on the template:
- **Base Station**: SBTS20C_2006_001
- **Equipment**: EQM20B_2007_002
- **LTE**: xL20C_2007_003
- **Transport**: TNL20C_2007_002

## Usage

This template serves as a reference for:
1. XML structure and element ordering
2. Parameter names and valid values
3. Hardware topology connections
4. Network interface configuration
5. LTE cell parameter settings

## Modifications by Export Tool

When generating new configurations, the export tool modifies:

**Variable Parameters** (user-configured):
- Base station ID and name
- Cell IDs and names
- Physical Cell IDs (PCIs)
- EARFCN values
- IP addresses and gateways
- Sector azimuths
- Number of sectors and carriers

**Fixed Parameters** (from template):
- Equipment types and product codes
- Cell ranges and thresholds
- RF parameters
- Protocol timers
- System policies
- Hardware capabilities

## File Format Details

**XML Namespace**: raml21.xsd
**RAML Version**: 2.1
**Encoding**: UTF-8
**Operation**: create (all managed objects)

## Managed Object Classes

Key classes in the configuration:
- `com.nokia.srbts:MRBTS` - Base station
- `com.nokia.srbts.eqm:*` - Equipment modules
- `NOKLTE:LNBTS` - LTE BTS
- `NOKLTE:LNCEL` - LTE cells
- `NOKLTE:LNCEL_TDD` - TDD-specific cell config
- `NOKLTE:CAREL` - Carrier relations
- `com.nokia.srbts.tnl:*` - Transport network layer

## Notes

- This is a production-grade configuration
- All parameters are within Nokia's valid ranges
- IP addresses should be changed for each deployment
- PCIs should be planned to avoid conflicts
- EARFCN selection depends on spectrum license

## See Also

- [NOKIA_EXPORT_GUIDE.md](../NOKIA_EXPORT_GUIDE.md) - User guide for export feature
- [NOKIA_IMPLEMENTATION_SUMMARY.md](../NOKIA_IMPLEMENTATION_SUMMARY.md) - Implementation details
- Nokia documentation: NetAct Configuration Management Guide
- Nokia documentation: AirScale Base Station Installation Guide

