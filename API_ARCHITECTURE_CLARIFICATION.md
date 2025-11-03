# API Architecture Clarification

## Current Setup (Misleading Naming)

### Issue
The Firebase Function is named `hssProxy` but it proxies **ALL API routes**, not just HSS routes.

### Current Architecture

**Port 3001: Main API Server** (`backend-services/server.js`)
- ✅ Handles ALL routes:
  - `/api/customers` - Customer management
  - `/api/work-orders` - Work orders
  - `/api/hss` - HSS management (Open5GS subscriber management)
  - `/api/inventory` - Inventory
  - `/api/plans` - Service plans
  - `/api/maintain` - Maintenance
  - `/api/billing` - Billing
  - `/admin/**` - Admin routes
  - All other API routes

**Port 3000: NOT USED** (no service running)
- Comment says it should be for "HSS API" but nothing is listening
- Firewall rule exists but unused

**Port 3002: EPC/ISO API** (`isoProxy`)
- `/api/deploy/**` - EPC deployment and ISO generation

### Firebase Functions

**`hssProxy`** - Routes to port 3001
- Handles: `/api/**` (except `/api/deploy/**`)
- Handles: `/admin/**`
- **MISLEADING NAME** - Should be `apiProxy` or `mainApiProxy`

**`isoProxy`** - Routes to port 3002
- Handles: `/api/deploy/**`

## The Problem

1. **Function name is misleading**: `hssProxy` suggests it's only for HSS, but it handles everything
2. **All services consolidated**: One API server on port 3001 handles all routes including HSS
3. **Port 3000 unused**: Comment says it should be for HSS but nothing runs there

## Solution Options

### Option 1: Rename Function (Recommended)
Rename `hssProxy` to `apiProxy` or `mainApiProxy` for clarity:
- More accurate name
- Less confusing
- No code changes needed, just naming

### Option 2: Keep Current (Accept Confusion)
- Keep `hssProxy` name
- Accept that it proxies more than just HSS
- Document that it's the "main API proxy"

### Option 3: Split Services (More Complex)
- Separate HSS service on port 3000
- Main API on port 3001
- Create separate `hssProxy` for port 3000
- Create `apiProxy` for port 3001
- Update routing logic

## Recommendation

**Option 1** - Just rename the function for clarity. The current architecture (one unified API) is fine and simpler to maintain.

