# Backend API Documentation

## Overview

The LTE WISP Management Platform backend is a Node.js/Express API server that provides comprehensive management capabilities for LTE WISP operations. The API is designed with a modular architecture for maintainability and scalability.

## Architecture

### Directory Structure

```
backend-services/
├── server-modular.js          # Main server entry point (modularized)
├── server.js                  # Legacy server (to be deprecated)
├── config/                    # Configuration modules
│   ├── database.js           # MongoDB connection and configuration
│   ├── middleware.js         # Express middleware setup
│   └── routes.js             # Route registration and organization
├── middleware/                # Custom middleware
│   └── auth.js               # Authentication and authorization middleware
├── routes/                   # API route handlers
│   ├── auth/                 # Authentication routes
│   ├── users/                # User management routes
│   ├── admin/                # Administrative routes
│   ├── setup/                # Setup and configuration routes
│   ├── work-orders.js        # Work order management
│   ├── customers.js          # Customer management
│   ├── inventory.js          # Inventory management
│   ├── network.js            # Network management
│   ├── monitoring.js         # System monitoring
│   ├── epc.js               # EPC management
│   └── system.js            # System management
├── models/                   # Database models/schemas
│   ├── user.js              # User and user-tenant schemas
│   ├── tenant.js            # Tenant schema
│   ├── work-order.js        # Work order schema
│   ├── customer.js          # Customer schema
│   └── inventory.js         # Inventory schema
├── services/                 # Business logic services
└── utils/                   # Utility functions
```

## API Endpoints

### Authentication & Authorization

#### Health Check
- **GET** `/health`
- **Description**: System health check
- **Authentication**: None required
- **Response**: System status and MongoDB connection status

### User Management

#### User Operations
- **GET** `/api/users/*` - User management endpoints
- **Authentication**: Required
- **Description**: CRUD operations for users

#### User-Tenant Associations
- **GET** `/api/user-tenants/*` - User-tenant relationship management
- **Authentication**: Required
- **Description**: Manage user memberships in tenants

#### Tenant Details (User Access)
- **GET** `/api/tenants/*` - Tenant information for regular users
- **Authentication**: Required
- **Description**: Get tenant details if user is assigned to tenant

### Administrative Endpoints

#### Tenant Management (Admin)
- **GET** `/admin/tenants/*` - Platform admin tenant management
- **Authentication**: Required (Platform Admin)
- **Description**: Full CRUD operations for tenants

#### General Admin
- **GET** `/admin/*` - General administrative endpoints
- **Authentication**: Required (Platform Admin)

### Business Logic Endpoints

#### Work Orders
- **GET** `/api/work-orders/*` - Work order management
- **Authentication**: Required
- **Description**: Create, read, update, delete work orders

#### Customer Management
- **GET** `/api/customers/*` - Customer management
- **Authentication**: Required
- **Description**: Customer CRUD operations

#### Inventory Management
- **GET** `/api/inventory/*` - Inventory management
- **Authentication**: Required
- **Description**: Inventory tracking and management

#### Network Management
- **GET** `/api/network/*` - Network configuration
- **Authentication**: Required
- **Description**: Network topology and configuration

#### System Monitoring
- **GET** `/api/monitoring/*` - System monitoring
- **Authentication**: Required
- **Description**: System health and performance monitoring

#### EPC Management
- **GET** `/api/epc/*` - EPC (Evolved Packet Core) management
- **Authentication**: Required
- **Description**: EPC configuration and monitoring

#### System Management
- **GET** `/api/system/*` - System administration
- **Authentication**: Required (Platform Admin)
- **Description**: System-level operations and configuration

### Setup Endpoints

#### Admin Setup
- **GET** `/setup-admin/*` - Initial admin setup
- **Authentication**: None required
- **Description**: Initial platform administrator setup

## Authentication

The API uses Firebase Authentication with JWT tokens. All protected endpoints require a valid Authorization header:

```
Authorization: Bearer <firebase-jwt-token>
```

### User Roles

1. **Platform Admin** (`david@david.com`): Full system access
2. **Tenant Owner**: Full access within assigned tenant
3. **Tenant User**: Limited access within assigned tenant

## Database

### MongoDB Atlas
- **Connection**: MongoDB Atlas cluster
- **Database**: `hss_management`
- **Collections**: 
  - `users` - User accounts
  - `tenants` - Tenant organizations
  - `user_tenants` - User-tenant associations
  - `work_orders` - Work order management
  - `customers` - Customer information
  - `inventory` - Inventory tracking

## Port Configuration

- **Port 3000**: User Management System API (this service)
- **Port 3001**: Open5GS HSS (separate service)
- **Port 3002**: GenieACS UI (separate service)

## Error Handling

The API uses standardized error responses:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "timestamp": "2025-10-22T12:00:00.000Z"
}
```

### Common HTTP Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **500**: Internal Server Error

## CORS Configuration

The API is configured to accept requests from:
- `http://localhost:3000` (development)
- `http://localhost:5173` (development)
- `https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app` (production)
- `https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net` (Cloud Functions)

## Security

- **CORS**: Configured for specific origins
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Request Logging**: All requests logged with timestamp and IP
- **Error Handling**: Sensitive information filtered in production

## Deployment

### Environment Variables

```bash
PORT=3000
MONGODB_URI=mongodb+srv://...
NODE_ENV=production
```

### Systemd Service

The API runs as a systemd service (`hss-api.service`) on the GCE server.

### Health Monitoring

The `/health` endpoint provides:
- Service status
- MongoDB connection status
- Timestamp
- Port information

## Migration from Legacy Server

The new modular server (`server-modular.js`) replaces the monolithic `server.js`. Key improvements:

1. **Modular Architecture**: Separated concerns into logical modules
2. **Better Error Handling**: Centralized error handling middleware
3. **Improved Logging**: Structured logging with timestamps
4. **Security Enhancements**: Better CORS and security headers
5. **Maintainability**: Easier to understand and modify

## Development

### Running Locally

```bash
cd backend-services
npm install
node server-modular.js
```

### Testing

```bash
# Health check
curl http://localhost:3000/health

# Test authentication
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/users
```

## Future Enhancements

1. **API Versioning**: Implement versioned API endpoints
2. **Rate Limiting**: Add rate limiting for API protection
3. **Caching**: Implement Redis caching for frequently accessed data
4. **Metrics**: Add Prometheus metrics collection
5. **Documentation**: Auto-generated API documentation with Swagger
