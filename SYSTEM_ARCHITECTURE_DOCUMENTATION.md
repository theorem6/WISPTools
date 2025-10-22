# LTE WISP Management Platform - System Architecture

## Overview

The LTE WISP Management Platform is a comprehensive multi-tenant SaaS solution designed for LTE Wireless Internet Service Providers. The platform provides end-to-end management capabilities including PCI resolution, ACS CPE management, network monitoring, and customer management.

## Architecture Principles

### 1. **Multi-Tenancy**
- Complete tenant isolation at the data and application level
- Shared infrastructure with tenant-specific configurations
- Role-based access control (RBAC) with tenant boundaries

### 2. **Microservices Architecture**
- Modular backend services with clear separation of concerns
- Independent deployment and scaling capabilities
- API-first design with comprehensive documentation

### 3. **Cloud-Native Design**
- Firebase hosting and functions for frontend and serverless functions
- Google Cloud Platform (GCP) for backend services
- MongoDB Atlas for data persistence
- Containerized deployment with systemd service management

### 4. **Security-First**
- Firebase Authentication with JWT tokens
- Role-based access control with tenant isolation
- CORS protection and security headers
- Encrypted data transmission

## System Components

### Frontend Layer

#### **SvelteKit Application**
- **Technology**: SvelteKit with TypeScript
- **Hosting**: Firebase App Hosting
- **URL**: `https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app`

**Architecture**:
```
Frontend (SvelteKit)
├── Authentication Layer
│   ├── Firebase Auth Integration
│   ├── JWT Token Management
│   └── Role-Based Access Control
├── Component Layer
│   ├── Common Components
│   ├── Domain-Specific Components
│   └── Reusable UI Elements
├── Service Layer
│   ├── API Client Services
│   ├── Business Logic Services
│   └── External Service Integrations
├── State Management
│   ├── Tenant Store
│   ├── Authentication Store
│   └── Application State
└── Route Layer
    ├── Public Routes
    ├── Protected Routes
    └── Admin Routes
```

#### **Key Frontend Modules**:
1. **PCI Resolution Module**: Cell site management and PCI conflict resolution
2. **ACS CPE Management**: TR-069 device management and monitoring
3. **Network Management**: Network topology and configuration
4. **Customer Management**: Customer accounts and service management
5. **Inventory Management**: Equipment and asset tracking
6. **Monitoring Dashboard**: System health and performance monitoring
7. **Administrative Interface**: Platform administration and tenant management

### Backend Layer

#### **User Management System API**
- **Technology**: Node.js with Express
- **Hosting**: Google Compute Engine (GCE)
- **Port**: 3000
- **URL**: `http://136.112.111.167:3000`

**Architecture**:
```
Backend API Server
├── Configuration Layer
│   ├── Database Configuration
│   ├── Middleware Configuration
│   └── Route Configuration
├── Middleware Layer
│   ├── Authentication Middleware
│   ├── CORS Middleware
│   ├── Error Handling
│   └── Request Logging
├── Route Layer
│   ├── Authentication Routes
│   ├── User Management Routes
│   ├── Tenant Management Routes
│   ├── Business Logic Routes
│   └── Admin Routes
├── Service Layer
│   ├── Authentication Service
│   ├── Tenant Service
│   ├── User Service
│   └── Notification Service
├── Model Layer
│   ├── User Models
│   ├── Tenant Models
│   ├── Business Models
│   └── Schema Definitions
└── Utility Layer
    ├── Logging Utilities
    ├── Validation Utilities
    └── Helper Functions
```

#### **API Endpoints**:
- **Authentication**: `/api/auth/*`
- **User Management**: `/api/users/*`
- **Tenant Management**: `/api/tenants/*`
- **Work Orders**: `/api/work-orders/*`
- **Customer Management**: `/api/customers/*`
- **Inventory Management**: `/api/inventory/*`
- **Network Management**: `/api/network/*`
- **Monitoring**: `/api/monitoring/*`
- **Admin Functions**: `/admin/*`

