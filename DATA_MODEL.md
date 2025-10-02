# LTE PCI Mapper - Data Model Documentation

## Cellular Network Hierarchy

The LTE PCI Mapper uses a proper hierarchical data model that accurately reflects real-world cellular network architecture:

```
Network
  └─ Cell Site (Tower)
      └─ Sector (Transmitter)
          └─ EARFCN/Channel (Frequency)
```

## 1. Network

A **Network** is a collection of cell sites belonging to an operator in a specific market.

**Properties:**
- `id` - Unique network identifier
- `name` - Network name (e.g., "Manhattan LTE Network")
- `market` - Market/region name
- `location` - Network center location (GPS + zoom level)
- `sites` - Array of CellSite objects
- `metadata` - Additional network information (operator, deployment phase, etc.)

## 2. Cell Site (Tower)

A **Cell Site** is a physical tower or rooftop installation at a specific GPS location.

**Properties:**
- `id` - Unique site ID (e.g., "SITE001")
- `name` - Site name (e.g., "Manhattan Tower A")
- `eNodeB` - eNodeB identifier for this site
- `latitude` - GPS coordinate (ONE per site)
- `longitude` - GPS coordinate (ONE per site)
- `sectors` - Array of Sector objects
- `metadata` - Site type, address, operator, etc.

**Key Points:**
- ✅ A cell site has **ONE GPS coordinate**
- ✅ All sectors on a site share the same GPS location
- ❌ Cell sites do **NOT** have azimuths
- ❌ Cell sites do **NOT** have PCIs

## 3. Sector (Transmitter)

A **Sector** is an individual transmitter/antenna mounted on a cell site, pointing in a specific direction.

**Properties:**
- `id` - Unique sector ID (e.g., "SITE001-SEC1")
- `sectorNumber` - Sector number (1, 2, 3, etc.)
- `azimuth` - Direction in degrees (0-359°) - **ONLY sectors have azimuths**
- `beamwidth` - Horizontal beamwidth (33°, 65°, 78°, 90°, 120°)
- `pci` - Physical Cell ID (0-503)
- `rsPower` - Reference signal power (dBm)
- `technology` - LTE, CBRS, or 5G
- `channels` - Array of Channel/EARFCN objects

**Key Points:**
- ✅ **Azimuths belong to sectors**, not cell sites
- ✅ Each sector has its own **azimuth** and **beamwidth**
- ✅ Each sector has its own **PCI**
- ✅ A typical 3-sector site has sectors at 0°, 120°, and 240°
- ✅ A 4-sector (CBRS) site has sectors at 0°, 90°, 180°, and 270°
- ✅ Multiple channels/EARFCNs per sector

## 4. Channel (EARFCN)

A **Channel** is a frequency channel (EARFCN) with specific bandwidth used by a sector.

**Properties:**
- `dlEarfcn` - Downlink EARFCN
- `ulEarfcn` - Uplink EARFCN
- `centerFreq` - Center frequency in MHz
- `channelBandwidth` - Bandwidth in MHz (1.4, 3, 5, 10, 15, 20)
- `isPrimary` - Whether this is the primary channel for the sector

**Key Points:**
- ✅ **Multiple EARFCNs per sector**
- ✅ Each EARFCN can have different bandwidth
- ✅ One EARFCN is marked as primary
- ✅ Supports carrier aggregation scenarios

## Example Structure

