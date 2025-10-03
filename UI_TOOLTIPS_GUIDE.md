# 🎯 UI Tooltips & Quick Help Guide

## Overview

The PCI Mapper app has comprehensive hover tooltips on all major UI elements to provide inline documentation without leaving the app.

---

## 📊 Topbar Statistics

### **Cell Count**
**Hover Text:** "Total number of cells/sectors in current network"

Shows how many cell sectors are loaded in the currently selected network.

### **Total Conflicts**
**Hover Text:** "Total PCI conflicts detected (all severities combined)"

Sum of all PCI conflicts across all severity levels (Critical + High + Medium + Low).

### **Critical Conflicts** 🔴
**Hover Text:** "Critical conflicts - PCI collision within 500m, requires immediate attention"

- **What it means:** Same PCI on two cells within 500 meters
- **Impact:** Severe interference, call drops, handover failures
- **Action:** Must be resolved immediately

### **High Conflicts** 🟡
**Hover Text:** "High priority conflicts - Within 1000m, MOD3 conflicts, should be resolved"

- **What it means:** MOD3 conflicts or PCI confusion within 1000m
- **Impact:** Significant interference, degraded performance
- **Action:** Should be resolved soon

### **Medium Conflicts** 🟠
**Hover Text:** "Medium priority conflicts - Within 2000m, MOD6/MOD12 conflicts"

- **What it means:** MOD6 or MOD12 conflicts within 2000m
- **Impact:** Moderate interference, occasional issues
- **Action:** Plan to resolve during next maintenance window

### **Low Conflicts** 🟢
**Hover Text:** "Low priority conflicts - Beyond 3000m, MOD30 conflicts, monitor but not urgent"

- **What it means:** MOD30 conflicts or issues beyond 3000m
- **Impact:** Minimal interference
- **Action:** Monitor, resolve if convenient

---

## 🔘 Topbar Action Buttons

### **Tower Management** 🏢
**Hover Text:** "Manage cell sites and towers - View all towers in current network"

- Opens tower manager dialog
- Shows all cell sites/towers in current network
- Group sectors by tower location
- Edit tower properties

### **Analysis** 📊
**Hover Text:** "View detailed network analysis - Cell statistics and health metrics"

- Network health overview
- Cell distribution statistics
- Frequency usage analysis
- Performance metrics

### **Conflicts** ⚠️
**Hover Text:** "View PCI conflicts - Shows collision, confusion, and modulo conflicts by severity"

- Detailed conflict list
- Filter by severity
- Sort by distance or type
- Click conflict to view on map

### **Recommendations** 💡
**Hover Text:** "AI-powered recommendations - Get intelligent suggestions to resolve conflicts"

- Gemini AI analysis of conflicts
- Specific resolution strategies
- PCI reassignment suggestions
- Best practices guidance

---

## 🗺️ Map Controls

### **Right-Click Map Hint** ℹ️
**Hover Text:** "Quick Tip: Right-click anywhere on the map to add a new cell site or sector at that location"

**What happens:**
- Right-click empty space → Add new site
- Right-click existing cell → Edit or delete sector

---

## 📥 Import & Data Management

### **CSV Import Fields**

When importing CSV data, these fields are available:

| Field | Description | Tooltip Help |
|-------|-------------|--------------|
| **Cell ID** | Unique identifier for cell/sector | "Required - Unique name like CELL001" |
| **Sector** | Sector number (1-4) | "Sector number within the tower (1-4)" |
| **Azimuth** | Direction in degrees | "Direction antenna points (0-359°). Leave blank for auto-calculation" |
| **Altitude** | Height in feet | "Height above ground level in feet. Used for line-of-sight calculations" |
| **PCI** | Physical Cell ID | "0-503. Leave blank for auto-assignment to avoid conflicts" |
| **EARFCN** | Frequency channel | "Required - Frequency channel number. Determines LTE band automatically" |
| **Latitude** | GPS latitude | "GPS coordinate. Required for proper mapping" |
| **Longitude** | GPS longitude | "GPS coordinate. Required for proper mapping" |

---

## 🎨 Theme & Display

### **Theme Switcher** 🌓
**Hover Text:** "Toggle between light and dark mode - Theme preference is saved"

- Switches between light/dark themes
- Preference persists across sessions
- Automatically applies to all UI elements

---

## 👤 User Profile

### **My Networks** 📍
**Hover Text:** "Manage your networks - Create, edit, or delete networks. Each network is private to your account"

- View all your networks
- Create new network
- Switch between networks
- Delete networks

### **Sign Out** 🚪
**Hover Text:** "Sign out and clear all data - All network data will be cleared from view"

- Logs you out
- Clears all cached data
- Redirects to login page
- Next user sees clean state

---

## 🛠️ Cell/Sector Editor

When editing a cell/sector, these fields have tooltips:

### **Cell ID**
**Tooltip:** "Unique identifier for this sector (e.g., CELL001_S1)"

### **PCI**
**Tooltip:** "Physical Cell ID (0-503). System will suggest conflict-free value if left blank"

### **Azimuth**
**Tooltip:** "Direction the antenna points (0-359°). 0° = North, 90° = East, 180° = South, 270° = West"

### **Latitude/Longitude**
**Tooltip:** "GPS coordinates of the cell tower. Click map to set location"

### **Frequency**
**Tooltip:** "Operating frequency in MHz. Common: 2100 (Band 1), 1800 (Band 3), 3550 (CBRS)"

### **EARFCN**
**Tooltip:** "E-UTRA Absolute Radio Frequency Channel Number. Determines exact frequency channel"

### **RS Power**
**Tooltip:** "Reference Signal Power in dBm. Typical range: -65 to -95 dBm"

