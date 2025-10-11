#!/bin/bash
# Test build script to verify everything works before deploying

set -e

echo "🧪 Testing local build..."
echo ""

# Navigate to Module_Manager if not already there
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the Module_Manager directory"
    exit 1
fi

# Check if src/app.html exists
if [ ! -f "src/app.html" ]; then
    echo "❌ Error: src/app.html not found!"
    exit 1
fi
echo "✅ src/app.html exists"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Run svelte-kit sync (generates .svelte-kit/tsconfig.json)
echo ""
echo "🔄 Running svelte-kit sync..."
npx svelte-kit sync

# Check if .svelte-kit/tsconfig.json was generated
if [ ! -f ".svelte-kit/tsconfig.json" ]; then
    echo "❌ Error: .svelte-kit/tsconfig.json not generated!"
    exit 1
fi
echo "✅ .svelte-kit/tsconfig.json generated"

# Build
echo ""
echo "🏗️  Building application..."
NODE_OPTIONS="--max-old-space-size=6144" npm run build

# Check build output
if [ ! -f "build/index.js" ]; then
    echo "❌ Error: build/index.js not found!"
    exit 1
fi
echo "✅ build/index.js created"

if [ ! -d "build/client" ]; then
    echo "❌ Error: build/client directory not found!"
    exit 1
fi
echo "✅ build/client directory created"

# List build output
echo ""
echo "📂 Build output:"
ls -lh build/

echo ""
echo "📂 Build client output:"
ls -lh build/client/ | head -10

echo ""
echo "✅ Build test successful!"
echo ""
echo "🚀 Ready to deploy with: firebase deploy --only apphosting"

