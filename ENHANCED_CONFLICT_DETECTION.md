# 🔍 Enhanced PCI Conflict Detection

## Overview

The PCI conflict detection engine now includes **advanced frequency congestion detection** and **enhanced co-channel interference analysis**.

## New Conflict Types

### 1. **FREQUENCY_CONGESTION** (NEW! ⚠️ UNRESOLVABLE)

**What it detects:**
- More than 3 sectors on the same EARFCN/frequency within 10km

**Why it's unresolvable:**
- LTE has only 3 unique PCI mod-3 values (0, 1, 2) for CRS
- If 4+ sectors share the same frequency in proximity, at least 2 MUST have the same PCI mod-3
- This causes unavoidable CRS (Cell Reference Signal) collision
- **Cannot be fixed by changing PCIs alone**

**Solution:**
- Reassign frequencies to different EARFCNs
- Relocate sectors to increase distance
- Adjust transmit power to reduce interference range

**Example:**
```
Scenario: 4 sectors on EARFCN 1200 within 8km
- Sector A: PCI 0 (mod-3 = 0)
- Sector B: PCI 1 (mod-3 = 1)
- Sector C: PCI 2 (mod-3 = 2)
- Sector D: PCI 3 (mod-3 = 0) ⚠️ CONFLICT with Sector A

Result: UNRESOLVABLE - Sector D cannot avoid mod-3 conflict
```

### 2. **CO_CHANNEL** (NEW!)

**What it detects:**
- Cells on exact same EARFCN with PCI mod-3 conflict
- Within 10km distance

**Severity:**
- **CRITICAL**: < 3km (severe interference)
- **HIGH**: 3-7km (significant interference)
- **MEDIUM**: 7-10km (manageable but problematic)

**Why it matters:**
- Same frequency = strongest interference
- PCI mod-3 conflict = CRS collision
- Combination is especially problematic

**Solution:**
- Change PCI to avoid mod-3 conflict
- Or change frequency/EARFCN

### 3. **Enhanced EARFCN Checking**

**Now checks:**
1. **Primary**: DL EARFCN (`dlEarfcn`)
2. **Fallback**: General EARFCN (`earfcn`)
3. **Frequency comparison**: Center frequency (within 0.1 MHz tolerance)

**Benefits:**
- More accurate co-channel detection
- Proper EARFCN-based grouping
- Handles both EARFCN and frequency-based data

## Severity Levels

| Level | Priority | Description | Can Optimize? |
|-------|----------|-------------|---------------|
| **UNRESOLVABLE** | 0 | >3 sectors on same frequency | ❌ Needs frequency changes |
| **CRITICAL** | 1 | Immediate interference issues | ✅ PCI changes help |
| **HIGH** | 2 | Significant problems | ✅ PCI changes help |
| **MEDIUM** | 3 | Manageable issues | ✅ PCI changes help |
| **LOW** | 4 | Minor concerns | ✅ Already acceptable |

## Detection Algorithm

### Phase 1: Frequency Congestion Check

```typescript
1. Group all cells by EARFCN/frequency
2. For each frequency group:
   a. If ≤3 sectors → Skip (manageable)
   b. If >3 sectors → Check proximity
   c. Find all sectors within 10km of each other
   d. If >3 in proximity → Create UNRESOLVABLE conflict
```

### Phase 2: Standard Conflict Detection

```typescript
For each pair of cells:
  1. Calculate distance
  2. Check if can interfere (within propagation range)
  3. Skip if same tower, different sectors (normal)
  4. Check if co-channel (same EARFCN)
  5. Detect conflict types:
     - COLLISION: Same PCI
     - CO_CHANNEL: Same EARFCN + mod-3 conflict
     - MOD3, MOD6, MOD12, MOD30: Modulo conflicts
     - FREQUENCY: Co-channel overlap
     - ADJACENT_CHANNEL: Adjacent frequency conflicts
  6. Check line of sight (reduces severity if blocked)
  7. Calculate severity
  8. Add to conflicts list
```

