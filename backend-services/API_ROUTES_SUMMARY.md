# Backend API Routes Summary

This document lists all registered API routes on the backend server (Port 3001).

## Core Routes (Always Loaded)

### Authentication & User Management
- `/api/auth` - Authentication routes
- `/api/users` - User management (includes auto-assign routes)
- `/api/tenants` - User tenant creation (first tenant only)
- `/api/user-tenants` - User tenant details and memberships
- `/api/notifications` - Notifications system

### Business Logic
- `/api/customers` - Customer management
- `/api/inventory` - Inventory management
- `/api/bundles` - Hardware bundles
- `/api/work-orders` - Work order management
- `/api/maintain` - Maintenance API
- `/api/network` - Network asset management
- `/api/plans` - Plan project management (PCI planning, marketing discovery)

### HSS & Monitoring
- `/api/hss` - HSS subscriber management
- `/api/monitoring` - Network monitoring
- `/api/monitoring/graphs` - Monitoring graphs and metrics
- `/api/device-assignment` - Device assignment for monitoring

### EPC & Remote Device Management
- `/api/epc` - EPC check-in routes (public, no auth)
- `/api/epc` - EPC management routes (with tenant requirement)
- `/api/epc` - EPC command management
- `/api/epc` - EPC logs
- `/api/epc/snmp` - EPC SNMP discovery
- `/api/epc-management` - EPC management (includes delete)
- `/api/deploy` - EPC deployment and ISO generation

### SNMP & Network Discovery
- `/api/snmp` - SNMP device management
- `/api/mikrotik` - Mikrotik device management

### Agent Routes
- `/api/agent` - Agent manifest (public, no auth required)

### System & Admin
- `/api/system` - System management
- `/api/permissions` - FCAPS permission management
- `/admin` - Admin routes (general)
- `/admin/tenants` - Admin tenant management
- `/setup-admin` - Setup routes

### Portal & Customer Portal
- `/api/customer-portal` - Customer portal API
- `/api/portal` - Portal domain routing
- `/api/portal-content` - Portal content management (alerts, FAQ, KB, chat)

## Optional Routes (Loaded with Try-Catch)

These routes are loaded conditionally and will show warnings if they fail to load:

- `/api/billing` - Billing API (requires PayPal configuration)
- `/api/equipment-pricing` - Equipment pricing API
- `/api/installation-documentation` - Installation documentation API
- `/api/subcontractors` - Subcontractors API
- `/api/branding` - Branding API for customer portal (custom registration)

## Services Initialized

### Monitoring Services
- **SNMP Polling Service** - Polls SNMP devices and stores metrics
- **Ping Monitoring Service** - Pings deployed devices every 5 minutes

## Route Status

To verify routes are operational:

1. **Check server logs** for route loading messages:
   - ✅ Routes that loaded successfully
   - ⚠️ Routes that failed to load (with error messages)

2. **Health Check**: `GET /health`
   - Returns server status and MongoDB connection status

3. **404 Handler**: All unmatched routes return a 404 with route details in the response

## Port Configuration

- **Port 3001**: Main API Server (all routes listed above)
- **Port 3002**: EPC/ISO Generation API (separate server)

## Domain Configuration

- **Domain**: `hss.wisptools.io`
- **Protocol**: HTTP (backend server)
- **Note**: Nginx on port 443 (HTTPS) proxies to backend on port 3001 (HTTP)

