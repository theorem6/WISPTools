// LTE PCI Conflict Detection and Mapping
//
// IMPORTANT: Data Model Hierarchy
// Network > Cell Site (Tower) > Sector > EARFCN/Channel
//
// This "Cell" interface is a FLATTENED representation of a SECTOR for analysis.
// In the proper hierarchy:
// - Cell Site = Physical tower location (has GPS coordinates)
// - Sector = Transmitter on the tower (has azimuth, beamwidth, PCI)
// - Channel = EARFCN with bandwidth (multiple per sector)
//
// This flat format simplifies conflict detection by representing each sector
// as an independent "cell" record with inherited tower coordinates.

import { losService, type LOSResult } from './services/losService';

export interface Cell {
  id: string;                  // Sector ID (inherits from Cell Site)
  eNodeB: number;              // Cell Site eNodeB ID
  sector: number;              // Sector number within the Cell Site
  pci: number;                 // Physical Cell ID (belongs to Sector)
  latitude: number;            // Inherited from Cell Site (tower location)
  longitude: number;           // Inherited from Cell Site (tower location)
  frequency: number;           // Primary frequency in MHz (from Channel)
  rsPower: number;             // Reference signal power (Sector property)
  azimuth?: number;            // Sector azimuth direction (0-359 degrees) - SECTOR property
  beamwidth?: number;          // Sector beamwidth (33-120 degrees) - SECTOR property
  heightAGL?: number;          // Height above ground level in feet - SECTOR property
  towerType?: '3-sector' | '4-sector'; // Cell Site configuration
  technology?: 'LTE' | 'CBRS' | 'LTE+CBRS'; // Sector technology
  
  // LTE Frequency Parameters (from Channel)
  earfcn?: number;             // Primary EARFCN for this sector
  centerFreq?: number;         // Center frequency in MHz (derived from EARFCN)
  channelBandwidth?: 1.4 | 3 | 5 | 10 | 15 | 20; // Channel bandwidth in MHz
  dlEarfcn?: number;           // Downlink EARFCN
  ulEarfcn?: number;           // Uplink EARFCN
}

export interface PCIConflict {
  primaryCell: Cell;
  conflictingCell: Cell;
  conflictType: 'COLLISION' | 'CONFUSION' | 'MOD3' | 'MOD6' | 'MOD12' | 'MOD30' | 'FREQUENCY' | 'ADJACENT_CHANNEL' | 'CO_CHANNEL' | 'FREQUENCY_CONGESTION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNRESOLVABLE';
  distance: number; // in meters
  frequencyOverlap?: boolean; // Whether cells operate on overlapping frequencies
  channelSeparation?: number; // Channel separation in MHz
  hasLineOfSight?: boolean; // Whether sectors have terrain-based LOS
  terrainBlocked?: boolean; // Whether terrain blocks the signal path
  losChecked?: boolean; // Whether LOS analysis was performed
  confusionCount?: number; // For CONFUSION type: how many neighbors share same PCI
  congestedSectors?: Cell[]; // List of all sectors causing frequency congestion
  isUnresolvable?: boolean; // True if conflict cannot be resolved by PCI changes alone
}

export interface PCIConflictAnalysis {
  conflicts: PCIConflict[];
  totalCells: number;
  conflictRate: number;
  recommendations: string[];
}

class PCIMapper {
  /**
   * Calculate maximum propagation distance based on frequency
   * Lower frequencies propagate farther than higher frequencies
   * 
   * Typical cell ranges:
   * - 700-900 MHz (Low Band): 10-30km radius (rural/suburban)
   * - 1700-2100 MHz (Mid Band): 3-10km radius (suburban/urban)
   * - 2300-2600 MHz (Mid Band): 2-5km radius (urban)
   * - 3300-3800 MHz (CBRS/C-Band): 1-3km radius (dense urban)
   * - 24+ GHz (mmWave): 100-500m radius (ultra-dense urban)
   */
  private getMaxPropagationDistance(frequency: number): number {
    // Frequency in MHz
    if (frequency < 1000) {
      // Low band (600-900 MHz) - excellent propagation
      return 30000; // 30km
    } else if (frequency < 1500) {
      // Lower mid band (1400-1500 MHz) - good propagation
      return 15000; // 15km
    } else if (frequency < 2200) {
      // Mid band (1700-2100 MHz) - moderate propagation
      return 10000; // 10km
    } else if (frequency < 2700) {
      // Upper mid band (2300-2600 MHz) - moderate-low propagation
      return 5000; // 5km
    } else if (frequency < 4000) {
      // CBRS/C-Band (3300-3800 MHz) - limited propagation
      return 3000; // 3km
    } else if (frequency < 6000) {
      // Upper bands (4-6 GHz) - short range
      return 2000; // 2km
    } else {
      // mmWave and higher - very short range
      return 500; // 500m
    }
  }

