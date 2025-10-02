// ============================================================================
// PROPER CELLULAR NETWORK DATA MODEL HIERARCHY
// ============================================================================
//
// Network > Cell Site (Tower) > Sector > EARFCN/Channel
//
// 1. Cell Site (CellSite) = Physical tower/site location
//    - Has GPS coordinates (latitude, longitude)
//    - Has eNodeB identifier
//    - Contains multiple sectors
//    - NO azimuth (azimuths belong to sectors)
//
// 2. Sector = Individual transmitter/antenna on the cell site
//    - Has azimuth (direction it points)
//    - Has beamwidth (coverage angle)
//    - Has PCI (Physical Cell ID)
//    - Has RS Power
//    - Contains multiple channels/EARFCNs
//
// 3. Channel = Frequency channel (EARFCN) with bandwidth
//    - Multiple EARFCNs can exist per sector
//    - Each has DL/UL EARFCN and bandwidth
//
// ============================================================================

export interface CellSite {
  id: string;              // Unique cell/site ID (e.g., "SITE001")
  name: string;            // Site name (e.g., "Manhattan Tower A")
  eNodeB: number;          // eNodeB ID for this cell site
  latitude: number;        // Cell site GPS coordinates (ONE per site)
  longitude: number;       // Cell site GPS coordinates (ONE per site)
  sectors: Sector[];       // Array of sectors on this cell site
  metadata?: {
    operator?: string;
    siteType?: string;     // Rooftop, tower, small cell, etc.
    address?: string;
  };
}

export interface Sector {
  id: string;              // Unique sector ID (e.g., "SITE001-SEC1")
  sectorNumber: number;    // Sector number (1, 2, 3, etc.)
  azimuth: number;         // Direction in degrees (0-359) - ONLY sectors have azimuths
  beamwidth: number;       // Horizontal beamwidth in degrees (typically 33, 65, 78, 90, 120)
  pci: number;             // Physical Cell ID (0-503)
  channels: Channel[];     // Multiple EARFCNs per sector
  rsPower: number;         // Reference signal power (dBm)
  technology: 'LTE' | 'CBRS' | '5G';
}

export interface Channel {
  dlEarfcn: number;        // Downlink EARFCN
  ulEarfcn: number;        // Uplink EARFCN  
  centerFreq: number;      // Center frequency in MHz
  channelBandwidth: number; // Bandwidth in MHz (1.4, 3, 5, 10, 15, 20)
  isPrimary: boolean;      // Primary channel for this sector
}

// Legacy Cell interface for backward compatibility
export interface LegacyCell {
  id: string;
  eNodeB: number;
  sector: number;
  pci: number;
  latitude: number;
  longitude: number;
  frequency: number;
  rsPower: number;
  azimuth?: number;
  towerType?: '3-sector' | '4-sector';
  technology?: 'LTE' | 'CBRS' | '5G';
  earfcn?: number;
  centerFreq?: number;
  channelBandwidth?: number;
  dlEarfcn?: number;
  ulEarfcn?: number;
}

/**
 * Convert legacy cell format to new CellSite format
 */
export function convertLegacyToCellSite(legacyCells: LegacyCell[]): CellSite[] {
  const sitesMap = new Map<string, CellSite>();
  
  for (const legacyCell of legacyCells) {
    const siteId = `SITE${legacyCell.eNodeB}`;
    
    // Get or create site
    if (!sitesMap.has(siteId)) {
      sitesMap.set(siteId, {
        id: siteId,
        name: `Site ${legacyCell.eNodeB}`,
        eNodeB: legacyCell.eNodeB,
        latitude: legacyCell.latitude,
        longitude: legacyCell.longitude,
        sectors: []
      });
    }
    
    const site = sitesMap.get(siteId)!;
    
    // Create sector
    const sector: Sector = {
      id: legacyCell.id,
      sectorNumber: legacyCell.sector,
      azimuth: legacyCell.azimuth || 0,
      beamwidth: (legacyCell as any).beamwidth || 65, // Use sector beamwidth if available
      pci: legacyCell.pci,
      channels: [
        {
          dlEarfcn: legacyCell.dlEarfcn || legacyCell.earfcn || 0,
          ulEarfcn: legacyCell.ulEarfcn || 0,
          centerFreq: legacyCell.centerFreq || legacyCell.frequency || 0,
          channelBandwidth: legacyCell.channelBandwidth || 20,
          isPrimary: true
        }
      ],
      rsPower: legacyCell.rsPower,
      technology: legacyCell.technology || 'LTE'
    };
    
    site.sectors.push(sector);
  }
  
  return Array.from(sitesMap.values());
}

/**
 * Convert CellSite format back to legacy format for compatibility
 */
export function convertCellSiteToLegacy(sites: CellSite[]): LegacyCell[] {
  const legacyCells: LegacyCell[] = [];
  
  for (const site of sites) {
    for (const sector of site.sectors) {
      const primaryChannel = sector.channels.find(c => c.isPrimary) || sector.channels[0];
      
      if (primaryChannel) {
        legacyCells.push({
          id: sector.id,
          eNodeB: site.eNodeB,
          sector: sector.sectorNumber,
          pci: sector.pci,
          latitude: site.latitude, // All sectors share the site's GPS coordinate
          longitude: site.longitude, // All sectors share the site's GPS coordinate
          frequency: primaryChannel.centerFreq,
          rsPower: sector.rsPower,
          azimuth: sector.azimuth,
          technology: sector.technology,
          earfcn: primaryChannel.dlEarfcn,
          centerFreq: primaryChannel.centerFreq,
          channelBandwidth: primaryChannel.channelBandwidth,
          dlEarfcn: primaryChannel.dlEarfcn,
          ulEarfcn: primaryChannel.ulEarfcn,
          ...(sector.beamwidth && { beamwidth: sector.beamwidth }) // Include beamwidth
        } as any);
      }
    }
  }
  
  return legacyCells;
}

/**
 * Flatten all sectors from all sites for analysis
 */
export function flattenSectorsForAnalysis(sites: CellSite[]): Array<{
  site: CellSite;
  sector: Sector;
}> {
  const flattened: Array<{ site: CellSite; sector: Sector }> = [];
  
  for (const site of sites) {
    for (const sector of site.sectors) {
      flattened.push({ site, sector });
    }
  }
  
  return flattened;
}

