# How to Edit Cell Sites, Sectors, and EARFCNs

## ✅ All Editing Features Are Available!

You can add, edit, and delete sectors and EARFCNs at any time - not just during initial creation.

## 📍 Ways to Edit Cell Sites

### Method 1: Tower Manager (Recommended)

1. **Open Tower Manager**
   - Click the tower/layers icon (📚) in the top navigation bar

2. **Find Your Tower**
   - Browse or search for the tower you want to edit
   - Click anywhere on the tower card to expand and see all sectors

3. **Edit the Tower**
   - Click the **✏️ Edit** button (pencil icon) on the tower card
   - The Site Editor will open with all current sectors and channels

### Method 2: Right-Click Context Menu

1. **Right-click on an Existing Sector** (cone on the map)
   - Select **"Edit Sector"** from the context menu
   - Opens the Cell Editor for that specific sector

2. **Right-click on Empty Map**
   - Select **"Add Cell Site Manually"** to create a new site

### Method 3: Left-Click on Sector

1. **Left-click on any sector cone** on the map
   - Opens the Cell Editor for that sector directly

---

## 🔧 What You Can Edit in the Site Editor

Once the Site Editor is open, you can:

### ➕ Add New Sectors
- Click the **"Add New Sector"** button
- Smart azimuth suggestions:
  - 1st sector: 0° (North)
  - 2nd sector: 120° (3-sector default)
  - 3rd sector: 240° (3-sector default)
  - 4th sector: 90° (4-sector CBRS)
  - Additional sectors: Placed in the largest gap

### ✏️ Edit Existing Sectors
For each sector, you can modify:
- **Azimuth** (0-359°)
  - Use the slider for quick adjustments
  - Or type exact degrees in the number field
  - Visual compass shows direction (N, NE, E, etc.)
- **Beamwidth** (33°, 65°, 78°, 90°, 120°)
- **PCI** (Physical Cell ID, 0-503)
- **RS Power** (dBm)
- **Technology** (LTE, CBRS, 5G)

### ➕ Add EARFCNs/Channels to a Sector
- Click **"+ Add Channel"** button within any sector
- Each sector can have **multiple EARFCNs**
- Configure for each channel:
  - **DL EARFCN** (Downlink)
  - **UL EARFCN** (Uplink)
  - **Center Frequency** (MHz)
  - **Channel Bandwidth** (1.4, 3, 5, 10, 15, 20 MHz)
  - **Set as Primary** (one channel per sector)

### 🗑️ Delete Sectors or Channels
- **Remove Sector**: Click the 🗑️ (trash) icon in the sector header
- **Remove Channel**: Click the **"Remove"** button next to any channel

### 💾 Save Your Changes
- Click **"💾 Save Changes"** button at the bottom
- Changes are immediately applied to the network
- Map updates automatically with new sector cones
- Conflicts are re-analyzed

---

## 📊 Example Editing Workflow

**Scenario:** You have a 3-sector tower and want to add a 4th sector for CBRS coverage

1. Open **Tower Manager** (click tower icon in topbar)
2. Find your tower and click **✏️ Edit**
3. Click **"Add New Sector"** button
4. Edit the new sector:
   - Set Azimuth to **90°** (or any direction you need)
   - Set Beamwidth to **90°**
   - Set PCI to a non-conflicting value
   - Set Technology to **CBRS**
5. Click **"+ Add Channel"** for the new sector
6. Set EARFCN to **55650** (CBRS Band 48)
7. Set Center Frequency to **3550 MHz**
8. Click **"💾 Save Changes"**

Done! Your tower now has 4 sectors with proper CBRS configuration.

---

## 🎯 Quick Tips

- **Azimuth belongs to sectors**, not cell sites
- **Each sector can have multiple EARFCNs** (carrier aggregation)
- **One channel per sector must be marked as Primary**
- **Delete sectors** removes them from the tower
- **Site Editor always shows the full tower** with all sectors
- **Changes take effect immediately** on save

---

## 🚨 Validation Rules

The Site Editor will prevent you from saving if:
- ❌ Site has no name
- ❌ Site has zero sectors (must have at least one)

Otherwise, you're free to add as many sectors and EARFCNs as needed!

---

## Need Help?

- **Tower not showing?** Make sure you've selected a network in the Network Selector
- **Can't find edit button?** Open Tower Manager and look for the ✏️ icon on each tower card
- **Changes not saving?** Check console for errors and ensure you have an active network selected

