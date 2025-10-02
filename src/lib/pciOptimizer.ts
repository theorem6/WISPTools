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
  private readonly MAX_ITERATIONS = 10;
  private readonly PCI_MIN = 0;
  private readonly PCI_MAX = 503;
  private readonly CONVERGENCE_THRESHOLD = 0; // Stop when no conflicts remain

  /**
   * Optimize PCI assignments to minimize conflicts
   */
  optimizePCIAssignments(cells: Cell[]): OptimizationResult {
    const originalCells = JSON.parse(JSON.stringify(cells)) as Cell[];
    let currentCells = JSON.parse(JSON.stringify(cells)) as Cell[];
    
    const changes: PCIChange[] = [];
    const convergenceHistory: IterationHistory[] = [];
    
    // Initial conflict analysis
    const initialConflicts = pciMapper.detectConflicts(currentCells);
    const originalConflictCount = initialConflicts.length;

    let iteration = 0;
    let previousConflictCount = originalConflictCount;

    console.log(`Starting PCI optimization with ${originalConflictCount} conflicts...`);

    while (iteration < this.MAX_ITERATIONS) {
      iteration++;
      
      // Detect current conflicts
      const conflicts = pciMapper.detectConflicts(currentCells);
      const conflictCount = conflicts.length;
      
      // Track iteration history
      convergenceHistory.push({
        iteration,
        conflictCount,
        criticalCount: conflicts.filter(c => c.severity === 'CRITICAL').length,
        highCount: conflicts.filter(c => c.severity === 'HIGH').length,
        changes: changes.length
      });

      console.log(`Iteration ${iteration}: ${conflictCount} conflicts (${conflicts.filter(c => c.severity === 'CRITICAL').length} critical)`);

      // Check for convergence
      if (conflictCount === 0) {
        console.log(`All conflicts resolved after ${iteration} iterations`);
        break;
      }
      
      // Only stop if no improvement for 2 consecutive iterations
      if (iteration > 1 && conflictCount >= previousConflictCount) {
        console.log(`Converged after ${iteration} iterations (no improvement)`);
        break;
      }

      // Resolve conflicts for this iteration
      const iterationChanges = this.resolveConflicts(currentCells, conflicts);
      changes.push(...iterationChanges);

      previousConflictCount = conflictCount;
    }

    // Final conflict analysis
    const finalConflicts = pciMapper.detectConflicts(currentCells);
    const finalConflictCount = finalConflicts.length;
    const resolvedConflicts = originalConflictCount - finalConflictCount;
    const conflictReduction = originalConflictCount > 0 
      ? (resolvedConflicts / originalConflictCount) * 100 
      : 0;

    console.log(`Optimization complete: ${resolvedConflicts} conflicts resolved (${conflictReduction.toFixed(1)}% reduction)`);

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
   */
  private resolveConflicts(cells: Cell[], conflicts: PCIConflict[]): PCIChange[] {
    const changes: PCIChange[] = [];
    
    // Sort conflicts by severity (resolve critical first)
    const sortedConflicts = [...conflicts].sort((a, b) => {
      const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
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

      // If no changes were made this iteration, force at least one change
      if (changesThisIteration === 0 && sortedConflicts.length > 0) {
        const firstConflict = sortedConflicts[0];
        const cellToReassign = this.selectCellForReassignment(firstConflict);
        const cellIndex = cells.findIndex(c => c.id === cellToReassign.id);
        
        if (cellIndex !== -1) {
          // Force a PCI change by picking a different PCI
          const newPCI = (cellToReassign.pci + 3) % 504; // Simple increment strategy
          const oldPCI = cellToReassign.pci;
          cells[cellIndex].pci = newPCI;
          
          changes.push({
            cellId: cellToReassign.id,
            oldPCI,
            newPCI,
            reason: `Forced reassignment for ${firstConflict.conflictType} conflict`
          });
          
          console.log(`Forced PCI change: ${cellToReassign.id} ${oldPCI} → ${newPCI}`);
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
    let bestPCI = targetCell.pci;
    let bestScore = -Infinity;

    for (const [pci, score] of candidateScores) {
      if (score > bestScore) {
        bestScore = score;
        bestPCI = pci;
      }
    }

    return bestPCI;
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
   */
  private generateCandidatePCIs(targetCell: Cell, usedPCIs: Set<number>): number[] {
    const candidates: number[] = [];
    const currentPCI = targetCell.pci;
    
    // Strategy 1: Try PCIs in different mod3 groups (most important for LTE)
    for (let mod3 = 0; mod3 < 3; mod3++) {
      const currentMod3 = currentPCI % 3;
      if (mod3 === currentMod3) continue; // Skip current mod3 group
      
      // Add several PCIs from each mod3 group
      for (let i = 0; i < 10; i++) {
        const candidate = mod3 + (i * 3);
        if (candidate <= this.PCI_MAX && !usedPCIs.has(candidate)) {
          candidates.push(candidate);
        }
      }
    }

    // Strategy 2: Try PCIs with different mod6 values in current mod3
    const currentMod3 = currentPCI % 3;
    const currentMod6 = currentPCI % 6;
    for (let mod6 = 0; mod6 < 6; mod6 += 3) { // Only check mod3-aligned mod6 values
      if (mod6 === currentMod6) continue;
      const candidate = currentMod3 + mod6;
      if (candidate <= this.PCI_MAX && !usedPCIs.has(candidate)) {
        candidates.push(candidate);
      }
    }

    // Strategy 3: Random sampling of available PCIs
    const availablePCIs = [];
    for (let i = this.PCI_MIN; i <= this.PCI_MAX; i++) {
      if (!usedPCIs.has(i)) {
        availablePCIs.push(i);
      }
    }
    
    // Add random samples
    const sampleSize = Math.min(20, availablePCIs.length);
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
