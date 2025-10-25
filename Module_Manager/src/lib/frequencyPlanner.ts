/**
 * Frequency Planner for FWA Tower Management
 * Handles frequency conflict detection and optimization for FWA towers
 */

export interface FrequencyChannel {
  frequency: number; // MHz
  bandwidth: number; // MHz
  vendor: string;
  power: number; // dBm
}

export interface TowerSector {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  azimuth: number; // degrees (0-360)
  antennaHeight: number; // meters above ground
  vendor: string;
  frequency: FrequencyChannel;
  radCenterHeight: number; // meters above ground (antenna center)
  towerId: string;
  sectorId: string;
}

export interface FrequencyConflict {
  id: string;
  type: 'LOS_INTERFERENCE' | 'VENDOR_SPACING' | 'BACK_TO_BACK_REUSE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  sector1: TowerSector;
  sector2: TowerSector;
  description: string;
  distance: number; // meters
  suggestedAction: string;
  interferenceLevel: number; // dB
}

export interface FrequencyOptimization {
  sectorId: string;
  currentFrequency: FrequencyChannel;
  suggestedFrequency: FrequencyChannel;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  expectedImprovement: number; // dB reduction in interference
}

export interface FrequencyPlan {
  sectors: TowerSector[];
  conflicts: FrequencyConflict[];
  optimizations: FrequencyOptimization[];
  totalInterference: number; // dB
  planScore: number; // 0-100 (higher is better)
}

export class FrequencyPlanner {
  private sectors: TowerSector[] = [];
  private conflicts: FrequencyConflict[] = [];
  private optimizations: FrequencyOptimization[] = [];

  // Available frequency bands for FWA
  private readonly AVAILABLE_FREQUENCIES = [
    // CBRS Band (3.55-3.7 GHz)
    { frequency: 3550, bandwidth: 20 },
    { frequency: 3570, bandwidth: 20 },
    { frequency: 3590, bandwidth: 20 },
    { frequency: 3610, bandwidth: 20 },
    { frequency: 3630, bandwidth: 20 },
    { frequency: 3650, bandwidth: 20 },
    { frequency: 3670, bandwidth: 20 },
    { frequency: 3690, bandwidth: 20 },
    
    // 5.8 GHz Band
    { frequency: 5800, bandwidth: 20 },
    { frequency: 5820, bandwidth: 20 },
    { frequency: 5840, bandwidth: 20 },
    { frequency: 5860, bandwidth: 20 },
    
    // 6 GHz Band
    { frequency: 6000, bandwidth: 20 },
    { frequency: 6020, bandwidth: 20 },
    { frequency: 6040, bandwidth: 20 },
    { frequency: 6060, bandwidth: 20 },
  ];

  constructor() {
    console.log('[FrequencyPlanner] Initialized');
  }

  /**
   * Add sectors to the frequency planner
   */
  addSectors(sectors: TowerSector[]): void {
    this.sectors = [...this.sectors, ...sectors];
    console.log(`[FrequencyPlanner] Added ${sectors.length} sectors. Total: ${this.sectors.length}`);
  }

