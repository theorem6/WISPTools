#!/bin/bash
# Deploy from Git to Firebase App Hosting
# This script deploys the entire application from a fresh git clone

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_FUNCTIONS=false
SKIP_APP_HOSTING=false
INITIALIZE_DB=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-functions)
      SKIP_FUNCTIONS=true
      shift
      ;;
    --skip-app-hosting)
      SKIP_APP_HOSTING=true
      shift
      ;;
    --initialize-db)
      INITIALIZE_DB=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}🚀 Deploying from Git to Firebase App Hosting...${NC}"
echo ""

# Check if Firebase CLI is installed
echo -e "${YELLOW}Checking Firebase CLI...${NC}"
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI not found. Please install it first:${NC}"
    echo -e "${YELLOW}npm install -g firebase-tools${NC}"
    exit 1
fi

FIREBASE_VERSION=$(firebase --version)
echo -e "${GREEN}✅ Firebase CLI installed: $FIREBASE_VERSION${NC}"

# Check if logged in to Firebase
echo ""
echo -e "${YELLOW}Checking Firebase authentication...${NC}"
if ! firebase projects:list &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Firebase. Please run:${NC}"
    echo -e "${YELLOW}firebase login${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Authenticated with Firebase${NC}"

# Verify we're in the correct project
echo ""
echo -e "${YELLOW}Verifying Firebase project...${NC}"
CURRENT_PROJECT=$(firebase use 2>&1 | grep "Active" | awk '{print $3}')
if [ -z "$CURRENT_PROJECT" ]; then
    echo -e "${RED}❌ No Firebase project selected. Please run:${NC}"
    echo -e "${YELLOW}firebase use <project-id>${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Using Firebase project: $CURRENT_PROJECT${NC}"

# Deploy Firebase Functions
if [ "$SKIP_FUNCTIONS" = false ]; then
    echo ""
    echo -e "${CYAN}📦 Deploying Firebase Functions...${NC}"
    echo -e "${GRAY}This includes all MongoDB CRUD operations and initialization functions${NC}"
    
    # Check if functions directory exists
    if [ ! -d "functions" ]; then
        echo -e "${RED}❌ functions directory not found!${NC}"
        exit 1
    fi
    
    # Install dependencies if needed
    if [ ! -d "functions/node_modules" ]; then
        echo -e "${YELLOW}Installing Functions dependencies...${NC}"
        cd functions
        npm install
        cd ..
    fi
    
    # Build TypeScript
    echo -e "${YELLOW}Building TypeScript...${NC}"
    cd functions
    npm run build
    cd ..
    echo -e "${GREEN}✅ TypeScript build successful${NC}"
    
    # Deploy functions
    echo -e "${YELLOW}Deploying functions to Firebase...${NC}"
    firebase deploy --only functions
    
    echo -e "${GREEN}✅ Firebase Functions deployed successfully!${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping Firebase Functions deployment${NC}"
fi

# Deploy Module Manager to Firebase App Hosting
if [ "$SKIP_APP_HOSTING" = false ]; then
    echo ""
    echo -e "${CYAN}🌐 Deploying Module Manager to Firebase App Hosting...${NC}"
    echo -e "${GRAY}This includes the GenieACS UI and database initialization pages${NC}"
    
    # Check if Module_Manager directory exists
    if [ ! -d "Module_Manager" ]; then
        echo -e "${RED}❌ Module_Manager directory not found!${NC}"
        exit 1
    fi
    
    cd Module_Manager
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing Module Manager dependencies...${NC}"
        npm install
    fi
    
    # Deploy to Firebase App Hosting
    echo -e "${YELLOW}Deploying to Firebase App Hosting...${NC}"
    firebase apphosting:backends:deploy
    
    echo -e "${GREEN}✅ Firebase App Hosting deployment successful!${NC}"
    
    cd ..
else
    echo -e "${YELLOW}⏭️  Skipping Firebase App Hosting deployment${NC}"
fi

