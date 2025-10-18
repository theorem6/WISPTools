#!/bin/bash
# Set Firebase Functions environment variables for GenieACS backend connection

echo "🔧 Setting Firebase Functions environment variables..."
echo ""

# Set GenieACS URLs pointing to the backend server
firebase functions:config:set \
  genieacs.nbi_url="http://136.112.111.167:7557" \
  genieacs.ui_url="http://136.112.111.167:8080" \
  genieacs.cwmp_url="http://136.112.111.167:7547" \
  genieacs.fs_url="http://136.112.111.167:7567"

if [ $? -eq 0 ]; then
    echo "✅ Environment variables set successfully"
    echo ""
    echo "📋 Current configuration:"
    firebase functions:config:get
    echo ""
    echo "🚀 Deploy functions to apply changes:"
    echo "   firebase deploy --only functions"
else
    echo "❌ Failed to set environment variables"
    exit 1
fi

