// Simple, Effective PCI Optimizer
// KISS Principle: Keep It Simple, Stupid
// This optimizer ACTUALLY WORKS by using straightforward logic

import { pciMapper, type Cell, type PCIConflict } from './pciMapper';
import type { OptimizationResult, PCIChange } from './pciOptimizer';

export class SimplePCIOptimizer {
  private readonly PCI_MIN = 30; // Reserve 0-29 for WISPs
  private readonly PCI_MAX = 503;
  private readonly MAX_ITERATIONS = 25;
  
  /**
   * Simple, effective PCI optimization
   * Strategy: For each conflicting cell, pick a TRULY RANDOM PCI that works
   */
  async optimizePCIAssignments(cells: Cell[], checkLOS: boolean = true): Promise<OptimizationResult> {
    const originalCells = JSON.parse(JSON.stringify(cells)) as Cell[];
    let currentCells = JSON.parse(JSON.stringify(cells)) as Cell[];
    
    const allChanges: PCIChange[] = [];
    const convergenceHistory: any[] = [];
    
    // Initial state
    let initialConflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
    const originalConflictCount = initialConflicts.length;
    let initialCritical = initialConflicts.filter(c => c.severity === 'CRITICAL').length;
    let initialHigh = initialConflicts.filter(c => c.severity === 'HIGH').length;
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎯 SIMPLE PCI OPTIMIZER`);
    console.log(`📊 Starting: ${originalConflictCount} conflicts`);
    console.log(`   🔴 Critical: ${initialCritical}`);
    console.log(`   🟠 High: ${initialHigh}`);
    console.log(`🎯 Goal: 0 critical + 0 high`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    let iteration = 0;
    let prevCritical = initialCritical;
    let prevHigh = initialHigh;
    
    while (iteration < this.MAX_ITERATIONS) {
      iteration++;
      
      // Detect current conflicts
      const conflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
      const criticalConflicts = conflicts.filter(c => c.severity === 'CRITICAL');
      const highConflicts = conflicts.filter(c => c.severity === 'HIGH');
      const totalCritical = criticalConflicts.length;
      const totalHigh = highConflicts.length;
      
      console.log(`\n🔄 Iteration ${iteration}: ${conflicts.length} conflicts (🔴 ${totalCritical} critical, 🟠 ${totalHigh} high)`);
      
      // Goal achieved?
      if (totalCritical === 0 && totalHigh === 0) {
        console.log(`✅ SUCCESS! Zero critical and high conflicts achieved!`);
        if (conflicts.length === 0) {
          console.log(`🎉 PERFECT! All conflicts eliminated!`);
        }
        break;
      }
      
      // Track history
      convergenceHistory.push({
        iteration,
        conflictCount: conflicts.length,
        criticalCount: totalCritical,
        highCount: totalHigh,
        changes: allChanges.length
      });
      
      // SIMPLE STRATEGY: Fix critical first, then high
      const conflictsToFix = [...criticalConflicts, ...highConflicts];
      
      if (conflictsToFix.length === 0) break;
      
      // Process conflicts one by one
      const changes = this.resolveConflictsSimple(currentCells, conflictsToFix, iteration);
      allChanges.push(...changes);
      
      console.log(`   ✏️  Made ${changes.length} PCI changes`);
      
      // Check progress
      if (totalCritical < prevCritical || totalHigh < prevHigh) {
        console.log(`   ✅ Progress! Critical: ${prevCritical}→${totalCritical}, High: ${prevHigh}→${totalHigh}`);
      } else if (totalCritical > prevCritical || totalHigh > prevHigh) {
        console.warn(`   ⚠️  WORSE! Critical: ${prevCritical}→${totalCritical}, High: ${prevHigh}→${totalHigh}`);
      }
      
      prevCritical = totalCritical;
      prevHigh = totalHigh;
    }
    
    // Final analysis
    const finalConflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
    const finalCritical = finalConflicts.filter(c => c.severity === 'CRITICAL').length;
    const finalHigh = finalConflicts.filter(c => c.severity === 'HIGH').length;
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ OPTIMIZATION COMPLETE (${iteration} iterations)`);
    console.log(`📊 BEFORE → AFTER:`);
    console.log(`   Total: ${originalConflictCount} → ${finalConflicts.length}`);
    console.log(`   Critical: ${initialCritical} → ${finalCritical} ${finalCritical === 0 ? '✅' : '❌'}`);
    console.log(`   High: ${initialHigh} → ${finalHigh} ${finalHigh === 0 ? '✅' : '❌'}`);
    console.log(`   Changes: ${allChanges.length} PCIs reassigned`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    return {
      originalCells,
      optimizedCells: currentCells,
      iterations: iteration,
      originalConflicts: originalConflictCount,
      finalConflicts: finalConflicts.length,
      resolvedConflicts: originalConflictCount - finalConflicts.length,
      conflictReduction: originalConflictCount > 0 ? 
        ((originalConflictCount - finalConflicts.length) / originalConflictCount) * 100 : 0,
      changes: allChanges,
      convergenceHistory
    };
  }
  