  /**
   * Determine if two cells can potentially interfere based on:
   * 1. Physical distance between cells
   * 2. Maximum propagation range for their frequencies
   * 
   * Cells are considered in separate networks if they're beyond
   * the maximum propagation distance of BOTH cells
   */
  private canCellsInterfere(cell1: Cell, cell2: Cell, distance: number): boolean {
    const freq1 = cell1.centerFreq || cell1.frequency;
    const freq2 = cell2.centerFreq || cell2.frequency;
    
    // Get max propagation for each cell
    const maxRange1 = this.getMaxPropagationDistance(freq1);
    const maxRange2 = this.getMaxPropagationDistance(freq2);
    
    // Use the larger of the two ranges (conservative approach)
    // Cells can interfere if distance is within the propagation range
    const effectiveRange = Math.max(maxRange1, maxRange2);
    
    // Add 20% buffer for edge cases (signal can extend beyond typical range)
    const bufferRange = effectiveRange * 1.2;
    
    return distance <= bufferRange;
  }

  /**
   * LTE EARFCN to Frequency conversion utilities
   */
  private earfcnToFrequency(earfcn: number, isUplink: boolean = false): number {
    // LTE frequency bands and their parameters
    const bandParams: { [key: number]: { dlOffset: number; ulOffset: number; spacing: number; range: [number, number] } } = {
      1: { dlOffset: 2110, ulOffset: 1920, spacing: 0.1, range: [0, 599] },
      2: { dlOffset: 1930, ulOffset: 1850, spacing: 0.1, range: [600, 1199] },
      3: { dlOffset: 1805, ulOffset: 1710, spacing: 0.1, range: [1200, 1949] },
      4: { dlOffset: 2110, ulOffset: 1710, spacing: 0.1, range: [1950, 2399] },
      5: { dlOffset: 869, ulOffset: 824, spacing: 0.1, range: [2400, 2649] },
      7: { dlOffset: 2620, ulOffset: 2500, spacing: 0.1, range: [2750, 3449] },
      8: { dlOffset: 925, ulOffset: 880, spacing: 0.1, range: [3450, 3799] },
      12: { dlOffset: 729, ulOffset: 699, spacing: 0.1, range: [5010, 5179] },
      13: { dlOffset: 746, ulOffset: 777, spacing: 0.1, range: [5180, 5279] },
      14: { dlOffset: 758, ulOffset: 788, spacing: 0.1, range: [5280, 5379] },
      17: { dlOffset: 734, ulOffset: 704, spacing: 0.1, range: [5730, 5849] },
      20: { dlOffset: 791, ulOffset: 832, spacing: 0.1, range: [6150, 6449] },
      25: { dlOffset: 1930, ulOffset: 1850, spacing: 0.1, range: [8040, 8689] },
      26: { dlOffset: 859, ulOffset: 814, spacing: 0.1, range: [8690, 9039] },
      28: { dlOffset: 758, ulOffset: 703, spacing: 0.1, range: [9210, 9659] },
      30: { dlOffset: 2350, ulOffset: 2305, spacing: 0.1, range: [9770, 9869] },
      38: { dlOffset: 2570, ulOffset: 2570, spacing: 0.1, range: [37750, 38249] },
      40: { dlOffset: 2350, ulOffset: 2300, spacing: 0.1, range: [38650, 39649] },
      41: { dlOffset: 2496, ulOffset: 2496, spacing: 0.1, range: [39650, 41589] },
      42: { dlOffset: 3400, ulOffset: 3400, spacing: 0.1, range: [41590, 43589] },
      43: { dlOffset: 3600, ulOffset: 3600, spacing: 0.1, range: [43590, 45589] },
      48: { dlOffset: 3550, ulOffset: 3550, spacing: 0.1, range: [55240, 56739] }, // CBRS
    };

    // Find the band for this EARFCN
    for (const [band, params] of Object.entries(bandParams)) {
      if (earfcn >= params.range[0] && earfcn <= params.range[1]) {
        const offset = isUplink ? params.ulOffset : params.dlOffset;
        return offset + (earfcn - params.range[0]) * params.spacing;
      }
    }

    // Default calculation for unknown bands
    return isUplink ? 1800 + earfcn * 0.1 : 2100 + earfcn * 0.1;
  }

