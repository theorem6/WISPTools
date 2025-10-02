# SON/CSON Mathematical Algorithms for PCI Optimization

## Overview

This document explains the mathematical foundations of Self-Organizing Network (SON) and Centralized SON (CSON) algorithms used for PCI optimization in fixed wireless networks.

---

## 🎨 Graph Coloring Approach

### Mathematical Model

PCI assignment can be modeled as a **Graph Coloring Problem**:

```
Given:
- V = Set of vertices (cells/EARFCNs)
- E = Set of edges (interference relationships)
- C = Set of colors (available PCIs)

Find:
- A coloring function f: V → C
- Such that: ∀(u,v) ∈ E, f(u) ≠ f(v) (or Mod3(f(u)) ≠ Mod3(f(v)))

Constraint:
- C ⊆ {30, 31, ..., 503}  (excluding WISP-reserved 0-29)
```

### Why Graph Coloring?

**NP-Hard Problem**: Finding optimal PCI assignment is computationally complex
- Similar to the chromatic number problem in graph theory
- No polynomial-time solution for optimal result
- Heuristic approaches needed

**Advantages**:
- Models interference as graph edges
- Proven mathematical framework
- Efficient heuristics exist (Welsh-Powell, DSATUR, Tabu Search)

---

## 🔍 Tabu Search Algorithm

### Mathematical Foundation

Tabu Search is a **metaheuristic** optimization algorithm:

```
Initialize:
- S₀ = initial solution (current PCI assignments)
- Best = S₀
- TabuList = ∅
- k = 0 (iteration counter)

While (k < MaxIterations and not converged):
    1. Generate neighborhood N(S_k) - possible PCI changes
    2. Select best non-tabu solution S' ∈ N(S_k)
    3. If f(S') < f(Best): Best = S'  (aspiration criterion)
    4. Add move (cell, old_PCI) to TabuList
    5. S_{k+1} = S'
    6. k = k + 1
    7. Clean TabuList (remove old entries)

Return Best
```

### Tabu List Parameters

```typescript
TABU_TENURE = 7  // Iterations to remember

TabuList: Map<string, number>
  Key: "cellId:PCI"
  Value: iteration_when_tabu_expires

isTabu(cellId, PCI, currentIteration):
  return currentIteration <= TabuList.get("cellId:PCI")
```

### Aspiration Criterion

```
Even if a move is tabu, allow it if:
- It produces the best solution found so far
- criticalConflicts(S') = 0 AND highConflicts(S') = 0
```

---

## 📊 Constraint Satisfaction Problem (CSP)

### PCI Assignment as CSP

```
Variables: X = {x₁, x₂, ..., xₙ} where xᵢ = PCI of cell i

Domain: D = {30, 31, ..., 503} for all variables

Constraints:
Hard Constraints (MUST satisfy):
  C1: xᵢ ≥ 30 ∀i                    (WISP reservation)
  C2: xᵢ ≠ xⱼ if cells overlap       (co-channel)
  C3: xᵢ mod 3 ≠ xⱼ mod 3 if critical (Mod3 diversity)

Soft Constraints (optimize):
  S1: xᵢ mod 6 ≠ xⱼ mod 6 if neighbors  (minimize Mod6)
  S2: xᵢ mod 12 ≠ xⱼ mod 12 if close    (minimize Mod12)
  S3: Maximize PCI diversity in region
```

### Objective Function

```
Minimize: F(X) = Σ w_ij × penalty(xᵢ, xⱼ)

Where:
penalty(xᵢ, xⱼ) = {
  1000  if xᵢ = xⱼ (same PCI)
  500   if xᵢ mod 3 = xⱼ mod 3 (Mod3 conflict)
  200   if xᵢ mod 6 = xⱼ mod 6 (Mod6 conflict)
  50    if xᵢ mod 12 = xⱼ mod 12 (Mod12 conflict)
  0     otherwise
}

w_ij = weight based on:
  - Distance (closer = higher weight)
  - LOS (has LOS = higher weight)
  - Azimuth overlap (more overlap = higher weight)
```

---

## 🔄 EARFCN-Level PCI Assignment

### Data Model Requirement

**IMPORTANT**: Each EARFCN requires its own PCI

```
Correct Model:
Cell Site (Tower)
  ├─ Sector 1 (Azimuth 0°)
  │   ├─ EARFCN 1950 → PCI 33
  │   ├─ EARFCN 2850 → PCI 147
  │   └─ EARFCN 3550 → PCI 261
  ├─ Sector 2 (Azimuth 120°)
  │   ├─ EARFCN 1950 → PCI 89
  │   └─ EARFCN 2850 → PCI 402
  └─ Sector 3 (Azimuth 240°)
      └─ EARFCN 1950 → PCI 177
```

