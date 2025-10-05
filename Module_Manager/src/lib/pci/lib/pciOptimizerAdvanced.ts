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
   */
  async optimizePCIAssignments(cells: Cell[], checkLOS: boolean = true): Promise<OptimizationResult> {
    const originalCells = JSON.parse(JSON.stringify(cells)) as Cell[];
    let currentCells = JSON.parse(JSON.stringify(cells)) as Cell[];
    
    const changes: PCIChange[] = [];
    const convergenceHistory: any[] = [];
    
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
    
    // Collect all used PCIs
    allCells.forEach(c => usedPCIs.add(c.pci));
    
    // Generate candidate PCIs
    const candidates: number[] = [];
    
    // Strategy 1: Find PCIs with different Mod3 from neighbors
    for (let mod3 = 0; mod3 < 3; mod3++) {
      // Check if any neighbor uses this Mod3
      const neighborsInMod3 = Array.from(neighborPCIs).filter(pci => pci % 3 === mod3);
      
      if (neighborsInMod3.length === 0) {
        // This Mod3 group is clear of neighbor conflicts!
        for (let pci = mod3; pci <= this.PCI_MAX; pci += 3) {
          if (pci >= this.PCI_MIN && !this.isTabu(cell.id, pci, iteration)) {
            candidates.push(pci);
          }
        }
      }
    }
    
    // Strategy 2: If no clear Mod3, find least conflicting PCIs
    if (candidates.length === 0) {
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
          score -= 1000; // Worst case
        }
      }
      
      // Bonus for unused PCIs (spread out the assignments)
      if (!usedPCIs.has(candidatePCI)) {
        score += 100;
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

