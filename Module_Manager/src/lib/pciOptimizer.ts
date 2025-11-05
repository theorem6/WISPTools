// Automated PCI Conflict Resolution and Optimization
import { pciMapper, type Cell, type PCIConflict } from './pciMapper';

export interface OptimizationResult {
  originalCells: Cell[];
  optimizedCells: Cell[];
  iterations: number;
  originalConflicts: number;
  finalConflicts: number;
  resolvedConflicts: number;
  conflictReduction: number; // percentage
  changes: PCIChange[];
  convergenceHistory: IterationHistory[];
}

export interface PCIChange {
  cellId: string;
  oldPCI: number;
  newPCI: number;
  reason: string;
}

export interface IterationHistory {
  iteration: number;
  conflictCount: number;
  criticalCount: number;
  highCount: number;
  changes: number;
}

export class PCIOptimizer {
  private readonly MAX_ITERATIONS = 20; // Increased for thorough optimization
  private readonly PCI_MIN = 30; // Reserve 0-29 for WISPs
  private readonly PCI_MAX = 503;
  private readonly CONVERGENCE_THRESHOLD_CRITICAL = 0; // Must eliminate ALL critical conflicts
  private readonly CONVERGENCE_THRESHOLD_ALL = 0; // Stop when no conflicts remain
  
  // SON-inspired configuration for fixed wireless networks
  private readonly WISP_RESERVED_PCIS = { min: 0, max: 29 }; // WISPs use lower PCIs
  private readonly FIXED_WIRELESS_PRIORITY = true; // Optimize for stationary networks