### Implementation Strategy

**Current**: One PCI per sector (legacy)
**Needed**: One PCI per EARFCN per sector

**Two Approaches**:

#### Approach 1: Flatten (Current Implementation)
```typescript
// Each EARFCN becomes a separate "cell" in analysis
Sector with 3 EARFCNs → 3 separate Cell objects

Cell {
  id: "SITE001-SEC1-EARFCN1950",
  eNodeB: 1001,
  sector: 1,
  pci: 33,
  earfcn: 1950,
  ...
}
```

#### Approach 2: Hierarchical (Future)
```typescript
// Use proper CellSite model
Sector {
  id: "SITE001-SEC1",
  channels: [
    { earfcn: 1950, pci: 33 },
    { earfcn: 2850, pci: 147 },
    { earfcn: 3550, pci: 261 }
  ]
}
```

### PCI Assignment Rules for Multiple EARFCNs

```
Rule 1: Co-located EARFCNs (same azimuth) should have:
  - Different Mod3 values if possible
  - At minimum, different Mod6 values
  
Rule 2: Same EARFCN, different sectors:
  - MUST have different Mod3 (different sectors always conflict on same freq)
  
Rule 3: Different EARFCNs, overlapping sectors:
  - Should have different Mod3 (cross-frequency interference)
```

---

## 🧮 SON Optimization Mathematics

### Multi-Objective Optimization

```
Minimize simultaneously:

f₁(X) = # of CRITICAL conflicts           (weight: 1000)
f₂(X) = # of HIGH conflicts               (weight: 100)
f₃(X) = # of MEDIUM conflicts             (weight: 10)
f₄(X) = # of LOW conflicts                (weight: 1)

Combined Objective:
F(X) = 1000×f₁(X) + 100×f₂(X) + 10×f₃(X) + f₄(X)
```

### Convergence Criteria

```
Primary Goal: f₁(X) = 0 AND f₂(X) = 0

Stop when:
  (f₁(X) = 0 AND f₂(X) = 0) OR
  (no improvement for 5 iterations) OR
  (iteration > MAX_ITERATIONS)
```

### Diversification Strategy

```
If stuck (no improvement for 3 iterations):
  - Increase search radius: recolor top 10 cells (was 5)
  - Apply stronger randomization
  - Relax tabu restrictions temporarily
  - Try different Mod3 groups aggressively
```

---

## 🎲 Advanced Randomization

### Avoiding PCI Reuse Patterns

**Problem**: Simple algorithms reuse same PCIs repeatedly

**Solution**: Tabu Search + Diversification

#### 1. Tabu List (Short-term Memory)
```
Prevents:
- Cell A using PCI 33 again for 7 iterations
- Recently rejected PCIs

Data Structure:
Map<"cellId:PCI", expirationIteration>
```

#### 2. Frequency-based Diversification
```
Track PCI usage frequency:
usage_count[pci] = # of times PCI assigned

Penalty = usage_count[pci] × 10

Prefer less-used PCIs for diversity
```

#### 3. Spatial Distribution
```
For each region (geographic cluster):
  - Track Mod3 distribution
  - Aim for 33% each Mod3 group (0, 1, 2)
  - Bonus for balanced distribution
```

#### 4. Fisher-Yates Shuffle
```
When selecting from top N candidates:
  1. Filter top 20% by score
  2. Shuffle array randomly
  3. Pick first element

Prevents: Always picking #1 option
Ensures: Diverse PCI assignments
```

---

## 🔬 CSON (Centralized SON) Approach

### Centralized vs Distributed

| Aspect | D-SON (Distributed) | C-SON (Centralized) |
|--------|---------------------|---------------------|
| **Decision Making** | Each cell decides | Central server decides |
| **View** | Local neighbors | Global network view |
| **Optimization** | Greedy local | Global optimum search |
| **Convergence** | May oscillate | Guaranteed |
| **Our Approach** | ✅ C-SON | Global optimization |

### CSON Mathematical Model

```
Global Optimization Problem:

Given:
- N cells with unknown PCIs
- M conflicts to resolve
- Interference matrix I[N×N]

Find:
- PCI vector P = [p₁, p₂, ..., pₙ]
- That minimizes total weighted interference

Minimize:
  Z = Σᵢ Σⱼ I[i,j] × conflict_penalty(pᵢ, pⱼ)

Subject to:
  pᵢ ∈ {30, 31, ..., 503} ∀i
  pᵢ mod 3 ≠ pⱼ mod 3  if I[i,j] = CRITICAL
  pᵢ ≠ pⱼ  if cells overlap
```

