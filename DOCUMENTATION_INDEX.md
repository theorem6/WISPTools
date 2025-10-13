# LTE WISP Management Platform - Documentation Index

## 📚 Table of Contents

### 🚀 Getting Started
- **[README.md](README.md)** - Project overview, features, and quick start
- **[BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)** - How to build and run the application
- **[Module_Manager/README.md](Module_Manager/README.md)** - Module Manager specific setup
- **[Module_Manager/QUICK_START.md](Module_Manager/QUICK_START.md)** - Quick start guide for Module Manager

### 🏗️ Architecture & Design
- **[MULTI_TENANT_ARCHITECTURE.md](MULTI_TENANT_ARCHITECTURE.md)** - Complete multi-tenant system architecture
- **[DATA_MODEL.md](DATA_MODEL.md)** - Data structures and models
- **[DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md)** - Firestore database schema and organization
- **[THEME_SYSTEM.md](THEME_SYSTEM.md)** - UI theming system (light/dark mode)
- **[Module_Manager/AUTHENTICATION_FLOW.md](Module_Manager/AUTHENTICATION_FLOW.md)** - Authentication implementation

### 👥 Multi-Tenant Management
- **[MULTI_TENANT_SETUP_GUIDE.md](MULTI_TENANT_SETUP_GUIDE.md)** - Comprehensive tenant setup guide
- **[ADMIN_AND_USER_MANAGEMENT.md](ADMIN_AND_USER_MANAGEMENT.md)** - Admin and user roles, permissions
- **[ONE_TENANT_PER_USER.md](ONE_TENANT_PER_USER.md)** - One tenant per user policy
- **[TENANT_DELETION_GUIDE.md](TENANT_DELETION_GUIDE.md)** - How to delete tenants (admin)

### 📡 CBRS Management Module
- **[CBRS_MODULE_COMPLETE.md](CBRS_MODULE_COMPLETE.md)** - Complete CBRS module documentation
- **[CBRS_API_KEY_SETUP_GUIDE.md](CBRS_API_KEY_SETUP_GUIDE.md)** - How to obtain Google SAS and Federated Wireless API keys
- **[CBRS_HYBRID_MODEL_GUIDE.md](CBRS_HYBRID_MODEL_GUIDE.md)** - Hybrid API key deployment model
- **[create-google-sas-service-account.md](create-google-sas-service-account.md)** - Creating Google SAS service account
- **[Module_Manager/src/routes/modules/cbrs-management/README.md](Module_Manager/src/routes/modules/cbrs-management/README.md)** - CBRS module technical documentation

### 🌐 ACS/TR-069 CPE Management
- **[Module_Manager/src/routes/modules/acs-cpe-management/README.md](Module_Manager/src/routes/modules/acs-cpe-management/README.md)** - ACS CPE Management module documentation
- **[Module_Manager/src/routes/modules/acs-cpe-management/TR069_MONITORING_GUIDE.md](Module_Manager/src/routes/modules/acs-cpe-management/TR069_MONITORING_GUIDE.md)** - TR-069 monitoring guide
- **[TR069_FIRMWARE_UPGRADE_GUIDE.md](TR069_FIRMWARE_UPGRADE_GUIDE.md)** - Firmware upgrade procedures

### 📶 PCI Planning & Optimization
- **[PCI_COLLISION_PREVENTION.md](PCI_COLLISION_PREVENTION.md)** - Enhanced PCI collision prevention
- **[Module_Manager/PCI_MODULE_INTEGRATION.md](Module_Manager/PCI_MODULE_INTEGRATION.md)** - PCI module integration details

### 🎨 User Interface
- **[UI_TOOLTIPS_GUIDE.md](UI_TOOLTIPS_GUIDE.md)** - Tooltip system and usage

### 🔐 Deployment & Configuration
- **[setup-apphosting-secrets.md](setup-apphosting-secrets.md)** - Firebase App Hosting secrets configuration
- **[grant-secret-access.md](grant-secret-access.md)** - Granting App Hosting access to secrets
- **[Module_Manager/FIREBASE_ENV_SETUP.md](Module_Manager/FIREBASE_ENV_SETUP.md)** - Firebase environment configuration

### 📦 Third-Party Integrations
- **[gce-backend/README.md](gce-backend/README.md)** - GCE backend service
- **[genieacs-fork/README.md](genieacs-fork/README.md)** - GenieACS fork documentation
- **[genieacs-fork/CONTRIBUTING.md](genieacs-fork/CONTRIBUTING.md)** - Contributing to GenieACS fork
- **[genieacs-fork/CHANGELOG.md](genieacs-fork/CHANGELOG.md)** - GenieACS changelog

### 📱 Equipment-Specific
- **[nokia/README.md](nokia/README.md)** - Nokia equipment specific documentation

---

## 🗂️ Documentation by Topic

### For New Users
Start here if you're new to the platform:
1. [README.md](README.md) - Understand what the platform does
2. [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) - Set up your development environment
3. [Module_Manager/QUICK_START.md](Module_Manager/QUICK_START.md) - Get up and running quickly
4. [MULTI_TENANT_SETUP_GUIDE.md](MULTI_TENANT_SETUP_GUIDE.md) - Create your first organization

### For Administrators
Managing the platform and users:
1. [ADMIN_AND_USER_MANAGEMENT.md](ADMIN_AND_USER_MANAGEMENT.md) - User roles and permissions
2. [MULTI_TENANT_ARCHITECTURE.md](MULTI_TENANT_ARCHITECTURE.md) - Understanding the architecture
3. [TENANT_DELETION_GUIDE.md](TENANT_DELETION_GUIDE.md) - Managing tenants
4. [ONE_TENANT_PER_USER.md](ONE_TENANT_PER_USER.md) - User limits and policies

