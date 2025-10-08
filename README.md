# LTE WISP Management Platform

## 🎯 Overview

Modern, modular platform for managing LTE WISP networks with integrated PCI conflict resolution, GenieACS device management, and ArcGIS mapping.

## 🏗️ Architecture

### Module Manager System (`/Module_Manager`)
The **active application** with modular architecture:
- **Login & Authentication** - Firebase Auth
- **Dashboard** - Module tiles for easy navigation
- **PCI Resolution Module** - Integrated PCI conflict manager
- **Future Modules** - Easily add new functionality

### Supporting Services
- **Firebase Functions** (`/functions`) - Backend API and GenieACS integration
- **Firebase Hosting** - Static assets (if needed)
- **Firebase App Hosting** - Cloud Run deployment for Module Manager

## 📁 Directory Structure

```
lte-pci-mapper/
├── Module_Manager/              ← ACTIVE APPLICATION
│   ├── src/
│   │   ├── routes/
│   │   │   ├── login/          ← Authentication
│   │   │   ├── dashboard/      ← Main dashboard
│   │   │   └── modules/        ← Module system
│   │   │       └── pci-resolution/
│   │   └── lib/
│   ├── Procfile
│   ├── apphosting.yaml
│   └── package.json
│
├── functions/                   ← Firebase Functions (Backend)
│   ├── src/
│   │   ├── genieacsIntegration.ts
│   │   ├── genieacsServices.ts
│   │   └── index.ts
│   └── package.json
│
├── src-OLD-standalone-pci-DEPRECATED/  ← Old standalone app (DO NOT USE)
│   └── README_DEPRECATED.md
│
├── firebase.json                ← Points to Module_Manager
├── package.json                 ← Root package (delegates to Module_Manager)
└── README.md                    ← This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- gcloud CLI (for Cloud Run)

### Development

```bash
# Install dependencies
cd Module_Manager
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### Deployment

```bash
# From project root

# Deploy everything (Module Manager + Functions)
firebase deploy

# Deploy just App Hosting (Module Manager)
firebase deploy --only apphosting

# Deploy just Functions
firebase deploy --only functions

# After deployment, route traffic to latest
gcloud run services update-traffic lte-pci-mapper \
  --region=us-central1 \
  --project=lte-pci-mapper-65450042-bbf71 \
  --to-latest
```

## 🔧 Configuration

### Firebase App Hosting
Configured in `Module_Manager/apphosting.yaml`:
- **CPU**: 1 core
- **Memory**: 2048 MiB (2 GB)
- **Min Instances**: 0 (scale to zero)
- **Max Instances**: 5

### Environment Variables
All configured in `apphosting.yaml`:
- Firebase credentials
- ArcGIS API key
- Gemini AI API key
- Wolfram Alpha API key
- MongoDB connection (for GenieACS)

## 📚 Modules

### PCI Resolution Module
- **Path**: `/Module_Manager/src/routes/modules/pci-resolution`
- **Features**:
  - Interactive ArcGIS map
  - PCI conflict detection
  - Automatic optimization
  - Network management
  - Export/reporting

### Future Modules
The architecture supports easy addition of new modules:
1. Create new route in `/Module_Manager/src/routes/modules/`
2. Add tile to dashboard
3. Implement module-specific functionality

## 🛠️ Technology Stack

- **Frontend**: SvelteKit 5, TypeScript
- **Mapping**: ArcGIS Maps SDK for JavaScript
- **Backend**: Firebase Functions (Node.js 20)
- **Database**: 
  - Firestore (user data, networks)
  - MongoDB Atlas (GenieACS devices)
- **Hosting**: Firebase App Hosting (Cloud Run)
- **Authentication**: Firebase Auth
- **AI**: Google Gemini AI

## 📖 Documentation

- `DEPLOY_CORRECT_APP_FIX.md` - Deployment architecture
- `ALL_ERRORS_FIXED_SUMMARY.md` - Deployment troubleshooting
- `TRAFFIC_ROUTING_FIX.md` - Traffic management
- `CLOUD_RUN_OPTIMIZATION.md` - Resource configuration
- `Module_Manager/README.md` - Module Manager specific docs

## ⚠️ Important Notes

### Old Standalone App
The `/src-OLD-standalone-pci-DEPRECATED` directory contains the old standalone PCI manager. **DO NOT USE**. It's kept for reference only.

### Deployment Target
Firebase App Hosting deploys from `/Module_Manager` as configured in `firebase.json`:
```json
"apphosting": {
  "backendId": "lte-pci-mapper",
  "rootDir": "/Module_Manager"
}
```

## 🔗 URLs

- **Production**: https://lte-pci-mapper-nfomthzoza-uc.a.run.app
- **Firebase Console**: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71
- **Cloud Run Console**: https://console.cloud.google.com/run/detail/us-central1/lte-pci-mapper

## 🤝 Contributing

1. All development happens in `/Module_Manager`
2. Follow SvelteKit conventions
3. Use TypeScript for type safety
4. Test locally before deploying
5. Use proper commit messages

## 📝 License

Private - LTE WISP Management Platform

---

**Active App**: Module Manager (`/Module_Manager`)  
**Status**: Production  
**Last Updated**: 2025-10-08
