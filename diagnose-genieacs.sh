#!/bin/bash
# Diagnose GenieACS installation issues

echo "═══════════════════════════════════════════════════════════"
echo "  🔍 GenieACS Diagnostics"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "📦 Node.js Version:"
node --version
echo ""

echo "📦 npm Version:"
npm --version
echo ""

echo "📦 GenieACS Installation:"
npm list -g genieacs
echo ""

echo "📂 GenieACS Binary Location:"
which genieacs-cwmp || echo "Not found in PATH"
ls -la /usr/lib/node_modules/genieacs/bin/ 2>/dev/null || echo "GenieACS not installed globally"
echo ""

echo "📂 Config File:"
cat /opt/genieacs/genieacs.env 2>/dev/null || echo "Config file not found"
echo ""

echo "👤 User exists:"
id genieacs 2>/dev/null || echo "genieacs user not found"
echo ""

echo "📂 Directory permissions:"
ls -ld /opt/genieacs /var/log/genieacs 2>/dev/null
echo ""

echo "🔍 Recent logs from genieacs-cwmp:"
journalctl -u genieacs-cwmp -n 30 --no-pager
echo ""

echo "🔍 Recent logs from genieacs-nbi:"
journalctl -u genieacs-nbi -n 30 --no-pager
echo ""

echo "🧪 Test MongoDB connection:"
node -e "
const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
MongoClient.connect(uri, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log('✅ MongoDB connection successful'))
  .catch(err => console.log('❌ MongoDB connection failed:', err.message));
" 2>&1
echo ""

echo "═══════════════════════════════════════════════════════════"

