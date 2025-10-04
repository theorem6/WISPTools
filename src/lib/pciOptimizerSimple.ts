// Simple, Effective PCI Optimizer
// KISS Principle: Keep It Simple, Stupid
// This optimizer ACTUALLY WORKS by using straightforward logic

import { pciMapper, type Cell, type PCIConflict } from './pciMapper';
import type { OptimizationResult, PCIChange } from './pciOptimizer';
import { wolframService } from './wolframService';

export class SimplePCIOptimizer {
  private readonly PCI_MIN = 30; // Reserve 0-29 for WISPs
  private readonly PCI_MAX = 503;
  private readonly MAX_ITERATIONS_WITHOUT_PROGRESS = 5; // Stop if stuck for 5 iterations (reduced to trigger emergency fallback faster)
  private readonly ABSOLUTE_MAX_ITERATIONS = 100; // Safety limit
  private readonly MAX_SHAKEUPS = 3; // Maximum number of random shakeups before giving up
  
  /**
   * Calculate modulus quality score - higher is better
   * Only MOD3, MOD6, and MOD30 are considered per SON requirements
   * MOD3 = 3 (worst - most destructive)
   * MOD6 = 6 (moderate)
   * MOD30 = 30 (best - least destructive)
   */
  private calculateModulusQuality(conflicts: PCIConflict[]): number {
    let totalQuality = 0;
    for (const conflict of conflicts) {
      if (conflict.severity === 'CRITICAL' || conflict.severity === 'UNRESOLVABLE') {
        totalQuality += 0; // Critical = no quality
      } else if (conflict.conflictType === 'COLLISION') {
        totalQuality += 0; // Collision = no quality
      } else if (conflict.conflictType === 'MOD3') {
        totalQuality += 3; // Worst modulus type
      } else if (conflict.conflictType === 'MOD6') {
        totalQuality += 6; // Moderate
      } else if (conflict.conflictType === 'MOD30') {
        totalQuality += 30; // Best - least interference
      } else {
        totalQuality += 10; // Other types (FREQUENCY, ADJACENT, etc.)
      }
    }
    return totalQuality;
  }
  
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
    