### Phase 3: Sorting

Conflicts sorted by:
1. **Severity** (UNRESOLVABLE → CRITICAL → HIGH → MEDIUM → LOW)
2. **Distance** (closer conflicts first within same severity)

## Real-World Examples

### Example 1: Frequency Congestion (UNRESOLVABLE)

**Scenario:** Downtown area with 5 towers on EARFCN 1200

```
Tower A (PCI 0): 40.7580° N, 73.9855° W
Tower B (PCI 1): 40.7590° N, 73.9845° W (1.2km away)
Tower C (PCI 2): 40.7570° N, 73.9865° W (1.5km away)
Tower D (PCI 3): 40.7585° N, 73.9875° W (2.1km away)
Tower E (PCI 4): 40.7575° N, 73.9850° W (1.8km away)

All towers are within 2.5km of each other on EARFCN 1200
```

**Detection Result:**
```
⚠️ UNRESOLVABLE CONFLICT
Type: FREQUENCY_CONGESTION
Sectors: 5 on EARFCN 1200 within 2.5km
Severity: UNRESOLVABLE

Explanation:
- LTE allows max 3 unique PCI mod-3 values (0, 1, 2)
- Tower D (PCI 3, mod-3 = 0) conflicts with Tower A (PCI 0, mod-3 = 0)
- Tower E (PCI 4, mod-3 = 1) conflicts with Tower B (PCI 1, mod-3 = 1)
- No PCI reassignment can fix this

Solutions:
1. Change Tower D or E to different EARFCN (recommended)
2. Reduce tower D/E power to decrease interference range
3. Relocate Tower D or E outside 10km radius
```

### Example 2: Co-Channel Conflict (Resolvable)

**Scenario:** 2 towers on same EARFCN with mod-3 conflict

```
Tower A: PCI 0 (mod-3 = 0), EARFCN 1200
Tower B: PCI 3 (mod-3 = 0), EARFCN 1200
Distance: 4.5km
```

**Detection Result:**
```
⚠️ CO-CHANNEL CONFLICT
Type: CO_CHANNEL
Severity: HIGH
Distance: 4.5km

Solution: Change Tower B PCI to 1, 2, 4, 5, 7, 8, etc. (any PCI with mod-3 ≠ 0)
```

### Example 3: Standard MOD3 (Different Frequencies)

**Scenario:** 2 towers with mod-3 conflict on different frequencies

```
Tower A: PCI 0 (mod-3 = 0), EARFCN 1200
Tower B: PCI 3 (mod-3 = 0), EARFCN 1300
Distance: 2km
```

**Detection Result:**
```
⚠️ MOD3 CONFLICT
Type: MOD3
Severity: MEDIUM (less severe than co-channel)
Distance: 2km

Reason: Different frequencies reduce interference
Solution: Change PCI if needed, but lower priority
```

## Integration Points

### Files Updated:

1. **`src/lib/pciMapper.ts`**
   - Added `detectFrequencyCongestion()` method
   - Added `areCellsCoChannel()` method
   - Enhanced `detectConflicts()` with frequency congestion check
   - Updated `calculateSeverity()` for new conflict types
   - Updated conflict type definitions

2. **Interface Changes:**
   ```typescript
   interface PCIConflict {
     conflictType: ... | 'CO_CHANNEL' | 'FREQUENCY_CONGESTION';
     severity: ... | 'UNRESOLVABLE';
     congestedSectors?: Cell[];  // NEW
     isUnresolvable?: boolean;    // NEW
   }
   ```

## Usage

### Detecting Conflicts

