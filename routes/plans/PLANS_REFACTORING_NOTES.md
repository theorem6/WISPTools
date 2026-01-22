# Plans.js Refactoring Notes

## Status

The `routes/plans.js` file (3249 lines) has been refactored into modular components:

### ✅ Created Modules:
- `routes/plans/plans-helpers.js` - Shared utility functions
- `routes/plans/plans-middleware.js` - Shared middleware
- `routes/plans/plans-core.js` - Core CRUD operations
- `routes/plans/plans-approval.js` - Approval/authorization routes
- `routes/plans/plans-features.js` - Plan layer features routes
- `routes/plans/plans-mobile.js` - Mobile API routes
- `routes/plans/plans-hardware.js` - Hardware requirements routes
- `routes/plans/plans-marketing.js` - Marketing discovery routes (partial - see below)
- `routes/plans/index.js` - Main index that combines all routes

### ⚠️ Remaining Work:

**Marketing Discovery Endpoint** (~1100 lines):
- The POST `/plans/:id/marketing/discover` endpoint is extremely complex
- Contains inline orchestration logic, progress tracking, algorithm execution
- Needs to be extracted to `services/plans-marketing-discovery-orchestrator.js`
- Current status: Stub created, full extraction pending

### Next Steps:
1. Extract marketing discovery orchestration logic to service
2. Update marketing routes to call service
3. Update main plans.js to use modular structure