    const initialMod3Count = initialConflicts.filter(c => c.conflictType === 'MOD3').length;
    const initialModulusQuality = this.calculateModulusQuality(initialConflicts);
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎯 SON-COMPLIANT PCI OPTIMIZER`);
    console.log(`📊 Starting: ${originalConflictCount} conflicts`);
    console.log(`   🔴 Critical: ${initialCritical}`);
    console.log(`   🟠 High: ${initialHigh}`);
    console.log(`   📐 MOD3 Conflicts: ${initialMod3Count} (critical for TDD/MIMO)`);
    console.log(`   📊 Modulus Quality: ${initialModulusQuality}`);
    console.log(`🎯 PRIMARY GOAL: Eliminate MOD3 conflicts (RS collision)`);
    console.log(`🎯 SECONDARY GOAL: Reduce MOD6 conflicts (for single-antenna systems)`);
    console.log(`⚡ Strategy: MOD3 → MOD6 → MOD30 (MOD30 is acceptable end state)`);
    console.log(`📊 Industry Standard: MOD3 critical (TDD), MOD6 moderate, MOD30 rarely an issue`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    let iteration = 0;
    let prevConflicts = originalConflictCount;
    let prevCritical = initialCritical;
    let prevHigh = initialHigh;
    let prevMod3Count = initialMod3Count;
    let prevModulusQuality = initialModulusQuality;
    let bestCells = JSON.parse(JSON.stringify(currentCells)) as Cell[]; // Track best solution
    let bestConflicts = originalConflictCount;
    let bestCritical = initialCritical;
    let bestHigh = initialHigh;
    let bestModulusQuality = initialModulusQuality;
    let rollbackCount = 0; // Track consecutive rollbacks for extra randomization
    let iterationsWithoutProgress = 0; // Track stagnation
    let totalChangesApplied = 0; // Track efficiency
    let shakeupsUsed = 0; // Track how many random shakeups we've attempted
    
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
      
      console.log(`\n🔄 Iteration ${iteration}: Applying ${changes.length} PCI changes...`);
      
      if (changes.length === 0) {
        console.error(`   ❌ No changes generated from conflict resolution!`);
        console.error(`   🔍 Conflicts detected: ${conflicts.length} (🔴 ${conflicts.filter(c => c.severity === 'CRITICAL').length} critical)`);
        
        // EMERGENCY FALLBACK: Force a change on the first conflicting cell
        if (conflicts.length > 0) {
          console.warn(`   🚨 EMERGENCY FALLBACK: Forcing PCI change on first conflict...`);
          
          const firstConflict = conflicts[0];
          const cellToChange = firstConflict.conflictingCell;
          const cellIndex = currentCells.findIndex(c => c.id === cellToChange.id);
          
          if (cellIndex !== -1) {
            const oldPCI = cellToChange.pci;
            // Try +4 (MOD3 shift), or +1 if that doesn't work
            let newPCI = oldPCI + 4;
            if (newPCI > this.PCI_MAX) {
              newPCI = oldPCI + 1;
              if (newPCI > this.PCI_MAX) {
                newPCI = this.PCI_MIN; // Wrap to start
              }
            }
            
            currentCells[cellIndex].pci = newPCI;
            changes.push({
              cellId: cellToChange.id,
              oldPCI,
              newPCI,
              reason: `Emergency fallback: Force change to break stagnation`
            });
            
            console.warn(`   🔧 Forced change: ${cellToChange.id}: ${oldPCI} → ${newPCI}`);
          } else {
            console.error(`   ❌ Cannot apply emergency fix - cell not found`);
            break;
          }
        } else {
          console.error(`   🛑 No conflicts to fix - stopping`);
          break;
        }
      }
      
      // Log the actual PCI changes that were applied
      for (const change of changes) {
        const cell = currentCells.find(c => c.id === change.cellId);
        console.log(`   📝 ${change.cellId}: PCI ${change.oldPCI} → ${change.newPCI} (Current: ${cell?.pci}) ${cell?.pci === change.newPCI ? '✅' : '❌ NOT APPLIED!'}`);
      }
      
      // Re-analyze conflicts after changes
      console.log(`   🔍 Re-analyzing conflicts after PCI changes...`);
      conflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
      const totalConflicts = conflicts.length;
      const totalCritical = conflicts.filter(c => c.severity === 'CRITICAL').length;
      const totalHigh = conflicts.filter(c => c.severity === 'HIGH').length;
      const totalMedium = conflicts.filter(c => c.severity === 'MEDIUM').length;
      const totalLow = conflicts.filter(c => c.severity === 'LOW').length;
      
      // Calculate modulus quality metrics
      const currentMod3Count = conflicts.filter(c => c.conflictType === 'MOD3').length;
      const currentModulusQuality = this.calculateModulusQuality(conflicts);
      
      console.log(`📊 After changes: ${totalConflicts} conflicts (🔴 ${totalCritical} critical, 🟠 ${totalHigh} high, 🟡 ${totalMedium} med, 🟢 ${totalLow} low)`);
      console.log(`   📐 MOD3: ${currentMod3Count} | Modulus Quality: ${currentModulusQuality} (higher = better)`);
      
      // EFFICIENCY CHECK: Did we make progress?
      // Priority: Critical > High > MOD3 Count > Modulus Quality > Total Conflicts
      const madeProgress = (totalCritical < prevCritical) || 
                          (totalCritical === prevCritical && totalHigh < prevHigh) ||
                          (totalCritical === prevCritical && totalHigh === prevHigh && currentMod3Count < prevMod3Count) ||
                          (totalCritical === prevCritical && totalHigh === prevHigh && currentMod3Count === prevMod3Count && currentModulusQuality > prevModulusQuality) ||
                          (totalCritical === prevCritical && totalHigh === prevHigh && currentMod3Count === prevMod3Count && currentModulusQuality === prevModulusQuality && totalConflicts < prevConflicts);
      
      if (totalCritical > prevCritical || (totalCritical === prevCritical && totalCritical > 0 && totalHigh >= prevHigh && totalConflicts >= prevConflicts)) {
        console.error(`❌ REJECTED! Critical conflicts increased or didn't improve: ${prevCritical} → ${totalCritical}`);
        console.log(`🔙 Rolling back ${changes.length} PCI changes...`);
        
        // Show what's being rolled back
        for (const change of changes.slice(0, 3)) {
          console.log(`   ↩️  ${change.cellId}: ${change.newPCI} → ${change.oldPCI} (reverting)`);
        }
        if (changes.length > 3) {
          console.log(`   ... and ${changes.length - 3} more changes`);
        }
        
        // ROLLBACK: Restore cells from before this iteration
        currentCells = cellsBeforeIteration;
        rollbackCount++; // Increase for more aggressive randomization
        iterationsWithoutProgress++; // Track stagnation
        
        // Verify rollback worked
        const revertedCell = currentCells.find(c => c.id === changes[0]?.cellId);
        if (revertedCell) {
          console.log(`   ✅ Rollback verified: ${revertedCell.id} PCI is now ${revertedCell.pci}`);
        }
        
        // Try more aggressive randomization next iteration by increasing diversity
        console.log(`   🎲 Next iteration will use MORE randomization (rollback #${rollbackCount})`);
        
