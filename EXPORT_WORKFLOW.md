# Export Workflow Guide

## Overview

The export functionality has been consolidated into a single, intuitive export modal accessible from the Actions dropdown menu.

## How to Access Exports

### Step 1: Click "Actions" Menu
Located in the top navigation bar (three vertical dots icon)

### Step 2: Click "Export & Configure"
Opens the export modal with all export options

### Step 3: Choose Your Export Type

The modal now offers **3 export options**:

```
┌────────────────────────────────────────┐
│  📤 Export & Configuration             │
├────────────────────────────────────────┤
│                                        │
│  📊 Export Options                     │
│  Export conflict reports or generate   │
│  Nokia base station configurations     │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │  📄 Export CSV                   │ │
│  ├──────────────────────────────────┤ │
│  │  📋 Export PDF                   │ │
│  ├──────────────────────────────────┤ │
│  │  📻 Nokia XML                    │ │
│  └──────────────────────────────────┘ │
│                                        │
└────────────────────────────────────────┘
```

## Export Options Explained

### 📄 CSV Export
- **Purpose**: Conflict report in spreadsheet format
- **Content**: All conflicts with details, severity, distance
- **Use Case**: Data analysis, record keeping, sharing with teams
- **Format**: Standard CSV file

### 📋 PDF Export  
- **Purpose**: Professional conflict report
- **Content**: Formatted report with statistics, breakdown, recommendations
- **Use Case**: Documentation, presentations, customer reports
- **Format**: PDF document

### 📻 Nokia XML Export
- **Purpose**: Nokia base station configuration file
- **Content**: Complete LTE configuration with transmitters, carriers, PCIs
- **Use Case**: Uploading to Nokia BBU, NetAct configuration
- **Format**: Nokia RAML 2.1 XML

## Workflow: Nokia Export

### Complete Workflow

```
1. Design Network
   ├── Add towers/cell sites
   ├── Configure transmitters (sectors)
   ├── Add carriers per transmitter
   └── Set PCIs and EARFCNs
   
2. Run PCI Analysis
   ├── Check for conflicts
   └── Optimize if needed
   
3. Open Export Modal
   ├── Actions → Export & Configure
   └── Click "📻 Nokia XML"
   
4. Nokia Configuration
   ├── Import site from dropdown
   ├── Configure IP addresses
   ├── Review transmitters & carriers
   ├── Validate configuration
   └── Generate & Download XML
   
5. Deploy to Nokia BBU
   ├── Upload XML to NetAct
   └── Apply configuration
```

### Quick Export

If you just need a CSV or PDF report:

1. **Actions** → **Export & Configure**
2. Click **CSV** or **PDF**
3. File downloads automatically

## Changes From Previous Version

### ✅ Removed (Simplified UI)
- ❌ Standalone "Nokia Export" button (was in top nav)
- ❌ "Load Sample" button
- ❌ "Clear Map" button

### ✅ Added (Better Organization)
- ✓ Nokia export integrated into export modal
- ✓ All export options in one place
- ✓ Cleaner navigation bar
- ✓ More intuitive workflow

## Benefits

### User Experience
- **Single Location**: All exports in one modal
- **Less Clutter**: Removed redundant buttons
- **Clear Options**: Three clearly labeled export types
- **Workflow**: Natural progression from design → analyze → export

### Visual Design
- **Cleaner Nav Bar**: Fewer buttons = less cognitive load
- **Organized Modal**: Export options grouped logically
- **Consistent Styling**: CSV (green), PDF (blue), Nokia (Nokia blue)
- **Better Discovery**: Users find all export options in one place

## Button Locations

### Top Navigation Bar (Right Side)
```
[Actions ▼] [User] [Theme] [Tower] [Analysis] [Conflicts] [AI]
    ↑
  Click here!
```

### Actions Dropdown Menu
```
Actions ▼
├── Data
│   └── Import Cells
├── Analysis  
│   ├── Run Analysis
│   └── Optimize PCIs
└── Export
    └── Export & Configure  ← Opens export modal
```

### Export Modal
```
📊 Export Options
├── 📄 Export CSV
├── 📋 Export PDF
└── 📻 Nokia XML  ← Opens Nokia config
```

## Navigation Path

### To Export Conflict Report (CSV/PDF):
**Actions** → **Export & Configure** → **CSV** or **PDF**

### To Generate Nokia Configuration:
**Actions** → **Export & Configure** → **Nokia XML** → Configure → Download

### To Manage Towers:
**Tower Manager** button (in top nav)

### To Import Cells:
**Actions** → **Import Cells**

## Keyboard Shortcuts

- **Escape**: Close modals
- **Click outside**: Close dropdowns and modals

## Mobile View

On mobile devices:
- Actions button shows only icon (three dots)
- Export modal adapts to smaller screens
- Export buttons stack vertically
- All functionality preserved

## Summary

The UI is now cleaner and more organized:

**Before**: 
- Multiple buttons scattered in nav bar
- Load Sample, Clear Map, Nokia Export, etc.

**After**:
- Single "Actions" dropdown
- Export modal with 3 clear options: CSV, PDF, Nokia XML
- Streamlined navigation
- Better user flow

All export functionality is accessible through:
**Actions → Export & Configure → Choose format**

This is more intuitive and professional! 🎉