# Initialize MongoDB Database
if [ "$INITIALIZE_DB" = true ]; then
    echo ""
    echo -e "${CYAN}🗄️  Initializing MongoDB Database...${NC}"
    
    # Get the project ID
    PROJECT_ID=$(firebase use 2>&1 | grep "Active" | awk '{print $3}')
    FUNCTIONS_URL="https://us-central1-$PROJECT_ID.cloudfunctions.net"
    
    echo -e "${YELLOW}Checking MongoDB health...${NC}"
    
    HEALTH_RESPONSE=$(curl -s "$FUNCTIONS_URL/checkMongoHealth")
    SUCCESS=$(echo $HEALTH_RESPONSE | jq -r '.success')
    
    if [ "$SUCCESS" = "true" ]; then
        DATABASE=$(echo $HEALTH_RESPONSE | jq -r '.database')
        SERVER_VERSION=$(echo $HEALTH_RESPONSE | jq -r '.serverVersion')
        PRESETS_COUNT=$(echo $HEALTH_RESPONSE | jq -r '.collections.presets')
        FAULTS_COUNT=$(echo $HEALTH_RESPONSE | jq -r '.collections.faults')
        
        echo -e "${GREEN}✅ MongoDB connected: $DATABASE${NC}"
        echo -e "${GRAY}   Server: $SERVER_VERSION${NC}"
        echo -e "${GRAY}   Presets: $PRESETS_COUNT${NC}"
        echo -e "${GRAY}   Faults: $FAULTS_COUNT${NC}"
        
        # Ask if user wants to initialize
        read -p "Initialize database with sample data? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Initializing database...${NC}"
            INIT_RESPONSE=$(curl -s -X POST "$FUNCTIONS_URL/initializeMongoDatabase")
            INIT_SUCCESS=$(echo $INIT_RESPONSE | jq -r '.success')
            
            if [ "$INIT_SUCCESS" = "true" ]; then
                PRESETS_CREATED=$(echo $INIT_RESPONSE | jq -r '.presets.created')
                PRESETS_SKIPPED=$(echo $INIT_RESPONSE | jq -r '.presets.skipped')
                FAULTS_CREATED=$(echo $INIT_RESPONSE | jq -r '.faults.created')
                FAULTS_SKIPPED=$(echo $INIT_RESPONSE | jq -r '.faults.skipped')
                
                echo -e "${GREEN}✅ Database initialized!${NC}"
                echo -e "${GRAY}   Presets: $PRESETS_CREATED created, $PRESETS_SKIPPED existed${NC}"
                echo -e "${GRAY}   Faults: $FAULTS_CREATED created, $FAULTS_SKIPPED existed${NC}"
            else
                ERROR=$(echo $INIT_RESPONSE | jq -r '.error')
                echo -e "${RED}❌ Database initialization failed: $ERROR${NC}"
            fi
        fi
    else
        ERROR=$(echo $HEALTH_RESPONSE | jq -r '.error')
        echo -e "${RED}❌ MongoDB not connected: $ERROR${NC}"
        echo -e "${YELLOW}Please configure MONGODB_URI in apphosting.yaml${NC}"
    fi
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

# Show next steps
echo -e "${CYAN}Next Steps:${NC}"
echo -e "${NC}1. Visit your Firebase App Hosting URL${NC}"
echo -e "${NC}2. Go to: ACS CPE Management → Administration → Database${NC}"
echo -e "${NC}3. Click 'Initialize Database' to create sample data${NC}"
echo -e "${NC}4. Test presets editing and faults management${NC}"
echo ""
echo -e "${YELLOW}To initialize database from command line, run:${NC}"
echo -e "${CYAN}./deploy-from-git.sh --initialize-db${NC}"
echo ""
echo -e "${YELLOW}To deploy only functions:${NC}"
echo -e "${CYAN}./deploy-from-git.sh --skip-app-hosting${NC}"
echo ""
echo -e "${YELLOW}To deploy only app hosting:${NC}"
echo -e "${CYAN}./deploy-from-git.sh --skip-functions${NC}"
echo ""

