# LTE WISP Management Platform

> Professional multi-tenant platform for managing LTE wireless networks, CBRS spectrum, CPE devices, and network optimization.

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Documentation](#-documentation)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## 🎯 Overview

The LTE WISP Management Platform is a comprehensive, enterprise-grade solution for wireless ISPs and network operators. Built with modern technologies and a modular architecture, it provides everything needed to manage LTE networks, CBRS spectrum, CPE devices, and optimize network performance.

### Key Capabilities

- **Multi-Tenant Architecture** - Isolate organizations with their own data and configurations
- **CBRS Management** - Full integration with Google SAS and Federated Wireless APIs
- **ACS/TR-069** - Complete CPE device management and monitoring
- **PCI Planning** - Advanced LTE PCI conflict resolution and optimization
- **User Management** - Role-based access control (Owner, Admin, Member, Viewer)
- **Network Visualization** - Interactive maps with ArcGIS integration

## ✨ Features

### 🏢 Multi-Tenant Management
- **Organization Isolation** - Complete data separation per tenant
- **User Roles** - Fine-grained permission control
- **One Tenant Per User** - Simplified account management
- **Admin Console** - Platform-wide administration tools
- **Tenant Switching** - Easy access to multiple organizations

### 🔐 HSS & Subscriber Management
- **Open5GS HSS** - Production-grade Home Subscriber Server
- **S6a/Diameter Interface** - Standard 3GPP MME authentication
- **Subscriber Management** - Full CRUD with IMSI, Ki, OPc, AMF, SQN
- **Bandwidth Plans** - Speed tiers and QoS management
- **Subscriber Groups** - Organize users with group policies
- **Bulk Import** - CSV-based mass subscriber provisioning
- **IMEI Capture** - Track device identifiers
- **Remote MME Support** - Connect multiple MME sites
- **MongoDB Atlas** - Cloud-based subscriber database

### 📡 CBRS Management Module
- **Google SAS Integration** - Device registration, spectrum inquiry, grants
- **Federated Wireless API** - Enhanced analytics and optimization
- **Hybrid Deployment** - Shared or per-tenant API keys
- **Grant Management** - Full grant lifecycle (request, heartbeat, relinquish)
- **Device Monitoring** - Real-time CBSD status tracking
- **Spectrum Visualization** - Available spectrum and grant status

### 🌐 ACS/TR-069 CPE Management
- **Device Provisioning** - Automated CPE onboarding
- **Firmware Management** - Remote firmware upgrades
- **Configuration Management** - Bulk configuration deployment
- **Performance Monitoring** - Real-time device metrics
- **Fault Management** - Automated fault detection and alerts
- **TR-069 Compliance** - Full Broadband Forum standard support

### 📶 PCI Planning & Optimization
- **Automatic PCI Assignment** - Intelligent PCI allocation
- **Conflict Detection** - Identify and resolve PCI collisions
- **Neighbor Analysis** - Optimal PCI planning based on topology
- **Visualization** - Interactive network maps
- **Optimization Algorithms** - Simple and advanced optimization modes
- **Zero Collision Guarantee** - Enhanced collision prevention

### 🎨 User Experience
- **Modern UI** - Clean, responsive interface
- **Dark/Light Mode** - User preference theming
- **Interactive Maps** - ArcGIS Maps SDK integration
- **Real-time Updates** - Live data synchronization
- **Mobile Responsive** - Works on all devices
- **Intuitive Navigation** - Module-based architecture

### 🔐 Security & Authentication
- **Firebase Authentication** - Secure user authentication
- **Role-Based Access** - Granular permissions
- **API Key Management** - Secure credential storage
- **Data Encryption** - At rest and in transit
- **Audit Logging** - Track all administrative actions

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- SvelteKit 2.0 - Modern web framework
- TypeScript - Type-safe development
- ArcGIS Maps SDK - Interactive mapping
- Firebase SDK - Client-side integration

**Backend:**
- Firebase Functions - Serverless backend
- Firebase App Hosting - Cloud Run deployment
- Firestore - NoSQL database
- Firebase Auth - Authentication

**APIs & Integrations:**
- Google SAS API - CBRS spectrum management
- Federated Wireless API - Enhanced CBRS features
- GenieACS - TR-069 ACS implementation
- MongoDB - GenieACS data store

### Project Structure

```
lte-pci-mapper/
├── Module_Manager/              ← Main Application
│   ├── src/
│   │   ├── routes/
│   │   │   ├── login/          ← Authentication
│   │   │   ├── dashboard/      ← Main dashboard
│   │   │   ├── tenant-setup/   ← Organization setup
│   │   │   └── modules/        ← Feature modules
│   │   │       ├── pci-resolution/        ← PCI planning
│   │   │       ├── cbrs-management/       ← CBRS module
│   │   │       ├── acs-cpe-management/    ← ACS/TR-069
│   │   │       └── tenant-management/     ← Admin tools
│   │   └── lib/
│   │       ├── firebase.ts     ← Firebase config
│   │       ├── models/         ← Data models
│   │       └── services/       ← Business logic
│   ├── apphosting.yaml         ← App Hosting config
│   └── package.json
│
├── functions/                   ← Firebase Functions
│   ├── src/
│   │   ├── index.ts            ← Function exports
│   │   ├── cbrsManagement.ts   ← CBRS functions
│   │   ├── genieacsBridge*.ts  ← GenieACS bridge
│   │   └── tenantMiddleware.ts ← Multi-tenant support
│   └── package.json
│
├── gce-backend/                 ← GCE backend service (optional)
├── genieacs-fork/               ← Modified GenieACS
├── firebase.json                ← Firebase configuration
└── package.json                 ← Root package
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20 or higher
- **Firebase CLI**: `npm install -g firebase-tools`
- **Git** for version control
- **Google Cloud Account** for deployment

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/theorem6/lte-pci-mapper.git
   cd lte-pci-mapper
   ```

2. **Install dependencies**
   ```bash
   cd Module_Manager
   npm install
   ```

3. **Configure Firebase**
   ```bash
   # Login to Firebase
   firebase login

   # Set Firebase project
   firebase use lte-pci-mapper-65450042-bbf71
   ```

4. **Set up environment variables**
   ```bash
   # Copy example environment file
   cp .env.example .env.local

   # Edit .env.local with your Firebase config
   # (See Module_Manager/FIREBASE_ENV_SETUP.md)
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   ```
   http://localhost:5173
   ```

### First-Time Setup

1. **Create your account**
   - Navigate to `/login`
   - Sign up with email/password or Google

2. **Set up your organization**
   - Fill out organization details
   - System automatically creates your tenant

3. **Explore modules**
   - Dashboard shows all available modules
   - Click any module to access features

4. **Configure API keys** (if using CBRS)
   - Navigate to CBRS Management
   - Click Settings
   - Enter your Google SAS or Federated Wireless API keys
   - See [CBRS_API_KEY_SETUP_GUIDE.md](CBRS_API_KEY_SETUP_GUIDE.md)

## 📚 Documentation

👉 **[Complete Documentation Index](docs/README.md)** - All guides organized by category

### Quick Links

#### **🚀 Getting Started:**
- **[COMPLETE_DEPLOYMENT_NOW.md](docs/deployment/COMPLETE_DEPLOYMENT_NOW.md)** ⭐ Start here to deploy the system
- **[FINAL_DEPLOYMENT_STATUS.md](docs/deployment/FINAL_DEPLOYMENT_STATUS.md)** - Current system status
- **[GOOGLE_CLOUD_DEPLOYMENT.md](docs/deployment/GOOGLE_CLOUD_DEPLOYMENT.md)** - Cloud infrastructure

#### **🔐 HSS & Subscriber Management:**
- **[HSS_PRODUCTION_GUIDE.md](docs/hss/HSS_PRODUCTION_GUIDE.md)** - Complete HSS documentation
- **[MME_CONNECTION_GUIDE.md](docs/hss/MME_CONNECTION_GUIDE.md)** - Connect remote MMEs
- **[HSS_DEPLOYMENT_COMPLETE.md](docs/hss/HSS_DEPLOYMENT_COMPLETE.md)** - HSS system overview

#### **📖 Feature Guides:**
- **[MULTI_TENANT_SETUP_GUIDE.md](docs/guides/MULTI_TENANT_SETUP_GUIDE.md)** - Multi-tenancy
- **[CBRS_HYBRID_MODEL_GUIDE.md](docs/guides/CBRS_HYBRID_MODEL_GUIDE.md)** - CBRS/SAS
- **[TR069_FIRMWARE_UPGRADE_GUIDE.md](docs/guides/TR069_FIRMWARE_UPGRADE_GUIDE.md)** - CPE management
- **[DATABASE_STRUCTURE.md](docs/guides/DATABASE_STRUCTURE.md)** - Database schema

#### **👤 Administration:**
- **[ADMIN_AND_USER_MANAGEMENT.md](docs/guides/ADMIN_AND_USER_MANAGEMENT.md)** - User roles
- **[TENANT_DELETION_GUIDE.md](docs/guides/TENANT_DELETION_GUIDE.md)** - Tenant management

## 🚢 Deployment

### Firebase App Hosting (Recommended)

Deploy the entire platform to Google Cloud:

```bash
# From project root
firebase deploy

# Or deploy specific components
firebase deploy --only apphosting  # Frontend
firebase deploy --only functions    # Backend
```

### Manual Cloud Run Deployment

For advanced deployments:

```bash
# Build and push Docker image
cd Module_Manager
gcloud builds submit --tag gcr.io/PROJECT_ID/lte-pci-mapper

# Deploy to Cloud Run
gcloud run deploy lte-pci-mapper \
  --image gcr.io/PROJECT_ID/lte-pci-mapper \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Environment Variables

Configure secrets in Firebase App Hosting:

- `FIREBASE_CONFIG` - Firebase configuration JSON
- `MONGODB_URI` - MongoDB connection string (for GenieACS)
- `GOOGLE_SAS_CLIENT_SECRET` - Google SAS OAuth secret (optional)
- `FEDERATED_WIRELESS_API_KEY` - Federated Wireless API key (optional)

See [setup-apphosting-secrets.md](setup-apphosting-secrets.md) for detailed instructions.

## 🔧 Configuration

### Firebase Configuration

1. **Create Firebase project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create new project or use existing

2. **Enable services**
   - Authentication (Email/Password, Google)
   - Firestore Database
   - Functions
   - App Hosting

3. **Configure security rules**
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only storage:rules
   ```

### Platform Admins

Add admin emails to `Module_Manager/src/lib/services/adminService.ts`:

```typescript
const ADMIN_EMAILS = [
  'admin@yourcompany.com',
  'support@yourcompany.com'
];
```

## 👥 User Roles

| Role | Permissions |
|------|-------------|
| **Platform Admin** | Full system access, manage all tenants |
| **Tenant Owner** | Full access within their organization |
| **Tenant Admin** | Manage users and settings |
| **Member** | Access modules and features |
| **Viewer** | Read-only access |

## 🤝 Contributing

We welcome contributions! Please see:

- **[genieacs-fork/CONTRIBUTING.md](genieacs-fork/CONTRIBUTING.md)** - Contributing to GenieACS fork
- **Issues** - Report bugs or request features on GitHub
- **Pull Requests** - Submit PRs with clear descriptions

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Follow code style conventions
- Create feature branches

## 📄 License

This project is proprietary software. All rights reserved.

Third-party components:
- **GenieACS**: AGPLv3 - See [genieacs-fork/README.md](genieacs-fork/README.md)
- **SvelteKit**: MIT
- **Firebase**: Google Terms of Service
- **ArcGIS**: Esri License

## 🆘 Support

- **Documentation**: [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
- **Issues**: GitHub Issues
- **Email**: support@yourcompany.com

## 🙏 Acknowledgments

- **GenieACS** - TR-069 ACS implementation
- **WinnForum** - CBRS SAS specifications
- **Broadband Forum** - TR-069 standard
- **Firebase Team** - Backend infrastructure
- **Svelte Team** - Frontend framework

---

## 🎯 Key Modules

### CBRS Management
Manage CBRS devices and spectrum:
- Device registration with SAS
- Spectrum grants and heartbeats
- Real-time monitoring
- Analytics and reporting

### ACS CPE Management
TR-069 device management:
- Automated provisioning
- Firmware upgrades
- Configuration management
- Performance monitoring

### PCI Resolution
LTE network optimization:
- Automatic PCI assignment
- Conflict detection
- Neighbor analysis
- Network visualization

### Tenant Management (Admin)
Platform administration:
- Create/delete tenants
- Manage users
- Configure platform keys
- Monitor usage

---

**Built with ❤️ for WISP operators worldwide**

**Version**: 2.0  
**Last Updated**: October 2025  
**Status**: Production Ready
