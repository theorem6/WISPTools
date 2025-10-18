# Distributed EPC API - Modular Architecture

## Overview

This is the modularized version of the Distributed EPC Management API. The monolithic `distributed-epc-api.js` has been split into logical, maintainable modules.

## Structure

```
distributed-epc/
├── index.js                    # Main entry point - mounts all routes
├── middleware/
│   └── auth.js                 # Authentication & authorization middleware
├── routes/
│   ├── registration.js         # EPC registration & deployment scripts
│   ├── management.js           # CRUD operations for EPCs
│   ├── metrics.js              # Metrics, heartbeat, attach/detach events
│   └── monitoring.js           # Dashboard, history, events
├── services/
│   └── metrics-service.js      # Metrics processing & alert generation
├── utils/
│   ├── script-generator.js     # Deployment script generation
│   └── crypto-utils.js         # Cryptographic utilities
└── models/
    └── index.js                # MongoDB model exports
```

## Usage

### In your main Express app:

```javascript
const distributedEpcRouter = require('./distributed-epc');

app.use('/api', distributedEpcRouter);
```

This will mount all EPC routes under `/api`.

## API Endpoints

### Registration & Deployment
- `POST /api/epc/register` - Register new EPC site
- `GET /api/epc/:epc_id/deployment-script` - Download deployment script

### Management
- `GET /api/epc/list` - List all EPCs (tenant-scoped)
- `GET /api/epc/:epc_id` - Get specific EPC
- `PUT /api/epc/:epc_id` - Update EPC configuration
- `DELETE /api/epc/:epc_id` - Delete EPC

### Metrics & Events
- `POST /api/metrics/heartbeat` - Simple heartbeat (EPC-authenticated)
- `POST /api/metrics/submit` - Full metrics submission (EPC-authenticated)
- `POST /api/metrics/attach` - Record attach event (EPC-authenticated)
- `POST /api/metrics/detach` - Record detach event (EPC-authenticated)

### Monitoring & Analytics
- `GET /api/dashboard` - Dashboard data for all EPCs
- `GET /api/metrics/history` - Historical metrics
- `GET /api/subscribers/roster` - Active subscriber roster
- `GET /api/events/attach-detach` - Attach/detach event log

### Health Check
- `GET /api/health` - Service health check

## Middleware

### `requireTenant`
Validates `X-Tenant-ID` header for tenant-scoped operations.

### `authenticateEPC`
Validates EPC authentication using:
- `X-EPC-Auth-Code` header
- `X-EPC-API-Key` header
- `X-EPC-Signature` header (optional HMAC)

## Services

### Metrics Service
- `processMetrics(metrics, epc)` - Analyze metrics and classify status
- `generateAlerts(metrics, epc)` - Generate alerts based on thresholds

## Utilities

### Script Generator
- `generateDeploymentScript(epc)` - Generate interactive bash deployment script

### Crypto Utilities
- `generateEpcId()` - Generate unique EPC ID
- `generateAuthCode()` - Generate authentication code
- `generateApiKey()` - Generate API key
- `generateSecretKey()` - Generate secret key for HMAC
- `verifySignature(payload, signature, secretKey)` - Verify HMAC signature
- `createSignature(payload, secretKey)` - Create HMAC signature

## Models

All MongoDB models are re-exported from `distributed-epc-schema.js`:
- `RemoteEPC` - EPC site configuration
- `EPCMetrics` - Metrics collection
- `SubscriberSession` - Active sessions
- `AttachDetachEvent` - Attach/detach events
- `EPCAlert` - System alerts

## Benefits of Modular Architecture

✅ **Maintainability** - Each file has a single responsibility  
✅ **Testability** - Individual modules can be unit tested  
✅ **Reusability** - Utilities can be imported elsewhere  
✅ **Scalability** - Easy to add new routes/services  
✅ **Readability** - Smaller files are easier to understand  
✅ **Collaboration** - Multiple developers can work on different modules  
✅ **Deployment** - Can deploy only changed modules  

## Migration from Monolithic API

The original `distributed-epc-api.js` can be replaced with:

```javascript
const distributedEpcRouter = require('./distributed-epc');
```

All functionality remains the same, just better organized!

## Development

### Adding a New Route

1. Create route file in `routes/`
2. Export router from the file
3. Import and mount in `index.js`

### Adding a New Service

1. Create service file in `services/`
2. Export functions
3. Import in routes that need it

### Adding Utilities

1. Create utility file in `utils/`
2. Export functions
3. Import where needed

## Testing

```bash
# Run unit tests
npm test

# Test specific module
npm test distributed-epc/routes/registration

# Integration tests
npm run test:integration
```

## Documentation

See main project documentation:
- `docs/distributed-epc/` - Distributed EPC documentation
- `docs/guides/FILE_SPLITTING_PLAN.md` - Modularization plan
- `docs/PROJECT_STATUS.md` - Current project status

---

*Last Updated: October 17, 2025*  
*Status: ✅ Modular Architecture Complete*

