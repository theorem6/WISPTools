#!/bin/bash

# Setup Cloud Build Trigger for LTE PCI Mapper
# This script helps configure the Cloud Build trigger properly

PROJECT_ID="lte-pci-mapper-65450042-bbf71"
TRIGGER_NAME="lte-pci-mapper-deploy"
REPO_NAME="lte-pci-mapper"
BRANCH_PATTERN="^main$"

echo "🔧 Setting up Cloud Build Trigger for $PROJECT_ID"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install Google Cloud SDK first."
    exit 1
fi

# Set the project
echo "📋 Setting project to $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔌 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable firebase.googleapis.com
gcloud services enable apphosting.googleapis.com

# Create Cloud Build trigger
echo "🚀 Creating Cloud Build trigger..."

# Check if trigger already exists
if gcloud builds triggers describe $TRIGGER_NAME --project=$PROJECT_ID &> /dev/null; then
    echo "⚠️ Trigger $TRIGGER_NAME already exists. Updating..."
    gcloud builds triggers update $TRIGGER_NAME \
        --project=$PROJECT_ID \
        --build-config=cloudbuild-simple.yaml \
        --repo-name=$REPO_NAME \
        --branch-pattern=$BRANCH_PATTERN \
        --description="Deploy LTE PCI Mapper Firebase Functions and App Hosting"
else
    echo "✨ Creating new trigger..."
    gcloud builds triggers create github \
        --project=$PROJECT_ID \
        --name=$TRIGGER_NAME \
        --build-config=cloudbuild-simple.yaml \
        --repo-name=$REPO_NAME \
        --branch-pattern=$BRANCH_PATTERN \
        --description="Deploy LTE PCI Mapper Firebase Functions and App Hosting"
fi

echo "✅ Cloud Build trigger configured successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Make sure your repository is connected to Cloud Build"
echo "2. Push changes to the main branch to trigger a build"
echo "3. Monitor builds in the Google Cloud Console"
echo ""
echo "🔗 View triggers: https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo "🔗 View builds: https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"