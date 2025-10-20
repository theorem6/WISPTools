# 🔄 Field Operations Workflows

**WISP Management Platform - Standardized Field Procedures**

---

## 📦 Workflow 1: Check In Inventory

**When:** Equipment arrives at warehouse, returns from field, or comes back from RMA

### **Web Platform Workflow**

#### Step 1: Receive Equipment
1. Navigate to **Inventory Module**
2. Click **"📷 Scan Barcode"** or **"➕ Add Item"**
3. If scanning:
   - Scan barcode/QR code
   - System auto-fills serial number, manufacturer, model
4. If manual:
   - Enter all equipment details
   - System generates asset tag and QR code

#### Step 2: Set Location
1. **Location Type:** Select "Warehouse"
2. **Warehouse:** Select which warehouse
3. **Section/Aisle/Shelf/Bin:** Enter precise location
4. **Status:** Set to "Available"
5. **Condition:** Select (New, Good, Fair, etc.)

#### Step 3: Purchase Info (Optional)
1. Enter vendor, purchase date, price
2. Add PO number and invoice
3. Set warranty information

#### Step 4: Print Label
1. Click **🏷️ Print Asset Tag**
2. Print QR code label
3. Affix to equipment

### **Mobile App Workflow**

#### Step 1: Open App
1. Login with credentials
2. Navigate to **"Check In Equipment"** screen

#### Step 2: Scan or Enter
1. **Option A:** Scan existing barcode from packaging
2. **Option B:** Manual entry of details
3. System checks if item exists in inventory

#### Step 3: Confirm Check-In
1. Verify equipment details
2. Select warehouse location
3. Take photo of equipment (optional)
4. Confirm check-in

#### Step 4: Result
- ✅ Equipment status → "Available"
- ✅ Location → Warehouse
- ✅ Syncs to web platform immediately
- ✅ Shows in warehouse inventory count

---

## 🚀 Workflow 2: Checkout and Install

### **2A: Checkout & Deploy Multipoint/LTE Sectors**

#### **Web Platform Preparation**

**Step 1: Coverage Map - Verify Site**
1. Open **Coverage Map Module**
2. Locate tower site on map
3. Verify tower details:
   - Height, FCC ID
   - Gate codes
   - Contact information
   - Existing sectors

**Step 2: Plan Sector Configuration**
1. Check PCI Resolution module for conflicts
2. Determine:
   - Azimuth (direction)
   - Band (B71, CBRS, etc.)
   - Beamwidth
   - PCI assignment

**Step 3: Reserve Equipment**
1. Go to **Inventory Module**
2. Filter: Category = "Radio Equipment"
3. Find available eNodeB or radio unit
4. Click **Edit** → Status = "Reserved"
5. Add note: "Reserved for [Tower Name] - Sector deployment"

#### **Mobile App - Day of Install**

**Step 1: Load Vehicle**
1. Open **Mobile App**
2. Go to **"Checkout Equipment"**
3. Scan each item:
   - Radio unit
   - Antenna
   - Cables
   - Mounting hardware
4. System asks: "Load into vehicle?"
5. Confirm → Status changes to "In-Transit"
6. Location changes to "Service Vehicle"

**Step 2: Navigate to Site**
1. Tap **"📡 Nearby Towers"**
2. Select destination tower
3. View gate code and contacts
4. Tap **"🗺️ Open in Maps"**
5. Navigate to site

**Step 3: On-Site Access**
1. Arrive at tower
2. View gate code on phone
3. View safety notes
4. Call site contact if needed

**Step 4: Deploy Sector**
1. After installation, scan radio unit
2. Tap **"🚀 Deploy to Site"**
3. Select tower from list
4. Enter deployment details:
   - Azimuth: [e.g., 120°]
   - Height: [e.g., 150 ft]
   - Antenna type
   - Cable run details
5. Take photos of installation
6. Add installation notes
7. Confirm deployment