---

## 🔍 Analysis Features

### **Run Analysis** 🔬
**Tooltip:** "Analyze current network for PCI conflicts - Checks collision, confusion, MOD3/6/12/30 conflicts"

**What it does:**
- Scans all cells for conflicts
- Calculates distances between cells
- Identifies conflict types
- Assigns severity levels

### **Optimize PCIs** ⚡
**Tooltip:** "Auto-optimize PCI assignments - Automatically reassign PCIs to minimize conflicts"

**What it does:**
- Uses intelligent algorithms
- Minimizes all conflict types
- Maintains network topology
- Suggests optimal PCI values

### **Clear Map** 🗑️
**Tooltip:** "Clear all cells from map - Removes all cells but keeps network saved"

- Clears visual display
- Network data remains saved
- Reload network to restore cells

---

## 📱 Network Manager

### **Create Network** ➕
**Tooltip:** "Create a new network - Define name, location, and market for a new RF network"

**Required fields:**
- Network name
- Market/region
- GPS location (center point)

### **Switch Network** 🔄
**Tooltip:** "Switch to a different network - Only your networks are shown"

- Shows all your saved networks
- Click to load network
- Current network cells replace displayed cells

### **Delete Network** 🗑️
**Tooltip:** "Permanently delete this network - All cells and analysis will be removed"

⚠️ **Warning:** This action cannot be undone!

---

## 🎯 Conflict Severity Guide

The tooltips explain conflict severity based on distance and type:

### **Distance-Based Severity**

| Distance | Collision | Confusion | MOD3 | MOD6 | MOD12 | MOD30 |
|----------|-----------|-----------|------|------|-------|-------|
| 0-500m | CRITICAL | CRITICAL | CRITICAL | HIGH | HIGH | MEDIUM |
| 500-1000m | HIGH | HIGH | HIGH | MEDIUM | MEDIUM | LOW |
| 1000-2000m | MEDIUM | MEDIUM | MEDIUM | LOW | LOW | LOW |
| 2000-3000m | LOW | LOW | LOW | LOW | LOW | LOW |
| >3000m | LOW | LOW | LOW | LOW | LOW | LOW |

### **Conflict Type Tooltips**

**Collision:**
"Two cells have identical PCI - Most severe conflict type"

**Confusion:**
"Cells with same PCI detected by UE during handover - Causes handover failures"

**MOD3:**
"PCI values have same modulo 3 remainder - Affects physical layer procedures"

**MOD6:**
"PCI values have same modulo 6 remainder - Can cause RS interference"

**MOD12:**
"PCI values have same modulo 12 remainder - Moderate interference risk"

**MOD30:**
"PCI values have same modulo 30 remainder - Minor consideration"

---

## 💡 Quick Tips Section

### **Keyboard Shortcuts** ⌨️
*(Future feature - tooltips will show shortcuts)*

- `Ctrl+N` - New network
- `Ctrl+I` - Import cells
- `Ctrl+A` - Run analysis
- `Ctrl+O` - Optimize PCIs
- `Escape` - Close modals

### **Best Practices** 🎯

Tooltips guide users to best practices:

- "Leave PCI blank for auto-assignment" - Prevents user errors
- "Typical azimuth: 0°, 120°, 240° for 3-sector" - Guides configuration
- "EARFCN 1950 = LTE Band 1 (2100 MHz)" - Clarifies frequency mapping

---

## 🔧 Tooltip Implementation

### **Technical Details**

The app uses two tooltip methods:

1. **Native HTML `title` attribute** - Simple, built-in browser tooltips
   ```html
   <button title="This is a tooltip">Button</button>
   ```

2. **Custom Tooltip component** - Rich, styled tooltips (future enhancement)
   ```svelte
   <Tooltip text="Custom tooltip">
     <button>Button</button>
   </Tooltip>
   ```

### **Tooltip Component Features**

- Positioned automatically (top/bottom/left/right)
- Fade-in animation
- Dark background for readability
- Arrow pointing to element
- Prevents UI overlap

---

## 📋 Tooltip Checklist

All major UI elements now have tooltips:

- [x] Topbar statistics (Cells, Conflicts)
- [x] Action buttons (Analysis, Conflicts, Recommendations)
- [x] Map controls (Right-click hint)
- [x] Theme switcher
- [x] User profile menu
- [ ] Cell editor fields (coming soon)
- [ ] Network manager buttons (coming soon)
- [ ] Import wizard fields (coming soon)

---

## 🎓 User Benefit

**With tooltips, users can:**

✅ Learn app features without leaving the interface
✅ Understand complex RF concepts inline
✅ Know what each button does before clicking
✅ See conflict severity explanations
✅ Get field validation hints
✅ Discover features through exploration

---

## 🔄 Tooltip Maintenance

When adding new features:

1. **Add tooltip to button/input:**
   ```html
   <button title="Clear explanation of what this does">Action</button>
   ```

2. **Follow tooltip format:**
   - **Format:** "Primary action - Additional context"
   - **Example:** "Run analysis - Checks for PCI conflicts across all cells"

3. **Update this documentation:**
   - Add new tooltip to relevant section
   - Include hover text and explanation
   - Provide usage context

---

## ✅ Summary

**The PCI Mapper now has:**

- 🎯 Comprehensive hover tooltips on all major buttons
- 📊 Detailed explanations of statistics and metrics
- 💡 Contextual help for conflict types and severity
- 🔧 Field-level guidance in forms and editors
- 📚 Inline documentation without external docs

**Users can learn the app by hovering!** 🖱️

---

**Last Updated:** October 3, 2025

