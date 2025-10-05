#!/bin/bash
# LTE WISP Management Platform - Module Manager Launcher
# For Firebase Web IDE

echo "================================================"
echo "  LTE WISP Management Platform - Module Manager"
echo "================================================"
echo ""

# Navigate to Module_Manager directory
cd Module_Manager

echo "Checking dependencies..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies (first time setup)..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Failed to install dependencies!"
        exit 1
    fi
fi

echo ""
echo "Starting development server..."
echo ""
echo "Once started, Firebase will provide a preview URL"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the dev server with host binding for Firebase
npm run dev -- --host