**Step 5: Result**
- ✅ Equipment status → "Deployed"
- ✅ Location → Tower site name
- ✅ New sector created in Coverage Map
- ✅ Photos attached to inventory item
- ✅ Installation timestamp recorded

#### **Web Platform - Post-Install**

**Step 1: Verify Deployment**
1. Coverage Map shows new sector
2. Inventory shows equipment at tower
3. Work order marked complete

**Step 2: Configuration**
1. ACS module configures radio parameters
2. HSS module provisions subscriber access
3. PCI module verifies no conflicts

---

### **2B: Checkout & Deploy Backhaul**

#### **Web Platform Preparation**

**Step 1: Plan Backhaul Link**
1. **Coverage Map** → Click source tower
2. Click **"Add Backhaul"**
3. Select destination (another tower or NOC)
4. Choose type:
   - Fiber
   - Fixed Wireless Licensed
   - Fixed Wireless Unlicensed

**Step 2: Reserve Equipment**
For **Fiber:**
- Reserve fiber termination equipment
- SFP modules
- Patch cables

For **Fixed Wireless:**
- Reserve two radios (Site A + Site B)
- Antennas (directional)
- Mounting hardware
- Cables

**Step 3: Configure Link Details**
- Frequency (for wireless)
- Capacity (Mbps)
- Circuit ID (for fiber)
- Provider info
- Monthly cost

#### **Mobile App - Installation**

**Step 1: Checkout Equipment**
1. Scan Site A radio → "Load into vehicle"
2. Scan Site B radio → "Load into vehicle"
3. Scan antennas and hardware
4. Status → "In-Transit"

**Step 2: Site A Installation**
1. Navigate to Site A
2. Install radio and antenna
3. Scan radio unit
4. Tap **"🚀 Deploy to Site"**
5. Select tower
6. Enter details:
   - Mount location
   - Azimuth toward Site B
   - Antenna height
   - TX power
7. Take photos
8. Mark **"Site A Complete"**

**Step 3: Site B Installation**
1. Navigate to Site B (or NOC)
2. Repeat deployment process
3. Enter azimuth toward Site A
4. Configure alignment

**Step 4: Link Activation**
1. System detects both ends deployed
2. Backhaul link auto-created on Coverage Map
3. Line drawn between sites
4. Status → "Active"

---

### **2C: Checkout & Deploy CPE**

#### **Web Platform - Customer Order**

**Step 1: Create Customer Record**
1. HSS Module → Add subscriber
2. Provision IMSI, KI, OPC
3. Set bandwidth plan

**Step 2: Reserve CPE**
1. Inventory → Filter "CPE Devices"
2. Select available CPE unit
3. Status → "Reserved"
4. Note: "Reserved for [Customer Name]"

**Step 3: Pre-Configuration**
1. ACS Module → Pre-provision CPE
2. Set connection request URL
3. Configure initial parameters

#### **Mobile App - Installation Day**

**Step 1: Load Vehicle**
1. Scan CPE unit → "Load into vehicle"
2. Scan antenna
3. Scan mounting hardware
4. All items → "In-Transit"

**Step 2: Navigate to Customer**
1. View customer address in app
2. Navigate with Google Maps
3. Contact customer on arrival

**Step 3: Installation**
1. Mount CPE and antenna
2. Scan CPE unit
3. Tap **"🚀 Deploy to Site"**
4. Enter:
   - Customer name
   - Service address
   - GPS coordinates (auto-captured)
   - Antenna azimuth (toward tower)
   - Signal strength readings
5. Take photos of installation
6. Customer signature capture

**Step 4: Activation**
1. Power on CPE
2. Wait for ACS connection
3. Verify connectivity
4. Run speed test
5. Mark **"Installation Complete"**

**Step 5: Result**
- ✅ CPE status → "Deployed"
- ✅ Location → Customer address
- ✅ Appears on Coverage Map
- ✅ ACS shows online status
- ✅ HSS provisions access
- ✅ Customer can use service