---

## 🎯 Implemented Algorithms

### Primary: Hybrid SON + Tabu Search

```
Algorithm: SON_TABU_OPTIMIZE(cells, maxIter)

1. Build interference graph G = (V, E)
   - V = cells
   - E = conflict relationships

2. Initialize tabu list T = ∅

3. For iteration k = 1 to maxIter:
   
   a) Detect conflicts C_k
   
   b) Count by severity: critical, high, medium, low
   
   c) If critical = 0 AND high = 0:
        → Success! Continue to optimize others or stop
   
   d) Select top N most conflicted cells
      Sort by: critical_conflicts DESC, total_conflicts DESC
   
   e) For each selected cell v:
        - Generate candidate PCIs (excluding 0-30, excluding tabu)
        - Score each candidate (multi-factor)
        - Select from top 20% randomly
        - Assign new PCI
        - Add old PCI to tabu list T
   
   f) Update best solution if improved
   
   g) If no improvement for 3 iterations:
        → Diversification: increase N, relax tabu
   
   h) Clean tabu list (remove expired entries)

4. Return best solution found
```

### Secondary: Graph Coloring (Advanced Optimizer)

See `pciOptimizerAdvanced.ts` for implementation

---

## 📏 Scoring Formula (Detailed)

### For each candidate PCI p for cell c:

```
score(p, c) = BASE_SCORE 
              - mod3_penalty(p, c)
              - mod6_penalty(p, c) 
              - mod12_penalty(p, c)
              - distance_penalty(p, c)
              - overlap_penalty(p, c)
              - tabu_penalty(p, c)
              + diversity_bonus(p, c)
              + unused_bonus(p, c)

Where:

BASE_SCORE = 1000

mod3_penalty = Σ (500 × LOS_factor × azimuth_factor)
                 for all neighbors n where p mod 3 = n.pci mod 3

mod6_penalty = Σ (200 × LOS_factor × azimuth_factor)
                 for all neighbors n where p mod 6 = n.pci mod 6

overlap_penalty = {
  -1000 if p = neighbor.pci AND sectors_overlap
  -500 if p mod 3 = neighbor.pci mod 3 AND sectors_overlap
  0 otherwise
}

tabu_penalty = {
  -2000 if (c.id, p) in TabuList
  0 otherwise
}

diversity_bonus = {
  +100 if p not used elsewhere in network
  +300 if diversify mode AND p mod 3 ≠ c.current_pci mod 3
  0 otherwise
}
```

---

## 🔢 EARFCN-to-PCI Assignment Strategy

### Carrier Aggregation Scenario

**Problem**: Sector has multiple EARFCNs (carrier aggregation)

```
Example:
Sector 1 @ Azimuth 0°:
  - EARFCN 1950 (Band 1, 2.1 GHz) → needs PCI_A
  - EARFCN 2850 (Band 7, 2.6 GHz) → needs PCI_B  
  - EARFCN 39650 (Band 41 CBRS) → needs PCI_C

Question: How to assign PCI_A, PCI_B, PCI_C?
```

### Strategy 1: Mod3 Separation (Recommended)

```
Assign different Mod3 groups to co-located EARFCNs:

EARFCN 1950 → PCI in Mod3 = 0  (e.g., 33, 36, 39...)
EARFCN 2850 → PCI in Mod3 = 1  (e.g., 34, 37, 40...)
EARFCN 39650 → PCI in Mod3 = 2 (e.g., 35, 38, 41...)

Benefit: Minimizes inter-frequency interference
```

### Strategy 2: Sequential Assignment

```
Assign sequential PCIs to same-sector EARFCNs:

EARFCN 1950 → PCI 33
EARFCN 2850 → PCI 34
EARFCN 39650 → PCI 35

Benefit: Easy to manage, predictable pattern
Risk: May not be optimal for all scenarios
```

### Strategy 3: Interference-Minimized (Our Implementation)

```
For each EARFCN on sector:
  1. Analyze interference with all other cells
  2. Weight by:
     - Same EARFCN, different sector: HIGH weight (co-channel)
     - Different EARFCN, overlapping azimuth: MEDIUM weight
     - Same EARFCN, same azimuth: IMPOSSIBLE (same cell)
  3. Assign PCI that minimizes weighted interference
  4. Ensure no two EARFCNs on same sector have same Mod3
```

---

## 🧪 Data Model for Multi-EARFCN Support

### Current Implementation (Flattened)

