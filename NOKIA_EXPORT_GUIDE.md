# Nokia LTE Configuration Export Guide

This feature allows you to generate Nokia LTE base station configuration files (XML format) directly from your PCI Mapper data.

## Features

- **Import from Existing Sites**: Import cell sites from your current network
- **Manual Configuration**: Build Nokia configurations from scratch
- **PCI Deconflict Integration**: Automatically uses PCI assignments from your optimized network
- **IP Configuration**: Configure management and transport network settings
- **Hardware Mapping**: Define radio modules, sectors, and carriers
- **Band 48 Support**: Optimized for CBRS Band 48 (3550-3700 MHz)

## How to Use

### 1. Access Nokia Configuration

Click the Nokia button (document icon) in the top navigation bar.

### 2. Import from Existing Site (Recommended)

1. Select a site from the dropdown
2. Click "Import Site Data"
3. The system will automatically populate:
   - Base station name
   - Sectors with azimuth settings
   - Carriers with EARFCNs and PCIs
   - Cell names

### 3. Configure Base Station

**Base Station Settings:**
- **BTS ID**: Unique numeric identifier (e.g., 10001)
- **BTS Name**: Human-readable name (e.g., BBU-SITE-DOWNTOWN)
- **LNBTS ID**: Logical BTS ID (usually same as BTS ID)
- **TAC**: Tracking Area Code
- **MCC**: Mobile Country Code (e.g., 310 for USA)
- **MNC**: Mobile Network Code (operator-specific)

### 4. Configure IP Addresses

**Management Network:**
- IP address for BBU management
- Gateway and subnet mask

**Transport Network:**
- IP address for S1/X2 interfaces
- Gateway and subnet mask

### 5. Add Sectors and Carriers

**For each sector:**
1. Click "Add Sector"
2. Set azimuth (0-359°)
3. Select Radio Module (RMOD-1, RMOD-2, or RMOD-3)

**For each carrier:**
1. Click "Add Carrier" under the sector
2. Enter:
   - Cell name (optional)
   - EARFCN DL (55240-56739 for Band 48)
   - Bandwidth (10MHz, 15MHz, or 20MHz)
   - PCI (0-503)

### 6. PCI Management

**Auto-fill PCIs:**
- Click "Auto-fill PCIs" to automatically assign PCIs
- Uses a spacing of 3 to avoid MOD3 conflicts

**Check Conflicts:**
- Click "Check PCI Conflicts" to validate no duplicate PCIs

**Manual Assignment:**
- Edit PCI values directly in carrier fields
- Ensure PCIs are unique across all carriers

### 7. Generate Configuration

1. Review configuration for errors (shown in red box if any)
2. Click "Generate & Download XML"
3. XML file will be downloaded to your computer

## Configuration Examples

### Single Sector, 3 Carriers (Typical CBRS)

```
Site: SITE-001
└── Sector 1 (Azimuth: 0°, RMOD-1)
    ├── Carrier 1: EARFCN 55640, 20MHz, PCI 10
    ├── Carrier 2: EARFCN 55840, 20MHz, PCI 13
    └── Carrier 3: EARFCN 56040, 20MHz, PCI 16
```

### 3-Sector Site, 1 Carrier Each

```
Site: SITE-002
├── Sector 1 (Azimuth: 0°, RMOD-1)
│   └── Carrier 1: EARFCN 55640, 20MHz, PCI 20
├── Sector 2 (Azimuth: 120°, RMOD-2)
│   └── Carrier 1: EARFCN 55640, 20MHz, PCI 21
└── Sector 3 (Azimuth: 240°, RMOD-3)
    └── Carrier 1: EARFCN 55640, 20MHz, PCI 22
```

### 3-Sector Site, 3 Carriers Each (Full Deployment)

```
Site: SITE-003
├── Sector 1 (Azimuth: 0°, RMOD-1)
│   ├── Carrier 1: EARFCN 55640, 20MHz, PCI 30
│   ├── Carrier 2: EARFCN 55840, 20MHz, PCI 33
│   └── Carrier 3: EARFCN 56040, 20MHz, PCI 36
├── Sector 2 (Azimuth: 120°, RMOD-2)
│   ├── Carrier 1: EARFCN 55640, 20MHz, PCI 31
│   ├── Carrier 2: EARFCN 55840, 20MHz, PCI 34
│   └── Carrier 3: EARFCN 56040, 20MHz, PCI 37
└── Sector 3 (Azimuth: 240°, RMOD-3)
    ├── Carrier 1: EARFCN 55640, 20MHz, PCI 32
    ├── Carrier 2: EARFCN 55840, 20MHz, PCI 35
    └── Carrier 3: EARFCN 56040, 20MHz, PCI 38
```