---

## 🆘 Workflow 3: Respond to Trouble Tickets & Outages

### **Ticket Types**

#### A. **CPE Offline / No Service**
#### B. **Sector Down**
#### C. **Backhaul Failure**
#### D. **Network-Wide Outage**

---

### **3A: CPE Offline / No Service**

#### **Step 1: Ticket Creation** (Web Platform)
1. Customer calls support
2. Create ticket in system
3. Lookup customer in HSS module
4. Check ACS for CPE status
5. Assign to field tech

#### **Step 2: Tech Receives Ticket** (Mobile App)
1. Push notification: "New Ticket #1234"
2. Open ticket → See:
   - Customer name & address
   - CPE serial number
   - Last online time
   - Signal history
3. Tap **"Accept Ticket"**
4. Tap **"Navigate to Customer"**

#### **Step 3: On-Site Diagnosis**
1. Arrive at customer site
2. Scan CPE unit QR code
3. View equipment details:
   - ACS connection status
   - Last inform time
   - Firmware version
4. Tap **"Run Diagnostics"**
   - Signal strength
   - Connection test
   - Speed test

#### **Step 4A: Simple Fix**
1. Identify issue (cable loose, power off, etc.)
2. Fix and test
3. Tap **"Mark Resolved"**
4. Add resolution notes
5. Customer signature
6. Ticket auto-closes

#### **Step 4B: Equipment Replacement**
1. Scan failed CPE → **"Mark for RMA"**
2. Status → "RMA"
3. Scan replacement CPE from vehicle
4. **"Deploy to Customer"**
5. Enter new CPE details
6. ACS auto-provisions new CPE
7. Old CPE → RMA location
8. New CPE → Customer location
9. Ticket updated with swap details

---

### **3B: Sector Down**

#### **Step 1: Detection** (Web Platform)
1. Monitoring detects sector offline
2. Auto-create ticket
3. Coverage Map shows affected area
4. Check number of impacted subscribers

#### **Step 2: Dispatch** (Mobile App)
1. Tech receives high-priority ticket
2. View sector details:
   - Tower location
   - Equipment serial numbers
   - Configuration
3. Check vehicle inventory for spare radio
4. If no spare → **"Request Equipment"**
   - System reserves from warehouse
   - Another tech delivers to site

#### **Step 3: On-Site**
1. Navigate to tower
2. Access with gate code
3. Scan sector equipment QR code
4. View current configuration
5. Run diagnostics

#### **Step 4: Repair or Replace**
**Option A: Reboot/Reconfigure**
1. Power cycle equipment
2. Verify comes online in ACS
3. Check signal levels
4. Mark ticket resolved

**Option B: Equipment Swap**
1. Scan failed radio → **"Mark RMA"**
2. Take photo of failure
3. Scan replacement radio
4. **"Deploy to Site"** → Same tower, same sector
5. System copies configuration to new radio
6. ACS auto-provisions
7. Verify sector online
8. Failed unit → RMA status

---

### **3C: Backhaul Failure**

#### **Step 1: Detection** (Web Platform)
1. Monitoring alerts: "Backhaul down"
2. Coverage Map shows affected link (red line)
3. Identify both endpoints (Site A & Site B)
4. List impacted services

#### **Step 2: Remote Diagnosis**
1. Check fiber provider status (if fiber)
2. Check radio link status (if wireless)
3. ACS shows radio connectivity
4. Ping tests from NOC

#### **Step 3: Dispatch** (Mobile App)
1. Tech assigned to Site A or Site B
2. View backhaul details:
   - Link type (fiber/wireless)
   - Equipment at both ends
   - Configuration
3. Navigate to site

#### **Step 4: On-Site Troubleshooting**
**For Fiber:**
1. Check fiber termination
2. Test with OTDR
3. Call provider if fiber cut
4. Update ticket with findings