```typescript
// Each EARFCN is a separate "Cell" object
const cells = [
  {
    id: "SITE001-SEC1-E1950",  // Sector 1, EARFCN 1950
    eNodeB: 1001,
    sector: 1,
    earfcn: 1950,
    pci: 33,
    azimuth: 0,
    ...
  },
  {
    id: "SITE001-SEC1-E2850",  // SAME SECTOR, different EARFCN
    eNodeB: 1001,
    sector: 1,
    earfcn: 2850,
    pci: 147,  // DIFFERENT PCI required
    azimuth: 0, // SAME azimuth as above
    ...
  }
];
```

**Conflict Detection**:
- Cells with same azimuth + same eNodeB + different EARFCN = Co-located
- Apply Mod3 separation constraint
- Optimizer assigns different Mod3 values automatically

---

## 🎓 Advanced SON Techniques

### 1. Simulated Annealing (Optional Enhancement)

```
Temperature T = T₀
While T > T_min:
  - Generate neighbor solution S'
  - ΔE = f(S') - f(S)
  - If ΔE < 0: accept S'
  - Else: accept with probability e^(-ΔE/T)
  - T = α × T  (cooling schedule, α ≈ 0.95)

Benefits:
- Can escape local optima
- Probabilistic acceptance of worse solutions
```

### 2. Genetic Algorithm (Future)

```
Population P = {S₁, S₂, ..., Sₙ}

For generation g = 1 to max:
  - Selection: Pick best solutions (tournament)
  - Crossover: Combine PCI assignments
  - Mutation: Random PCI changes
  - Evaluation: Score each solution
  - Replacement: Keep best solutions

Benefits:
- Population-based (parallel search)
- Can find global optimum
```

### 3. Ant Colony Optimization

```
Pheromone trails τ[cell][PCI]

For each ant:
  - Construct solution using pheromone guidance
  - Probability ∝ τ[c][p]^α × η[c][p]^β
  - Update pheromones on good paths

Benefits:
- Learns good PCI patterns
- Collective intelligence
```

---

## 💻 Implementation Guide

### Using Current Optimizer (SON + Tabu)

```typescript
import { pciService } from '$lib/services/pciService';

// Automatically uses SON with tabu search
const result = await pciService.optimizePCIs(cells);

Features:
✅ Tabu search built-in
✅ Targets 0 critical + 0 high
✅ Excludes PCIs 0-30
✅ Randomized selection
✅ Aggressive mode for stalemates
```

### Using Advanced Optimizer (Graph Coloring)

```typescript
import { advancedPCIOptimizer } from '$lib/pciOptimizerAdvanced';

// Uses pure graph coloring + tabu search
const result = await advancedPCIOptimizer.optimizePCIAssignments(cells, true);

Features:
✅ Explicit interference graph
✅ Top 20% randomization
✅ Stronger diversification
✅ Better for complex networks
```

---

## 📊 Performance Comparison

| Algorithm | Time Complexity | Quality | Best For |
|-----------|----------------|---------|----------|
| **Greedy** | O(n²) | Good | Small networks |
| **SON + Random** | O(n² × k) | Better | Medium networks |
| **SON + Tabu** | O(n² × k) | Best | Large networks |
| **Graph Coloring** | O(n² × k) | Best | Complex topology |
| **Simulated Annealing** | O(n² × k × log T) | Excellent | Very large |
| **Genetic** | O(n² × k × pop) | Excellent | Research/offline |

Where:
- n = number of cells
- k = max iterations  
- T = temperature range
- pop = population size

**Our Implementation**: SON + Tabu (best balance of speed and quality)

---

## 🎯 Summary

The PCI Mapper implements:

✅ **Graph Coloring**: Models interference as graph
✅ **Tabu Search**: Avoids cycling, diverse solutions
✅ **CSP Approach**: Hard + soft constraints
✅ **Multi-objective**: Prioritizes critical/high
✅ **EARFCN-aware**: Each EARFCN gets unique PCI
✅ **Randomization**: Fisher-Yates + top-N selection
✅ **WISP-safe**: Excludes PCIs 0-30
✅ **SON principles**: Self-optimization, ANR-aware

**Mathematical Foundation**: Industry-standard algorithms adapted for fixed wireless

**Result**: Production-ready PCI optimization for WISP networks!

---

## 📚 References

- **3GPP TS 36.300**: E-UTRAN Overall Description
- **3GPP TS 36.902**: SON Use Cases and Solutions
- **Graph Coloring**: Welsh-Powell, DSATUR algorithms
- **Tabu Search**: Glover, F. (1986) "Future Paths for Integer Programming"
- **CSP**: Russell & Norvig, "Artificial Intelligence: A Modern Approach"