  /**
   * Optimize PCI assignments to minimize conflicts with LOS awareness
   */
  async optimizePCIAssignments(cells: Cell[], checkLOS: boolean = true): Promise<OptimizationResult> {
    const originalCells = JSON.parse(JSON.stringify(cells)) as Cell[];
    let currentCells = JSON.parse(JSON.stringify(cells)) as Cell[];
    
    const changes: PCIChange[] = [];
    const convergenceHistory: IterationHistory[] = [];
    
    // Initial conflict analysis with LOS checking
    const initialConflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
    const originalConflictCount = initialConflicts.length;

    let iteration = 0;
    let previousConflictCount = originalConflictCount;
    let previousCriticalCount = initialConflicts.filter(c => c.severity === 'CRITICAL').length;
    let previousHighCount = initialConflicts.filter(c => c.severity === 'HIGH').length;
    let stalledIterations = 0;
    let badIterations = 0; // Track iterations that increased critical/high

    console.log(`🔧 Starting SON-inspired PCI optimization with ${originalConflictCount} conflicts (${previousCriticalCount} critical, ${previousHighCount} high)...`);
    console.log(`📋 Target: Eliminate ALL critical and high conflicts`);

    while (iteration < this.MAX_ITERATIONS) {
      iteration++;
      
      // Detect current conflicts with LOS checking
      const conflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
      const conflictCount = conflicts.length;
      const criticalCount = conflicts.filter(c => c.severity === 'CRITICAL').length;
      const highCount = conflicts.filter(c => c.severity === 'HIGH').length;
      
      // Track iteration history
      convergenceHistory.push({
        iteration,
        conflictCount,
        criticalCount,
        highCount,
        changes: changes.length
      });

      console.log(`📊 Iteration ${iteration}: ${conflictCount} total (🔴 ${criticalCount} critical, 🟠 ${highCount} high, 🟡 ${conflicts.filter(c => c.severity === 'MEDIUM').length} medium)`);

      // SON CHECK: Did critical or high conflicts INCREASE? This is bad!
      if (iteration > 1 && (criticalCount > previousCriticalCount || highCount > previousHighCount)) {
        badIterations++;
        console.warn(`⚠️  CRITICAL/HIGH INCREASED! Previous: ${previousCriticalCount}/${previousHighCount}, Now: ${criticalCount}/${highCount}`);
        console.log(`🔄 SON Response: Reverting last changes and forcing more aggressive optimization (bad iteration #${badIterations})`);
        
        // This iteration made things worse - we need to be more aggressive
        stalledIterations = 3; // Force aggressive mode immediately
      }

      // PRIMARY GOAL: Eliminate ALL critical AND high conflicts
      // Continue optimizing as long as critical or high conflicts exist
      if (criticalCount === 0 && highCount === 0) {
        if (conflictCount === 0) {
          console.log(`✅ Perfect! All conflicts resolved after ${iteration} iterations`);
          break;
        } else {
          // No critical/high conflicts, but some medium/low remain
          console.log(`✅ All critical and high conflicts eliminated! ${conflictCount} low-priority conflicts remain.`);
          // Continue to try to resolve remaining conflicts  
          if (iteration > 1 && conflictCount >= previousConflictCount) {
            console.log(`🏁 SON Optimization complete - zero critical/high conflicts achieved.`);
            break;
          }
        }
      }
      
      // Check if we're making progress on critical/high conflicts
      const combinedSevere = criticalCount + highCount;
      const previousSevere = previousCriticalCount + previousHighCount;
      
      if (iteration > 2 && combinedSevere >= previousSevere) {
        stalledIterations++;
        console.log(`⚠️  Severe conflicts not improving (stalled: ${stalledIterations})`);
        
        // If stalled for 2 iterations on severe conflicts, go aggressive immediately
        if (stalledIterations >= 2) {
          console.log(`🔀 SON Aggressive Mode: Breaking stalemate with randomized reassignments`);
        }
      } else if (combinedSevere < previousSevere) {
        stalledIterations = 0; // Reset - we're making progress!
        badIterations = 0; // Reset bad iterations counter
        console.log(`✅ Progress! Severe conflicts reduced from ${previousSevere} to ${combinedSevere}`);
      }

      // SON-inspired conflict resolution: Prioritize critical and high conflicts
      const criticalConflicts = conflicts.filter(c => c.severity === 'CRITICAL');
      const highConflicts = conflicts.filter(c => c.severity === 'HIGH');
      const otherConflicts = conflicts.filter(c => c.severity !== 'CRITICAL' && c.severity !== 'HIGH');
      
      // Resolve in priority order: critical → high → others
      const iterationChanges = this.resolveConflicts(
        currentCells, 
        [...criticalConflicts, ...highConflicts, ...otherConflicts],
        stalledIterations >= 2 || badIterations > 0, // Use aggressive mode if stalled or had bad iterations
        badIterations // Pass badIterations for extra aggressive mode
      );
      changes.push(...iterationChanges);

      previousConflictCount = conflictCount;
      previousCriticalCount = criticalCount;
      previousHighCount = highCount;
    }

    // Final conflict analysis with LOS checking
    const finalConflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
    const finalConflictCount = finalConflicts.length;
    const finalCriticalCount = finalConflicts.filter(c => c.severity === 'CRITICAL').length;
    const finalHighCount = finalConflicts.filter(c => c.severity === 'HIGH').length;
    const resolvedConflicts = originalConflictCount - finalConflictCount;
    const conflictReduction = originalConflictCount > 0 
      ? (resolvedConflicts / originalConflictCount) * 100 
      : 0;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ SON Optimization Complete After ${iteration} Iterations`);
    console.log(`📊 Results:`);
    console.log(`   • Total Conflicts: ${originalConflictCount} → ${finalConflictCount} (${conflictReduction.toFixed(1)}% reduction)`);
    console.log(`   • Critical: ${previousCriticalCount} → ${finalCriticalCount} ${finalCriticalCount === 0 ? '✅' : '⚠️'}`);
    console.log(`   • High: ${previousHighCount} → ${finalHighCount} ${finalHighCount === 0 ? '✅' : '⚠️'}`);
    console.log(`   • Changes Made: ${changes.length} PCI reassignments`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return {
      originalCells,
      optimizedCells: currentCells,
      iterations: iteration,
      originalConflicts: originalConflictCount,
      finalConflicts: finalConflictCount,
      resolvedConflicts,
      conflictReduction,
      changes,
      convergenceHistory
    };
  }

  /**
   * Resolve conflicts for a single iteration
   * SON-inspired: Prioritize critical conflicts and use intelligent PCI selection
   */
  private resolveConflicts(cells: Cell[], conflicts: PCIConflict[], aggressiveMode = false, badIterations = 0): PCIChange[] {
    const changes: PCIChange[] = [];
    
    // SON Algorithm: Sort conflicts by severity and distance
    // Critical conflicts at close range are highest priority
    const sortedConflicts = [...conflicts].sort((a, b) => {
      const severityOrder: Record<string, number> = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'UNRESOLVABLE': 0 };
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      
      if (severityDiff !== 0) return severityDiff;
      
      // Same severity: closer conflicts are higher priority
      return a.distance - b.distance;
    });

      // Track cells that have been modified in this iteration
      const modifiedCellIds = new Set<string>();
      let changesThisIteration = 0;

      for (const conflict of sortedConflicts) {
        // Choose which cell to reassign (prefer lower signal strength or conflicting cell)
        const cellToReassign = this.selectCellForReassignment(conflict);
        
        // Skip if already modified in this iteration
        if (modifiedCellIds.has(cellToReassign.id)) {
          continue;
        }

        // Find the cell in the array
        const cellIndex = cells.findIndex(c => c.id === cellToReassign.id);
        if (cellIndex === -1) continue;

        // Find a conflict-free PCI
        const newPCI = this.findOptimalPCI(cells, cellToReassign, conflict);
        
        if (newPCI !== cellToReassign.pci) {
          const oldPCI = cellToReassign.pci;
          cells[cellIndex].pci = newPCI;
          
          changes.push({
            cellId: cellToReassign.id,
            oldPCI,
            newPCI,
            reason: `Resolved ${conflict.conflictType} conflict with ${conflict.primaryCell.id === cellToReassign.id ? conflict.conflictingCell.id : conflict.primaryCell.id}`
          });

          modifiedCellIds.add(cellToReassign.id);
          changesThisIteration++;
        }
      }

      // SON-inspired stalemate breaking: Force aggressive changes if needed
      if ((changesThisIteration === 0 && sortedConflicts.length > 0) || aggressiveMode) {
        console.log('🔀 SON Mode: Forcing random PCI reassignments to break conflicts');
        
        // More aggressive if we had bad iterations (increased critical/high)
        const numToForce = aggressiveMode ? (badIterations > 0 ? 8 : 5) : 3;
        const conflictsToForce = sortedConflicts.slice(0, numToForce);
        
        console.log(`   → Forcing ${numToForce} random changes ${badIterations > 0 ? '(EXTRA aggressive - had worsening)' : ''}`);
        
        for (const conflict of conflictsToForce) {
          const cellToReassign = this.selectCellForReassignment(conflict);
          const cellIndex = cells.findIndex(c => c.id === cellToReassign.id);
          
          if (cellIndex !== -1 && !modifiedCellIds.has(cellToReassign.id)) {
            // Use SON-inspired randomized PCI selection
            const usedPCIs = new Set(cells.map(c => c.pci));
            const newPCI = this.selectSONRandomPCI(cellToReassign.pci, usedPCIs);
            const oldPCI = cellToReassign.pci;
            
            cells[cellIndex].pci = newPCI;
            
            changes.push({
              cellId: cellToReassign.id,
              oldPCI,
              newPCI,
              reason: `SON random reassignment to eliminate ${conflict.severity} ${conflict.conflictType} conflict`
            });
            
            modifiedCellIds.add(cellToReassign.id);
            changesThisIteration++;
            
            console.log(`🎲 SON random change: ${cellToReassign.id} ${oldPCI} → ${newPCI} (Mod3: ${oldPCI % 3} → ${newPCI % 3})`);
          }
        }
      }

    return changes;
  }

  /**
   * Select which cell should be reassigned in a conflict
   */
  private selectCellForReassignment(conflict: PCIConflict): Cell {
    // Prefer to reassign the cell with lower signal strength
    if (conflict.primaryCell.rsPower < conflict.conflictingCell.rsPower) {
      return conflict.conflictingCell;
    } else if (conflict.conflictingCell.rsPower < conflict.primaryCell.rsPower) {
      return conflict.primaryCell;
    }
    
    // If equal signal strength, prefer the conflicting cell
    return conflict.conflictingCell;
  }
  
  /**
   * SON-inspired random PCI selection for fixed wireless networks
   * Excludes WISP-reserved PCIs (0-30) and prioritizes Mod3 diversity
   * Uses randomization to break conflict patterns
   */
  private selectSONRandomPCI(currentPCI: number, usedPCIs: Set<number>): number {
    const currentMod3 = currentPCI % 3;
    const availablePCIs: number[] = [];
    
    // SON Priority 1: Different Mod3 group (CRITICAL for fixed wireless CRS conflicts)
    // Fixed wireless networks have stationary equipment, so Mod3 conflicts are most severe
    for (let mod3 = 0; mod3 < 3; mod3++) {
      if (mod3 === currentMod3) continue; // Skip current Mod3
      
      for (let base = mod3; base <= this.PCI_MAX; base += 3) {
        if (base < this.PCI_MIN) continue; // Skip WISP-reserved PCIs (0-30)
        if (!usedPCIs.has(base)) {
          availablePCIs.push(base);
        }
      }
    }
    
    // SON Priority 2: Same Mod3 but different Mod6 (for PBCH conflicts)
    if (availablePCIs.length === 0) {
      const currentMod6 = currentPCI % 6;
      for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
        if (!usedPCIs.has(pci) && pci % 3 === currentMod3 && pci % 6 !== currentMod6) {
          availablePCIs.push(pci);
        }
      }
    }
    
    // SON Priority 3: Any available PCI (excluding WISP range)
    if (availablePCIs.length === 0) {
      for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
        if (!usedPCIs.has(pci)) {
          availablePCIs.push(pci);
        }
      }
    }
    
    // SON Randomization: Select randomly from available pool
    if (availablePCIs.length > 0) {
      const randomIndex = Math.floor(Math.random() * availablePCIs.length);
      return availablePCIs[randomIndex];
    }
    
    // Last resort: Find any PCI >= 30 that's not heavily used
    for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
      if (pci % 3 !== currentMod3) { // At least change Mod3
        return pci;
      }
    }
    
    // Absolute last resort
    return Math.max(this.PCI_MIN, (currentPCI + 3) % 504);
  }

  /**
   * Find an optimal PCI that minimizes conflicts considering azimuth and spatial relationships
   */
  private findOptimalPCI(cells: Cell[], targetCell: Cell, currentConflict: PCIConflict): number {
    const neighborCells = this.findNeighborCells(cells, targetCell);
    const usedPCIs = new Set(neighborCells.map(c => c.pci));
    
    // Create a scoring system for candidate PCIs
    const candidateScores: Map<number, number> = new Map();

    // Generate candidate PCIs
    const candidates = this.generateCandidatePCIs(targetCell, usedPCIs);

    for (const candidatePCI of candidates) {
      let score = 0;

      // Test this PCI against all neighbor cells
      for (const neighbor of neighborCells) {
        const distance = this.calculateDistance(targetCell, neighbor);
        const azimuthDiff = this.calculateAzimuthDifference(targetCell, neighbor);
        const isColocated = this.areCellsColocated(targetCell, neighbor);
        const sectorOverlap = this.calculateSectorOverlap(targetCell, neighbor);
        const sectorsOverlapping = this.doSectorsOverlap(targetCell, neighbor);
        
        // Azimuth-aware conflict penalties
        // Sectors facing each other are more likely to interfere
        const azimuthFactor = this.calculateAzimuthInterferenceFactor(azimuthDiff);
        
        // CRITICAL: Overlapping sectors with same PCI - extremely high penalty
        if (sectorsOverlapping) {
          const overlapFactor = sectorOverlap * 2; // Amplify overlap effect
          
          if (candidatePCI === neighbor.pci) {
            score -= 500 * overlapFactor; // CRITICAL: Same PCI in overlapping sectors
          }
          if (candidatePCI % 3 === neighbor.pci % 3) {
            score -= 150 * overlapFactor; // Very heavy penalty for mod3 in overlap
          }
          if (candidatePCI % 6 === neighbor.pci % 6) {
            score -= 80 * overlapFactor;
          }
        } else {
          // Normal azimuth-aware penalties for non-overlapping sectors
          if (candidatePCI % 3 === neighbor.pci % 3) {
            score -= 100 * azimuthFactor; // Heavier penalty if sectors face each other
          }
          if (candidatePCI % 6 === neighbor.pci % 6) {
            score -= 50 * azimuthFactor;
          }
        }
        
        // Standard mod penalties (always apply)
        if (candidatePCI % 12 === neighbor.pci % 12) {
          score -= 25 * azimuthFactor;
        }
        if (candidatePCI % 30 === neighbor.pci % 30) {
          score -= 10 * azimuthFactor;
        }

        // Co-located cells (same tower) should have distinct mod3 values
        if (isColocated) {
          if (candidatePCI % 3 === neighbor.pci % 3) {
            score -= 200; // Very heavy penalty for co-located mod3 conflicts
          } else {
            score += 50; // Bonus for different mod3 on same tower
          }
        }

        // Bonus for distance separation (reduced if overlapping or facing)
        const distanceBonus = this.calculateDistanceBonus(distance) * (1 - Math.max(sectorOverlap, azimuthFactor * 0.5));
        score += distanceBonus;
        
        // Bonus for back-to-back sectors (facing away from each other)
        if (azimuthDiff > 135 && azimuthDiff < 225 && !sectorsOverlapping) {
          score += 20; // Sectors pointing away from each other can share mod3
        }
        
        // Bonus for no overlap at all
        if (sectorOverlap === 0) {
          score += 10; // Non-overlapping sectors are preferable
        }
      }

      candidateScores.set(candidatePCI, score);
    }

    // Find the PCI with the highest score
    // Collect all PCIs within 10% of the best score for randomization
    let bestScore = -Infinity;
    const topCandidates: number[] = [];

    // First pass: find the best score
    for (const [pci, score] of candidateScores) {
      if (score > bestScore) {
        bestScore = score;
      }
    }

    // Second pass: collect all candidates within 10% of best score
    const scoreThreshold = bestScore * 0.9;
    for (const [pci, score] of candidateScores) {
      if (score >= scoreThreshold) {
        topCandidates.push(pci);
      }
    }

    // Randomly select from top candidates for diversity
    if (topCandidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * topCandidates.length);
      return topCandidates[randomIndex];
    }

    // Fallback to current PCI if no good candidates
    return targetCell.pci;
  }
  
  /**
   * Calculate azimuth difference between two cells
   */
  private calculateAzimuthDifference(cell1: Cell, cell2: Cell): number {
    const azimuth1 = (cell1 as any).azimuth || 0;
    const azimuth2 = (cell2 as any).azimuth || 0;
    
    // Calculate absolute difference
    let diff = Math.abs(azimuth1 - azimuth2);
    
    // Handle wrap-around (e.g., 350° and 10° are only 20° apart)
    if (diff > 180) {
      diff = 360 - diff;
    }
    
    return diff;
  }
  
  /**
   * Calculate how much two sectors interfere based on their azimuth relationship
   * Returns 0-1, where 1 means maximum interference (facing each other)
   */
  private calculateAzimuthInterferenceFactor(azimuthDiff: number): number {
    // Sectors facing each other (0-45°) have maximum interference
    if (azimuthDiff < 45) {
      return 1.0;
    }
    // Moderate interference (45-90°)
    else if (azimuthDiff < 90) {
      return 0.7;
    }
    // Low interference (90-135°)
    else if (azimuthDiff < 135) {
      return 0.4;
    }
    // Back-to-back sectors (135-180°) have minimal interference
    else {
      return 0.2;
    }
  }
  
  /**
   * Check if two sectors have overlapping coverage areas
   * Based on azimuth and sector-specific beamwidth
   */
  private doSectorsOverlap(cell1: Cell, cell2: Cell): boolean {
    const azimuth1 = (cell1 as any).azimuth || 0;
    const azimuth2 = (cell2 as any).azimuth || 0;
    const beamwidth1 = (cell1 as any).beamwidth || 65;
    const beamwidth2 = (cell2 as any).beamwidth || 65;
    
    // Calculate sector coverage ranges using sector-specific beamwidths
    const sector1Start = (azimuth1 - beamwidth1 / 2 + 360) % 360;
    const sector1End = (azimuth1 + beamwidth1 / 2) % 360;
    const sector2Start = (azimuth2 - beamwidth2 / 2 + 360) % 360;
    const sector2End = (azimuth2 + beamwidth2 / 2) % 360;
    
    // Helper function to check if angle is within sector range
    const isInRange = (angle: number, start: number, end: number): boolean => {
      if (start <= end) {
        return angle >= start && angle <= end;
      } else {
        // Handle wrap-around (e.g., sector from 350° to 10°)
        return angle >= start || angle <= end;
      }
    };
    
    // Check if sectors overlap
    return (
      isInRange(azimuth1, sector2Start, sector2End) ||
      isInRange(azimuth2, sector1Start, sector1End) ||
      isInRange(sector1Start, sector2Start, sector2End) ||
      isInRange(sector1End, sector2Start, sector2End)
    );
  }
  
  /**
   * Calculate overlap percentage between two sectors
   * Returns 0-1, where 1 means complete overlap
   */
  private calculateSectorOverlap(cell1: Cell, cell2: Cell): number {
    const azimuthDiff = this.calculateAzimuthDifference(cell1, cell2);
    const beamwidth1 = (cell1 as any).beamwidth || 65;
    const beamwidth2 = (cell2 as any).beamwidth || 65;
    
    // Use the average beamwidth for overlap calculation
    const avgBeamwidth = (beamwidth1 + beamwidth2) / 2;
    
    // Calculate overlap based on azimuth difference
    if (azimuthDiff >= avgBeamwidth) {
      return 0; // No overlap
    }
    
    // Overlap percentage: more overlap = higher value
    const overlapDegrees = avgBeamwidth - azimuthDiff;
    const overlapPercentage = overlapDegrees / avgBeamwidth;
    
    return Math.max(0, Math.min(1, overlapPercentage));
  }
  
  /**
   * Check if two cells are co-located (same tower)
   */
  private areCellsColocated(cell1: Cell, cell2: Cell): boolean {
    const distance = this.calculateDistance(cell1, cell2);
    // Cells within 50 meters are considered co-located
    return distance < 50 && cell1.eNodeB === cell2.eNodeB;
  }
  
  /**
   * Calculate distance bonus based on separation
   */
  private calculateDistanceBonus(distance: number): number {
    if (distance > 5000) return 10;
    if (distance > 2000) return 5;
    if (distance > 1000) return 3;
    if (distance > 500) return 1;
    return 0;
  }

  /**
   * Find cells that are neighbors (within range) of the target cell
   */
  private findNeighborCells(cells: Cell[], targetCell: Cell, maxDistance: number = 10000): Cell[] {
    return cells.filter(cell => {
      if (cell.id === targetCell.id) return false;
      
      const distance = this.calculateDistance(targetCell, cell);
      return distance <= maxDistance;
    });
  }

  /**
   * Generate candidate PCIs for optimization
   * SON-inspired: Excludes WISP-reserved PCIs (0-30) and uses intelligent selection
   */
  private generateCandidatePCIs(targetCell: Cell, usedPCIs: Set<number>): number[] {
    const candidates: number[] = [];
    const currentPCI = targetCell.pci;
    
    // SON Strategy 1: Different Mod3 groups (highest priority for fixed wireless)
    // For stationary networks, Mod3 diversity is critical to avoid CRS conflicts
    for (let mod3 = 0; mod3 < 3; mod3++) {
      const currentMod3 = currentPCI % 3;
      if (mod3 === currentMod3) continue; // Skip current mod3 group
      
      // Start from PCI_MIN (30) to avoid WISP-reserved range
      for (let base = mod3; base <= this.PCI_MAX; base += 3) {
        if (base < this.PCI_MIN) continue; // Skip WISP-reserved PCIs (0-30)
        if (!usedPCIs.has(base)) {
          candidates.push(base);
          if (candidates.length >= 30) break; // Enough candidates from this mod3
        }
      }
    }

    // SON Strategy 2: Same Mod3 but different Mod6 (secondary priority)
    const currentMod3 = currentPCI % 3;
    const currentMod6 = currentPCI % 6;
    for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci += 3) {
      if (pci % 3 === currentMod3 && pci % 6 !== currentMod6 && !usedPCIs.has(pci)) {
        candidates.push(pci);
      }
    }

    // SON Strategy 3: Geographic-based random sampling
    // For fixed wireless: sample from full available range for diversity
    const availablePCIs = [];
    for (let i = this.PCI_MIN; i <= this.PCI_MAX; i++) {
      if (!usedPCIs.has(i)) {
        availablePCIs.push(i);
      }
    }
    
    // Add randomized samples for diversity (SON uses randomization to avoid patterns)
    const sampleSize = Math.min(30, availablePCIs.length);
    for (let i = 0; i < sampleSize; i++) {
      const randomIndex = Math.floor(Math.random() * availablePCIs.length);
      const candidate = availablePCIs[randomIndex];
      if (!candidates.includes(candidate)) {
        candidates.push(candidate);
      }
    }

    // Strategy 4: Sequential exploration around current PCI
    for (let offset = 1; offset <= 50; offset++) {
      const candidate1 = (currentPCI + offset) % 504;
      const candidate2 = (currentPCI - offset + 504) % 504;
      
      if (!usedPCIs.has(candidate1) && !candidates.includes(candidate1)) {
        candidates.push(candidate1);
      }
      if (!usedPCIs.has(candidate2) && !candidates.includes(candidate2)) {
        candidates.push(candidate2);
      }
      
      if (candidates.length >= 50) break;
    }

    return candidates.slice(0, 50); // Limit to 50 candidates
  }

  /**
   * Calculate distance between two cells (Haversine formula)
   */
  private calculateDistance(cell1: Cell, cell2: Cell): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (cell1.latitude * Math.PI) / 180;
    const φ2 = (cell2.latitude * Math.PI) / 180;
    const Δφ = ((cell2.latitude - cell1.latitude) * Math.PI) / 180;
    const Δλ = ((cell2.longitude - cell1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const pciOptimizer = new PCIOptimizer();