  /**
   * Calculate frequency overlap between two cells
   */
  private calculateFrequencyOverlap(cell1: Cell, cell2: Cell): { overlap: boolean; separation: number; type: 'CO_CHANNEL' | 'ADJACENT' | 'SEPARATED' } {
    const freq1 = cell1.centerFreq || cell1.frequency;
    const freq2 = cell2.centerFreq || cell2.frequency;
    const bw1 = cell1.channelBandwidth || 20; // Default to 20MHz
    const bw2 = cell2.channelBandwidth || 20;

    if (!freq1 || !freq2) {
      return { overlap: false, separation: 0, type: 'SEPARATED' };
    }

    const separation = Math.abs(freq1 - freq2);
    const minSeparation = (bw1 + bw2) / 2;

    if (separation < minSeparation) {
      return { overlap: true, separation, type: 'CO_CHANNEL' };
    } else if (separation < minSeparation + 5) {
      return { overlap: false, separation, type: 'ADJACENT' };
    } else {
      return { overlap: false, separation, type: 'SEPARATED' };
    }
  }

  /**
   * Detect frequency congestion: when more than 3 sectors share the same EARFCN/frequency in proximity
   * This creates an UNRESOLVABLE conflict that cannot be fixed by PCI changes alone
   * 
   * LTE constraint: Maximum 3 unique PCI mod-3 values (0, 1, 2) available for co-channel cells
   * If 4+ sectors on same frequency are in proximity, at least 2 must share the same PCI mod-3,
   * causing unavoidable CRS collision
   */
  private detectFrequencyCongestion(cells: Cell[]): PCIConflict[] {
    const conflicts: PCIConflict[] = [];
    const frequencyGroups = new Map<string, Cell[]>();
    
    // Group cells by EARFCN/frequency
    for (const cell of cells) {
      const earfcn = cell.dlEarfcn || cell.earfcn;
      const freq = cell.centerFreq || cell.frequency;
      
      // Use EARFCN as primary key, fall back to frequency
      const key = earfcn ? `earfcn_${earfcn}` : `freq_${freq}`;
      
      if (!frequencyGroups.has(key)) {
        frequencyGroups.set(key, []);
      }
      frequencyGroups.get(key)!.push(cell);
    }
    
    // Check each frequency group for congestion
    for (const [freqKey, groupCells] of frequencyGroups.entries()) {
      if (groupCells.length <= 3) continue; // 3 or fewer is manageable
      
      // Find cells in proximity (within interference range)
      for (let i = 0; i < groupCells.length; i++) {
        const cell1 = groupCells[i];
        const proximityCells: Cell[] = [cell1];
        
        for (let j = 0; j < groupCells.length; j++) {
          if (i === j) continue;
          
          const cell2 = groupCells[j];
          const distance = this.calculateDistance(cell1, cell2);
          
          // Check if within interference range
          if (this.canCellsInterfere(cell1, cell2, distance) && distance < 10000) {
            proximityCells.push(cell2);
          }
        }
        
        // If more than 3 sectors on same frequency in proximity = UNRESOLVABLE
        if (proximityCells.length > 3) {
          const earfcn = cell1.dlEarfcn || cell1.earfcn || 0;
          const freq = cell1.centerFreq || cell1.frequency;
          
          // Create conflict for each pair showing the congestion
          for (let k = 1; k < Math.min(proximityCells.length, 4); k++) {
            conflicts.push({
              primaryCell: cell1,
              conflictingCell: proximityCells[k],
              conflictType: 'FREQUENCY_CONGESTION',
              severity: 'UNRESOLVABLE',
              distance: this.calculateDistance(cell1, proximityCells[k]),
              frequencyOverlap: true,
              channelSeparation: 0,
              congestedSectors: proximityCells,
              isUnresolvable: true
            });
          }
          
          console.warn(
            `⚠️ UNRESOLVABLE: ${proximityCells.length} sectors on same frequency (EARFCN: ${earfcn}, Freq: ${freq} MHz) within 10km. ` +
            `LTE constraint: Max 3 co-channel sectors can coexist without CRS collision. ` +
            `Solution: Reassign frequencies or relocate sectors.`
          );
          
          break; // Only report once per group
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Check if two cells are on the exact same frequency/EARFCN (co-channel)
   */
  private areCellsCoChannel(cell1: Cell, cell2: Cell): boolean {
    // First check EARFCN (most precise)
    const earfcn1 = cell1.dlEarfcn || cell1.earfcn;
    const earfcn2 = cell2.dlEarfcn || cell2.earfcn;
    
    if (earfcn1 && earfcn2) {
      return earfcn1 === earfcn2;
    }
    
    // Fall back to frequency comparison (within 0.1 MHz tolerance)
    const freq1 = cell1.centerFreq || cell1.frequency;
    const freq2 = cell2.centerFreq || cell2.frequency;
    
    if (freq1 && freq2) {
      return Math.abs(freq1 - freq2) < 0.1;
    }
    
    return false;
  }

  /**
   * Detect PCI conflicts based on LTE standards with Line of Sight analysis
   * Supports:
   * - Traditional 3-sector towers (120 degrees apart)
   * - CBRS 4-sector towers (90 degrees apart)
   * - Frequency-based conflicts (co-channel, adjacent channel)
   * - Terrain-based line of sight checking (reduces conflicts when blocked)
   * - Frequency congestion detection (>3 sectors on same frequency)
   * 
   * PCI conflicts occur when:
   * - CRS (Cell Reference Signal) collision: PCI % 3 = same
   * - PBCH (Physical Broadcast Channel) interference: PCI % 6 = same  
   * - PSS/SSS interference: PCI % 12 = same
   * - PRS interference: PCI % 30 = same
   * - Co-channel frequency overlap with same PCI
   * - Adjacent channel interference with conflicting PCI
   * - Frequency congestion: >3 sectors on same EARFCN in proximity (UNRESOLVABLE)
   * 
   * LOS Integration:
   * - Checks if sectors have line of sight using ArcGIS elevation data
   * - Reduces conflict severity when terrain blocks the signal path
   * - Considers sector azimuth, beamwidth, and height AGL
   */
  async detectConflicts(cells: Cell[], checkLOS: boolean = true): Promise<PCIConflict[]> {
    const conflicts: PCIConflict[] = [];
    
    // First, detect frequency congestion (more than 3 sectors on same frequency in proximity)
    const congestionConflicts = this.detectFrequencyCongestion(cells);
    conflicts.push(...congestionConflicts);
    
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const cell1 = cells[i];
        const cell2 = cells[j];
        
        // Calculate distance between cells (in meters)
        const distance = this.calculateDistance(cell1, cell2);
        
        // Check if cells can interfere based on frequency propagation
        // Cells beyond max propagation range are considered separate networks
        if (!this.canCellsInterfere(cell1, cell2, distance)) {
          continue; // Skip - cells are in separate networks (too far apart)
        }
        
        // Check if cells are on the same tower
        const sameTower = cell1.eNodeB === cell2.eNodeB;
        
        // Skip conflict check if cells are on same tower but different sectors
        // (this is normal for 3-sector/4-sector configurations)
        if (sameTower && cell1.sector !== cell2.sector) {
          // For same tower, check azimuth separation
          const azimuthSeparation = this.calculateAzimuthSeparation(cell1, cell2);
          const expectedSeparation = this.getExpectedAzimuthSeparation(cell1, cell2);
          
          // If sectors are properly separated, skip conflict check
          if (Math.abs(azimuthSeparation - expectedSeparation) < 15) {
            continue;
          }
        }

        // Calculate frequency overlap
        const frequencyInfo = this.calculateFrequencyOverlap(cell1, cell2);
        
        // Check if cells are on exact same frequency/EARFCN (co-channel)
        const isCoChannel = this.areCellsCoChannel(cell1, cell2);
        
        // PRIORITY 1: Check for PCI COLLISION (exact same PCI in proximity)
        // This is the most severe conflict - cells cannot be distinguished
        const conflictTypes: Array<{ 
          type: 'COLLISION' | 'MOD3' | 'MOD6' | 'MOD12' | 'MOD30' | 'FREQUENCY' | 'ADJACENT_CHANNEL' | 'CO_CHANNEL'; 
          value: number; 
          check: (pci1: number, pci2: number) => boolean;
          confusionCount?: number;
        }> = [];
        
        // Exact same PCI = COLLISION
        if (cell1.pci === cell2.pci && distance < 15000) {
          conflictTypes.push({
            type: 'COLLISION' as const,
            value: 0,
            check: () => true
          });
        }
        
        // CO-CHANNEL: Same EARFCN/frequency with any PCI mod-3 conflict
        // This is critical because co-channel interference is strongest
        if (isCoChannel && distance < 10000) {
          // Check for mod-3 conflict (CRS collision risk on same frequency)
          if (cell1.pci % 3 === cell2.pci % 3) {
            conflictTypes.push({
              type: 'CO_CHANNEL' as const,
              value: 0,
              check: () => true
            });
          }
        }
        
        // Standard modulo conflicts (only if within reasonable distance)
        if (distance < 5000 || isCoChannel) {
          conflictTypes.push(
            { type: 'MOD3' as const, value: 3, check: (pci1, pci2) => pci1 % 3 === pci2 % 3 },
            { type: 'MOD6' as const, value: 6, check: (pci1, pci2) => pci1 % 6 === pci2 % 6 },
            { type: 'MOD12' as const, value: 12, check: (pci1, pci2) => pci1 % 12 === pci2 % 12 },
            { type: 'MOD30' as const, value: 30, check: (pci1, pci2) => pci1 % 30 === pci2 % 30 }
          );
        }

        // Frequency overlap conflicts (co-channel or overlapping frequencies)
        if (frequencyInfo.overlap && cell1.pci === cell2.pci) {
          conflictTypes.push({
            type: 'FREQUENCY' as const,
            value: 0,
            check: () => true // Always true for co-channel same PCI
          });
        }

        if (frequencyInfo.type === 'ADJACENT') {
          // Check for adjacent channel PCI conflicts
          const adjacentConflicts = [
            { type: 'MOD3' as const, check: (pci1, pci2) => pci1 % 3 === pci2 % 3 },
            { type: 'MOD6' as const, check: (pci1, pci2) => pci1 % 6 === pci2 % 6 }
          ];
          
          for (const adjConflict of adjacentConflicts) {
            if (adjConflict.check(cell1.pci, cell2.pci)) {
              conflictTypes.push({
                type: 'ADJACENT_CHANNEL' as const,
                value: 0,
                check: () => true
              });
              break;
            }
          }
        }
        // Check line of sight if enabled and sectors have required data
        let losResult: LOSResult | null = null;
        if (checkLOS && cell1.azimuth !== undefined && cell2.azimuth !== undefined) {
          try {
            losResult = await losService.checkLineOfSight(
              cell1.latitude,
              cell1.longitude,
              cell1.heightAGL || 100,
              cell1.azimuth,
              cell1.beamwidth || 65,
              cell2.latitude,
              cell2.longitude,
              cell2.heightAGL || 100,
              cell2.azimuth,
              cell2.beamwidth || 65
            );
          } catch (error) {
            console.warn('LOS check failed, assuming LOS exists:', error);
            losResult = null;
          }
        }
        
        for (const conflictType of conflictTypes) {
          if (conflictType.check(cell1.pci, cell2.pci)) {
            // Calculate base severity
            let severity = this.calculateSeverity(
              conflictType.type, 
              distance, 
              cell1.rsPower, 
              cell2.rsPower, 
              frequencyInfo.overlap
            );
            
            // Reduce severity if no line of sight (terrain blocks signal)
            if (losResult && !losResult.hasLineOfSight) {
              severity = this.reduceSeverityForNoLOS(severity);
            }
            
            conflicts.push({
              primaryCell: cell1,
              conflictingCell: cell2,
              conflictType: conflictType.type,
              severity,
              distance,
              frequencyOverlap: frequencyInfo.overlap,
              channelSeparation: frequencyInfo.separation,
              hasLineOfSight: losResult?.hasLineOfSight,
              terrainBlocked: losResult?.terrainBlocked,
              losChecked: losResult !== null
            });
          }
        }
      }
    }
    
    return conflicts.sort((a, b) => {
      // Sort by severity, then by distance
      const severityOrder = { 'UNRESOLVABLE': 5, 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return severityOrder[b.severity] - severityOrder[a.severity] || a.distance - b.distance;
    });
  }
  
  /**
   * Calculate distance between two cells using Haversine formula
   */
  private calculateDistance(cell1: Cell, cell2: Cell): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(cell2.latitude - cell1.latitude);
    const dLon = this.toRadians(cell2.longitude - cell1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(cell1.latitude)) * Math.cos(this.toRadians(cell2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Calculate azimuth separation between two cells
   */
  private calculateAzimuthSeparation(cell1: Cell, cell2: Cell): number {
    const azimuth1 = cell1.azimuth || this.getDefaultAzimuth(cell1);
    const azimuth2 = cell2.azimuth || this.getDefaultAzimuth(cell2);
    
    let separation = Math.abs(azimuth1 - azimuth2);
    
    // Handle wrap-around (e.g., 350° and 10° are actually 20° apart)
    if (separation > 180) {
      separation = 360 - separation;
    }
    
    return separation;
  }
  
  /**
   * Get default azimuth based on sector number and tower type
   */
  private getDefaultAzimuth(cell: Cell): number {
    const towerType = cell.towerType || '3-sector';
    
    if (towerType === '3-sector') {
      // Traditional 3-sector: sectors at 0°, 120°, 240°
      const sectorAzimuths = [0, 120, 240];
      return sectorAzimuths[(cell.sector - 1) % 3] || 0;
    } else {
      // CBRS 4-sector: sectors at 0°, 90°, 180°, 270°
      const sectorAzimuths = [0, 90, 180, 270];
      return sectorAzimuths[(cell.sector - 1) % 4] || 0;
    }
  }
  
  /**
   * Get expected azimuth separation for tower type
   */
  private getExpectedAzimuthSeparation(cell1: Cell, cell2: Cell): number {
    const towerType = cell1.towerType || cell2.towerType || '3-sector';
    
    if (towerType === '3-sector') {
      // Traditional LTE: 120° separation
      return 120;
    } else {
      // CBRS: 90° separation
      return 90;
    }
  }
  
  /**
   * Reduce conflict severity when there's no line of sight
   * Terrain blocking significantly reduces interference
   */
  private reduceSeverityForNoLOS(severity: PCIConflict['severity']): PCIConflict['severity'] {
    const severityMap: Record<PCIConflict['severity'], PCIConflict['severity']> = {
      'CRITICAL': 'HIGH',     // Critical becomes High (still important but not critical)
      'HIGH': 'MEDIUM',       // High becomes Medium
      'MEDIUM': 'LOW',        // Medium becomes Low
      'LOW': 'LOW'            // Low stays Low (minimal impact)
    };
    
    return severityMap[severity];
  }
  
  /**
   * Calculate conflict severity based on WISP hierarchy:
   * 0. PCI COLLISION = CRITICAL (exact same PCI - cells indistinguishable)
   * 1. Same channel MOD3 conflicts = CRITICAL (CRS collision)
   * 2. Same channel MOD30 = HIGH (PSS/SSS collision)
   * 3. Allow N=1 reuse but reduce PSS/SSS conflicts
   */
  private calculateSeverity(
    conflictType: PCIConflict['conflictType'], 
    distance: number, 
    rsPower1: number, 
    rsPower2: number,
    frequencyOverlap: boolean = false
  ): PCIConflict['severity'] {
    const signalDifference = Math.abs(rsPower1 - rsPower2);
    
    // PRIORITY -1: FREQUENCY CONGESTION - Unresolvable by PCI changes
    if (conflictType === 'FREQUENCY_CONGESTION') {
      return 'UNRESOLVABLE'; // Cannot be fixed without frequency changes
    }
    
    // PRIORITY 0: CO-CHANNEL with MOD3 conflict - Most severe co-channel issue
    if (conflictType === 'CO_CHANNEL') {
      // Same EARFCN with PCI mod-3 conflict = CRS collision
      if (distance < 3000) {
        return 'CRITICAL'; // Very close - severe interference
      } else if (distance < 7000) {
        return 'HIGH'; // Medium distance - significant interference
      } else {
        return 'MEDIUM'; // Farther but still problematic
      }
    }
    
    // PRIORITY 1: PCI COLLISION - exact same PCI (most severe)
    if (conflictType === 'COLLISION') {
      // Cells with same PCI cannot be distinguished by UE
      if (distance < 5000) {
        return 'CRITICAL'; // Very close - definite problem
      } else if (distance < 10000) {
        return 'HIGH'; // Medium distance - likely problem
      } else {
        return 'MEDIUM'; // Far but still within propagation range
      }
    }
    
    // HIERARCHY RULE 1: Same channel MOD3 conflicts are ALWAYS CRITICAL
    if (frequencyOverlap && conflictType === 'MOD3') {
      // MOD3 on same channel causes CRS (Cell Reference Signal) collision
      // This MUST be avoided - highest priority
      if (distance < 5000) { // Within 5km
        return 'CRITICAL';
      } else if (distance < 10000) { // 5-10km
        return 'HIGH';
      }
      return 'MEDIUM';
    }
    
    // HIERARCHY RULE 2: Same channel MOD30 conflicts are HIGH priority
    if (frequencyOverlap && conflictType === 'MOD30') {
      // MOD30 on same channel causes PSS/SSS (synchronization signal) collision
      // Should be avoided, but less critical than MOD3
      if (distance < 3000 && signalDifference < 6) {
        return 'HIGH'; // Not CRITICAL, but important to fix
      } else if (distance < 8000) {
        return 'MEDIUM';
      }
      return 'LOW';
    }
    
    // HIERARCHY RULE 3: Same channel, same PCI (co-channel interference)
    if (frequencyOverlap && conflictType === 'FREQUENCY') {
      // This is N=1 reuse territory - can be allowed if far enough apart
      if (distance < 2000) {
        return 'CRITICAL'; // Too close for N=1 reuse
      } else if (distance < 5000) {
        return 'HIGH';
      } else if (distance < 10000) {
        return 'MEDIUM'; // N=1 reuse acceptable at this distance
      }
      return 'LOW'; // Far enough for N=1 reuse
    }
    
    // Different channels have relaxed rules (interference is lower)
    const thresholds = {
      ADJACENT_CHANNEL: {
        critical: 500,
        high: 1000,
        medium: 2000
      },
      MOD3: { 
        critical: 300,  // Less critical on different channels
        high: 800, 
        medium: 2000 
      },
      MOD6: { 
        critical: 200, 
        high: 600, 
        medium: 1500 
      },
      MOD12: { 
        critical: 150, 
        high: 400, 
        medium: 1000 
      },
      MOD30: { 
        critical: 100,  // PSS/SSS reuse less critical on different channels
        high: 300, 
        medium: 800 
      }
    };
    
    const threshold = thresholds[conflictType];
    if (!threshold) return 'LOW';
    
    // For different channels, use standard thresholds
    if (distance < threshold.critical && signalDifference < 6) {
      return 'CRITICAL';
    } else if (distance < threshold.high && signalDifference < 9) {
      return 'HIGH';
    } else if (distance < threshold.medium && signalDifference < 12) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }
  
  /**
   * Generate PCI value suggestions to resolve conflicts
   */
  suggestPCI(cells: Cell[], maxPCI = 503): number[] {
    const usedPCIs = new Set(cells.map(cell => cell.pci));
    const suggestions: number[] = [];
    
    // Generate PCI suggestions avoiding conflicts
    for (let pci = 0; pci <= maxPCI; pci++) {
      if (usedPCIs.has(pci)) continue;
      
      // Check if this PCI would conflict with existing cells
      const wouldConflict = cells.some(cell => {
        const checks = [
          pci % 3 === cell.pci % 3,
          pci % 6 === cell.pci % 6,
          pci % 12 === cell.pci % 12,
          pci % 30 === cell.pci % 30
        ];
        return checks.some(check => check);
      });
      
      if (!wouldConflict) {
        suggestions.push(pci);
      }
      
      if (suggestions.length >= 10) break; // Limit suggestions
    }
    
    return suggestions;
  }
  
  /**
   * Perform comprehensive PCI conflict analysis with optional LOS checking
   */
  async analyzeConflicts(cells: Cell[], checkLOS: boolean = true): Promise<PCIConflictAnalysis> {
    const conflicts = await this.detectConflicts(cells, checkLOS);
    const conflictRate = cells.length > 0 ? (conflicts.length / cells.length) * 100 : 0;
    
    const recommendations = this.generateRecommendations(conflicts);
    
    return {
      conflicts,
      totalCells: cells.length,
      conflictRate,
      recommendations
    };
  }
  
  private generateRecommendations(conflicts: PCIConflict[]): string[] {
    const recommendations: string[] = [];
    
    if (conflicts.length === 0) {
      recommendations.push('✓ No PCI conflicts detected. Network configuration is optimal.');
      recommendations.push('Note: Analysis uses frequency-based propagation models and terrain-based LOS to identify conflicts.');
      return recommendations;
    }
    
    const criticalConflicts = conflicts.filter(c => c.severity === 'CRITICAL');
    const highConflicts = conflicts.filter(c => c.severity === 'HIGH');
    
    // Check LOS statistics
    const losCheckedConflicts = conflicts.filter(c => c.losChecked);
    const blockedConflicts = conflicts.filter(c => c.terrainBlocked);
    const losConflicts = conflicts.filter(c => c.losChecked && c.hasLineOfSight);
    
    if (criticalConflicts.length > 0) {
      recommendations.push(`URGENT: ${criticalConflicts.length} critical PCI conflicts detected requiring immediate attention.`);
    }
    
    if (highConflicts.length > 0) {
      recommendations.push(`${highConflicts.length} high-priority PCI conflicts should be resolved soon.`);
    }
    
    // Add LOS analysis recommendations
    if (losCheckedConflicts.length > 0) {
      recommendations.push(`🗻 Terrain Analysis: ${losCheckedConflicts.length} conflicts checked for line-of-sight.`);
      
      if (blockedConflicts.length > 0) {
        recommendations.push(`✓ ${blockedConflicts.length} conflicts have terrain blocking - reduced severity due to natural RF shielding.`);
      }
      
      if (losConflicts.length > 0 && blockedConflicts.length > 0) {
        recommendations.push(`⚠️ ${losConflicts.length} conflicts have clear line of sight - these are highest priority.`);
      }
    } else {
      recommendations.push('Note: Enable sector azimuth/height data for terrain-based LOS analysis.');
    }
    
    // Add propagation-aware note
    recommendations.push('⚡ Smart Network Analysis: Cells beyond maximum propagation range are treated as separate networks.');
    
    // Tower configuration recommendations
    const threeSectorCells = conflicts.filter(c => 
      c.primaryCell.towerType === '3-sector' || c.conflictingCell.towerType === '3-sector'
    );
    const fourSectorCells = conflicts.filter(c => 
      c.primaryCell.towerType === '4-sector' || c.conflictingCell.towerType === '4-sector'
    );
    
    if (threeSectorCells.length > 0) {
      recommendations.push(`${threeSectorCells.length} conflicts involve 3-sector towers (120° separation) - verify sector azimuths.`);
    }
    
    if (fourSectorCells.length > 0) {
      recommendations.push(`${fourSectorCells.length} conflicts involve CBRS 4-sector towers (90° separation) - verify sector alignment.`);
    }
    
    // Frequency-specific recommendations
    const mod3Conflicts = conflicts.filter(c => c.conflictType === 'MOD3');
    if (mod3Conflicts.length > 0) {
      recommendations.push('Mod3 conflicts detected: Consider frequency-domain optimization.');
    }
    
    const mod6Conflicts = conflicts.filter(c => c.conflictType === 'MOD6');
    if (mod6Conflicts.length > 0) {
      recommendations.push('Mod6 conflicts detected: Review PBCH configuration.');
    }
    
    // Geographic recommendations
    const closeConflicts = conflicts.filter(c => c.distance < 1000);
    if (closeConflicts.length > 0) {
      recommendations.push(`${closeConflicts.length} conflicts occur within 1km radius - review site locations.`);
    }
    
    recommendations.push('Consider implementing automated PCI assignment algorithms.');
    recommendations.push('For mixed 3-sector/4-sector deployments, use separate PCI pools.');
    recommendations.push('Regular PCI audits recommended to maintain optimal performance.');
    
    // Add frequency band information
    const lowBandCells = conflicts.filter(c => {
      const freq1 = c.primaryCell.centerFreq || c.primaryCell.frequency;
      const freq2 = c.conflictingCell.centerFreq || c.conflictingCell.frequency;
      return freq1 < 1000 || freq2 < 1000;
    });
    
    const midBandCells = conflicts.filter(c => {
      const freq1 = c.primaryCell.centerFreq || c.primaryCell.frequency;
      const freq2 = c.conflictingCell.centerFreq || c.conflictingCell.frequency;
      return (freq1 >= 1700 && freq1 <= 2600) || (freq2 >= 1700 && freq2 <= 2600);
    });
    
    const cBandCells = conflicts.filter(c => {
      const freq1 = c.primaryCell.centerFreq || c.primaryCell.frequency;
      const freq2 = c.conflictingCell.centerFreq || c.conflictingCell.frequency;
      return (freq1 >= 3300 && freq1 <= 3800) || (freq2 >= 3300 && freq2 <= 3800);
    });
    
    if (lowBandCells.length > 0) {
      recommendations.push(`📡 ${lowBandCells.length} conflicts in low-band (600-900MHz) - propagation range: up to 30km`);
    }
    if (midBandCells.length > 0) {
      recommendations.push(`📡 ${midBandCells.length} conflicts in mid-band (1700-2600MHz) - propagation range: 3-10km`);
    }
    if (cBandCells.length > 0) {
      recommendations.push(`📡 ${cBandCells.length} conflicts in CBRS/C-Band (3300-3800MHz) - propagation range: 1-3km`);
    }
    
    return recommendations;
  }

  /**
   * Get propagation range for a cell (public method for external use)
   */
  getPropagationRange(cell: Cell): number {
    const freq = cell.centerFreq || cell.frequency;
    return this.getMaxPropagationDistance(freq);
  }
}

export const pciMapper = new PCIMapper();
