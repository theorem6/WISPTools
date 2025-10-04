# How to View Your Changes

## Issue: npm not recognized

You're seeing this error because Node.js is not installed or not in your PATH:
```
npm : The term 'npm' is not recognized...
```

## Solution: Install Node.js

### Option 1: Download and Install Node.js

1. **Download Node.js**: https://nodejs.org/
   - Choose the **LTS (Long Term Support)** version
   - For Windows, download the Windows Installer (.msi)

2. **Install Node.js**
   - Run the downloaded installer
   - Accept defaults (it will add npm to PATH automatically)
   - Restart your PowerShell/terminal after installation

3. **Verify Installation**
   ```powershell
   node --version
   npm --version
   ```

### Option 2: View via GitHub Pages / Firebase Hosting

If you have Firebase hosting set up, you can deploy:
```bash
npm run build
firebase deploy --only hosting
```

## After Installing Node.js

1. **Open a new PowerShell window** (important - to reload PATH)

2. **Navigate to project**:
   ```powershell
   cd C:\Users\david\Downloads\PCI_mapper
   ```

3. **Install dependencies** (one-time):
   ```powershell
   npm install
   ```

4. **Run development server**:
   ```powershell
   npm run dev
   ```

5. **Open browser** to: `http://localhost:5173`

## What You'll See

### Navigation Bar Changes:
- Bar is now **80px from top** (more space at top of screen)
- Bar spans **95% of page width** (full-width responsive)
- **Nokia Export button** is prominently visible in blue

### Button Location:
```
[📡 Tower] [📄 Nokia Export] [📊 Analysis] [⚠️ Conflicts] [💡 Recommendations]
              ↑
        Blue button with label
```

### On Mobile:
- Button shows icon + smaller text
- Bar adjusts to mobile width (98%)
- All buttons remain accessible

## Viewing on GitHub

You can also view your code on GitHub:
- Repository: https://github.com/theorem6/lte-pci-mapper
- Latest commit: `ead3fb1`
- Files changed: `src/routes/+page.svelte`

## Changes Made

1. ✅ Navigation bar moved 10 lines down (80px from top)
2. ✅ Bar made full-width and adjustable (95% width, 100% max)
3. ✅ Nokia Export button enhanced with:
   - Prominent blue gradient styling
   - Thicker border (2px)
   - Better shadows
   - Bold text (700 weight)
   - Guaranteed visibility (!important flags)

## Need Help?

If you continue having issues viewing the Nokia Export button, check:
1. Browser cache cleared (Ctrl+Shift+R for hard refresh)
2. Node.js properly installed and in PATH
3. Development server running (`npm run dev`)
4. No console errors in browser DevTools (F12)

