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
      if (conflictCount === 0 || conflictCount >= previousConflictCount) {
        console.log(`Converged after ${iteration} iterations`);
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
   * Find an optimal PCI that minimizes conflicts
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
        
        // Check for mod conflicts
        if (candidatePCI % 3 === neighbor.pci % 3) {
          score -= 100; // Heavy penalty for Mod3 conflicts
        }
        if (candidatePCI % 6 === neighbor.pci % 6) {
          score -= 50; // Medium penalty for Mod6 conflicts
        }
        if (candidatePCI % 12 === neighbor.pci % 12) {
          score -= 25; // Lower penalty for Mod12 conflicts
        }
        if (candidatePCI % 30 === neighbor.pci % 30) {
          score -= 10; // Lowest penalty for Mod30 conflicts
        }

        // Bonus for distance separation
        if (distance > 2000) {
          score += 5;
        } else if (distance > 1000) {
          score += 3;
        } else if (distance > 500) {
          score += 1;
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
   * Find cells that are neighbors (within range) of the target cell
   */
  private findNeighborCells(cells: Cell[], targetCell: Cell, maxDistance: number = 5000): Cell[] {
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
    
    // Strategy 1: Try PCIs in the same mod3 group but different mod6
    const currentMod3 = targetCell.pci % 3;
    for (let i = currentMod3; i <= this.PCI_MAX; i += 3) {
      if (!usedPCIs.has(i)) {
        candidates.push(i);
      }
    }

    // Strategy 2: Try completely different mod3 groups
    for (let mod3 = 0; mod3 < 3; mod3++) {
      if (mod3 === currentMod3) continue;
      
      for (let i = mod3; i <= this.PCI_MAX; i += 3) {
        if (!usedPCIs.has(i) && candidates.length < 50) {
          candidates.push(i);
        }
      }
    }

    // Strategy 3: If still no candidates, try all available PCIs
    if (candidates.length === 0) {
      for (let i = this.PCI_MIN; i <= this.PCI_MAX; i++) {
        if (!usedPCIs.has(i)) {
          candidates.push(i);
          if (candidates.length >= 50) break;
        }
      }
    }

    return candidates;
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
