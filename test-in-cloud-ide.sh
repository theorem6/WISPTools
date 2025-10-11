#!/bin/bash

# Quick diagnostic script for Cloud IDE
# Run this in your Cloud IDE to verify everything is correct

echo "════════════════════════════════════════════════════════"
echo "🔍 DEPLOYMENT DIAGNOSTIC SCRIPT"
echo "════════════════════════════════════════════════════════"
echo ""

# Check current directory
echo "1️⃣  Current Directory:"
pwd
echo ""

# Check if we're in the right repo
echo "2️⃣  Git Repository:"
git remote -v | head -2
echo ""

# Check latest commit
echo "3️⃣  Latest Commit:"
git log --oneline -1
echo ""
echo "   Expected: 'Add cloud deploy quick reference commands' or later"
echo ""

# Check if apphosting.yaml exists
echo "4️⃣  apphosting.yaml exists:"
if [ -f "apphosting.yaml" ]; then
    echo "   ✅ YES"
    echo ""
    echo "   Root directory setting:"
    grep "rootDirectory" apphosting.yaml
else
    echo "   ❌ NO - You're in the wrong directory!"
    echo "   Run: cd ~/lte-pci-mapper"
fi
echo ""

# Check if Module_Manager exists
echo "5️⃣  Module_Manager directory:"
if [ -d "Module_Manager" ]; then
    echo "   ✅ EXISTS"
else
    echo "   ❌ MISSING!"
fi
echo ""

# Check if app.html exists
echo "6️⃣  src/app.html file:"
if [ -f "Module_Manager/src/app.html" ]; then
    echo "   ✅ EXISTS"
else
    echo "   ❌ MISSING!"
fi
echo ""

# Check tsconfig
echo "7️⃣  tsconfig.json configuration:"
if [ -f "Module_Manager/tsconfig.json" ]; then
    echo "   First 3 lines:"
    head -3 Module_Manager/tsconfig.json
else
    echo "   ❌ MISSING!"
fi
echo ""

# Check firebase.json
echo "8️⃣  firebase.json apphosting config:"
if [ -f "firebase.json" ]; then
    grep -A 10 '"apphosting"' firebase.json
else
    echo "   ❌ MISSING!"
fi
echo ""

# Check Firebase project
echo "9️⃣  Firebase Project:"
firebase use
echo ""

echo "════════════════════════════════════════════════════════"
echo "📋 SUMMARY"
echo "════════════════════════════════════════════════════════"
echo ""

# Determine if ready to deploy
if [ -f "apphosting.yaml" ] && [ -d "Module_Manager" ] && [ -f "Module_Manager/src/app.html" ]; then
    echo "✅ Configuration looks GOOD!"
    echo ""
    echo "🚀 Ready to deploy with:"
    echo "   firebase deploy --only apphosting"
else
    echo "❌ Configuration has ISSUES!"
    echo ""
    echo "💡 Suggested fixes:"
    if [ ! -f "apphosting.yaml" ]; then
        echo "   - Run: cd ~/lte-pci-mapper"
    fi
    if [ ! -d "Module_Manager" ]; then
        echo "   - Missing Module_Manager directory"
        echo "   - Run: git pull origin main"
    fi
    if [ ! -f "Module_Manager/src/app.html" ]; then
        echo "   - Missing src/app.html"
        echo "   - Run: git pull origin main"
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════"

