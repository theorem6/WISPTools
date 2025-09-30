// LTE PCI Conflict Detection and Mapping
export interface Cell {
  id: string;
  eNodeB: number;
  sector: number;
  pci: number;
  latitude: number;
  longitude: number;
  frequency: number;
  rsPower: number;
  azimuth?: number; // Sector azimuth direction (0-359 degrees)
  towerType?: '3-sector' | '4-sector'; // Tower configuration
  technology?: 'LTE' | 'CBRS' | 'LTE+CBRS'; // Technology type
}

export interface PCIConflict {
  primaryCell: Cell;
  conflictingCell: Cell;
  conflictType: 'MOD3' | 'MOD6' | 'MOD12' | 'MOD30';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  distance: number; // in meters
}

export interface PCIConflictAnalysis {
  conflicts: PCIConflict[];
  totalCells: number;
  conflictRate: number;
  recommendations: string[];
}

class PCIMapper {
  /**
   * Detect PCI conflicts based on LTE standards
   * Supports:
   * - Traditional 3-sector towers (120 degrees apart)
   * - CBRS 4-sector towers (90 degrees apart)
   * 
   * PCI conflicts occur when:
   * - CRS (Cell Reference Signal) collision: PCI % 3 = same
   * - PBCH (Physical Broadcast Channel) interference: PCI % 6 = same  
   * - PSS/SSS interference: PCI % 12 = same
   * - PRS interference: PCI % 30 = same
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
        
        // Check for different types of conflicts
        const conflictTypes = [
          { type: 'MOD3' as const, value: 3, check: (pci1, pci2) => pci1 % 3 === pci2 % 3 },
          { type: 'MOD6' as const, value: 6, check: (pci1, pci2) => pci1 % 6 === pci2 % 6 },
          { type: 'MOD12' as const, value: 12, check: (pci1, pci2) => pci1 % 12 === pci2 % 12 },
          { type: 'MOD30' as const, value: 30, check: (pci1, pci2) => pci1 % 30 === pci2 % 30 }
        ];
        
        for (const conflictType of conflictTypes) {
          if (conflictType.check(cell1.pci, cell2.pci)) {
            const severity = this.calculateSeverity(conflictType.type, distance, cell1.rsPower, cell2.rsPower);
            
            conflicts.push({
              primaryCell: cell1,
              conflictingCell: cell2,
              conflictType: conflictType.type,
              severity,
              distance
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
    rsPower2: number
  ): PCIConflict['severity'] {
    const signalDifference = Math.abs(rsPower1 - rsPower2);
    
    // Define severity thresholds
    const thresholds = {
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
