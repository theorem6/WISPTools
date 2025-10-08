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
  heightAGL: number;       // Height above ground level in feet
  rmodId?: number;         // Radio Module ID (1-3) for Nokia configurations
  channels: Channel[];     // Multiple carriers/channels per sector (transmitter)
  rsPower: number;         // Reference signal power (dBm)
  technology: 'LTE' | 'CBRS' | '5G';
}

export interface Channel {
  id?: string;             // Unique channel/carrier ID
  name?: string;           // Optional carrier name
  dlEarfcn: number;        // Downlink EARFCN
  ulEarfcn: number;        // Uplink EARFCN  
  centerFreq: number;      // Center frequency in MHz
  channelBandwidth: number; // Bandwidth in MHz (1.4, 3, 5, 10, 15, 20)
  pci: number;             // Physical Cell ID (0-503) - Each carrier has its own PCI
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
 * Groups cells by eNodeB and sector number
 * If multiple cells share same eNodeB+sector, they become carriers on the same sector
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
    
    // Check if sector already exists
    let sector = site.sectors.find(s => s.sectorNumber === legacyCell.sector);
    
    if (!sector) {
      // Create new sector
      sector = {
        id: `${siteId}-SEC${legacyCell.sector}`,
        sectorNumber: legacyCell.sector,
        azimuth: legacyCell.azimuth || 0,
        beamwidth: (legacyCell as any).beamwidth || 65,
        heightAGL: (legacyCell as any).heightAGL || 100,
        rmodId: ((legacyCell.sector - 1) % 3) + 1,
        channels: [],
        rsPower: legacyCell.rsPower,
        technology: legacyCell.technology || 'LTE'
      };
      site.sectors.push(sector);
    }
    
    // Add carrier/channel to the sector
    const carrierNumber = sector.channels.length + 1;
    sector.channels.push({
      id: legacyCell.id, // Use original cell ID as carrier ID
      name: `Carrier ${carrierNumber}`,
      dlEarfcn: legacyCell.dlEarfcn || legacyCell.earfcn || 0,
      ulEarfcn: legacyCell.ulEarfcn || 0,
      centerFreq: legacyCell.centerFreq || legacyCell.frequency || 0,
      channelBandwidth: legacyCell.channelBandwidth || 20,
      pci: legacyCell.pci,
      isPrimary: carrierNumber === 1 // First carrier is primary
    });
  }
  
  return Array.from(sitesMap.values());
}

/**
 * Convert CellSite format back to legacy format for compatibility
 * NOW EXPORTS ALL CARRIERS: Each carrier/channel gets its own "cell" record for PCI conflict analysis
 * This is critical because each RMOD can have multiple carriers with different PCIs
 */
export function convertCellSiteToLegacy(sites: CellSite[]): LegacyCell[] {
  const legacyCells: LegacyCell[] = [];
  
  for (const site of sites) {
    for (const sector of site.sectors) {
      // Export ALL channels/carriers, not just the primary
      // Each carrier has its own PCI and must be checked independently
      for (let channelIndex = 0; channelIndex < sector.channels.length; channelIndex++) {
        const channel = sector.channels[channelIndex];
        
        // Create unique ID for each carrier
        const carrierId = channel.id || `${sector.id}-CH${channelIndex + 1}`;
        
        legacyCells.push({
          id: carrierId,
          eNodeB: site.eNodeB,
          sector: sector.sectorNumber,
          pci: channel.pci, // Each carrier has its own PCI
          latitude: site.latitude, // All sectors share the site's GPS coordinate
          longitude: site.longitude, // All sectors share the site's GPS coordinate
          frequency: channel.centerFreq,
          rsPower: sector.rsPower,
          azimuth: sector.azimuth,
          technology: sector.technology,
          earfcn: channel.dlEarfcn,
          centerFreq: channel.centerFreq,
          channelBandwidth: channel.channelBandwidth,
          dlEarfcn: channel.dlEarfcn,
          ulEarfcn: channel.ulEarfcn,
          beamwidth: sector.beamwidth,
          heightAGL: sector.heightAGL
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

