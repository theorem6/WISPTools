#!/bin/bash

# Complete Auto-Deploy Setup Script
# This script sets up automated deployment from Git to Google Cloud

set -e

echo "🚀 Setting up Automated Google Cloud Deployment for WISPTools.io"
echo "=================================================================="

# Check if we're in the right directory
if [ ! -f "cloudbuild-auto-deploy.yaml" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK not found. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud. Please run:"
    echo "   gcloud auth login"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No project ID set. Please run:"
    echo "   gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📋 Project ID: $PROJECT_ID"
echo ""

# Ask user which deployment method they want
echo "Which deployment method would you like to set up?"
echo "1) Google Cloud Build (Recommended)"
echo "2) GitHub Actions"
echo "3) Cron-based deployment"
echo "4) All of the above"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "🔧 Setting up Google Cloud Build..."
        ./setup-cloud-build-trigger.sh
        ;;
    2)
        echo "🔧 Setting up GitHub Actions..."
        echo "✅ GitHub Actions workflow created at .github/workflows/auto-deploy.yml"
        echo "⚠️  Please configure the required secrets in your GitHub repository:"
        echo "   - FIREBASE_PROJECT_ID"
        echo "   - FIREBASE_TOKEN"
        echo "   - GCP_PROJECT_ID"
        echo "   - GCP_SA_KEY"
        ;;
    3)
        echo "🔧 Setting up Cron-based deployment..."
        ./setup-auto-deploy-cron.sh
        ;;
    4)
        echo "🔧 Setting up all deployment methods..."
        echo ""
        echo "1️⃣ Google Cloud Build..."
        ./setup-cloud-build-trigger.sh
        echo ""
        echo "2️⃣ GitHub Actions..."
        echo "✅ GitHub Actions workflow created"
        echo ""
        echo "3️⃣ Cron-based deployment..."
        ./setup-auto-deploy-cron.sh
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Push your changes to the main branch"
echo "2. Check the deployment logs"
echo "3. Verify all services are running"
echo ""
echo "🔗 Useful Commands:"
echo "  • Check Cloud Build: gcloud builds list"
echo "  • Check services: sudo systemctl status wisptools-*"
echo "  • View logs: journalctl -u wisptools-backend -f"
echo "  • Manual deploy: ./deploy-from-git.sh"
echo ""
echo "📚 Documentation: AUTO_DEPLOY_SETUP.md"
echo ""
echo "🚀 Your automated deployment is ready!"