```json
{
  "network": {
    "id": "NET001",
    "name": "Manhattan LTE Network",
    "sites": [
      {
        "id": "SITE001",
        "name": "Times Square Tower",
        "eNodeB": 1001,
        "latitude": 40.7580,
        "longitude": -73.9855,
        "sectors": [
          {
            "id": "SITE001-SEC1",
            "sectorNumber": 1,
            "azimuth": 0,
            "beamwidth": 65,
            "pci": 15,
            "rsPower": -75,
            "technology": "LTE",
            "channels": [
              {
                "dlEarfcn": 1950,
                "ulEarfcn": 1850,
                "centerFreq": 2100,
                "channelBandwidth": 20,
                "isPrimary": true
              },
              {
                "dlEarfcn": 2000,
                "ulEarfcn": 1900,
                "centerFreq": 2150,
                "channelBandwidth": 10,
                "isPrimary": false
              }
            ]
          },
          {
            "id": "SITE001-SEC2",
            "sectorNumber": 2,
            "azimuth": 120,
            "beamwidth": 65,
            "pci": 16,
            "rsPower": -77,
            "technology": "LTE",
            "channels": [
              {
                "dlEarfcn": 1950,
                "ulEarfcn": 1850,
                "centerFreq": 2100,
                "channelBandwidth": 20,
                "isPrimary": true
              }
            ]
          },
          {
            "id": "SITE001-SEC3",
            "sectorNumber": 3,
            "azimuth": 240,
            "beamwidth": 65,
            "pci": 17,
            "rsPower": -76,
            "technology": "LTE",
            "channels": [
              {
                "dlEarfcn": 1950,
                "ulEarfcn": 1850,
                "centerFreq": 2100,
                "channelBandwidth": 20,
                "isPrimary": true
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## Flattened "Cell" Interface for Analysis

For conflict detection and optimization algorithms, the hierarchical model is flattened into a simpler "Cell" interface where each **sector** becomes a "cell" record:

```typescript
interface Cell {
  id: string;         // Sector ID
  eNodeB: number;     // From Cell Site
  sector: number;     // Sector number
  pci: number;        // From Sector
  latitude: number;   // Inherited from Cell Site
  longitude: number;  // Inherited from Cell Site
  azimuth: number;    // From Sector (NOT from Cell Site!)
  // ... other properties
}
```

**Important:** Even in this flattened format:
- The `azimuth` value comes from the **Sector**, not the Cell Site
- The `latitude`/`longitude` are inherited from the Cell Site
- Each "Cell" record represents one **Sector** on a Cell Site

## Conversion Functions

The app provides conversion functions to move between hierarchical and flat formats:

- `convertCellSiteToLegacy(sites)` - Converts hierarchical CellSite to flat Cell[]
- `convertLegacyToCellSite(cells)` - Converts flat Cell[] to hierarchical CellSite[]

## Import/Export Formats

### CSV Format
Each row represents a **sector** (not a cell site):
```
Cell ID,eNodeB,Sector,PCI,Latitude,Longitude,Frequency,RS Power,Azimuth,Tower Type,Technology,EARFCN,Channel Bandwidth,DL EARFCN,UL EARFCN
SITE001-SEC1,1001,1,15,40.7580,-73.9855,2100,-75,0,3-sector,LTE,1950,20,1950,1850
SITE001-SEC2,1001,2,16,40.7580,-73.9855,2100,-77,120,3-sector,LTE,1950,20,1950,1850
SITE001-SEC3,1001,3,17,40.7580,-73.9855,2100,-76,240,3-sector,LTE,1950,20,1950,1850
```

Note: Multiple rows with the same eNodeB and GPS coordinates represent multiple sectors on the same cell site.

### KML Format
Each placemark represents a **sector**:
```xml
<Placemark>
  <name>SITE001-SEC1</name>
  <ExtendedData>
    <Data name="eNodeB"><value>1001</value></Data>
    <Data name="Sector"><value>1</value></Data>
    <Data name="PCI"><value>15</value></Data>
    <Data name="Azimuth"><value>0</value></Data>
    <!-- ... -->
  </ExtendedData>
  <Point>
    <coordinates>-73.9855,40.7580,0</coordinates>
  </Point>
</Placemark>
```

## Summary

| Entity | Has GPS? | Has Azimuth? | Has PCI? | Has EARFCNs? |
|--------|----------|--------------|----------|--------------|
| Network | ✅ (center) | ❌ | ❌ | ❌ |
| Cell Site | ✅ (one location) | ❌ | ❌ | ❌ |
| Sector | ❌ (inherits) | ✅ | ✅ | ✅ (multiple) |
| Channel | ❌ | ❌ | ❌ | ✅ (one) |

**Remember:** 
- 🏢 **Cell Sites** have GPS coordinates
- 📡 **Sectors** have azimuths and PCIs
- 📻 **Channels** have EARFCNs and bandwidth

