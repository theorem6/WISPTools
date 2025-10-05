# 🚀 Quick Start - LTE WISP Management Platform

## Get Started in 3 Steps

### 1️⃣ Install Dependencies

```bash
cd Module_Manager
npm install
```

### 2️⃣ Start Development Server

```bash
npm run dev
```

### 3️⃣ Open in Browser

Visit: **http://localhost:5173**

---

## 🎯 What You'll See

### Landing Page

- **Platform Header**: LTE WISP Management Platform with theme toggle
- **Hero Section**: Welcome message with platform stats
- **Module Cards**: Available modules (PCI Resolution is active)
- **Feature Highlights**: Platform capabilities
- **Footer**: Copyright information

### Navigation

- **Click Module Card**: Opens module page
- **Theme Toggle**: Switch between light/dark mode (persists)
- **Back Button**: Return to dashboard from modules

---

## 🎨 Try These Features

### 1. Toggle Dark Mode

Click the 🌙/☀️ icon in the header. Your preference is saved!

### 2. Explore PCI Resolution

Click the "PCI Resolution" card to see the module page.

### 3. Responsive Design

Resize your browser window - everything adapts!

---

## 📦 Project Structure

```
Module_Manager/
├── src/
│   ├── routes/
│   │   ├── +page.svelte           # Landing page
│   │   └── modules/
│   │       └── pci-resolution/    # PCI module
│   └── styles/
│       └── theme.css              # Shared theme
├── package.json
└── README.md                      # Full documentation
```

---

## 🔧 Development Commands

```bash
# Start dev server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Type checking (watch mode)
npm run check:watch
```

---

## 🎯 Next Steps

1. **Explore the Landing Page**: See all available modules
2. **Check Dark Mode**: Toggle between themes
3. **Read Documentation**: See [README.md](README.md) for details
4. **Review Theme**: Edit `src/styles/theme.css` to customize
5. **Add Modules**: Follow [README.md](README.md) guide to add modules

---

## 📚 Documentation

- **[README.md](README.md)** - Complete Module Manager guide
- **[MODULE_MANAGER_SETUP.md](../PCI_mapper/MODULE_MANAGER_SETUP.md)** - Platform setup
- **[PLATFORM_TRANSFORMATION_SUMMARY.md](../PCI_mapper/PLATFORM_TRANSFORMATION_SUMMARY.md)** - Transformation details

---

## 🆘 Troubleshooting

### Port Already in Use

```bash
# Use a different port
npm run dev -- --port 5174
```

### npm Not Found

Install Node.js from https://nodejs.org/

### Build Errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

---

## 🎉 You're Ready!

The LTE WISP Management Platform is running!

**Enjoy building network management modules!** 🚀

