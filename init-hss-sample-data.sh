#!/bin/bash
# Initialize HSS with Sample Data
# Creates bandwidth plans, groups, and sample subscribers

set -e

EXTERNAL_IP=${1:-"localhost"}
API_URL="http://$EXTERNAL_IP/api/hss"
TENANT_ID="tenant_001"

echo "═══════════════════════════════════════════════════════════"
echo "  📊 Initializing HSS with Sample Data"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "API URL:   $API_URL"
echo "Tenant ID: $TENANT_ID"
echo ""

# ============================================================================
# STEP 1: Create Bandwidth Plans
# ============================================================================
echo "📋 Step 1/3: Creating bandwidth plans..."
echo ""

# Gold Plan
echo "  Creating Gold Plan (100/50 Mbps)..."
curl -s -X POST "$API_URL/bandwidth-plans" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "plan_name": "Gold Plan",
    "plan_id": "plan_gold",
    "tenantId": "'$TENANT_ID'",
    "bandwidth": {
      "download_mbps": 100,
      "upload_mbps": 50,
      "burst_download_mbps": 150,
      "burst_upload_mbps": 75
    },
    "qos": {
      "qci": 9,
      "arp": {
        "priority_level": 5,
        "pre_emption_capability": true,
        "pre_emption_vulnerability": false
      },
      "gbr": false,
      "mbr_dl": 100000000,
      "mbr_ul": 50000000
    },
    "data_limits": {
      "monthly_quota_gb": 500,
      "throttle_after_quota": false
    },
    "features": {
      "priority_traffic": true,
      "video_optimization": true,
      "gaming_optimization": true,
      "static_ip": false
    },
    "pricing": {
      "monthly_price": 79.99,
      "currency": "USD"
    }
  }' > /dev/null 2>&1 && echo "  ✅ Gold Plan created" || echo "  ⚠️  Gold Plan may already exist"

# Silver Plan
echo "  Creating Silver Plan (50/25 Mbps)..."
curl -s -X POST "$API_URL/bandwidth-plans" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "plan_name": "Silver Plan",
    "plan_id": "plan_silver",
    "tenantId": "'$TENANT_ID'",
    "bandwidth": {
      "download_mbps": 50,
      "upload_mbps": 25,
      "burst_download_mbps": 75,
      "burst_upload_mbps": 40
    },
    "qos": {
      "qci": 9,
      "arp": {
        "priority_level": 10,
        "pre_emption_capability": false,
        "pre_emption_vulnerability": true
      },
      "gbr": false,
      "mbr_dl": 50000000,
      "mbr_ul": 25000000
    },
    "data_limits": {
      "monthly_quota_gb": 250,
      "throttle_after_quota": false
    },
    "pricing": {
      "monthly_price": 49.99,
      "currency": "USD"
    }
  }' > /dev/null 2>&1 && echo "  ✅ Silver Plan created" || echo "  ⚠️  Silver Plan may already exist"

# Bronze Plan
echo "  Creating Bronze Plan (25/10 Mbps)..."
curl -s -X POST "$API_URL/bandwidth-plans" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "plan_name": "Bronze Plan",
    "plan_id": "plan_bronze",
    "tenantId": "'$TENANT_ID'",
    "bandwidth": {
      "download_mbps": 25,
      "upload_mbps": 10,
      "burst_download_mbps": 35,
      "burst_upload_mbps": 15
    },
    "qos": {
      "qci": 9,
      "arp": {
        "priority_level": 15,
        "pre_emption_capability": false,
        "pre_emption_vulnerability": true
      },
      "gbr": false,
      "mbr_dl": 25000000,
      "mbr_ul": 10000000
    },
    "data_limits": {
      "monthly_quota_gb": 100,
      "throttle_after_quota": true,
      "throttled_speed_mbps": 5
    },
    "pricing": {
      "monthly_price": 29.99,
      "currency": "USD"
    }
  }' > /dev/null 2>&1 && echo "  ✅ Bronze Plan created" || echo "  ⚠️  Bronze Plan may already exist"

echo ""

# ============================================================================
# STEP 2: Create Subscriber Groups
# ============================================================================
echo "📋 Step 2/3: Creating subscriber groups..."
echo ""