**For Wireless:**
1. Scan radio QR code
2. Check power and connections
3. View alignment (azimuth to other site)
4. Signal strength test
5. Realign if needed
6. Update link status

#### **Step 5: Equipment Swap if Needed**
1. Scan failed radio → RMA
2. Scan replacement → Deploy
3. Auto-configure with saved settings
4. Verify link up
5. Test throughput
6. Document in ticket

---

### **3D: Network-Wide Outage**

#### **Step 1: Identify Scope** (Web Platform)
1. Coverage Map shows all affected sites
2. Monitoring dashboard shows:
   - Sites offline
   - Subscribers impacted
   - Services down
3. Identify root cause:
   - NOC power failure?
   - Core network issue?
   - Upstream provider down?

#### **Step 2: Triage & Dispatch**
1. Create master incident ticket
2. Link all related tickets
3. Dispatch teams to:
   - NOC (if NOC issue)
   - Key tower sites
   - Upstream provider facility

#### **Step 3: NOC Response**
1. Tech arrives at NOC
2. Scan NOC location QR code
3. View NOC equipment inventory
4. Check power systems
5. Check core network (HSS, MME, SGW)
6. Document findings in ticket

#### **Step 4: Restore Service**
1. Fix root cause
2. Verify sites coming back online
3. Coverage Map updates (green indicators)
4. Monitoring shows recovery
5. Update master ticket
6. Notify customers

---

## 📱 Mobile App - New Screens Needed

### 1. **Work Orders / Tickets Screen**
```
My Tickets (5)
┌─────────────────────────────────┐
│ 🔴 HIGH - Sector Offline        │
│ Tower: Main St Site             │
│ Assigned 2 hours ago            │
│ [Accept] [View Details]         │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 🟡 MEDIUM - CPE No Service      │
│ Customer: John Smith            │
│ Address: 123 Main St            │
│ [Accept] [Navigate]             │
└─────────────────────────────────┘
```

### 2. **Equipment Checkout Screen**
```
Checkout Equipment
┌─────────────────────────────────┐
│ Scan items to load into vehicle │
│                                  │
│ [📷 Scan Item]  [⌨️ Manual]    │
└─────────────────────────────────┘

Items in Cart (3):
☑ Nokia Radio - SN: ABC123
☑ Sector Antenna - SN: XYZ789
☑ 50ft Coax Cable - SN: CAB001

[✅ Checkout All Items]
```

### 3. **Deployment Wizard Screen**
```
Deploy Equipment to Site

Step 1: Scan Equipment
[📷 Scan equipment QR code]

Step 2: Select Site
○ Main St Tower
○ Hill Site Tower
○ Create New Site

Step 3: Installation Details
Azimuth: [120°]
Height: [150 ft]
Antenna Type: [Sector 90°]

Step 4: Documentation
[📷 Take Photos]
[✍️ Add Notes]
[✅ Customer Signature]

[🚀 Complete Deployment]
```

### 4. **Diagnostic Tools Screen**
```
Equipment Diagnostics

📡 CPE-001 @ Customer Site

Signal Strength: -68 dBm [Good]
SNR: 15 dB [Excellent]
Uptime: 12 days
Last Speed Test: 50/10 Mbps

[🔄 Refresh]
[📊 Run Speed Test]
[🔌 Reboot Device]
[⚙️ View Config]
```

### 5. **RMA Screen**
```
Return for RMA

Equipment: Nokia Radio ABC123
Reason: No power / Won't boot

☑ Equipment scanned
☑ Photos taken (3)
☑ Failure notes added

Return to:
○ Main Warehouse - RMA Section
○ RMA Center - 456 Repair Rd

[📦 Process RMA Return]
```

---

## 🌐 Web Platform - New Features Needed

### 1. **Work Order / Ticketing System**

**Location:** New module `/modules/work-orders`

