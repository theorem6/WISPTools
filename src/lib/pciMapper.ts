// LTE PCI Conflict Detection and Mapping
export interface Cell {
  id: string;
  eNodeB: number;
  sector: number;
  pci: number;
  latitude: number;
  longitude: number;
  frequency: number; // Legacy field - center frequency in MHz
  rsPower: number;
  azimuth?: number; // Sector azimuth direction (0-359 degrees)
  towerType?: '3-sector' | '4-sector'; // Tower configuration
  technology?: 'LTE' | 'CBRS' | 'LTE+CBRS'; // Technology type
  
  // LTE Frequency Parameters
  earfcn?: number; // LTE EARFCN (E-UTRA Absolute Radio Frequency Channel Number)
  centerFreq?: number; // Center frequency in MHz (derived from EARFCN)
  channelBandwidth?: 1.4 | 3 | 5 | 10 | 15 | 20; // Channel bandwidth in MHz
  dlEarfcn?: number; // Downlink EARFCN (if different from earfcn)
  ulEarfcn?: number; // Uplink EARFCN (if different from earfcn)
}

export interface PCIConflict {
  primaryCell: Cell;
  conflictingCell: Cell;
  conflictType: 'MOD3' | 'MOD6' | 'MOD12' | 'MOD30' | 'FREQUENCY' | 'ADJACENT_CHANNEL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  distance: number; // in meters
  frequencyOverlap?: boolean; // Whether cells operate on overlapping frequencies
  channelSeparation?: number; // Channel separation in MHz
}

export interface PCIConflictAnalysis {
  conflicts: PCIConflict[];
  totalCells: number;
  conflictRate: number;
  recommendations: string[];
}

class PCIMapper {
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
   * Detect PCI conflicts based on LTE standards
   * Supports:
   * - Traditional 3-sector towers (120 degrees apart)
   * - CBRS 4-sector towers (90 degrees apart)
   * - Frequency-based conflicts (co-channel, adjacent channel)
   * 
   * PCI conflicts occur when:
   * - CRS (Cell Reference Signal) collision: PCI % 3 = same
   * - PBCH (Physical Broadcast Channel) interference: PCI % 6 = same  
   * - PSS/SSS interference: PCI % 12 = same
   * - PRS interference: PCI % 30 = same
   * - Co-channel frequency overlap with same PCI
   * - Adjacent channel interference with conflicting PCI
   */
  detectConflicts(cells: Cell[]): PCIConflict[] {
    const conflicts: PCIConflict[] = [];
    
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const cell1 = cells[i];
        const cell2 = cells[j];
        
        // Calculate distance between cells (in meters)
        const distance = this.calculateDistance(cell1, cell2);
        
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
        
        // Check for different types of conflicts
        const conflictTypes = [
          { type: 'MOD3' as const, value: 3, check: (pci1, pci2) => pci1 % 3 === pci2 % 3 },
          { type: 'MOD6' as const, value: 6, check: (pci1, pci2) => pci1 % 6 === pci2 % 6 },
          { type: 'MOD12' as const, value: 12, check: (pci1, pci2) => pci1 % 12 === pci2 % 12 },
          { type: 'MOD30' as const, value: 30, check: (pci1, pci2) => pci1 % 30 === pci2 % 30 }
        ];

        // Add frequency-based conflicts
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
        
        for (const conflictType of conflictTypes) {
          if (conflictType.check(cell1.pci, cell2.pci)) {
            const severity = this.calculateSeverity(conflictType.type, distance, cell1.rsPower, cell2.rsPower, frequencyInfo.overlap);
            
            conflicts.push({
              primaryCell: cell1,
              conflictingCell: cell2,
              conflictType: conflictType.type,
              severity,
              distance,
              frequencyOverlap: frequencyInfo.overlap,
              channelSeparation: frequencyInfo.separation
            });
          }
        }
      }
    }
    
    return conflicts.sort((a, b) => {
      // Sort by severity, then by distance
      const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
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
   * Calculate conflict severity based on conflict type, distance, and signal power
   */
  private calculateSeverity(
    conflictType: PCIConflict['conflictType'], 
    distance: number, 
    rsPower1: number, 
    rsPower2: number,
    frequencyOverlap: boolean = false
  ): PCIConflict['severity'] {
    const signalDifference = Math.abs(rsPower1 - rsPower2);
    
    // Define severity thresholds
    const thresholds = {
      FREQUENCY: {
        critical: 1000,
        high: 2000,
        medium: 5000
      },
      ADJACENT_CHANNEL: {
        critical: 500,
        high: 1000,
        medium: 2000
      },
      MOD3: { 
        critical: 500, 
        high: 1000, 
        medium: 2000 
      },
      MOD6: { 
        critical: 300, 
        high: 700, 
        medium: 1500 
      },
      MOD12: { 
        critical: 200, 
        high: 500, 
        medium: 1000 
      },
      MOD30: { 
        critical: 100, 
        high: 300, 
        medium: 600 
      }
    };
    
    const threshold = thresholds[conflictType];
    
    // Frequency overlap increases severity
    const frequencyMultiplier = frequencyOverlap ? 0.5 : 1.0;
    const adjustedDistance = distance * frequencyMultiplier;
    
    if (adjustedDistance < threshold.critical && signalDifference < 6) {
      return 'CRITICAL';
    } else if (adjustedDistance < threshold.high && signalDifference < 9) {
      return 'HIGH';
    } else if (adjustedDistance < threshold.medium && signalDifference < 12) {
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
   * Perform comprehensive PCI conflict analysis
   */
  analyzeConflicts(cells: Cell[]): PCIConflictAnalysis {
    const conflicts = this.detectConflicts(cells);
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
      recommendations.push('No PCI conflicts detected. Network configuration is optimal.');
      return recommendations;
    }
    
    const criticalConflicts = conflicts.filter(c => c.severity === 'CRITICAL');
    const highConflicts = conflicts.filter(c => c.severity === 'HIGH');
    
    if (criticalConflicts.length > 0) {
      recommendations.push(`URGENT: ${criticalConflicts.length} critical PCI conflicts detected requiring immediate attention.`);
    }
    
    if (highConflicts.length > 0) {
      recommendations.push(`${highConflicts.length} high-priority PCI conflicts should be resolved soon.`);
    }
    
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
    
    return recommendations;
  }
}

export const pciMapper = new PCIMapper();