### Data Layer

#### **MongoDB Atlas**
- **Technology**: MongoDB Atlas Cloud Database
- **Database**: `hss_management`
- **Collections**:
  - `users`: User accounts and profiles
  - `tenants`: Tenant organizations and configurations
  - `user_tenants`: User-tenant associations and roles
  - `work_orders`: Work order management
  - `customers`: Customer information and accounts
  - `inventory`: Equipment and asset tracking
  - `network_configs`: Network configurations
  - `monitoring_data`: System monitoring metrics

#### **Data Architecture**:
```
MongoDB Atlas
├── Tenant Isolation
│   ├── Tenant-Specific Collections
│   ├── Cross-Tenant Data Separation
│   └── Role-Based Data Access
├── Data Models
│   ├── User Schema
│   ├── Tenant Schema
│   ├── Work Order Schema
│   ├── Customer Schema
│   └── Inventory Schema
├── Indexes
│   ├── Performance Indexes
│   ├── Query Optimization
│   └── Tenant-Specific Indexes
└── Backup & Recovery
    ├── Automated Backups
    ├── Point-in-Time Recovery
    └── Cross-Region Replication
```

### Integration Layer

#### **Firebase Cloud Functions**
- **Technology**: Firebase Functions (Node.js)
- **Purpose**: Serverless API proxy and integration layer
- **Functions**:
  - `hssProxy`: Routes frontend API calls to GCE backend
  - `analyzePCI`: PCI analysis and optimization
  - `genieacsBridge`: GenieACS integration
  - `notificationService`: Push notifications

#### **External Service Integrations**:
1. **Firebase Authentication**: User authentication and authorization
2. **Firebase Hosting**: Frontend application hosting
3. **Google Cloud Platform**: Backend infrastructure
4. **MongoDB Atlas**: Data persistence
5. **GenieACS**: TR-069 device management
6. **Open5GS**: LTE core network functions
7. **ArcGIS**: Mapping and geospatial services

### Infrastructure Layer

#### **Google Cloud Platform**
- **Compute Engine**: Backend API server hosting
- **Firewall**: Network security and port management
- **Load Balancer**: Traffic distribution (future)
- **Monitoring**: System health and performance monitoring

#### **Port Allocation**:
- **Port 3000**: User Management System API
- **Port 3001**: Open5GS HSS (LTE Core)
- **Port 3002**: GenieACS UI (TR-069 Management)

## Security Architecture

### Authentication & Authorization

#### **Firebase Authentication**
- **Provider**: Firebase Auth with email/password
- **Token Type**: JWT (JSON Web Tokens)
- **Token Expiry**: Configurable (default 1 hour)
- **Refresh**: Automatic token refresh

#### **Role-Based Access Control (RBAC)**:
```
User Roles Hierarchy:
├── Platform Admin (david@david.com)
│   ├── Full system access
│   ├── Tenant management
│   ├── User management
│   └── System configuration
├── Tenant Owner
│   ├── Full tenant access
│   ├── User management within tenant
│   ├── Configuration management
│   └── Billing and subscription
└── Tenant User
    ├── Limited tenant access
    ├── Module-specific permissions
    ├── Read-only access to some features
    └── Self-service capabilities
```

#### **Tenant Isolation**:
- **Data Isolation**: Complete data separation between tenants
- **API Isolation**: Tenant-specific API endpoints and data access
- **Configuration Isolation**: Tenant-specific settings and configurations
- **User Isolation**: Users can only access their assigned tenants

### Network Security

#### **CORS Configuration**:
- **Allowed Origins**: Specific domains only
- **Credentials**: Enabled for authenticated requests
- **Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization, x-tenant-id

#### **Security Headers**:
- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: DENY
- **X-XSS-Protection**: 1; mode=block
- **Content-Security-Policy**: Restrictive CSP (future)