```typescript
import { pciMapper } from '$lib/pciMapper';

const conflicts = await pciMapper.detectConflicts(cells, true);

// Filter by type
const unresolvableConflicts = conflicts.filter(c => c.severity === 'UNRESOLVABLE');
const coChannelConflicts = conflicts.filter(c => c.conflictType === 'CO_CHANNEL');

// Get congested sectors
const congested = conflicts
  .filter(c => c.congestedSectors)
  .map(c => c.congestedSectors);

console.log(`Found ${unresolvableConflicts.length} unresolvable conflicts`);
```

### Handling UNRESOLVABLE Conflicts

```typescript
for (const conflict of conflicts) {
  if (conflict.isUnresolvable) {
    console.warn('Cannot fix with PCI changes:');
    console.warn(`  ${conflict.congestedSectors?.length} sectors on same frequency`);
    console.warn(`  Recommendation: Change frequency or relocate`);
  }
}
```

## Optimization Behavior

### PCI Optimizer Response:

- **Resolvable conflicts**: Optimizer will try to fix by changing PCIs
- **UNRESOLVABLE conflicts**: 
  - Optimizer will skip (cannot fix)
  - Warning message displayed
  - Recommendation to change frequencies
  - Detailed sector list provided

### Recommendations Generated:

```
⚠️ UNRESOLVABLE CONFLICT DETECTED

Problem: 5 sectors sharing EARFCN 1200 within 8km radius
Sectors: SITE001-SEC1, SITE002-SEC1, SITE003-SEC1, SITE004-SEC1, SITE005-SEC1

Why unresolvable:
- LTE allows maximum 3 co-channel sectors without PCI mod-3 collision
- 5 sectors exceeds this limit

Recommended actions:
1. Reassign 2 sectors to different EARFCN (e.g., EARFCN 1300, 1400)
2. Reduce transmit power on edge sectors to limit interference range
3. Relocate 2 towers to >10km separation
4. Consider frequency reuse planning with proper isolation
```

## Testing

### Test Scenarios:

1. **4 sectors, same EARFCN, <5km apart** → Should detect FREQUENCY_CONGESTION (UNRESOLVABLE)
2. **3 sectors, same EARFCN** → Should NOT trigger congestion
3. **2 sectors, same EARFCN, PCI mod-3 conflict** → Should detect CO_CHANNEL (CRITICAL/HIGH)
4. **2 sectors, different EARFCN, PCI mod-3 conflict** → Should detect MOD3 (MEDIUM/LOW)

### Console Output Example:

```
🔍 Analyzing 100 cells for PCI conflicts...

⚠️ UNRESOLVABLE: 4 sectors on same frequency (EARFCN: 1200, Freq: 1805 MHz) within 10km.
LTE constraint: Max 3 co-channel sectors can coexist without CRS collision.
Solution: Reassign frequencies or relocate sectors.

✅ Analysis complete:
   - Total conflicts: 23
   - UNRESOLVABLE: 2
   - CRITICAL: 5
   - HIGH: 8
   - MEDIUM: 6
   - LOW: 2

📊 Conflict breakdown:
   - FREQUENCY_CONGESTION: 2 (cannot optimize)
   - CO_CHANNEL: 3 (high priority)
   - COLLISION: 2 (high priority)
   - MOD3: 10 (standard)
   - MOD6: 4 (standard)
   - MOD12: 2 (low priority)
```

## Benefits

✅ **More accurate detection** - Identifies unresolvable situations  
✅ **Better EARFCN checking** - Uses actual channel numbers  
✅ **Co-channel emphasis** - Prioritizes same-frequency conflicts  
✅ **Clear reporting** - Tells users when PCI changes won't help  
✅ **Actionable recommendations** - Suggests frequency reassignment  

## LTE Standards Compliance

Based on 3GPP specifications:
- **TS 36.211**: Physical channels and modulation
- **TS 36.104**: Base station radio transmission/reception
- **PCI planning**: Maximum 3 co-channel cells with unique mod-3 values

This implementation ensures your PCI planning complies with LTE requirements! 🎯