# Residential Group
echo "  Creating Residential Users group..."
curl -s -X POST "$API_URL/groups" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "group_name": "Residential Users",
    "group_id": "group_residential",
    "tenantId": "'$TENANT_ID'",
    "default_plan_id": "plan_silver",
    "group_settings": {
      "apn": "internet",
      "allowed_apns": ["internet", "ims"],
      "roaming_allowed": true,
      "volte_enabled": true,
      "vowifi_enabled": true
    }
  }' > /dev/null 2>&1 && echo "  ✅ Residential group created" || echo "  ⚠️  Residential group may already exist"

# Business Group
echo "  Creating Business Users group..."
curl -s -X POST "$API_URL/groups" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "group_name": "Business Users",
    "group_id": "group_business",
    "tenantId": "'$TENANT_ID'",
    "default_plan_id": "plan_gold",
    "group_settings": {
      "apn": "internet",
      "allowed_apns": ["internet", "ims", "vpn"],
      "roaming_allowed": true,
      "volte_enabled": true,
      "vowifi_enabled": true
    }
  }' > /dev/null 2>&1 && echo "  ✅ Business group created" || echo "  ⚠️  Business group may already exist"

# VIP Group
echo "  Creating VIP Users group..."
curl -s -X POST "$API_URL/groups" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "group_name": "VIP Users",
    "group_id": "group_vip",
    "tenantId": "'$TENANT_ID'",
    "default_plan_id": "plan_gold",
    "group_settings": {
      "apn": "internet",
      "allowed_apns": ["internet", "ims", "vpn"],
      "roaming_allowed": true,
      "volte_enabled": true,
      "vowifi_enabled": true
    },
    "qos_override": {
      "qci": 5,
      "arp": {
        "priority_level": 1,
        "pre_emption_capability": true,
        "pre_emption_vulnerability": false
      }
    }
  }' > /dev/null 2>&1 && echo "  ✅ VIP group created" || echo "  ⚠️  VIP group may already exist"

echo ""

# ============================================================================
# STEP 3: Create Sample Subscribers (Optional)
# ============================================================================
echo "📋 Step 3/3: Creating sample test subscribers..."
echo ""

# Sample subscriber 1
echo "  Creating test subscriber 1..."
curl -s -X POST "$API_URL/subscribers" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "tenantId": "'$TENANT_ID'",
    "imsi": "001010123456789",
    "ki": "00112233445566778899AABBCCDDEEFF",
    "opc": "63BFA50EE6523365FF14C1F45F88737D",
    "user_info": {
      "full_name": "Test User 1",
      "email": "test1@example.com",
      "phone": "+1234567890"
    },
    "group_membership": {
      "group_id": "group_residential"
    }
  }' > /dev/null 2>&1 && echo "  ✅ Test subscriber 1 created" || echo "  ⚠️  Test subscriber 1 may already exist"

# Sample subscriber 2
echo "  Creating test subscriber 2..."
curl -s -X POST "$API_URL/subscribers" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "tenantId": "'$TENANT_ID'",
    "imsi": "001010123456790",
    "ki": "00112233445566778899AABBCCDDEE00",
    "opc": "63BFA50EE6523365FF14C1F45F887380",
    "user_info": {
      "full_name": "Test User 2",
      "email": "test2@example.com",
      "phone": "+1234567891"
    },
    "group_membership": {
      "group_id": "group_business"
    }
  }' > /dev/null 2>&1 && echo "  ✅ Test subscriber 2 created" || echo "  ⚠️  Test subscriber 2 may already exist"

echo ""

# ============================================================================
# Display Statistics
# ============================================================================
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}  ✅ SAMPLE DATA INITIALIZATION COMPLETE!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}📊 What Was Created:${NC}"
echo "   ✅ 3 Bandwidth Plans (Gold, Silver, Bronze)"
echo "   ✅ 3 Subscriber Groups (Residential, Business, VIP)"
echo "   ✅ 2 Test Subscribers"
echo ""
echo -e "${BLUE}🔗 View in Web UI:${NC}"
echo "   https://lte-pci-mapper-65450042-bbf71.web.app/modules/hss-management"
echo ""
echo -e "${BLUE}📡 API Endpoints:${NC}"
echo "   List Plans:       curl http://$EXTERNAL_IP/api/hss/bandwidth-plans"
echo "   List Groups:      curl http://$EXTERNAL_IP/api/hss/groups"
echo "   List Subscribers: curl http://$EXTERNAL_IP/api/hss/subscribers"
echo "   Dashboard Stats:  curl http://$EXTERNAL_IP/api/hss/dashboard/stats"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