**Features:**
- Create tickets manually or auto (from monitoring)
- Assign to technicians
- Priority levels (Low, Medium, High, Critical)
- Status: Open, Assigned, In Progress, Resolved, Closed
- Link to affected equipment/sites
- Time tracking
- Customer notifications

**Database Schema:**
```javascript
{
  ticketId: "TKT-2025-001",
  type: "cpe-offline" | "sector-down" | "backhaul-failure" | "installation",
  priority: "low" | "medium" | "high" | "critical",
  status: "open" | "assigned" | "in-progress" | "resolved" | "closed",
  assignedTo: "tech-user-id",
  affectedEquipment: ["equipment-id-1"],
  affectedSites: ["tower-id-1"],
  affectedCustomers: ["customer-id-1"],
  description: "Sector offline at Main St Tower",
  resolution: "Replaced failed radio",
  createdAt: Date,
  resolvedAt: Date,
  sla: { responseTime: 4, resolutionTime: 24 },
  tenantId: "tenant-1"
}
```

### 2. **Equipment Reservation System**

**Location:** Inventory module enhancement

**Features:**
- Reserve button on inventory items
- Reserved items show who reserved and for what
- Auto-expire reservations after 48 hours
- Reservation history

**Status Flow:**
```
Available → Reserved → In-Transit → Deployed
```

### 3. **Deployment Wizard** (Web)

**Location:** Coverage Map module

**Features:**
- Step-by-step deployment process
- Auto-create sector when deploying radio
- Auto-link inventory item to sector
- Deployment checklist
- Photo uploads
- Configuration templates

### 4. **Vehicle Management**

**Location:** New module `/modules/fleet`

**Features:**
- List all service vehicles
- Equipment currently in each vehicle
- Tech assigned to vehicle
- Current location (GPS from mobile app)
- Capacity tracking (max items per vehicle)

### 5. **RMA Tracking**

**Location:** Inventory module enhancement

**Features:**
- RMA workflow (Create RMA → Ship → Receive → Test → Return to Stock)
- RMA ticket creation
- Link to vendor RMA numbers
- Repair/replace decision
- Cost tracking
- Turnaround time reporting

---

## 🔄 Complete Workflows Summary

### **Check In Inventory**
```
Receive → Scan → Verify → Set Location → Print Label → Available
```
**Time:** 2-3 minutes per item  
**Users:** Warehouse staff

### **Deploy Sector**
```
Reserve → Checkout → Transit → Navigate → Install → Deploy → Online
```
**Time:** 2-4 hours  
**Users:** Field technician + network operator

### **Deploy CPE**
```
Reserve → Checkout → Navigate → Install → Provision → Test → Complete
```
**Time:** 1-2 hours  
**Users:** Field technician + support staff

### **Troubleshoot Outage**
```
Alert → Create Ticket → Dispatch → Diagnose → Fix/Replace → Verify → Close
```
**Time:** 1-8 hours depending on severity  
**Users:** Network operator + field technician

---

## 📊 Workflow Metrics to Track

### **Inventory Metrics**
- Items checked in per day
- Items checked out per day
- Average time in each status
- Utilization rate (deployed vs. available)

### **Deployment Metrics**
- Deployments per day/week/month
- Average deployment time
- Success rate (first-time installs)
- Equipment failures during deployment

### **Service Metrics**
- Tickets created vs. resolved
- Average resolution time
- SLA compliance
- Customer satisfaction

### **Equipment Metrics**
- Mean time between failures (MTBF)
- RMA rate by manufacturer
- Deployment lifecycle by category
- Cost per deployment

---

## 🎯 Next Steps to Implement

I'll now create:

1. ✅ **Work Order/Ticketing Module** (Web)
2. ✅ **Equipment Checkout Screen** (Mobile)
3. ✅ **Deployment Wizard** (Mobile)
4. ✅ **RMA Workflow** (Both)
5. ✅ **Vehicle Management** (Web)
6. ✅ **Diagnostic Tools** (Mobile)

Shall I proceed with implementing these workflow features?

