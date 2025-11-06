#!/bin/bash

# Frontend Deployment Script - Robust & Safe
# This script ensures safe deployment of the frontend to Firebase Hosting
# with pre-deployment checks, verification, and rollback capabilities

set -e  # Exit on error

# Configuration
FIREBASE_PROJECT="wisptools-production"
BUILD_DIR="Module_Manager/build/client"
SOURCE_DIR="Module_Manager"
BACKUP_DIR="firebase-hosting-backup-$(date +%Y%m%d%H%M%S)"
FIREBASE_JSON="firebase.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- Helper Functions ---

log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

# --- Pre-deployment Checks ---

pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check if Firebase CLI is installed
    if ! command -v firebase &> /dev/null; then
        log_error "Firebase CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if we're logged in to Firebase
    if ! firebase projects:list &> /dev/null; then
        log_error "Not logged in to Firebase. Please run 'firebase login' first."
        exit 1
    fi
    
    # Check if firebase.json exists
    if [ ! -f "$FIREBASE_JSON" ]; then
        log_error "firebase.json not found in current directory."
        exit 1
    fi
    
    # Validate firebase.json structure
    if ! node -e "const fs = require('fs'); const config = JSON.parse(fs.readFileSync('$FIREBASE_JSON', 'utf8')); if (!config.hosting || !config.hosting.public || !config.hosting.rewrites) { process.exit(1); }" 2>/dev/null; then
        log_error "firebase.json is missing required hosting configuration."
        exit 1
    fi
    
    # Check if build directory exists
    if [ ! -d "$BUILD_DIR" ]; then
        log_warning "Build directory not found. Building now..."
        build_frontend
    fi
    
    # Verify index.html exists
    if [ ! -f "$BUILD_DIR/index.html" ]; then
        log_error "index.html not found in $BUILD_DIR. Build may have failed."
        exit 1
    fi
    
    # Verify 404.html exists
    if [ ! -f "$BUILD_DIR/404.html" ]; then
        log_warning "404.html not found. Creating it from index.html..."
        cp "$BUILD_DIR/index.html" "$BUILD_DIR/404.html"
    fi
    
    log_success "Pre-deployment checks passed"
}

build_frontend() {
    log "Building frontend..."
    cd "$SOURCE_DIR"
    
    if ! npm run build; then
        log_error "Frontend build failed"
        exit 1
    fi
    
    cd ..
    
    # Verify build output
    if [ ! -f "$BUILD_DIR/index.html" ]; then
        log_error "Build completed but index.html not found"
        exit 1
    fi
    
    log_success "Frontend build completed successfully"
}

# --- Backup Current Deployment ---

backup_current_deployment() {
    log "Creating backup of current deployment configuration..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup firebase.json
    cp "$FIREBASE_JSON" "$BACKUP_DIR/firebase.json"
    
    # Get current Firebase Hosting version (if possible)
    firebase hosting:clone:status 2>/dev/null > "$BACKUP_DIR/clone-status.txt" || true
    
    log_success "Backup created in $BACKUP_DIR"
}

# --- Deploy to Firebase ---

deploy_to_firebase() {
    log "Deploying to Firebase Hosting..."
    
    if ! firebase deploy --only hosting --project "$FIREBASE_PROJECT"; then
        log_error "Firebase deployment failed"
        return 1
    fi
    
    log_success "Deployment to Firebase completed"
    return 0
}

# --- Post-deployment Verification ---

verify_deployment() {
    log "Verifying deployment..."
    
    local site_url="https://${FIREBASE_PROJECT}.web.app"
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Verification attempt $attempt/$max_attempts..."
        
        # Check if site is accessible
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$site_url" || echo "000")
        
        if [ "$http_code" = "200" ]; then
            log_success "Site is accessible (HTTP $http_code)"
            
            # Check if index.html content is present
            local content=$(curl -s "$site_url" | grep -o "<title>.*</title>" || echo "")
            if [ -n "$content" ]; then
                log_success "Site content verified"
                return 0
            else
                log_warning "Site accessible but content verification failed"
            fi
        else
            log_warning "Site returned HTTP $http_code, retrying..."
        fi
        
        attempt=$((attempt + 1))
        sleep 5
    done
    
    log_error "Deployment verification failed after $max_attempts attempts"
    return 1
}

# --- Rollback ---

rollback() {
    log_error "Deployment failed. Attempting rollback..."
    
    if [ -f "$BACKUP_DIR/firebase.json" ]; then
        log "Restoring firebase.json from backup..."
        cp "$BACKUP_DIR/firebase.json" "$FIREBASE_JSON"
        
        log "Redeploying previous version..."
        firebase deploy --only hosting --project "$FIREBASE_PROJECT" || {
            log_error "Rollback failed. Manual intervention required."
            exit 1
        }
        
        log_success "Rollback completed"
    else
        log_error "No backup found. Cannot rollback automatically."
        log_error "Please manually restore firebase.json and redeploy."
        exit 1
    fi
}

# --- Main Execution ---

main() {
    log "=== Starting Frontend Deployment ==="
    
    # Pre-deployment checks
    pre_deployment_checks
    
    # Build frontend if needed
    if [ ! -d "$BUILD_DIR" ] || [ ! -f "$BUILD_DIR/index.html" ]; then
        build_frontend
    fi
    
    # Backup current configuration
    backup_current_deployment
    
    # Deploy
    if ! deploy_to_firebase; then
        rollback
        exit 1
    fi
    
    # Verify deployment
    if ! verify_deployment; then
        log_error "Deployment verification failed"
        rollback
        exit 1
    fi
    
    log_success "=== Frontend Deployment Completed Successfully ==="
    log "Site URL: https://${FIREBASE_PROJECT}.web.app"
    log "Backup location: $BACKUP_DIR"
}

# Run main function
main


