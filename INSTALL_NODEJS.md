# 📦 Install Node.js and npm for LTE PCI Mapper

## 🚨 **Node.js and npm Not Found**

Node.js and npm are not installed on your system. Here's how to install them:

## 🚀 **Installation Steps:**

### **Step 1: Download Node.js**

1. **Go to**: https://nodejs.org/
2. **Download**: LTS version (recommended) - currently Node.js 20.x
3. **Choose**: Windows Installer (.msi) for 64-bit
4. **File**: `node-v20.x.x-x64.msi`

### **Step 2: Install Node.js**

1. **Run**: The downloaded `.msi` file
2. **Follow**: Installation wizard
3. **Check**: "Add to PATH" option (should be checked by default)
4. **Complete**: Installation

### **Step 3: Verify Installation**

Open a new Command Prompt or PowerShell and run:

```cmd
node --version
npm --version
```

You should see:
```
v20.x.x
10.x.x
```

## 🔧 **Alternative Installation Methods:**

### **Option 1: Using Chocolatey (Windows Package Manager)**

```powershell
# Install Chocolatey first (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs

# Verify installation
node --version
npm --version
```

### **Option 2: Using Winget (Windows Package Manager)**

```cmd
# Install Node.js
winget install OpenJS.NodeJS

# Verify installation
node --version
npm --version
```

### **Option 3: Using NVM (Node Version Manager)**

```powershell
# Install NVM for Windows
# Download from: https://github.com/coreybutler/nvm-windows/releases

# Install Node.js LTS
nvm install lts
nvm use lts

# Verify installation
node --version
npm --version
```

## 🎯 **After Installation - Install Project Dependencies:**

Once Node.js and npm are installed, run these commands in your project directory:

```cmd
# Navigate to project directory
cd "C:\Users\david\Downloads\PCI_mapper"

# Install all dependencies
npm install --legacy-peer-deps

# Verify installation
npm list

# Run type checking
npm run check

# Build the project
npm run build

# Start development server
npm run dev
```

## 📋 **What Will Be Installed:**

### **Core Dependencies:**
- **Svelte 5.0** - Latest stable version
- **SvelteKit 2.7.4** - Latest stable version
- **TypeScript 5.7.2** - Latest stable version
- **Vite 6.0.1** - Latest stable version

### **Firebase Dependencies:**
- **Firebase 11.1.0** - Latest stable version
- **Firebase Adapter** - For SvelteKit integration

### **ArcGIS Dependencies:**
- **@arcgis/core 4.32.0** - Latest stable version
- **@arcgis/map-components 4.32.0** - Latest stable version
- **svelte-arcgis 1.0.3** - Svelte integration

### **Development Dependencies:**
- **ESLint 9.17.0** - Code linting
- **Prettier 3.4.2** - Code formatting
- **TypeScript** - Type checking

## 🚨 **Troubleshooting:**

### **Issue: "node is not recognized"**
- **Solution**: Restart Command Prompt/PowerShell after installation
- **Check**: Node.js is added to PATH environment variable

### **Issue: "npm is not recognized"**
- **Solution**: npm comes with Node.js, reinstall Node.js
- **Check**: Node.js installation completed successfully

### **Issue: Permission errors**
- **Solution**: Run Command Prompt as Administrator
- **Alternative**: Use PowerShell with execution policy

### **Issue: Network/firewall errors**
- **Solution**: Check internet connection and firewall settings
- **Alternative**: Use corporate proxy if applicable

## 🎉 **Expected Results:**

After successful installation:

```cmd
C:\Users\david\Downloads\PCI_mapper> npm install --legacy-peer-deps
npm WARN deprecated some-package@version
added 1234 packages in 45s

C:\Users\david\Downloads\PCI_mapper> npm run dev
> pci-mapper@1.0.0 dev
> vite dev

  VITE v6.0.1  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

## 🚀 **Quick Start After Installation:**

```cmd
# 1. Install Node.js from https://nodejs.org/
# 2. Restart Command Prompt
# 3. Navigate to project
cd "C:\Users\david\Downloads\PCI_mapper"

# 4. Install dependencies
npm install --legacy-peer-deps

# 5. Start development
npm run dev
```

## 📊 **System Requirements:**

- **OS**: Windows 10/11 (64-bit)
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 1GB free space
- **Network**: Internet connection for package downloads

**Install Node.js first, then run the npm commands to install all dependencies!** 🚀