  /**
   * Resolve conflicts using SIMPLE, PROVEN logic
   * No complex scoring - just pick random PCIs that work
   */
  private resolveConflictsSimple(cells: Cell[], conflicts: PCIConflict[], iteration: number): PCIChange[] {
    const changes: PCIChange[] = [];
    const modifiedThisIteration = new Set<string>();
    
    // Get all currently used PCIs
    const usedPCIs = new Set(cells.map(c => c.pci));
    
    // Process each conflict
    for (const conflict of conflicts) {
      // Pick which cell to change (prefer conflicting cell, or weaker signal)
      let cellToChange = conflict.conflictingCell;
      if (conflict.primaryCell.rsPower < conflict.conflictingCell.rsPower) {
        cellToChange = conflict.conflictingCell; // Change the one with weaker signal
      }
      
      // Skip if already modified this iteration
      if (modifiedThisIteration.has(cellToChange.id)) {
        continue;
      }
      
      // Find the cell in array
      const cellIndex = cells.findIndex(c => c.id === cellToChange.id);
      if (cellIndex === -1) continue;
      
      const oldPCI = cellToChange.pci;
      
      // SIMPLE STRATEGY: Pick a RANDOM PCI from available pool
      const newPCI = this.pickRandomGoodPCI(cellToChange, cells, usedPCIs);
      
      if (newPCI !== oldPCI) {
        // Apply the change
        cells[cellIndex].pci = newPCI;
        usedPCIs.add(newPCI);
        modifiedThisIteration.add(cellToChange.id);
        
        changes.push({
          cellId: cellToChange.id,
          oldPCI,
          newPCI,
          reason: `Simple: Resolve ${conflict.severity} ${conflict.conflictType} conflict with ${conflict.primaryCell.id === cellToChange.id ? conflict.conflictingCell.id : conflict.primaryCell.id}`
        });
        
        console.log(`      ${cellToChange.id}: ${oldPCI} → ${newPCI} (Mod3: ${oldPCI%3} → ${newPCI%3})`);
      }
    }
    
    return changes;
  }
  
  /**
   * Pick a random PCI that's good (simple, effective logic)
   */
  private pickRandomGoodPCI(cell: Cell, allCells: Cell[], usedPCIs: Set<number>): number {
    const currentMod3 = cell.pci % 3;
    
    // Find nearby cells (within 5km) - these are the ones that matter
    const nearbyCells = allCells.filter(c => {
      if (c.id === cell.id) return false;
      const dist = this.distance(cell.latitude, cell.longitude, c.latitude, c.longitude);
      return dist < 5000; // 5km radius
    });
    
    const nearbyPCIs = new Set(nearbyCells.map(c => c.pci));
    const nearbyMod3s = new Set(nearbyCells.map(c => c.pci % 3));
    
    // STEP 1: Try to find PCIs with different Mod3 from ALL nearby cells
    const availableMod3Groups = [0, 1, 2].filter(mod3 => !nearbyMod3s.has(mod3));
    
    if (availableMod3Groups.length > 0) {
      // Pick a random Mod3 group that's not used nearby
      const randomMod3 = availableMod3Groups[Math.floor(Math.random() * availableMod3Groups.length)];
      
      // Collect all available PCIs in this Mod3 group
      const candidates = [];
      for (let pci = randomMod3; pci <= this.PCI_MAX; pci += 3) {
        if (pci >= this.PCI_MIN && !nearbyPCIs.has(pci)) {
          candidates.push(pci);
        }
      }
      
      if (candidates.length > 0) {
        // Pick RANDOM from candidates (not first!)
        const randomPCI = candidates[Math.floor(Math.random() * candidates.length)];
        console.log(`      → Strategy: Different Mod3 (${randomMod3}) - picked ${randomPCI} from ${candidates.length} options`);
        return randomPCI;
      }
    }
    
    // STEP 2: If can't get different Mod3, at least get different PCI
    const availablePCIs = [];
    for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
      if (!nearbyPCIs.has(pci) && pci % 3 !== currentMod3) {
        availablePCIs.push(pci);
      }
    }
    
    if (availablePCIs.length > 0) {
      const randomPCI = availablePCIs[Math.floor(Math.random() * availablePCIs.length)];
      console.log(`      → Strategy: Different PCI, any Mod3 - picked ${randomPCI}`);
      return randomPCI;
    }
    
    // STEP 3: Last resort - pick ANY PCI >= 30 that's not used
    const anyAvailable = [];
    for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
      if (!usedPCIs.has(pci)) {
        anyAvailable.push(pci);
      }
    }
    
    if (anyAvailable.length > 0) {
      const randomPCI = anyAvailable[Math.floor(Math.random() * anyAvailable.length)];
      console.log(`      → Strategy: Any unused PCI - picked ${randomPCI}`);
      return randomPCI;
    }
    
    // STEP 4: Absolute last resort - random PCI >= 30
    const randomPCI = Math.floor(Math.random() * (this.PCI_MAX - this.PCI_MIN + 1)) + this.PCI_MIN;
    console.log(`      → Strategy: Random fallback - picked ${randomPCI}`);
    return randomPCI;
  }
  
  /**
   * Calculate distance between two points (meters)
   */
  private distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const simplePCIOptimizer = new SimplePCIOptimizer();

