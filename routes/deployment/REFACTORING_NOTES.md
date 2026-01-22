# Deployment Routes Refactoring Notes

## Status: Partial

The `routes/epc-deployment.js` file (1657 lines) is being broken into modular route files.

## Completed

1. ✅ **EPC Management Routes** (`deployment/epc-management.js`)
   - POST /register-epc
   - POST /checkin
   - PUT /:epc_id
   - DELETE /delete-epc/:epc_id
   - POST /link-device
   - POST /:epc_id/link-device

2. ✅ **Deployment Scripts Routes** (`deployment/scripts.js`)
   - GET /:epc_id/deploy
   - GET /:epc_id/bootstrap
   - GET /:epc_id/full-deployment

## Remaining

3. ⏳ **ISO Generation Routes** (`deployment/iso-generation.js`) - Need to extract:
   - GET /download-iso
   - GET /generic-iso
   - POST /rebuild-generic-iso
   - GET /rebuild-status
   - POST /generate-epc-iso (~490 lines)
   - POST /:epc_id/generate-iso (~200 lines)
   - GET /isos

## Next Steps

1. Extract ISO generation routes into `deployment/iso-generation.js`
2. Update `deployment/index.js` to include ISO routes
3. Update main `routes/epc-deployment.js` to export from `deployment/index.js`

