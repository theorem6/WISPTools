# 📊 Simplified CSV Import Format

## Overview

The CSV import has been simplified to only require the essential cell/sector data fields. This makes data entry faster and cleaner.

---

## 📋 CSV Format

### **Required Columns (in order):**

| Column | Description | Example | Required |
|--------|-------------|---------|----------|
| **Cell ID** | Unique identifier for the cell/sector | `CELL001` | ✅ Yes |
| **Sector** | Sector number (1-4) | `1`, `2`, `3` | ✅ Yes |
| **Azimuth** | Direction in degrees (0-359) | `0`, `120`, `240` | ⚠️ Optional |
| **Altitude** | Height above ground in feet | `100`, `150` | ⚠️ Optional |
| **PCI** | Physical Cell ID (0-503) | `15`, `21` | ⚠️ Optional* |
| **EARFCN** | Frequency channel number | `1950`, `55650` | ✅ Yes |
| **Latitude** | GPS latitude | `40.7128` | ⚠️ Optional** |
| **Longitude** | GPS longitude | `-74.0060` | ⚠️ Optional** |

\* *Leave PCI blank for auto-assignment*  
\** *Optional if all cells share the same location*

---

## 📝 Example CSV

### **Simple 3-Sector Tower:**

```csv
Cell ID,Sector,Azimuth,Altitude,PCI,EARFCN,Latitude,Longitude
CELL001,1,0,100,15,1950,40.7128,-74.0060
CELL002,2,120,100,,1950,40.7128,-74.0060
CELL003,3,240,100,21,1950,40.7128,-74.0060
```

### **Multiple Towers:**

```csv
Cell ID,Sector,Azimuth,Altitude,PCI,EARFCN,Latitude,Longitude
CELL001,1,0,100,15,1950,40.7128,-74.0060
CELL002,2,120,100,,1950,40.7128,-74.0060
CELL003,3,240,100,,1950,40.7128,-74.0060
CELL004,1,0,120,,1950,40.7689,-73.9667
CELL005,2,120,120,,1950,40.7689,-73.9667
CELL006,3,240,120,,1950,40.7689,-73.9667
```

### **CBRS Cells (4-sector):**

```csv
Cell ID,Sector,Azimuth,Altitude,PCI,EARFCN,Latitude,Longitude
CELL007,1,0,150,,55650,40.7589,-73.9851
CELL008,2,90,150,,55650,40.7589,-73.9851
CELL009,3,180,150,,55650,40.7589,-73.9851
CELL010,4,270,150,,55650,40.7589,-73.9851
```

---

## 🎯 What Happens Automatically

### **1. Frequency Derivation (Auto-Calculated)**
⚠️ **You do NOT provide Frequency** - the system automatically derives it from EARFCN:

| EARFCN Range | Frequency (Auto) | Band |
|--------------|------------------|------|
| 0 - 599 | 2100 MHz | LTE Band 1 |
| 1200 - 1949 | 1800 MHz | LTE Band 3 |
| 2750 - 3449 | 2600 MHz | LTE Band 7 |
| 55240 - 56739 | 3550 MHz | CBRS |

### **2. RS Power (Auto-Set)**
⚠️ **You do NOT provide RS Power** - automatically set to **-85 dBm** (typical reference signal power)

### **3. Other Auto-Filled Values**
Fields not in CSV get sensible defaults:

- **eNodeB**: Extracted from Cell ID numbers (e.g., `CELL001` → eNodeB `1`)
- **Technology**: `LTE` (or `CBRS` if EARFCN is in CBRS range)
- **Channel Bandwidth**: `20 MHz`
- **Center Frequency**: Same as derived frequency
- **DL/UL EARFCN**: Both set to the provided EARFCN

### **3. PCI Auto-Assignment**
If PCI column is empty, the system will automatically assign a conflict-free PCI after import.

---

## 💡 Tips & Best Practices

### **Sector Numbering**
- **3-sector towers**: Use sectors 1, 2, 3
- **4-sector towers**: Use sectors 1, 2, 3, 4
- Sector numbers help organize cells by tower

### **Azimuth Values**
- **Sector 1**: Typically `0°` (North)
- **Sector 2** (3-sector): Typically `120°`
- **Sector 3** (3-sector): Typically `240°`
- **4-sector towers**: `0°`, `90°`, `180°`, `270°`

Leave azimuth blank for auto-calculation based on sector number.

### **Altitude**
- Height of antenna above ground level in feet
- Typical values: `50-200 feet`
- Used for line-of-sight calculations

### **PCI Assignment Strategy**
- Leave blank for initial import (auto-assigned)
- Or specify known PCIs if available
- System will flag conflicts after import

---

## 🚀 How to Use

### **In the App:**

1. Click **"📥 Manual Import / CSV"** button
2. Click **"Download CSV Template"** to get the format
3. Fill in your cell data
4. Upload the CSV file
5. System will import and display cells on map

### **Download Template:**

The app provides a ready-to-use template with examples. Just click **"Download CSV Template"** in the import dialog.

---

## 📊 Example Workflow

### **Step 1: Export your cell data with these columns:**
```
Cell ID, Sector, Azimuth, Altitude, PCI, EARFCN, Latitude, Longitude
```

### **Step 2: Upload to PCI Mapper**
- The system fills in all other required fields automatically
- Frequency, bandwidth, technology all derived from EARFCN

### **Step 3: Review & Analyze**
- Cells appear on map
- Conflict detection runs automatically
- PCI optimization available if conflicts found

---

## ❓ FAQ

### **Q: What if I don't know the PCI?**
A: Leave the PCI column blank. The system will auto-assign conflict-free PCIs after import.

### **Q: Can I upload cells without lat/lng?**
A: Yes, but you'll need to set them in the UI or all cells will appear at 0,0. Lat/lng are technically optional in the CSV but required for proper mapping.

### **Q: What EARFCN should I use?**
A: Common values:
- LTE Band 1 (2100 MHz): `1950`
- LTE Band 3 (1800 MHz): `1575`
- LTE Band 7 (2600 MHz): `3100`
- CBRS (3550 MHz): `55650`

### **Q: Do I need to provide eNodeB?**
A: No! The system extracts it from the Cell ID. For example, `CELL001` → eNodeB `1`.

### **Q: Can I mix LTE and CBRS in one file?**
A: Yes! The system automatically detects technology based on EARFCN.

---

## 🔄 Migration from Old Format

If you have the old 15-column CSV format:

**Old format (15 columns):**
```
Cell ID,eNodeB,Sector,PCI,Lat,Lng,Freq,RS Power,Azimuth,Tower Type,Tech,EARFCN,Bandwidth,DL,UL
```

**New format (8 columns):**
```
Cell ID,Sector,Azimuth,Altitude,PCI,EARFCN,Latitude,Longitude
```

**What changed:**
- ❌ Removed: eNodeB (auto-extracted), Frequency (auto-derived), RS Power (default), Tower Type (auto-detected), Channel Bandwidth (default), DL/UL EARFCN (use EARFCN)
- ✅ Added: Altitude (optional but useful)
- ✅ Simplified: Only essential fields needed

---

## ✅ Summary

**Old CSV:** 15 columns, complex, lots of redundant data  
**New CSV:** 8 columns, simple, essential data only

The simplified format:
- ✅ Faster data entry
- ✅ Less room for error
- ✅ Auto-fills derived fields
- ✅ Cleaner templates
- ✅ Same powerful analysis

**Just provide the essentials, we handle the rest!**

---

**Last Updated:** October 3, 2025