## Band 48 (CBRS) Frequencies

| Channel | EARFCN | Frequency (MHz) |
|---------|--------|-----------------|
| 1       | 55240  | 3550            |
| ...     | ...    | ...             |
| Center  | 55640  | 3625            |
| ...     | ...    | ...             |
| Max     | 56739  | 3699.9          |

**Bandwidth Options:**
- 10 MHz: 50 RBs
- 15 MHz: 75 RBs
- 20 MHz: 100 RBs

## PCI Planning Best Practices

1. **Spacing**: Maintain PCI spacing of at least 3 between adjacent cells
2. **MOD3 Conflicts**: Avoid PCIs that differ by 3, 6, 9... within 1km
3. **MOD6 Conflicts**: Avoid PCIs that differ by 6, 12, 18... within 2km
4. **Collision**: Never use the same PCI for adjacent sectors
5. **Range**: Use PCIs 0-503 (504 total PCIs available)

## Hardware Configuration

### Supported Equipment
- **BBU**: Nokia AirScale Baseband
- **Radio Modules**: RMOD (up to 3 per BBU)
- **Antennas**: 4x4 MIMO per sector

### Hardware Topology
- BBMOD-1: Connected to RMOD-1 and RMOD-2 via CPRI
- BBMOD-2: Connected to RMOD-3 via CPRI
- SMOD: System Module for control and timing

## Network Topology

### Management Network (VLAN 1)
- BBU management interface
- For NetAct, OMC, maintenance

### Transport Network (VLAN 2)
- S1 interface to EPC
- X2 interface to neighbor eNodeBs

## Validation

The system validates:
- ✓ BTS ID is numeric
- ✓ BTS name is not empty
- ✓ At least one sector exists
- ✓ Each sector has at least one carrier
- ✓ PCI values are 0-503
- ✓ EARFCN values are in Band 48 range
- ✓ IP addresses are valid
- ✓ Subnet masks are valid (8-32)

## Troubleshooting

### "Invalid EARFCN" Error
- Ensure EARFCN is between 55240-56739 for Band 48
- Check that you're using DL EARFCN (UL is same for TDD)

### "Invalid PCI" Error
- PCIs must be 0-503
- Check for duplicates using "Check PCI Conflicts"

### "Invalid IP Address" Error
- Ensure IP follows format xxx.xxx.xxx.xxx
- Each octet must be 0-255
- No leading zeros (use 192.168.1.1, not 192.168.001.001)

### Missing Sectors After Import
- Ensure the site has sectors defined
- Check that cells have EARFCN and PCI values

## Advanced Features

### Carrier Aggregation
- Define multiple carriers per sector
- System automatically creates CAREL (Carrier Relations)
- Carriers can use different frequencies

### Multi-Band Support
- Currently optimized for Band 48
- Edit EARFCN ranges in code for other bands

### Custom Hardware
- Modify equipment types in `nokiaService.ts`
- Update product codes for different hardware versions

## File Format

Generated files use Nokia RAML 2.1 XML format compatible with:
- Nokia NetAct
- Nokia AirScale Base Stations
- Nokia Flexi Multiradio BTS

## Support

For questions or issues:
1. Check validation errors in the UI
2. Review this guide
3. Verify against working Nokia configuration template
4. Ensure data imported from PCI Mapper is correct

## Version History

- **v1.0** (2025-10-03): Initial release
  - Band 48 support
  - 3-sector, 3-carrier configuration
  - Import from PCI Mapper sites
  - IP configuration
  - PCI validation

## Future Enhancements

Planned features:
- [ ] Multi-band support (Band 2, 4, 5, 12, 14, 66, 71)
- [ ] 5G NR configuration
- [ ] SON parameter templates
- [ ] Neighbor cell list generation
- [ ] Automatic X2 link configuration
- [ ] Import from existing Nokia XML
- [ ] Batch export for multiple sites