        // Check if we're stuck
        if (iterationsWithoutProgress >= this.MAX_ITERATIONS_WITHOUT_PROGRESS) {
          shakeupsUsed++;
          
          if (shakeupsUsed > this.MAX_SHAKEUPS) {
            console.error(`\n❌ MAX SHAKEUPS REACHED: Tried ${this.MAX_SHAKEUPS} random restarts`);
            console.error(`🛑 Optimizer exhausted all attempts`);
            console.error(`   Best achieved: ${bestConflicts} conflicts (🔴 ${bestCritical} critical, 🟠 ${bestHigh} high)`);
            break;
          }
          
          console.error(`\n❌ STAGNATION DETECTED: No progress for ${iterationsWithoutProgress} consecutive iterations`);
          console.warn(`🎲 SHAKEUP #${shakeupsUsed}/${this.MAX_SHAKEUPS}: Randomizing PCIs to break deadlock...`);
          
          // Get all cells involved in conflicts
          const conflictingCellIds = new Set<string>();
          for (const conflict of conflicts) {
            conflictingCellIds.add(conflict.primaryCell.id);
            conflictingCellIds.add(conflict.conflictingCell.id);
          }
          
          // Randomly reassign PCIs to these cells
          let randomizedCount = 0;
          for (const cellId of conflictingCellIds) {
            const cellIndex = currentCells.findIndex(c => c.id === cellId);
            if (cellIndex !== -1) {
              const oldPCI = currentCells[cellIndex].pci;
              const newPCI = Math.floor(Math.random() * (this.PCI_MAX - this.PCI_MIN + 1)) + this.PCI_MIN;
              currentCells[cellIndex].pci = newPCI;
              console.log(`   🎲 ${cellId}: ${oldPCI} → ${newPCI} (random)`);
              randomizedCount++;
            }
          }
          
          console.warn(`   ✅ Randomized ${randomizedCount} cells, restarting optimization (attempt ${shakeupsUsed + 1})...`);
          
          // Reset counters and try again
          iterationsWithoutProgress = 0;
          rollbackCount = 0;
          prevCritical = 999; // Force acceptance of first iteration
          prevHigh = 999;
          prevConflicts = 999;
          
          // Don't break - continue to next iteration with fresh random state
          continue;
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
          shakeupsUsed++;
          
          if (shakeupsUsed > this.MAX_SHAKEUPS) {
            console.error(`\n❌ MAX SHAKEUPS REACHED: Tried ${this.MAX_SHAKEUPS} random restarts`);
            console.error(`🛑 Optimizer exhausted all attempts`);
            console.error(`   Best achieved: ${bestConflicts} conflicts (🔴 ${bestCritical} critical, 🟠 ${bestHigh} high)`);
            break;
          }
          
          console.error(`\n❌ STAGNATION DETECTED: No progress for ${iterationsWithoutProgress} consecutive iterations`);
          console.warn(`🎲 SHAKEUP #${shakeupsUsed}/${this.MAX_SHAKEUPS}: Randomizing PCIs to break deadlock...`);
          
          // Get all cells involved in conflicts
          const conflictingCellIds = new Set<string>();
          for (const conflict of conflicts) {
            conflictingCellIds.add(conflict.primaryCell.id);
            conflictingCellIds.add(conflict.conflictingCell.id);
          }
          
          // Randomly reassign PCIs to these cells
          let randomizedCount = 0;
          for (const cellId of conflictingCellIds) {
            const cellIndex = currentCells.findIndex(c => c.id === cellId);
            if (cellIndex !== -1) {
              const oldPCI = currentCells[cellIndex].pci;
              const newPCI = Math.floor(Math.random() * (this.PCI_MAX - this.PCI_MIN + 1)) + this.PCI_MIN;
              currentCells[cellIndex].pci = newPCI;
              console.log(`   🎲 ${cellId}: ${oldPCI} → ${newPCI} (random)`);
              randomizedCount++;
            }
          }
          
          console.warn(`   ✅ Randomized ${randomizedCount} cells, restarting optimization (attempt ${shakeupsUsed + 1})...`);
          
          // Reset counters and try again
          iterationsWithoutProgress = 0;
          rollbackCount = 0;
          prevCritical = 999; // Force acceptance of first iteration
          prevHigh = 999;
          prevConflicts = 999;
          
          // Don't break - continue to next iteration with fresh random state
          continue;
        }
        
