// Advanced PCI Optimizer using Graph Coloring and Tabu Search
// Based on SON/CSON mathematical optimization principles
//
// KEY CONCEPTS:
// 1. Graph Coloring: Treat PCI assignment as a graph coloring problem
// 2. Tabu Search: Avoid revisiting recent PCI assignments
// 3. EARFCN-aware: Each EARFCN needs its own PCI (not just per sector)
// 4. Fixed Wireless: Optimize for stationary equipment

import { pciMapper, type Cell, type PCIConflict } from './pciMapper';
import type { OptimizationResult, PCIChange } from './pciOptimizer';

export class AdvancedPCIOptimizer {
  private readonly MAX_ITERATIONS = 30;
  private readonly PCI_MIN = 30; // Reserve 0-29 for WISPs
  private readonly PCI_MAX = 503;
  
  // Tabu search parameters
  private readonly TABU_TENURE = 7; // How long to remember bad assignments
  private tabuList: Map<string, number> = new Map(); // cellId+PCI -> iteration number
  
  // Graph coloring - interference matrix
  private interferenceMatrix: Map<string, Set<string>> = new Map();
  
  /**
   * Graph Coloring Approach to PCI Assignment
   * 
   * Mathematical Model:
   * - Vertices (V) = Cells/EARFCNs
   * - Edges (E) = Conflicts between cells
   * - Colors (C) = Available PCIs (30-503)
   * - Goal: Assign colors to vertices such that no adjacent vertices share the same color
   * 
   * Constraint: PCIs must differ in Mod3 for cells with high interference
   * 
   * CRITICAL RULE: NEVER use the same PCI twice in the network (no collisions)
   */
  async optimizePCIAssignments(cells: Cell[], checkLOS: boolean = true): Promise<OptimizationResult> {
    const originalCells = JSON.parse(JSON.stringify(cells)) as Cell[];
    let currentCells = JSON.parse(JSON.stringify(cells)) as Cell[];
    
    const changes: PCIChange[] = [];
    const convergenceHistory: any[] = [];
    
    // STEP 1: Eliminate PCI collisions FIRST (highest priority)
    console.log(`🚨 STEP 1: Detecting and eliminating PCI collisions...`);
    const collisionChanges = await this.eliminatePCICollisions(currentCells);
    changes.push(...collisionChanges);
    
    if (collisionChanges.length > 0) {
      console.log(`✅ Eliminated ${collisionChanges.length} PCI collisions`);
    } else {
      console.log(`✅ No PCI collisions detected`);
    }
    
    // Build interference graph
    await this.buildInterferenceGraph(currentCells, checkLOS);
    
    // Initial conflict analysis
    const initialConflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
    const originalConflictCount = initialConflicts.length;
    
    let iteration = 0;
    let bestCells = JSON.parse(JSON.stringify(currentCells)) as Cell[];
    let bestConflictCount = originalConflictCount;
    let criticalCount = initialConflicts.filter(c => c.severity === 'CRITICAL').length;
    let highCount = initialConflicts.filter(c => c.severity === 'HIGH').length;
    let noImprovementCount = 0;
    
    console.log(`🎨 Graph Coloring PCI Optimization Started`);
    console.log(`📊 Initial: ${originalConflictCount} conflicts (${criticalCount} critical, ${highCount} high)`);
    console.log(`🎯 Goal: 0 critical + 0 high conflicts`);
    console.log(`🔒 WISP PCIs 0-30 excluded`);
    
    while (iteration < this.MAX_ITERATIONS && (criticalCount > 0 || highCount > 0 || noImprovementCount < 5)) {
      iteration++;
      
      const conflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
      const currentCriticalCount = conflicts.filter(c => c.severity === 'CRITICAL').length;
      const currentHighCount = conflicts.filter(c => c.severity === 'HIGH').length;
      const currentConflictCount = conflicts.length;
      
      console.log(`🔄 Iteration ${iteration}: ${currentConflictCount} conflicts (🔴 ${currentCriticalCount} critical, 🟠 ${currentHighCount} high)`);
      
      // Update best solution if this is better
      if (currentConflictCount < bestConflictCount || 
          (currentConflictCount === bestConflictCount && currentCriticalCount < criticalCount)) {
        bestCells = JSON.parse(JSON.stringify(currentCells)) as Cell[];
        bestConflictCount = currentConflictCount;
        noImprovementCount = 0;
        console.log(`✅ New best solution found!`);
      } else {
        noImprovementCount++;
      }
      
      // Check goal achievement
      if (currentCriticalCount === 0 && currentHighCount === 0) {
        console.log(`🎯 Goal achieved! 0 critical + 0 high conflicts`);
        if (currentConflictCount === 0) {
          console.log(`✨ Perfect optimization - zero conflicts!`);
          break;
        }
      }
      
      // Apply graph coloring with tabu search
      const iterationChanges = await this.graphColoringIteration(
        currentCells,
        conflicts,
        iteration,
        noImprovementCount >= 3 // Use diversification if stuck
      );
      
      changes.push(...iterationChanges);
      
      convergenceHistory.push({
        iteration,
        conflictCount: currentConflictCount,
        criticalCount: currentCriticalCount,
        highCount: currentHighCount,
        changes: iterationChanges.length
      });
      
      criticalCount = currentCriticalCount;
      highCount = currentHighCount;
      
      // Clean tabu list (remove old entries)
      this.cleanTabuList(iteration);
    }
    
    // Use best solution found
    currentCells = bestCells;
    
    const finalConflicts = await pciMapper.detectConflicts(currentCells, checkLOS);
    const finalConflictCount = finalConflicts.length;
    const finalCriticalCount = finalConflicts.filter(c => c.severity === 'CRITICAL').length;
    const finalHighCount = finalConflicts.filter(c => c.severity === 'HIGH').length;
    
    // FINAL VERIFICATION: Check for any remaining PCI collisions
    const finalPCICounts = new Map<number, number>();
    currentCells.forEach(cell => {
      finalPCICounts.set(cell.pci, (finalPCICounts.get(cell.pci) || 0) + 1);
    });
    
    const finalCollisions = Array.from(finalPCICounts.entries())
      .filter(([pci, count]) => count > 1);
    
    if (finalCollisions.length > 0) {
      console.error(`❌ ERROR: ${finalCollisions.length} PCI collisions detected in final result!`);
      finalCollisions.forEach(([pci, count]) => {
        const collidingCells = currentCells.filter(c => c.pci === pci);
        console.error(`   PCI ${pci} used by ${count} cells: ${collidingCells.map(c => c.id).join(', ')}`);
      });
    } else {
      console.log(`✅ VERIFIED: No PCI collisions in final result`);
    }
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎨 Graph Coloring Optimization Complete`);
    console.log(`📊 Results:`);
    console.log(`   • Total: ${originalConflictCount} → ${finalConflictCount}`);
    console.log(`   • Critical: ${initialConflicts.filter(c => c.severity === 'CRITICAL').length} → ${finalCriticalCount} ${finalCriticalCount === 0 ? '✅' : '⚠️'}`);
    console.log(`   • High: ${initialConflicts.filter(c => c.severity === 'HIGH').length} → ${finalHighCount} ${finalHighCount === 0 ? '✅' : '⚠️'}`);
    console.log(`   • Iterations: ${iteration}`);
    console.log(`   • PCI Changes: ${changes.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    return {
      originalCells,
      optimizedCells: currentCells,
      iterations: iteration,
      originalConflicts: originalConflictCount,
      finalConflicts: finalConflictCount,
      resolvedConflicts: originalConflictCount - finalConflictCount,
      conflictReduction: originalConflictCount > 0 ? ((originalConflictCount - finalConflictCount) / originalConflictCount) * 100 : 0,
      changes,
      convergenceHistory
    };
  }
  
  /**
   * Eliminate PCI collisions (same PCI used twice)
   * This is the HIGHEST PRIORITY - must be resolved before other conflicts
   * 
   * Algorithm:
   * 1. Find all cells with duplicate PCIs
   * 2. Keep the first cell with each PCI
   * 3. Reassign all duplicates to unused PCIs
   * 4. Prioritize PCIs that minimize mod-3/mod-6 conflicts
   */
  private async eliminatePCICollisions(cells: Cell[]): Promise<PCIChange[]> {
    const changes: PCIChange[] = [];
    const pciToCells = new Map<number, Cell[]>();
    const usedPCIs = new Set<number>();
    
    // Group cells by PCI
    for (const cell of cells) {
      if (!pciToCells.has(cell.pci)) {
        pciToCells.set(cell.pci, []);
      }
      pciToCells.get(cell.pci)!.push(cell);
      usedPCIs.add(cell.pci);
    }
    
    // Find collisions (PCIs used by multiple cells)
    const collisions = Array.from(pciToCells.entries())
      .filter(([pci, cells]) => cells.length > 1);
    
    if (collisions.length === 0) {
      return changes;
    }
    
    console.log(`🚨 Found ${collisions.length} PCI collisions:`);
    collisions.forEach(([pci, cells]) => {
      console.log(`   PCI ${pci} used by ${cells.length} cells: ${cells.map(c => c.id).join(', ')}`);
    });
    
    // For each collision, reassign all but the first cell
    for (const [pci, collidingCells] of collisions) {
      // Keep the first cell, reassign the rest
      for (let i = 1; i < collidingCells.length; i++) {
        const cellToReassign = collidingCells[i];
        const cellIndex = cells.findIndex(c => c.id === cellToReassign.id);
        
        if (cellIndex === -1) continue;
        
        // Find best available PCI (not used by any cell)
        const newPCI = this.findUnusedPCI(cellToReassign, cells, usedPCIs);
        
        // Update cell
        const oldPCI = cells[cellIndex].pci;
        cells[cellIndex].pci = newPCI;
        usedPCIs.add(newPCI);
        
        changes.push({
          cellId: cellToReassign.id,
          oldPCI,
          newPCI,
          reason: `🚨 COLLISION ELIMINATED: PCI ${oldPCI} was used by multiple cells`
        });
        
        console.log(`   ✅ ${cellToReassign.id}: PCI ${oldPCI} → ${newPCI} (collision eliminated)`);
      }
    }
    
    // Verify no collisions remain
    const finalPCICounts = new Map<number, number>();
    cells.forEach(cell => {
      finalPCICounts.set(cell.pci, (finalPCICounts.get(cell.pci) || 0) + 1);
    });
    
    const remainingCollisions = Array.from(finalPCICounts.entries())
      .filter(([pci, count]) => count > 1);
    
    if (remainingCollisions.length > 0) {
      console.error(`❌ WARNING: ${remainingCollisions.length} collisions still remain!`);
    }
    
    return changes;
  }
  
  /**
   * Find an unused PCI that minimizes conflicts with nearby cells
   */
  private findUnusedPCI(cell: Cell, allCells: Cell[], usedPCIs: Set<number>): number {
    // Get nearby cells (within reasonable distance for conflict consideration)
    const nearbyCells = allCells.filter(c => {
      if (c.id === cell.id) return false;
      const distance = this.calculateDistance(cell, c);
      return distance < 50000; // Within 50km
    });
    
    // Score each available PCI
    const scores = new Map<number, number>();
    
    for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
      // Skip if already used by another cell
      if (usedPCIs.has(pci)) continue;
      
      let score = 1000; // Start with high score
      
      // Evaluate against nearby cells
      for (const nearbyCell of nearbyCells) {
        const distance = this.calculateDistance(cell, nearbyCell);
        const distanceFactor = Math.max(0, 1 - distance / 50000); // 0-1 based on distance
        
        // Penalize mod-3 conflicts (more severe for closer cells)
        if (pci % 3 === nearbyCell.pci % 3) {
          score -= 500 * distanceFactor;
        }
        
        // Penalize mod-6 conflicts
        if (pci % 6 === nearbyCell.pci % 6) {
          score -= 200 * distanceFactor;
        }
        
        // Penalize mod-12 conflicts
        if (pci % 12 === nearbyCell.pci % 12) {
          score -= 50 * distanceFactor;
        }
      }
      
      scores.set(pci, score);
    }
    
    // Find best scoring PCI
    const sortedPCIs = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]);
    
    if (sortedPCIs.length > 0) {
      return sortedPCIs[0][0];
    }
    
    // Fallback: find any unused PCI
    for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
      if (!usedPCIs.has(pci)) {
        return pci;
      }
    }
    
    // Last resort: use a random PCI (shouldn't happen with 474 available PCIs)
    return this.PCI_MIN + Math.floor(Math.random() * (this.PCI_MAX - this.PCI_MIN + 1));
  }
  
  /**
   * Calculate distance between two cells (Haversine formula)
   */
  private calculateDistance(cell1: Cell, cell2: Cell): number {
    const R = 6371000; // Earth's radius in meters
    const lat1 = cell1.latitude * Math.PI / 180;
    const lat2 = cell2.latitude * Math.PI / 180;
    const dLat = (cell2.latitude - cell1.latitude) * Math.PI / 180;
    const dLon = (cell2.longitude - cell1.longitude) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  /**
   * Build interference graph for graph coloring algorithm
   * Vertices = Cells, Edges = Interference relationships
   */
  private async buildInterferenceGraph(cells: Cell[], checkLOS: boolean): Promise<void> {
    this.interferenceMatrix.clear();
    
    for (const cell of cells) {
      this.interferenceMatrix.set(cell.id, new Set());
    }
    
    // Detect all conflicts to build edges
    const conflicts = await pciMapper.detectConflicts(cells, checkLOS);
    
    for (const conflict of conflicts) {
      // Add bidirectional edges
      this.interferenceMatrix.get(conflict.primaryCell.id)?.add(conflict.conflictingCell.id);
      this.interferenceMatrix.get(conflict.conflictingCell.id)?.add(conflict.primaryCell.id);
    }
  }
  
  /**
   * Graph coloring iteration with tabu search
   * 
   * Algorithm:
   * 1. Select vertex (cell) with most conflicts
   * 2. Try to recolor with best available color (PCI)
   * 3. Avoid colors in tabu list
   * 4. Update tabu list
   */
  private async graphColoringIteration(
    cells: Cell[],
    conflicts: PCIConflict[],
    iteration: number,
    diversify: boolean
  ): Promise<PCIChange[]> {
    const changes: PCIChange[] = [];
    
    // Count conflicts per cell
    const conflictCount = new Map<string, number>();
    for (const conflict of conflicts) {
      conflictCount.set(conflict.primaryCell.id, (conflictCount.get(conflict.primaryCell.id) || 0) + 1);
      conflictCount.set(conflict.conflictingCell.id, (conflictCount.get(conflict.conflictingCell.id) || 0) + 1);
    }
    
    // Sort cells by conflict count (most conflicted first) and severity
    const cellsToRecolor = [...cells]
      .filter(c => conflictCount.get(c.id) || 0 > 0)
      .sort((a, b) => {
        // Prioritize critical conflicts
        const aCritical = conflicts.filter(cf => 
          (cf.primaryCell.id === a.id || cf.conflictingCell.id === a.id) && cf.severity === 'CRITICAL'
        ).length;
        const bCritical = conflicts.filter(cf => 
          (cf.primaryCell.id === b.id || cf.conflictingCell.id === b.id) && cf.severity === 'CRITICAL'
        ).length;
        
        if (aCritical !== bCritical) return bCritical - aCritical;
        
        // Then by total conflict count
        return (conflictCount.get(b.id) || 0) - (conflictCount.get(a.id) || 0);
      });
    
    // Recolor top N cells (diversify if stuck)
    const numToRecolor = diversify ? Math.min(10, cellsToRecolor.length) : Math.min(5, cellsToRecolor.length);
    
    for (let i = 0; i < numToRecolor; i++) {
      const cell = cellsToRecolor[i];
      const cellIndex = cells.findIndex(c => c.id === cell.id);
      if (cellIndex === -1) continue;
      
      // Find best PCI using graph coloring
      const newPCI = this.findBestColorForVertex(
        cell,
        cells,
        iteration,
        diversify
      );
      
      if (newPCI !== cell.pci && !this.isTabu(cell.id, newPCI, iteration)) {
        const oldPCI = cell.pci;
        cells[cellIndex].pci = newPCI;
        
        // Add to tabu list
        this.addToTabu(cell.id, oldPCI, iteration);
        
        changes.push({
          cellId: cell.id,
          oldPCI,
          newPCI,
          reason: `Graph coloring: Reduce conflicts from ${conflictCount.get(cell.id)} conflicts`
        });
        
        console.log(`🎨 Recolored ${cell.id}: PCI ${oldPCI} → ${newPCI} (Mod3: ${oldPCI % 3} → ${newPCI % 3})`);
      }
    }
    
    return changes;
  }
  
  /**
   * Find best "color" (PCI) for a vertex (cell) using constraint satisfaction
   * 
   * Scoring based on:
   * - PCI uniqueness (CRITICAL: never assign a used PCI)
   * - Mod3 conflicts (highest weight)
   * - Mod6 conflicts
   * - Distance to conflicting cells
   * - Tabu status
   */
  private findBestColorForVertex(
    cell: Cell,
    allCells: Cell[],
    iteration: number,
    diversify: boolean
  ): number {
    const neighbors = this.interferenceMatrix.get(cell.id) || new Set();
    const neighborPCIs = new Set<number>();
    const usedPCIs = new Set<number>();
    
    // Collect PCIs from all neighbors (interfering cells)
    for (const neighborId of neighbors) {
      const neighbor = allCells.find(c => c.id === neighborId);
      if (neighbor) {
        neighborPCIs.add(neighbor.pci);
      }
    }
    
    // Collect ALL used PCIs across the entire network
    // CRITICAL: This prevents PCI collisions
    allCells.forEach(c => {
      if (c.id !== cell.id) { // Exclude current cell
        usedPCIs.add(c.pci);
      }
    });
    
    // Generate candidate PCIs - ONLY unused PCIs
    const candidates: number[] = [];
    
    // Strategy 1: Find UNUSED PCIs with different Mod3 from neighbors
    for (let mod3 = 0; mod3 < 3; mod3++) {
      // Check if any neighbor uses this Mod3
      const neighborsInMod3 = Array.from(neighborPCIs).filter(pci => pci % 3 === mod3);
      
      if (neighborsInMod3.length === 0) {
        // This Mod3 group is clear of neighbor conflicts!
        for (let pci = mod3; pci <= this.PCI_MAX; pci += 3) {
          // CRITICAL: Only consider PCIs that are NOT used by ANY cell
          if (pci >= this.PCI_MIN && !usedPCIs.has(pci) && !this.isTabu(cell.id, pci, iteration)) {
            candidates.push(pci);
          }
        }
      }
    }
    
    // Strategy 2: If no clear Mod3, find any unused least conflicting PCIs
    if (candidates.length === 0) {
      for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
        // CRITICAL: Only consider PCIs that are NOT used by ANY cell
        if (!usedPCIs.has(pci) && !this.isTabu(cell.id, pci, iteration)) {
          candidates.push(pci);
        }
      }
    }
    
    // Strategy 3: If still no candidates (network is saturated), allow any PCI
    // This shouldn't happen with 474 available PCIs for typical networks
    if (candidates.length === 0) {
      console.warn(`⚠️ No unused PCIs available for ${cell.id}, allowing used PCIs`);
      for (let pci = this.PCI_MIN; pci <= this.PCI_MAX; pci++) {
        if (!this.isTabu(cell.id, pci, iteration)) {
          candidates.push(pci);
        }
      }
    }
    
    // Score each candidate
    const scores = new Map<number, number>();
    
    for (const candidatePCI of candidates) {
      let score = 1000; // Start with high score
      
      // CRITICAL: Massive penalty for PCI collisions (same PCI used elsewhere)
      if (usedPCIs.has(candidatePCI)) {
        score -= 10000; // Absolutely avoid collisions
      }
      
      // Penalty for Mod3 conflicts with neighbors
      for (const neighborPCI of neighborPCIs) {
        if (candidatePCI % 3 === neighborPCI % 3) {
          score -= 500; // Severe penalty
        }
        if (candidatePCI % 6 === neighborPCI % 6) {
          score -= 200;
        }
        if (candidatePCI % 12 === neighborPCI % 12) {
          score -= 50;
        }
        if (candidatePCI === neighborPCI) {
          score -= 1000; // Collision with neighbor - worst case
        }
      }
      
      // Bonus for unused PCIs (spread out the assignments)
      if (!usedPCIs.has(candidatePCI)) {
        score += 1000; // Strong bonus for uniqueness
      }
      
      // Penalty for recently tried PCIs (tabu)
      if (this.isTabu(cell.id, candidatePCI, iteration)) {
        score -= 2000; // Strong avoidance
      }
      
      // Diversification bonus (if stuck, try different Mod3 groups)
      if (diversify && candidatePCI % 3 !== cell.pci % 3) {
        score += 300;
      }
      
      scores.set(candidatePCI, score);
    }
    
    // Find top candidates
    const sortedCandidates = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]);
    
    if (sortedCandidates.length === 0) {
      return cell.pci; // No valid candidates
    }
    
    // Tabu search with aspiration criterion:
    // Pick from top 20% of candidates randomly (diversification)
    const topN = Math.max(1, Math.ceil(sortedCandidates.length * 0.2));
    const topCandidates = sortedCandidates.slice(0, topN);
    const randomIndex = Math.floor(Math.random() * topCandidates.length);
    
    return topCandidates[randomIndex][0];
  }
  
  /**
   * Tabu List Management
   * Prevents cycling back to recently tried PCIs
   */
  private isTabu(cellId: string, pci: number, currentIteration: number): boolean {
    const key = `${cellId}:${pci}`;
    const tabuUntil = this.tabuList.get(key);
    
    if (tabuUntil === undefined) return false;
    
    return currentIteration <= tabuUntil;
  }
  
  private addToTabu(cellId: string, pci: number, currentIteration: number): void {
    const key = `${cellId}:${pci}`;
    this.tabuList.set(key, currentIteration + this.TABU_TENURE);
  }
  
  private cleanTabuList(currentIteration: number): void {
    for (const [key, tabuUntil] of this.tabuList.entries()) {
      if (currentIteration > tabuUntil) {
        this.tabuList.delete(key);
      }
    }
  }
  
  /**
   * Clear all state (for new optimization runs)
   */
  clear(): void {
    this.tabuList.clear();
    this.interferenceMatrix.clear();
  }
}

export const advancedPCIOptimizer = new AdvancedPCIOptimizer();