## Deployment Architecture

### Development Environment
- **Frontend**: Local SvelteKit development server
- **Backend**: Local Node.js development server
- **Database**: MongoDB Atlas development cluster
- **Authentication**: Firebase Auth development project

### Production Environment
- **Frontend**: Firebase App Hosting
- **Backend**: Google Compute Engine (GCE)
- **Database**: MongoDB Atlas production cluster
- **Authentication**: Firebase Auth production project
- **Monitoring**: GCP monitoring and logging

### Deployment Process
1. **Code Development**: Local development with Git version control
2. **Code Review**: GitHub pull request review process
3. **Testing**: Automated testing and manual testing
4. **Deployment**: Automated deployment via Firebase CLI
5. **Monitoring**: Continuous monitoring and alerting

## Scalability Considerations

### Horizontal Scaling
- **Frontend**: Firebase App Hosting auto-scaling
- **Backend**: GCE instance scaling (future load balancer)
- **Database**: MongoDB Atlas cluster scaling
- **Functions**: Firebase Functions auto-scaling

### Performance Optimization
- **Frontend**: Code splitting and lazy loading
- **Backend**: Database indexing and query optimization
- **Caching**: Redis caching layer (future)
- **CDN**: Firebase CDN for static assets

### Monitoring & Observability
- **Application Monitoring**: Custom health checks and metrics
- **Infrastructure Monitoring**: GCP monitoring and logging
- **Database Monitoring**: MongoDB Atlas monitoring
- **User Analytics**: Firebase Analytics integration

## Disaster Recovery

### Backup Strategy
- **Database**: Automated MongoDB Atlas backups
- **Code**: Git repository with multiple remotes
- **Configuration**: Infrastructure as Code (future)
- **Documentation**: Comprehensive system documentation

### Recovery Procedures
- **Database Recovery**: Point-in-time recovery from MongoDB Atlas
- **Application Recovery**: Redeployment from Git repository
- **Configuration Recovery**: Manual configuration restoration
- **Data Migration**: Automated data migration procedures

## Future Architecture Enhancements

### Short Term (3-6 months)
1. **API Versioning**: Implement versioned API endpoints
2. **Rate Limiting**: Add rate limiting for API protection
3. **Caching Layer**: Implement Redis caching
4. **Monitoring**: Enhanced monitoring and alerting

### Medium Term (6-12 months)
1. **Microservices**: Further decompose monolithic backend
2. **Event-Driven Architecture**: Implement event-driven communication
3. **CI/CD Pipeline**: Automated testing and deployment
4. **Infrastructure as Code**: Terraform or similar

### Long Term (12+ months)
1. **Multi-Region Deployment**: Global deployment strategy
2. **Advanced Analytics**: Machine learning and AI integration
3. **Mobile Applications**: Native mobile app development
4. **API Gateway**: Centralized API management

## Technology Stack Summary

### Frontend
- **Framework**: SvelteKit with TypeScript
- **Styling**: CSS with custom properties
- **State Management**: Svelte stores
- **Authentication**: Firebase Auth
- **Hosting**: Firebase App Hosting

### Backend
- **Runtime**: Node.js with Express
- **Language**: JavaScript/TypeScript
- **Authentication**: Firebase Admin SDK
- **Database**: MongoDB with Mongoose
- **Hosting**: Google Compute Engine

### Infrastructure
- **Cloud Provider**: Google Cloud Platform
- **Database**: MongoDB Atlas
- **Authentication**: Firebase
- **Monitoring**: GCP Monitoring
- **Deployment**: Firebase CLI + Git

### External Services
- **Maps**: ArcGIS
- **Device Management**: GenieACS
- **LTE Core**: Open5GS
- **Notifications**: Firebase Cloud Messaging
- **Analytics**: Firebase Analytics

This architecture provides a robust, scalable, and secure foundation for the LTE WISP Management Platform while maintaining flexibility for future enhancements and growth.