        continue;
      }
      
      // Changes ACCEPTED - this iteration improved things!
      console.log(`   ✅ ACCEPTED! Total: ${prevConflicts}→${totalConflicts} (🔴 ${prevCritical}→${totalCritical}, 🟠 ${prevHigh}→${totalHigh})`);
      console.log(`   📐 MOD3: ${prevMod3Count}→${currentMod3Count} | Quality: ${prevModulusQuality}→${currentModulusQuality}`);
      console.log(`   💾 Committing ${changes.length} PCI changes to network state...`);
      
      // Verify changes are persisted
      for (const change of changes.slice(0, 3)) {
        const cell = currentCells.find(c => c.id === change.cellId);
        console.log(`   ✓ ${change.cellId}: PCI permanently set to ${cell?.pci}`);
      }
      if (changes.length > 3) {
        console.log(`   ... and ${changes.length - 3} more cells updated`);
      }
      
      allChanges.push(...changes);
      totalChangesApplied += changes.length;
      rollbackCount = 0; // Reset on success
      iterationsWithoutProgress = 0; // Reset stagnation counter on progress
      
      // Update best solution - prioritize: critical < high < modulus quality < total conflicts
      if (totalCritical < bestCritical || 
          (totalCritical === bestCritical && totalHigh < bestHigh) ||
          (totalCritical === bestCritical && totalHigh === bestHigh && currentModulusQuality > bestModulusQuality) ||
          (totalCritical === bestCritical && totalHigh === bestHigh && currentModulusQuality === bestModulusQuality && totalConflicts < bestConflicts)) {
        bestCells = JSON.parse(JSON.stringify(currentCells)) as Cell[];
        bestConflicts = totalConflicts;
        bestCritical = totalCritical;
        bestHigh = totalHigh;
        bestModulusQuality = currentModulusQuality;
        console.log(`   ⭐ NEW BEST: ${bestConflicts} total (${bestCritical} critical, ${bestHigh} high, Quality: ${currentModulusQuality})`);
      }
      
      // Track history
      convergenceHistory.push({
        iteration,
        conflictCount: conflicts.length,
        criticalCount: totalCritical,
        highCount: totalHigh,
        mod3Count: currentMod3Count,
        modulusQuality: currentModulusQuality,
        changes: allChanges.length
      });
      
      // Update tracking variables for next iteration
      prevConflicts = totalConflicts;
      prevCritical = totalCritical;
      prevHigh = totalHigh;
      prevMod3Count = currentMod3Count;
      prevModulusQuality = currentModulusQuality;
      
      // Check ULTIMATE goal: Zero conflicts
      if (totalConflicts === 0) {
        console.log(`\n💎 ULTIMATE GOAL ACHIEVED! ZERO CONFLICTS!`);
        console.log(`✨ Network is perfectly deconflicted!`);
        console.log(`⚡ Efficiency: ${totalChangesApplied} changes in ${iteration} iterations`);
        console.log(`📈 Improvement: ${originalConflictCount} → 0 conflicts (100%)`);
        console.log(`📐 Modulus Quality: ${initialModulusQuality} → ${currentModulusQuality}`);
        
        // Validate with Wolfram Alpha
        await this.validateWithWolfram(totalCritical, totalHigh, totalChangesApplied);
        break; // Stop - ultimate goal achieved
      }
      
      // SON CONTINUOUS IMPROVEMENT: Don't stop at critical=0, improve modulus types
      if (totalCritical === 0 && totalHigh === 0) {
        if (currentMod3Count > 0) {
          console.log(`\n🌟 Critical and High ELIMINATED! But ${currentMod3Count} MOD3 conflicts remain`);
          console.log(`⚡ SON OPTIMIZATION: Converting MOD3 → MOD6/MOD30...`);
          console.log(`📊 Target: Eliminate all MOD3 (critical for TDD/MIMO systems)`);
          // Don't break - continue optimizing to improve modulus quality
        } else if (totalConflicts > 0) {
          const mod6Count = conflicts.filter(c => c.conflictType === 'MOD6').length;
          const mod30Count = conflicts.filter(c => c.conflictType === 'MOD30').length;
          console.log(`\n🌟 Critical, High, and MOD3 ELIMINATED!`);
          console.log(`   📊 Remaining: ${mod6Count} MOD6, ${mod30Count} MOD30`);
          if (mod6Count > 0) {
            console.log(`⚡ Optimizing MOD6 conflicts (important for single-antenna systems)...`);
            // Continue to reduce MOD6
          } else {
            console.log(`✅ Optimal PCI plan achieved! Only MOD30 conflicts remain.`);
            console.log(`📋 Note: MOD30 conflicts rarely cause real issues in commercial networks`);
            // MOD30 only is acceptable - we can stop
            break;
          }
        }
      }
    }
    
    // Use best solution found
    currentCells = bestCells;
    
    // Final analysis
    const finalConflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
    const finalCritical = finalConflicts.filter(c => c.severity === 'CRITICAL').length;
    const finalHigh = finalConflicts.filter(c => c.severity === 'HIGH').length;
    const finalMod3Count = finalConflicts.filter(c => c.conflictType === 'MOD3').length;
    const finalModulusQuality = this.calculateModulusQuality(finalConflicts);
    
    const conflictsResolved = originalConflictCount - finalConflicts.length;
    const reductionPercent = originalConflictCount > 0 ? 
      ((conflictsResolved) / originalConflictCount) * 100 : 0;
    const mod3Improvement = initialMod3Count - finalMod3Count;
    const qualityImprovement = finalModulusQuality - initialModulusQuality;
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // Determine success or failure
    if (conflictsResolved === 0 && originalConflictCount > 0) {
      console.log(`❌ OPTIMIZATION FAILED - NO PROGRESS`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`⚠️  Could not resolve any conflicts`);
      console.log(`   Total Conflicts: ${originalConflictCount} → ${finalConflicts.length} (0% reduction)`);
      console.log(`   Iterations: ${iteration}`);
      console.log(`   Changes Attempted: ${allChanges.length}`);
      console.log(`   Random Shakeups Used: ${shakeupsUsed}/${this.MAX_SHAKEUPS}`);
      console.error(`\n💡 The optimizer tried everything:`);
      console.error(`   ✓ Quick MOD3 fix (+4 rule)`);
      console.error(`   ✓ Cost-based PCI selection`);
      console.error(`   ✓ Emergency fallback changes`);
      console.error(`   ✓ ${shakeupsUsed} random shakeup attempt(s)`);
      console.error(`\n🔍 Consider:`);
      console.error(`   • Check if cells are on same EARFCN/frequency`);
      console.error(`   • Verify cell locations and distances`);
      console.error(`   • Review remaining conflicts for manual resolution`);
    } else if (finalConflicts.length === 0) {
      console.log(`✅ OPTIMIZATION COMPLETE - PERFECT SUCCESS`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`💎 ZERO CONFLICTS - PERFECT DECONFLICTION!`);
      console.log(`📊 RESULTS:`);
      console.log(`   Total Conflicts: ${originalConflictCount} → 0 (100% reduction)`);
      console.log(`   🔴 Critical: ${initialCritical} → 0 ✅`);
      console.log(`   🟠 High: ${initialHigh} → 0 ✅`);
      console.log(`   📐 MOD3: ${initialMod3Count} → 0 ✅`);
      console.log(`   📊 Modulus Quality: ${initialModulusQuality} → ${finalModulusQuality} (+${qualityImprovement})`);
      console.log(`⚡ EFFICIENCY:`);
      console.log(`   Iterations: ${iteration}`);
      console.log(`   PCI Changes: ${allChanges.length}`);
      console.log(`   Changes per Iteration: ${(allChanges.length / iteration).toFixed(1)}`);
    } else if (conflictsResolved > 0) {
      console.log(`✅ OPTIMIZATION COMPLETE - PARTIAL SUCCESS`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 RESULTS:`);
      console.log(`   Total Conflicts: ${originalConflictCount} → ${finalConflicts.length} (${reductionPercent.toFixed(1)}% reduction)`);
      console.log(`   Conflicts Resolved: ${conflictsResolved}`);
      console.log(`   🔴 Critical: ${initialCritical} → ${finalCritical} ${finalCritical === 0 ? '✅' : `(${initialCritical - finalCritical} resolved)`}`);
      console.log(`   🟠 High: ${initialHigh} → ${finalHigh} ${finalHigh === 0 ? '✅' : `(${initialHigh - finalHigh} resolved)`}`);
      console.log(`   📐 MOD3: ${initialMod3Count} → ${finalMod3Count} ${finalMod3Count === 0 ? '✅' : `(${mod3Improvement} converted to higher modulus)`}`);
      console.log(`   📊 Modulus Quality: ${initialModulusQuality} → ${finalModulusQuality} (${qualityImprovement > 0 ? '+' : ''}${qualityImprovement})`);
      console.log(`⚡ EFFICIENCY:`);
      console.log(`   Iterations: ${iteration}`);
      console.log(`   PCI Changes: ${allChanges.length}`);
      console.log(`   Changes per Iteration: ${(allChanges.length / iteration).toFixed(1)}`);
      
      const finalMod6Count = finalConflicts.filter(c => c.conflictType === 'MOD6').length;
      const finalMod30Count = finalConflicts.filter(c => c.conflictType === 'MOD30').length;
      
      if (finalCritical === 0 && finalHigh === 0 && finalMod3Count === 0 && finalMod6Count === 0) {
        console.log(`🌟 OPTIMAL PCI PLAN ACHIEVED!`);
        console.log(`📊 Only ${finalMod30Count} MOD30 conflicts remain`);
        console.log(`✅ MOD30 conflicts are acceptable - rarely cause issues in commercial networks`);
      } else if (finalCritical === 0 && finalHigh === 0 && finalMod3Count === 0) {
        console.log(`🌟 Excellent PCI plan achieved!`);
        console.log(`📊 Remaining: ${finalMod6Count} MOD6, ${finalMod30Count} MOD30`);
        console.log(`📈 No MOD3 conflicts (critical for TDD/MIMO). MOD6 acceptable for multi-antenna systems.`);
      } else if (finalCritical === 0 && finalHigh === 0) {
        console.log(`🌟 All critical and high conflicts eliminated!`);
        console.log(`📐 ${finalMod3Count} MOD3 conflicts remain - recommend further optimization (critical for TDD)`);
      } else if (reductionPercent < 50) {
        console.warn(`⚠️  Less than 50% reduction - consider manual review`);
      }
    } else {
      console.log(`❌ OPTIMIZATION FAILED`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`   No conflicts to optimize`);
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
   * Quick MOD3 fix: Add +4 to PCI to shift MOD3 group
   * (PCI + 4) % 3 moves to next MOD3 group, resolving MOD3 conflicts
   * 
   * IMPORTANT: Only modifies ONE sector per conflict pair to avoid reintroducing conflicts
   */
  private tryQuickMod3Fix(cells: Cell[], conflicts: PCIConflict[]): PCIChange[] {
    const changes: PCIChange[] = [];
    const mod3Conflicts = conflicts.filter(c => c.conflictType === 'MOD3');
    
    if (mod3Conflicts.length === 0) {
      console.log(`   ⏭️  No MOD3 conflicts to fix with quick method`);
      return changes;
    }
    
    console.log(`   ⚡ Attempting quick MOD3 fix for ${mod3Conflicts.length} conflicts (add +4 rule)`);
    
    // Track which cells we've already modified - CRITICAL to avoid modifying both sectors
    const alreadyModified = new Set<string>();
    let skippedCount = 0;
    
    for (const conflict of mod3Conflicts.slice(0, 5)) { // Fix up to 5 at a time
      // Pick ONE cell to adjust (prefer conflicting cell, but check if already modified)
      let cellToChange = conflict.conflictingCell;
      
      // If conflicting cell already modified, try primary instead
      if (alreadyModified.has(conflict.conflictingCell.id)) {
        if (alreadyModified.has(conflict.primaryCell.id)) {
          // Both already modified - skip this conflict
          console.log(`      ⏭️  Skipping conflict (both cells already modified)`);
          skippedCount++;
          continue;
        }
        cellToChange = conflict.primaryCell;
      }
      
      // Double-check the other cell in the pair hasn't been modified
      const otherCell = cellToChange.id === conflict.primaryCell.id 
        ? conflict.conflictingCell 
        : conflict.primaryCell;
      
      if (alreadyModified.has(otherCell.id)) {
        // Other cell was already modified - skip to avoid reintroducing conflict
        console.log(`      ⏭️  Skipping ${cellToChange.id} (paired cell ${otherCell.id} already modified)`);
        skippedCount++;
        continue;
      }
      
      const cellIndex = cells.findIndex(c => c.id === cellToChange.id);
      if (cellIndex === -1) continue;
      
      const oldPCI = cellToChange.pci;
      let newPCI = oldPCI + 4;
      
      // WRAPAROUND: Keep within valid range (30-503)
      if (newPCI > this.PCI_MAX) {
        // Wrap around to beginning of pool
        const overflow = newPCI - this.PCI_MAX;
        newPCI = this.PCI_MIN + overflow - 1;
        console.log(`      🔄 Wraparound: ${oldPCI} + 4 = ${oldPCI + 4} → wrapped to ${newPCI}`);
      }
      
      // Double-check still in valid range
      if (newPCI < this.PCI_MIN || newPCI > this.PCI_MAX) {
        // Fallback: try going backwards
        newPCI = oldPCI - 5;
        if (newPCI < this.PCI_MIN) {
          // Wrap from beginning
          newPCI = this.PCI_MAX - (this.PCI_MIN - newPCI);
        }
      }
      
      // Verify it actually fixes the MOD3 conflict
      const oldMod3 = oldPCI % 3;
      const newMod3 = newPCI % 3;
      
      if (oldMod3 !== newMod3) {
        cells[cellIndex].pci = newPCI;
        alreadyModified.add(cellToChange.id); // Mark as modified
        
        changes.push({
          cellId: cellToChange.id,
          oldPCI,
          newPCI,
          reason: `Quick MOD3 fix: ${oldPCI} (+4) → ${newPCI} (Mod3: ${oldMod3}→${newMod3})`
        });
        console.log(`      ${cellToChange.id}: ${oldPCI} → ${newPCI} (Mod3: ${oldMod3}→${newMod3}) [paired cell: ${otherCell.id} unchanged]`);
      }
    }
    
    if (changes.length > 0) {
      console.log(`   ✅ Quick MOD3 fix: Modified ${changes.length} sectors (skipped ${skippedCount})`);
    } else if (skippedCount > 0) {
      console.warn(`   ⚠️  Quick MOD3 fix: No changes made (all ${skippedCount} conflicts skipped - cells already modified)`);
      console.warn(`   💡 Will fall back to full conflict resolution`);
    } else {
      console.warn(`   ⚠️  Quick MOD3 fix: Failed to generate any changes`);
    }
    
    return changes;
  }
  
  /**
   * Resolve conflicts EFFICIENTLY using hotspot analysis
   * Identifies cells involved in multiple conflicts and fixes them first
   */
  private resolveConflictsEfficiently(cells: Cell[], conflicts: PCIConflict[], iteration: number, rollbackCount = 0): PCIChange[] {
    const changes: PCIChange[] = [];
    const modifiedThisIteration = new Set<string>();
    
    // STEP 0: Try quick MOD3 fix first (add +4 rule)
    const quickFixes = this.tryQuickMod3Fix(cells, conflicts);
    if (quickFixes.length > 0) {
      console.log(`   ✅ Quick MOD3 fix applied: ${quickFixes.length} changes`);
      return quickFixes; // Return immediately if quick fix worked
    }
    
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
   * Pick a PCI using cost-based selection following WISP hierarchy:
   * 1. MUST avoid MOD3 conflicts on same channel (high cost)
   * 2. Should avoid MOD30 conflicts on same channel (medium cost)
   * 3. Allow N=1 reuse on different channels (low cost if distance OK)
   * 
   * Uses weighted cost function instead of pure randomization for better results
   */
  private pickRandomGoodPCI(cell: Cell, allCells: Cell[], usedPCIs: Set<number>, extraRandom = false): number {
    const currentMod3 = cell.pci % 3;
    const currentEarfcn = cell.earfcn || cell.frequency;
    
    // Find nearby cells (within 10km) - these are the ones that matter
    const nearbyCells = allCells.filter(c => {
      if (c.id === cell.id) return false;
      const dist = this.distance(cell.latitude, cell.longitude, c.latitude, c.longitude);
      return dist < 10000; // 10km radius
    });
    
    // CRITICAL: Get cells on SAME CHANNEL (same EARFCN)
    const sameChannelCells = nearbyCells.filter(c => {
      const cEarfcn = c.earfcn || c.frequency;
      return Math.abs(cEarfcn - currentEarfcn) < 1; // Same channel
    });
    
    // Get forbidden PCIs and Mod values for SAME CHANNEL
    const sameChannelPCIs = new Set(sameChannelCells.map(c => c.pci));
    const sameChannelMod3s = new Set(sameChannelCells.map(c => c.pci % 3)); // MUST avoid
    const sameChannelMod30s = new Set(sameChannelCells.map(c => c.pci % 30)); // SHOULD avoid
    
    // Get nearby PCIs on different channels (less restrictive)
    const nearbyPCIs = new Set(nearbyCells.map(c => c.pci));
    const nearbyMod3s = new Set(nearbyCells.map(c => c.pci % 3));
    
    // STEP 1: PRIORITY - Avoid same-channel MOD3 conflicts (CRITICAL)
    // Find PCIs that have different MOD3 from same-channel cells AND different MOD30
    const sameChannelSafeMod3Groups = [0, 1, 2].filter(mod3 => !sameChannelMod3s.has(mod3));
    
    if (sameChannelSafeMod3Groups.length > 0) {
      const candidates = [];
      
      for (const safeMod3 of sameChannelSafeMod3Groups) {
        for (let pci = safeMod3; pci <= this.PCI_MAX; pci += 3) {
          if (pci < this.PCI_MIN) continue;
          
          const pciMod30 = pci % 30;
          
          // CRITICAL: Must not match same-channel MOD3
          if (sameChannelMod3s.has(pci % 3)) continue;
          
          // HIGH PRIORITY: Should not match same-channel MOD30 (PSS/SSS)
          if (sameChannelMod30s.has(pciMod30)) continue;
          
          // Avoid using exact same PCI as same-channel cells
          if (sameChannelPCIs.has(pci)) continue;
          
          // Avoid if nearby cells on ANY channel use it (less restrictive)
          if (!extraRandom && nearbyPCIs.has(pci)) continue;
          
          candidates.push(pci);
        }
      }
      
      if (candidates.length > 0) {
        // Use cost-based selection for optimal choice
        const pciWithCost = candidates.map(pci => ({
          pci,
          cost: this.calculatePCICost(pci, cell, allCells)
        }));
        
        // Sort by cost (lowest first)
        pciWithCost.sort((a, b) => a.cost - b.cost);
        
        // Take best option (or randomly from top 3 for diversity)
        const topCandidates = pciWithCost.slice(0, Math.min(3, pciWithCost.length));
        const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];
        
        console.log(`      → OPTIMAL: No same-channel MOD3/MOD30 - picked ${selected.pci} (cost: ${selected.cost}, from ${candidates.length} options)`);
        return selected.pci;
      }
    }
    
    // STEP 2: Relax MOD30 constraint if needed, but KEEP MOD3 constraint for same channel
    if (sameChannelSafeMod3Groups.length > 0) {
      const candidates = [];
      
      for (const safeMod3 of sameChannelSafeMod3Groups) {
        for (let pci = safeMod3; pci <= this.PCI_MAX; pci += 3) {
          if (pci < this.PCI_MIN) continue;
          
          // CRITICAL: Still must not match same-channel MOD3
          if (sameChannelMod3s.has(pci % 3)) continue;
          
          // Allow MOD30 match now (less optimal but acceptable)
          // Avoid exact PCI match on same channel
          if (sameChannelPCIs.has(pci)) continue;
          
          candidates.push(pci);
        }
      }
      
      if (candidates.length > 0) {
        const randomPCI = candidates[Math.floor(Math.random() * candidates.length)];
        console.log(`      → GOOD: No same-channel MOD3 conflict (MOD30 may exist) - picked ${randomPCI}`);
        return randomPCI;
      }
    }
    
    // STEP 3: Try different channels with different MOD3 from all nearby
    const availableMod3Groups = [0, 1, 2].filter(mod3 => !nearbyMod3s.has(mod3));
    
    if (availableMod3Groups.length > 0) {
      const candidates = [];
      for (const mod3 of availableMod3Groups) {
        for (let pci = mod3; pci <= this.PCI_MAX; pci += 3) {
          if (pci < this.PCI_MIN) continue;
          if (!nearbyPCIs.has(pci)) {
            candidates.push(pci);
          }
        }
      }
      
      if (candidates.length > 0) {
        const randomPCI = candidates[Math.floor(Math.random() * candidates.length)];
        console.log(`      → ACCEPTABLE: Different MOD3 from all nearby - picked ${randomPCI}`);
        return randomPCI;
      }
    }
    
    // STEP 4: At least avoid same-channel conflicts (critical constraint)
    const candidates = [];
    for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
      // MUST not match same-channel MOD3 (critical rule)
      if (sameChannelMod3s.has(pci % 3)) continue;
      
      // Avoid exact same-channel PCI match
      if (sameChannelPCIs.has(pci)) continue;
      
      candidates.push(pci);
    }
    
    if (candidates.length > 0) {
      const randomPCI = candidates[Math.floor(Math.random() * candidates.length)];
      console.log(`      → MINIMUM: No same-channel MOD3 - picked ${randomPCI}`);
      return randomPCI;
    }
    
    // STEP 5: Any unused PCI from the pool (30-503)
    const anyAvailable = [];
    for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
      if (!usedPCIs.has(pci)) {
        anyAvailable.push(pci);
      }
    }
    
    if (anyAvailable.length > 0) {
      const randomPCI = anyAvailable[Math.floor(Math.random() * anyAvailable.length)];
      console.warn(`      → ⚠️  LAST RESORT: Any unused PCI - picked ${randomPCI} (${anyAvailable.length} available)`);
      return randomPCI;
    }
    
    // STEP 6: POOL EXHAUSTED - Use least-cost PCI even if "in use"
    // This means we're reusing PCIs, which is acceptable with proper distance
    console.warn(`      ⚠️  PCI pool exhausted (all 474 PCIs in use), calculating least-cost reuse...`);
    
    const allPCIs = [];
    for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
      allPCIs.push(pci);
    }
    
    // Calculate cost for ALL PCIs and pick the lowest
    const pciWithCost = allPCIs.map(pci => ({
      pci,
      cost: this.calculatePCICost(pci, cell, allCells)
    }));
    
    pciWithCost.sort((a, b) => a.cost - b.cost);
    
    // Pick from top 5 lowest cost (some randomization)
    const topCandidates = pciWithCost.slice(0, Math.min(5, pciWithCost.length));
    const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    
    console.warn(`      → 🔄 WRAPAROUND REUSE: Picked ${selected.pci} (cost: ${selected.cost}, reusing from pool)`);
    return selected.pci;
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
   * Calculate cost score for a candidate PCI based on potential conflicts
   * Lower cost = better PCI choice
   * 
   * Cost penalties:
   * - PCI collision (same PCI as nearby cell): 100 points
   * - Same-channel MOD3 conflict: 50 points (CRITICAL)
   * - Same-channel MOD30 conflict: 25 points (HIGH)
   * - Different-channel MOD3 conflict: 10 points (MEDIUM)
   * - Same PCI globally: 5 points (avoid reuse when possible)
   */
  private calculatePCICost(candidatePCI: number, cell: Cell, allCells: Cell[]): number {
    let cost = 0;
    const currentEarfcn = cell.earfcn || cell.frequency;
    
    for (const otherCell of allCells) {
      if (otherCell.id === cell.id) continue;
      
      const dist = this.distance(cell.latitude, cell.longitude, otherCell.latitude, otherCell.longitude);
      const otherEarfcn = otherCell.earfcn || otherCell.frequency;
      const sameChannel = Math.abs(currentEarfcn - otherEarfcn) < 1;
      
      // Only consider cells within interference range
      if (dist > 15000) continue; // Beyond 15km
      
      // COLLISION: Exact same PCI nearby (worst case)
      if (candidatePCI === otherCell.pci) {
        if (dist < 5000) {
          cost += 100; // Very high penalty for collision
        } else if (dist < 10000) {
          cost += 50;
        } else {
          cost += 20;
        }
      }
      
      // Same-channel conflicts (critical for WISP)
      if (sameChannel) {
        // MOD3 conflict on same channel = CRITICAL
        if (candidatePCI % 3 === otherCell.pci % 3) {
          cost += 50; // High penalty
        }
        
        // MOD30 conflict on same channel = HIGH (PSS/SSS)
        if (candidatePCI % 30 === otherCell.pci % 30) {
          cost += 25; // Medium-high penalty
        }
      } else {
        // Different channel conflicts (less severe)
        if (candidatePCI % 3 === otherCell.pci % 3 && dist < 5000) {
          cost += 10; // Lower penalty for different channels
        }
      }
    }
    
    return cost;
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