### For CBRS Operators
Setting up and managing CBRS devices:
1. [CBRS_MODULE_COMPLETE.md](CBRS_MODULE_COMPLETE.md) - Complete module overview
2. [CBRS_API_KEY_SETUP_GUIDE.md](CBRS_API_KEY_SETUP_GUIDE.md) - Get your API keys
3. [CBRS_HYBRID_MODEL_GUIDE.md](CBRS_HYBRID_MODEL_GUIDE.md) - Choose deployment model
4. [create-google-sas-service-account.md](create-google-sas-service-account.md) - Google SAS setup

### For WISP Operators
Managing CPE devices and network:
1. [Module_Manager/src/routes/modules/acs-cpe-management/README.md](Module_Manager/src/routes/modules/acs-cpe-management/README.md) - ACS module
2. [TR069_FIRMWARE_UPGRADE_GUIDE.md](TR069_FIRMWARE_UPGRADE_GUIDE.md) - Firmware management
3. [PCI_COLLISION_PREVENTION.md](PCI_COLLISION_PREVENTION.md) - Network optimization

### For Developers
Technical implementation details:
1. [MULTI_TENANT_ARCHITECTURE.md](MULTI_TENANT_ARCHITECTURE.md) - System architecture
2. [DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md) - Database schema
3. [DATA_MODEL.md](DATA_MODEL.md) - Data models
4. [Module_Manager/AUTHENTICATION_FLOW.md](Module_Manager/AUTHENTICATION_FLOW.md) - Authentication
5. [Module_Manager/FIREBASE_ENV_SETUP.md](Module_Manager/FIREBASE_ENV_SETUP.md) - Environment setup

### For DevOps
Deployment and configuration:
1. [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) - Building the application
2. [setup-apphosting-secrets.md](setup-apphosting-secrets.md) - Secret management
3. [grant-secret-access.md](grant-secret-access.md) - Permission management
4. [Module_Manager/FIREBASE_ENV_SETUP.md](Module_Manager/FIREBASE_ENV_SETUP.md) - Firebase config

---

## 🔍 Quick Reference

### Common Tasks

| Task | Documentation |
|------|---------------|
| Set up development environment | [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) |
| Create your first tenant | [MULTI_TENANT_SETUP_GUIDE.md](MULTI_TENANT_SETUP_GUIDE.md) |
| Add CBRS devices | [CBRS_MODULE_COMPLETE.md](CBRS_MODULE_COMPLETE.md) |
| Manage CPE devices | [Module_Manager/src/routes/modules/acs-cpe-management/README.md](Module_Manager/src/routes/modules/acs-cpe-management/README.md) |
| Optimize PCI assignments | [PCI_COLLISION_PREVENTION.md](PCI_COLLISION_PREVENTION.md) |
| Configure API keys | [CBRS_API_KEY_SETUP_GUIDE.md](CBRS_API_KEY_SETUP_GUIDE.md) |
| Delete a tenant | [TENANT_DELETION_GUIDE.md](TENANT_DELETION_GUIDE.md) |
| Upgrade firmware | [TR069_FIRMWARE_UPGRADE_GUIDE.md](TR069_FIRMWARE_UPGRADE_GUIDE.md) |
| Customize theme | [THEME_SYSTEM.md](THEME_SYSTEM.md) |
| Deploy to Firebase | [setup-apphosting-secrets.md](setup-apphosting-secrets.md) |

### Troubleshooting

| Issue | Documentation |
|-------|---------------|
| Authentication problems | [Module_Manager/AUTHENTICATION_FLOW.md](Module_Manager/AUTHENTICATION_FLOW.md) |
| Tenant not loading | [ONE_TENANT_PER_USER.md](ONE_TENANT_PER_USER.md) |
| API key issues | [CBRS_API_KEY_SETUP_GUIDE.md](CBRS_API_KEY_SETUP_GUIDE.md) |
| Secret access denied | [grant-secret-access.md](grant-secret-access.md) |
| PCI conflicts | [PCI_COLLISION_PREVENTION.md](PCI_COLLISION_PREVENTION.md) |

---

## 📝 Module-Specific Documentation

Each major module has its own README with detailed information:

- **CBRS Management**: [Module_Manager/src/routes/modules/cbrs-management/README.md](Module_Manager/src/routes/modules/cbrs-management/README.md)
- **ACS CPE Management**: [Module_Manager/src/routes/modules/acs-cpe-management/README.md](Module_Manager/src/routes/modules/acs-cpe-management/README.md)
- **PCI Planning**: [Module_Manager/PCI_MODULE_INTEGRATION.md](Module_Manager/PCI_MODULE_INTEGRATION.md)

---

## 🤝 Contributing

See individual module CONTRIBUTING.md files:
- **GenieACS Fork**: [genieacs-fork/CONTRIBUTING.md](genieacs-fork/CONTRIBUTING.md)

---

## 📜 License & Legal

Project documentation and code are provided as-is. See individual module licenses for third-party components.

---

## 🆘 Getting Help

1. Check this index for relevant documentation
2. Search the documentation for keywords
3. Review module-specific READMEs
4. Check troubleshooting sections
5. Contact platform administrators

---

**Last Updated**: October 2025  
**Version**: 2.0  
**Platform**: LTE WISP Management Platform

