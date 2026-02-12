---
title: Wizard Documentation – Online Help
description: Online documentation for all wizards; accessible via Help in each module.
---

# Wizard Documentation - Online Help

**Date:** January 2025  
**Status:** ✅ Complete

---

## 📋 Overview

Comprehensive online documentation has been created for all wizards, following the existing documentation patterns in the application. Documentation is accessible via the Help (?) button in each module.

---

## 📚 Documentation Files Created

### 1. **Centralized Wizard Documentation**
**File:** `Module_Manager/src/lib/docs/wizard-docs.ts`

**Contents:**
- Overview of wizard system
- How to access each wizard
- Detailed step-by-step guides for all 5 high-priority wizards:
  - Deployment Wizard
  - Troubleshooting Wizard
  - Device Onboarding Wizard
  - Inventory Check-in Wizard
  - Work Order Creation Wizard
- Common wizard features
- Best practices
- Troubleshooting guide

### 2. **Module-Specific Updates**

#### Deploy Module (`deploy-docs.ts`)
- Added "Deployment Wizard" section
- Explains deployment types (Sector, Radio, CPE)
- Step-by-step wizard guide
- Tips for using the wizard

#### ACS Module (`acs-cpe-docs.ts`)
- Added "Device Wizards" section
- Covers both Device Onboarding and Troubleshooting wizards
- Problem types and solutions explained
- Access instructions

#### Inventory Module (`inventory-docs.ts`)
- Added "Check-in Wizard" section
- Check-in methods explained
- Location types detailed
- Tips for efficient check-ins

---

## 🚀 How Wizards Are Accessed

### Deployment Wizard
- **Module:** Deploy
- **Button:** "📦 Deploy Equipment" in module header
- **Alternative:** Right-click tower site → "Deploy Hardware"

### Troubleshooting Wizard
- **Module:** ACS CPE Management
- **Button:** "🔍 Troubleshoot" (requires device selection)
- **Pre-populated:** Device ID and serial from selected device

### Device Onboarding Wizard
- **Module:** ACS CPE Management
- **Button:** "👋 Onboard Device" in module actions
- **Standalone:** Can be launched anytime

### Inventory Check-in Wizard
- **Module:** Inventory
- **Button:** "📦 Check-in Wizard" (primary action)
- **Alternative:** "Scan Check In" modal → Wizard mode

### Work Order Creation Wizard
- **Module:** Work Orders
- **Button:** "📋 Create Work Order Wizard" (primary action)
- **Alternative:** "Quick Create" modal for simple tickets

---

## 📖 Documentation Structure

All documentation follows this pattern:

```html
<h3>Module Title</h3>
<div class="info">Purpose</div>
<div class="toc">Table of Contents</div>
<h4 id="section">Section Title</h4>
<!-- Content with proper formatting -->
```

### Documentation Features

1. **Table of Contents:** Jump links to all sections
2. **Info Boxes:** Highlighted important information
3. **Step-by-Step Guides:** Numbered lists for procedures
4. **Tips Sections:** Best practices and helpful hints
5. **Troubleshooting:** Common issues and solutions
6. **Visual Indicators:** Emojis for quick scanning

---

## 🎯 Accessing Documentation

### Method 1: Module Help Button
1. Navigate to any module
2. Click the **Help (?)** button (bottom-left corner)
3. Documentation opens in modal
4. Navigate using table of contents

### Method 2: Direct Documentation Page
- Documentation is available via HelpModal component
- Can be accessed programmatically
- Supports deep linking to sections

---

## 📝 Documentation Content

### Each Wizard Includes:

1. **Access Instructions**
   - Where to find the wizard
   - Button location
   - Prerequisites

2. **Step-by-Step Guide**
   - Each step explained
   - What to expect
   - Required fields

3. **Tips and Best Practices**
   - Preparation tips
   - Common mistakes to avoid
   - Efficiency suggestions

4. **Troubleshooting**
   - Common issues
   - Solutions
   - When to seek help

---

## 🔄 Integration with Help System

Documentation integrates seamlessly with existing help system:

- **HelpModal Component:** Displays formatted HTML documentation
- **Module Docs:** Each module has its own documentation file
- **Wizard Docs:** Centralized wizard documentation
- **Cross-References:** Links between related sections

---

## ✅ Documentation Status

| Wizard | Documentation | Module Docs Updated | Status |
|--------|--------------|---------------------|--------|
| Deployment Wizard | ✅ Complete | ✅ Deploy Module | ✅ Complete |
| Troubleshooting Wizard | ✅ Complete | ✅ ACS Module | ✅ Complete |
| Device Onboarding Wizard | ✅ Complete | ✅ ACS Module | ✅ Complete |
| Inventory Check-in Wizard | ✅ Complete | ✅ Inventory Module | ✅ Complete |
| Work Order Creation Wizard | ✅ Complete | ⏳ Pending | ⏳ Pending |

---

## 🎨 Documentation Features

### Visual Elements
- **Info boxes:** Blue background for general information
- **Warning boxes:** Red background for important warnings
- **Success boxes:** Green background for success messages
- **Code blocks:** Syntax-highlighted code examples
- **Tables:** Formatted data tables

### Navigation
- **Table of Contents:** Clickable links to sections
- **Smooth Scrolling:** Auto-scrolls to selected section
- **Anchor Links:** Direct links to specific sections
- **Back to Top:** Easy navigation for long docs

### Responsive Design
- **Mobile-Friendly:** Adapts to small screens
- **Readable Fonts:** Optimized for readability
- **Proper Spacing:** Clear visual hierarchy

---

## 📱 User Experience

### Finding Wizard Documentation

1. **From Module:**
   - Click Help (?) button
   - Look for "Wizard" or "🧙" sections
   - Click to jump to wizard documentation

2. **From Wizard:**
   - Wizards include inline help
   - Tooltips explain each step
   - Error messages guide corrections

3. **Search:**
   - Use browser search (Ctrl+F / Cmd+F)
   - Search for wizard name
   - Jump to relevant section

---

## 🔍 Documentation Maintenance

### Adding New Wizards

1. Create wizard component
2. Add to `wizard-docs.ts`
3. Update module-specific docs
4. Add to table of contents
5. Test help modal display

### Updating Existing Docs

1. Edit relevant `.ts` file in `src/lib/docs/`
2. Follow existing formatting
3. Update table of contents if needed
4. Test in HelpModal

---

## 📊 Summary

✅ **Complete Documentation Created:**
- Centralized wizard documentation
- Module-specific wizard sections
- Step-by-step guides
- Best practices
- Troubleshooting guides

✅ **Integration Complete:**
- HelpModal component integration
- Module help buttons functional
- Cross-references working
- Responsive design

✅ **User Access:**
- Help (?) button in each module
- Table of contents navigation
- Deep linking support
- Mobile-friendly display

**Status:** All wizard documentation is complete and accessible online via the Help system!
