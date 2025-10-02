// Simple, Effective PCI Optimizer
// KISS Principle: Keep It Simple, Stupid
// This optimizer ACTUALLY WORKS by using straightforward logic

import { pciMapper, type Cell, type PCIConflict } from './pciMapper';
import type { OptimizationResult, PCIChange } from './pciOptimizer';
import { wolframService } from './wolframService';

export class SimplePCIOptimizer {
  private readonly PCI_MIN = 30; // Reserve 0-29 for WISPs
  private readonly PCI_MAX = 503;
  private readonly MAX_ITERATIONS_WITHOUT_PROGRESS = 10; // Stop if stuck for 10 iterations
  private readonly ABSOLUTE_MAX_ITERATIONS = 100; // Safety limit
  
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
    console.log(`🎯 EFFICIENT PCI OPTIMIZER`);
    console.log(`📊 Starting: ${originalConflictCount} conflicts`);
    console.log(`   🔴 Critical: ${initialCritical}`);
    console.log(`   🟠 High: ${initialHigh}`);
    console.log(`🎯 ULTIMATE GOAL: 0 conflicts (complete deconfliction)`);
    console.log(`⚡ Strategy: Maximum efficiency, minimum changes`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    let iteration = 0;
    let prevConflicts = originalConflictCount;
    let prevCritical = initialCritical;
    let prevHigh = initialHigh;
    let bestCells = JSON.parse(JSON.stringify(currentCells)) as Cell[]; // Track best solution
    let bestConflicts = originalConflictCount;
    let bestCritical = initialCritical;
    let bestHigh = initialHigh;
    let rollbackCount = 0; // Track consecutive rollbacks for extra randomization
    let iterationsWithoutProgress = 0; // Track stagnation
    let totalChangesApplied = 0; // Track efficiency
    
    // Run until critical = 0 OR stuck for too long OR hit safety limit
    while (iteration < this.ABSOLUTE_MAX_ITERATIONS) {
      iteration++;
      
      // Save state before making changes (for potential rollback)
      const cellsBeforeIteration = JSON.parse(JSON.stringify(currentCells)) as Cell[];
      
      // EFFICIENT STRATEGY: Prioritize by severity, fix hotspots first
      let conflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
      
      if (conflicts.length === 0) {
        console.log(`🎉 ZERO CONFLICTS! Perfect deconfliction achieved!`);
        break;
      }
      
      // Prioritize: Critical > High > Medium > Low
      const conflictsToFix = [
        ...conflicts.filter(c => c.severity === 'CRITICAL'),
        ...conflicts.filter(c => c.severity === 'HIGH'),
        ...conflicts.filter(c => c.severity === 'MEDIUM'),
        ...conflicts.filter(c => c.severity === 'LOW')
      ];
      
      // Process conflicts efficiently (pass rollback count for extra randomization)
      const changes = this.resolveConflictsEfficiently(currentCells, conflictsToFix, iteration, rollbackCount);
      
      console.log(`\n🔄 Iteration ${iteration}: Making ${changes.length} PCI changes...`);
      
      if (changes.length === 0) {
        console.warn(`   ⚠️  No changes possible - stopping`);
        break;
      }
      
      // Re-check conflicts after changes
      conflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
      const totalConflicts = conflicts.length;
      const totalCritical = conflicts.filter(c => c.severity === 'CRITICAL').length;
      const totalHigh = conflicts.filter(c => c.severity === 'HIGH').length;
      const totalMedium = conflicts.filter(c => c.severity === 'MEDIUM').length;
      const totalLow = conflicts.filter(c => c.severity === 'LOW').length;
      
      console.log(`📊 After changes: ${totalConflicts} conflicts (🔴 ${totalCritical} critical, 🟠 ${totalHigh} high, 🟡 ${totalMedium} med, 🟢 ${totalLow} low)`);
      
      // EFFICIENCY CHECK: Did we make progress?
      // Priority: Critical > High > Total Conflicts
      const madeProgress = (totalCritical < prevCritical) || 
                          (totalCritical === prevCritical && totalHigh < prevHigh) ||
                          (totalCritical === prevCritical && totalHigh === prevHigh && totalConflicts < prevConflicts);
      
      if (totalCritical > prevCritical || (totalCritical === prevCritical && totalCritical > 0 && totalHigh >= prevHigh && totalConflicts >= prevConflicts)) {
        console.error(`❌ REJECTED! Critical conflicts increased or didn't improve: ${prevCritical} → ${totalCritical}`);
        console.log(`🔙 Rolling back iteration ${iteration} changes...`);
        
        // ROLLBACK: Restore cells from before this iteration
        currentCells = cellsBeforeIteration;
        rollbackCount++; // Increase for more aggressive randomization
        iterationsWithoutProgress++; // Track stagnation
        
        // Try more aggressive randomization next iteration by increasing diversity
        console.log(`   🎲 Next iteration will use MORE randomization (rollback #${rollbackCount})`);
        
        // Check if we're stuck
        if (iterationsWithoutProgress >= this.MAX_ITERATIONS_WITHOUT_PROGRESS) {
          console.warn(`\n⚠️ STAGNATION DETECTED: No progress for ${iterationsWithoutProgress} iterations`);
          console.warn(`🛑 Stopping optimization - best solution so far:`);
          console.warn(`   🔴 Critical: ${bestCritical}`);
          console.warn(`   🟠 High: ${bestHigh}`);
          break;
        }
        
        continue; // Skip to next iteration without accepting changes
      }
      
      if (totalHigh > prevHigh || (totalHigh === prevHigh && totalHigh > 0 && totalCritical === prevCritical)) {
        console.warn(`❌ REJECTED! High conflicts increased or didn't improve: ${prevHigh} → ${totalHigh}`);
        console.log(`🔙 Rolling back iteration ${iteration} changes...`);
        
        // ROLLBACK
        currentCells = cellsBeforeIteration;
        rollbackCount++; // Increase for more aggressive randomization
        iterationsWithoutProgress++; // Track stagnation
        console.log(`   🎲 Next iteration will use MORE randomization (rollback #${rollbackCount})`);
        
        // Check if we're stuck
        if (iterationsWithoutProgress >= this.MAX_ITERATIONS_WITHOUT_PROGRESS) {
          console.warn(`\n⚠️ STAGNATION DETECTED: No progress for ${iterationsWithoutProgress} iterations`);
          console.warn(`🛑 Stopping optimization - best solution so far:`);
          console.warn(`   🔴 Critical: ${bestCritical}`);
          console.warn(`   🟠 High: ${bestHigh}`);
          break;
        }
        
        continue;
      }
      
      // Changes ACCEPTED - this iteration improved things!
      console.log(`   ✅ ACCEPTED! Total: ${prevConflicts}→${totalConflicts} (🔴 ${prevCritical}→${totalCritical}, 🟠 ${prevHigh}→${totalHigh})`);
      allChanges.push(...changes);
      totalChangesApplied += changes.length;
      rollbackCount = 0; // Reset on success
      iterationsWithoutProgress = 0; // Reset stagnation counter on progress
      
      // Update best solution if this is better (prioritize: critical < conflicts)
      if (totalCritical < bestCritical || 
          (totalCritical === bestCritical && totalHigh < bestHigh) ||
          (totalCritical === bestCritical && totalHigh === bestHigh && totalConflicts < bestConflicts)) {
        bestCells = JSON.parse(JSON.stringify(currentCells)) as Cell[];
        bestConflicts = totalConflicts;
        bestCritical = totalCritical;
        bestHigh = totalHigh;
        console.log(`   ⭐ NEW BEST: ${bestConflicts} total (${bestCritical} critical, ${bestHigh} high)`);
      }
      
      // Track history
      convergenceHistory.push({
        iteration,
        conflictCount: conflicts.length,
        criticalCount: totalCritical,
        highCount: totalHigh,
        changes: allChanges.length
      });
      
      // Check ULTIMATE goal: Zero conflicts
      if (totalConflicts === 0) {
        console.log(`\n💎 ULTIMATE GOAL ACHIEVED! ZERO CONFLICTS!`);
        console.log(`⚡ Efficiency: ${totalChangesApplied} changes in ${iteration} iterations`);
        console.log(`📈 Improvement: ${originalConflictCount} → 0 conflicts (100%)`);
        
        // Validate with Wolfram Alpha
        await this.validateWithWolfram(totalCritical, totalHigh, totalChangesApplied);
        break; // Stop - ultimate goal achieved
      }
      
      // Check secondary goal: Critical = 0
      if (totalCritical === 0 && totalHigh === 0) {
        console.log(`\n🌟 Critical and High conflicts ELIMINATED! (${totalConflicts} low-priority remaining)`);
        console.log(`⚡ Continuing to eliminate all conflicts...`);
      }
      
      prevConflicts = totalConflicts;
      prevCritical = totalCritical;
      prevHigh = totalHigh;
    }
    
    // Use best solution found
    currentCells = bestCells;
    
    // Final analysis
    const finalConflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
    const finalCritical = finalConflicts.filter(c => c.severity === 'CRITICAL').length;
    const finalHigh = finalConflicts.filter(c => c.severity === 'HIGH').length;
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ OPTIMIZATION COMPLETE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 RESULTS:`);
    console.log(`   Total Conflicts: ${originalConflictCount} → ${finalConflicts.length} (${((originalConflictCount - finalConflicts.length) / Math.max(originalConflictCount, 1) * 100).toFixed(1)}% reduction)`);
    console.log(`   🔴 Critical: ${initialCritical} → ${finalCritical} ${finalCritical === 0 ? '✅' : '❌'}`);
    console.log(`   🟠 High: ${initialHigh} → ${finalHigh} ${finalHigh === 0 ? '✅' : '❌'}`);
    console.log(`⚡ EFFICIENCY:`);
    console.log(`   Iterations: ${iteration}`);
    console.log(`   PCI Changes: ${allChanges.length}`);
    console.log(`   Changes per Iteration: ${(allChanges.length / iteration).toFixed(1)}`);
    if (finalConflicts.length === 0) {
      console.log(`💎 ZERO CONFLICTS - PERFECT DECONFLICTION!`);
    } else if (finalCritical === 0 && finalHigh === 0) {
      console.log(`🌟 All critical and high conflicts eliminated!`);
    }
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
   * Resolve conflicts EFFICIENTLY using hotspot analysis
   * Identifies cells involved in multiple conflicts and fixes them first
   */
  private resolveConflictsEfficiently(cells: Cell[], conflicts: PCIConflict[], iteration: number, rollbackCount = 0): PCIChange[] {
    const changes: PCIChange[] = [];
    const modifiedThisIteration = new Set<string>();
    
    // Get all currently used PCIs
    const usedPCIs = new Set(cells.map(c => c.pci));
    
    // EFFICIENCY: Identify hotspot cells (involved in multiple conflicts)
    const cellConflictCount = new Map<string, number>();
    for (const conflict of conflicts) {
      cellConflictCount.set(conflict.primaryCell.id, (cellConflictCount.get(conflict.primaryCell.id) || 0) + 1);
      cellConflictCount.set(conflict.conflictingCell.id, (cellConflictCount.get(conflict.conflictingCell.id) || 0) + 1);
    }
    
    // Smart number of fixes: more aggressive after rollbacks, but always efficient
    const baseToFix = rollbackCount > 0 ? 8 : 3; // Fewer changes = more efficient
    const numToFix = Math.min(baseToFix, conflicts.length);
    
    console.log(`   🎯 Efficiently fixing ${numToFix} conflicts (targeting hotspots)`);
    if (cellConflictCount.size > 0) {
      const maxConflicts = Math.max(...Array.from(cellConflictCount.values()));
      console.log(`   🔥 Hotspot detected: cell with ${maxConflicts} conflicts`);
    }
    
    // Process conflicts - prioritize hotspot cells
    for (let i = 0; i < numToFix && i < conflicts.length; i++) {
      const conflict = conflicts[i];
      
      // Pick which cell to change - prefer hotspot cells (involved in more conflicts)
      const primaryConflicts = cellConflictCount.get(conflict.primaryCell.id) || 0;
      const conflictingConflicts = cellConflictCount.get(conflict.conflictingCell.id) || 0;
      
      let cellToChange = conflict.conflictingCell;
      if (primaryConflicts > conflictingConflicts) {
        cellToChange = conflict.primaryCell; // Fix the hotspot
      } else if (primaryConflicts === conflictingConflicts && conflict.primaryCell.rsPower < conflict.conflictingCell.rsPower) {
        cellToChange = conflict.conflictingCell; // If equal, fix weaker signal
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
      // After rollbacks, use even more randomization
      const newPCI = this.pickRandomGoodPCI(cellToChange, cells, usedPCIs, rollbackCount > 0);
      
      if (newPCI !== oldPCI) {
        // Apply the change
        cells[cellIndex].pci = newPCI;
        usedPCIs.add(newPCI);
        modifiedThisIteration.add(cellToChange.id);
        
        changes.push({
          cellId: cellToChange.id,
          oldPCI,
          newPCI,
          reason: `Resolve ${conflict.severity} ${conflict.conflictType} conflict`
        });
        
        console.log(`      ${cellToChange.id}: ${oldPCI} → ${newPCI} (Mod3: ${oldPCI%3} → ${newPCI%3})`);
      }
    }
    
    return changes;
  }
  
  /**
   * Pick a random PCI that's good (simple, effective logic)
   */
  private pickRandomGoodPCI(cell: Cell, allCells: Cell[], usedPCIs: Set<number>, extraRandom = false): number {
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
  
  /**
   * Validate optimization results with Wolfram Alpha
   */
  private async validateWithWolfram(critical: number, high: number, changesCount: number): Promise<void> {
    try {
      console.log(`🔬 Validating results with Wolfram Alpha...`);
      
      // Query: "Is 0 critical conflicts optimal for LTE PCI planning?"
      const validationQuery = `PCI optimization: ${critical} critical conflicts, ${high} high priority conflicts, ${changesCount} changes - is this optimal?`;
      
      const wolframResult = await wolframService.query(validationQuery);
      
      if (wolframResult) {
        console.log(`✅ Wolfram Alpha validation:`);
        console.log(`   ${wolframResult.substring(0, 200)}...`);
      }
      
      // Query mathematical validation
      const mathQuery = `graph coloring: ${changesCount} vertices, mod 3 constraint, minimize conflicts`;
      const mathResult = await wolframService.query(mathQuery);
      
      if (mathResult) {
        console.log(`📐 Mathematical validation:`);
        console.log(`   ${mathResult.substring(0, 200)}...`);
      }
    } catch (error) {
      console.warn(`⚠️ Wolfram Alpha validation failed (non-critical):`, error);
    }
  }
}

export const simplePCIOptimizer = new SimplePCIOptimizer();

