#!/bin/bash

# Backend Deployment Script for Planning System
# Deploys the new planning system backend components

echo "🚀 Deploying Planning System Backend Components..."

# Set variables
BACKEND_DIR="backend-services"
DEPLOYMENT_DIR="deployment-files"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create deployment directory if it doesn't exist
mkdir -p $DEPLOYMENT_DIR

echo "📦 Creating deployment package..."

# Create a tarball with the new backend components
tar -czf $DEPLOYMENT_DIR/planning-system-backend-$TIMESTAMP.tar.gz \
    $BACKEND_DIR/routes/plans.js \
    $BACKEND_DIR/models/plan.js \
    $BACKEND_DIR/models/network.js \
    $BACKEND_DIR/server.js

echo "✅ Backend deployment package created: $DEPLOYMENT_DIR/planning-system-backend-$TIMESTAMP.tar.gz"

echo ""
echo "📋 DEPLOYMENT CHECKLIST:"
echo "========================"
echo ""
echo "1. 📁 NEW FILES TO DEPLOY:"
echo "   - routes/plans.js (Planning System API)"
echo "   - models/plan.js (Plan Project Model)"
echo "   - models/network.js (Network Equipment Models)"
echo "   - server.js (Updated with plans route)"
echo ""
echo "2. 🔧 BACKEND CHANGES:"
echo "   - Added /api/plans endpoint"
echo "   - Added PlanProject model"
echo "   - Added UnifiedTower, UnifiedSector, UnifiedCPE, NetworkEquipment models"
echo "   - Added missing hardware analysis functionality"
echo "   - Added purchase order generation"
echo ""
echo "3. 🗄️ DATABASE CHANGES:"
echo "   - New collection: planprojects"
echo "   - New collections: unifiedtowers, unifiedsectors, unifiedcpes, networkequipments"
echo "   - Indexes will be created automatically"
echo ""
echo "4. 🔌 API ENDPOINTS ADDED:"
echo "   GET    /api/plans                    - List all plans"
echo "   GET    /api/plans/:id                 - Get single plan"
echo "   POST   /api/plans                     - Create new plan"
echo "   PUT    /api/plans/:id                 - Update plan"
echo "   DELETE /api/plans/:id                 - Delete plan"
echo "   POST   /api/plans/:id/requirements    - Add hardware requirement"
echo "   DELETE /api/plans/:id/requirements/:idx - Remove hardware requirement"
echo "   POST   /api/plans/:id/analyze         - Analyze missing hardware"
echo "   GET    /api/plans/:id/missing-hardware - Get missing hardware analysis"
echo "   POST   /api/plans/:id/purchase-order  - Generate purchase order"
echo "   GET    /api/plans/hardware/existing   - Get all existing hardware"
echo ""
echo "5. 🚀 DEPLOYMENT STEPS:"
echo "   a) Upload the tarball to your server"
echo "   b) Extract: tar -xzf planning-system-backend-$TIMESTAMP.tar.gz"
echo "   c) Restart your backend service"
echo "   d) Verify health check: curl http://your-server:3000/health"
echo "   e) Test new endpoint: curl http://your-server:3000/api/plans"
echo ""
echo "6. ✅ VERIFICATION:"
echo "   - Check MongoDB for new collections"
echo "   - Test plan creation via API"
echo "   - Test missing hardware analysis"
echo "   - Verify frontend can connect to new endpoints"
echo ""
echo "📝 NOTES:"
echo "========="
echo "- The planning system integrates with existing inventory and network APIs"
echo "- All endpoints require X-Tenant-ID header for multi-tenancy"
echo "- Missing hardware analysis compares requirements against existing inventory"
echo "- Purchase orders are generated as downloadable text files"
echo "- The system supports alternative equipment suggestions"
echo ""
echo "🎯 READY FOR DEPLOYMENT!"
echo "========================"
