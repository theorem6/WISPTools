# 🚀 Quick Start Guide - Module Manager

## Starting the Platform

### Method 1: Using the PowerShell Launcher (Easiest)

Simply double-click `start-module-manager.ps1` or run in PowerShell:

```powershell
.\start-module-manager.ps1
```

### Method 2: Manual Start

```powershell
cd Module_Manager
npm install    # First time only
npm run dev
```

Then open your browser to: **http://localhost:5173**

---

## What You'll See

1. **Dashboard** - Main landing page with module cards
2. **PCI Resolution** - Full PCI conflict detection and analysis (WORKING ✅)
3. **Other Modules** - Coming soon placeholders

---

## Project Structure

```
PCI_mapper/
├── Module_Manager/          # Main platform (START HERE)
│   └── src/
│       ├── routes/
│       │   ├── /                    # Root redirect
│       │   ├── /login               # Authentication page  
│       │   ├── /dashboard           # Module selection
│       │   └── /modules/pci-resolution/  # PCI module (✅ WORKING)
│       └── lib/                     # Shared components & services
│
└── src/                     # Original PCI app (reference/backup)
    └── routes/+page.svelte  # Original working PCI page
```

---

## Adding New Modules

To add a new module to the dashboard:

1. **Create the module route:**
   ```
   Module_Manager/src/routes/modules/your-module/+page.svelte
   ```

2. **Add to dashboard:**
   Edit `Module_Manager/src/routes/dashboard/+page.svelte`
   
   Add your module to the `modules` array:
   ```typescript
   {
     id: 'your-module',
     name: 'Your Module Name',
     description: 'Module description',
     icon: '📊',
     color: '#2563eb',
     status: 'active',  // or 'coming-soon'
     path: '/modules/your-module'
   }
   ```

3. **Test it:**
   Restart dev server and click your new module card!

---

## Troubleshooting

### "npm is not recognized"
- Ensure Node.js is installed: https://nodejs.org/
- Restart your terminal after installation
- Run: `node --version` to verify

### Port 5173 already in use
- Stop any other Vite dev servers
- Or change port in `vite.config.ts`: `server: { port: 5174 }`

### Changes not appearing
- Hard refresh browser: `Ctrl + Shift + R` or `Ctrl + F5`
- Check terminal for build errors

### Module shows loading screen forever
- Check browser console (F12) for errors
- Check terminal for compilation errors
- Ensure all imports in the module are correct

---

## Development Tips

### File Watching
The dev server automatically reloads when you save files. No restart needed!

### Console Logging
- Browser Console (F12) shows client-side logs
- Terminal shows server-side build logs

### Hot Module Replacement (HMR)
Changes to Svelte components update instantly without full page reload.

---

## Next Steps

1. ✅ Start Module_Manager (`.\start-module-manager.ps1`)
2. ✅ Test PCI Resolution module
3. 🚧 Add your next module (Coverage Planning, Spectrum Management, etc.)
4. 📚 Review documentation in `Module_Manager/README.md`

---

## Need Help?

- Check `Module_Manager/README.md` for detailed documentation
- Review `DOCUMENTATION_OVERVIEW.md` for architecture details
- Check git history: `git log --oneline` to see what worked before

---

**Happy Coding! 🎉**