  /**
   * Clear all sectors and reset planner
   */
  clearSectors(): void {
    this.sectors = [];
    this.conflicts = [];
    this.optimizations = [];
    console.log('[FrequencyPlanner] Cleared all sectors');
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate azimuth difference between two sectors
   */
  private calculateAzimuthDifference(azimuth1: number, azimuth2: number): number {
    let diff = Math.abs(azimuth1 - azimuth2);
    if (diff > 180) {
      diff = 360 - diff;
    }
    return diff;
  }

  /**
   * Check if two sectors are facing each other (LOS)
   */
  private areSectorsFacingEachOther(sector1: TowerSector, sector2: TowerSector): boolean {
    const azimuthDiff = this.calculateAzimuthDifference(sector1.azimuth, sector2.azimuth);
    
    // Sectors are facing each other if azimuth difference is between 150-210 degrees
    // This accounts for antenna beamwidth and sector overlap
    return azimuthDiff >= 150 && azimuthDiff <= 210;
  }

  /**
   * Check if two sectors are back-to-back
   */
  private areSectorsBackToBack(sector1: TowerSector, sector2: TowerSector): boolean {
    const azimuthDiff = this.calculateAzimuthDifference(sector1.azimuth, sector2.azimuth);
    
    // Sectors are back-to-back if azimuth difference is between 150-210 degrees
    // and they're on the same tower
    return sector1.towerId === sector2.towerId && azimuthDiff >= 150 && azimuthDiff <= 210;
  }

  /**
   * Check if two frequency channels overlap
   */
  private doFrequenciesOverlap(freq1: FrequencyChannel, freq2: FrequencyChannel): boolean {
    const freq1Start = freq1.frequency - freq1.bandwidth / 2;
    const freq1End = freq1.frequency + freq1.bandwidth / 2;
    const freq2Start = freq2.frequency - freq2.bandwidth / 2;
    const freq2End = freq2.frequency + freq2.bandwidth / 2;

    return !(freq1End <= freq2Start || freq2End <= freq1Start);
  }

  /**
   * Calculate interference level between two sectors
   */
  private calculateInterferenceLevel(sector1: TowerSector, sector2: TowerSector): number {
    const distance = this.calculateDistance(
      sector1.latitude, sector1.longitude,
      sector2.latitude, sector2.longitude
    );

    // Free space path loss calculation
    const frequency = (sector1.frequency.frequency + sector2.frequency.frequency) / 2;
    const pathLoss = 20 * Math.log10(distance) + 20 * Math.log10(frequency) - 147.55;
    
    // Additional factors
    const heightFactor = Math.abs(sector1.radCenterHeight - sector2.radCenterHeight) * 0.1;
    const powerDifference = Math.abs(sector1.frequency.power - sector2.frequency.power);
    
    // Calculate interference level (negative dB means interference)
    const interference = sector1.frequency.power - pathLoss - heightFactor - powerDifference;
    
    return interference;
  }

  /**
   * Detect LOS interference conflicts
   */
  private detectLOSInterference(): FrequencyConflict[] {
    const conflicts: FrequencyConflict[] = [];

    for (let i = 0; i < this.sectors.length; i++) {
      for (let j = i + 1; j < this.sectors.length; j++) {
        const sector1 = this.sectors[i];
        const sector2 = this.sectors[j];

        // Check if sectors are facing each other and frequencies overlap
        if (this.areSectorsFacingEachOther(sector1, sector2) && 
            this.doFrequenciesOverlap(sector1.frequency, sector2.frequency)) {
          
          const distance = this.calculateDistance(
            sector1.latitude, sector1.longitude,
            sector2.latitude, sector2.longitude
          );

          const interferenceLevel = this.calculateInterferenceLevel(sector1, sector2);
          
          // Determine severity based on interference level
          let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
          if (interferenceLevel > -60) severity = 'HIGH';
          else if (interferenceLevel > -80) severity = 'MEDIUM';

          const conflict: FrequencyConflict = {
            id: `los_${sector1.id}_${sector2.id}`,
            type: 'LOS_INTERFERENCE',
            severity,
            sector1,
            sector2,
            description: `LOS interference between ${sector1.name} and ${sector2.name}. Same frequency/bandwidth facing each other.`,
            distance,
            suggestedAction: `Change frequency or bandwidth for ${sector1.name} or ${sector2.name}`,
            interferenceLevel
          };

          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect vendor vertical spacing conflicts
   */
  private detectVendorSpacingConflicts(): FrequencyConflict[] {
    const conflicts: FrequencyConflict[] = [];

    // Group sectors by tower
    const sectorsByTower = new Map<string, TowerSector[]>();
    this.sectors.forEach(sector => {
      if (!sectorsByTower.has(sector.towerId)) {
        sectorsByTower.set(sector.towerId, []);
      }
      sectorsByTower.get(sector.towerId)!.push(sector);
    });

    // Check each tower for vendor spacing issues
    sectorsByTower.forEach((towerSectors, towerId) => {
      for (let i = 0; i < towerSectors.length; i++) {
        for (let j = i + 1; j < towerSectors.length; j++) {
          const sector1 = towerSectors[i];
          const sector2 = towerSectors[j];

          // Check if different vendors on same tower
          if (sector1.vendor !== sector2.vendor) {
            const heightDifference = Math.abs(sector1.radCenterHeight - sector2.radCenterHeight);
            
            if (heightDifference < 10) {
              const severity: 'HIGH' | 'MEDIUM' | 'LOW' = heightDifference < 5 ? 'HIGH' : 'MEDIUM';
              
              const conflict: FrequencyConflict = {
                id: `vendor_${sector1.id}_${sector2.id}`,
                type: 'VENDOR_SPACING',
                severity,
                sector1,
                sector2,
                description: `Insufficient vertical spacing between ${sector1.vendor} and ${sector2.vendor} on tower ${towerId}`,
                distance: heightDifference,
                suggestedAction: `Increase vertical spacing to minimum 10m between ${sector1.vendor} and ${sector2.vendor}`,
                interferenceLevel: 10 - heightDifference // Closer = higher interference
              };

              conflicts.push(conflict);
            }
          }
        }
      }
    });

    return conflicts;
  }

  /**
   * Detect back-to-back frequency reuse opportunities
   */
  private detectBackToBackReuse(): FrequencyConflict[] {
    const conflicts: FrequencyConflict[] = [];

    for (let i = 0; i < this.sectors.length; i++) {
      for (let j = i + 1; j < this.sectors.length; j++) {
        const sector1 = this.sectors[i];
        const sector2 = this.sectors[j];

        // Check if sectors are back-to-back
        if (this.areSectorsBackToBack(sector1, sector2)) {
          // Back-to-back sectors can reuse frequencies without penalty
          // This is actually a positive finding, not a conflict
          const conflict: FrequencyConflict = {
            id: `backtoback_${sector1.id}_${sector2.id}`,
            type: 'BACK_TO_BACK_REUSE',
            severity: 'LOW',
            sector1,
            sector2,
            description: `Back-to-back sectors can reuse frequency ${sector1.frequency.frequency}MHz without penalty`,
            distance: 0, // Same tower
            suggestedAction: `Consider reusing frequency ${sector1.frequency.frequency}MHz for ${sector2.name}`,
            interferenceLevel: -100 // Very low interference
          };

          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Perform comprehensive frequency conflict analysis
   */
  analyzeConflicts(): FrequencyConflict[] {
    console.log('[FrequencyPlanner] Starting conflict analysis...');
    
    this.conflicts = [];
    
    // Detect different types of conflicts
    const losConflicts = this.detectLOSInterference();
    const vendorConflicts = this.detectVendorSpacingConflicts();
    const backToBackConflicts = this.detectBackToBackReuse();
    
    this.conflicts = [...losConflicts, ...vendorConflicts, ...backToBackConflicts];
    
    console.log(`[FrequencyPlanner] Found ${this.conflicts.length} conflicts:`, {
      los: losConflicts.length,
      vendor: vendorConflicts.length,
      backToBack: backToBackConflicts.length
    });
    
    return this.conflicts;
  }

  /**
   * Generate frequency optimization suggestions
   */
  generateOptimizations(): FrequencyOptimization[] {
    console.log('[FrequencyPlanner] Generating optimization suggestions...');
    
    this.optimizations = [];
    
    // Find sectors with high interference conflicts
    const highInterferenceConflicts = this.conflicts.filter(
      conflict => conflict.severity === 'HIGH' && conflict.type === 'LOS_INTERFERENCE'
    );
    
    highInterferenceConflicts.forEach(conflict => {
      // Suggest alternative frequencies for the first sector
      const alternativeFreq = this.findAlternativeFrequency(conflict.sector1, conflict.sector2);
      
      if (alternativeFreq) {
        const optimization: FrequencyOptimization = {
          sectorId: conflict.sector1.id,
          currentFrequency: conflict.sector1.frequency,
          suggestedFrequency: alternativeFreq,
          reason: `Reduce interference with ${conflict.sector2.name}`,
          priority: 'HIGH',
          expectedImprovement: Math.abs(conflict.interferenceLevel)
        };
        
        this.optimizations.push(optimization);
      }
    });
    
    console.log(`[FrequencyPlanner] Generated ${this.optimizations.length} optimization suggestions`);
    
    return this.optimizations;
  }

  /**
   * Find alternative frequency for a sector
   */
  private findAlternativeFrequency(targetSector: TowerSector, conflictingSector: TowerSector): FrequencyChannel | null {
    // Find frequencies that don't conflict with the conflicting sector
    for (const freq of this.AVAILABLE_FREQUENCIES) {
      const testChannel: FrequencyChannel = {
        frequency: freq.frequency,
        bandwidth: freq.bandwidth,
        vendor: targetSector.frequency.vendor,
        power: targetSector.frequency.power
      };
      
      // Check if this frequency conflicts with the conflicting sector
      if (!this.doFrequenciesOverlap(testChannel, conflictingSector.frequency)) {
        return testChannel;
      }
    }
    
    return null;
  }

  /**
   * Calculate overall plan score
   */
  calculatePlanScore(): number {
    const totalConflicts = this.conflicts.length;
    const highSeverityConflicts = this.conflicts.filter(c => c.severity === 'HIGH').length;
    const mediumSeverityConflicts = this.conflicts.filter(c => c.severity === 'MEDIUM').length;
    
    // Calculate score (0-100, higher is better)
    let score = 100;
    score -= highSeverityConflicts * 20; // High severity conflicts are heavily penalized
    score -= mediumSeverityConflicts * 10; // Medium severity conflicts are moderately penalized
    score -= totalConflicts * 2; // Each conflict reduces score slightly
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate comprehensive frequency plan
   */
  generateFrequencyPlan(): FrequencyPlan {
    console.log('[FrequencyPlanner] Generating comprehensive frequency plan...');
    
    const conflicts = this.analyzeConflicts();
    const optimizations = this.generateOptimizations();
    const planScore = this.calculatePlanScore();
    
    // Calculate total interference
    const totalInterference = conflicts.reduce((sum, conflict) => {
      return sum + Math.abs(conflict.interferenceLevel);
    }, 0);
    
    const plan: FrequencyPlan = {
      sectors: this.sectors,
      conflicts,
      optimizations,
      totalInterference,
      planScore
    };
    
    console.log(`[FrequencyPlanner] Generated plan with score: ${planScore}/100`);
    
    return plan;
  }

  /**
   * Get statistics about the current frequency plan
   */
  getPlanStatistics(): {
    totalSectors: number;
    totalConflicts: number;
    highSeverityConflicts: number;
    mediumSeverityConflicts: number;
    lowSeverityConflicts: number;
    planScore: number;
    totalInterference: number;
  } {
    const totalConflicts = this.conflicts.length;
    const highSeverityConflicts = this.conflicts.filter(c => c.severity === 'HIGH').length;
    const mediumSeverityConflicts = this.conflicts.filter(c => c.severity === 'MEDIUM').length;
    const lowSeverityConflicts = this.conflicts.filter(c => c.severity === 'LOW').length;
    
    const totalInterference = this.conflicts.reduce((sum, conflict) => {
      return sum + Math.abs(conflict.interferenceLevel);
    }, 0);
    
    return {
      totalSectors: this.sectors.length,
      totalConflicts,
      highSeverityConflicts,
      mediumSeverityConflicts,
      lowSeverityConflicts,
      planScore: this.calculatePlanScore(),
      totalInterference
    };
  }
}

// Export singleton instance
export const frequencyPlanner = new FrequencyPlanner();
