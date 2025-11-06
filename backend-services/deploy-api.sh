#!/bin/bash
#
# Safe API Deployment Script
# Deploys API services without breaking running services
# Supports rollback and health checks
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GCE_INSTANCE="acs-hss-server"
GCE_ZONE="us-central1-a"
GCE_PROJECT="lte-pci-mapper-65450042-bbf71"
REMOTE_DIR="/opt/gce-backend"
BACKUP_DIR="/opt/gce-backend/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# API Services Configuration
declare -A SERVICES=(
    ["main-api"]="3001:server.js"
    ["epc-api"]="3002:min-epc-server.js"
)

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_service_health() {
    local service_name=$1
    local port=$2
    
    log_info "Checking health of $service_name on port $port..."
    
    local response=$(gcloud compute ssh $GCE_INSTANCE \
        --zone=$GCE_ZONE \
        --project=$GCE_PROJECT \
        --command="curl -s -o /dev/null -w '%{http_code}' http://localhost:$port/health 2>/dev/null || echo '000'" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
        log_info "$service_name is healthy (HTTP $response)"
        return 0
    else
        log_error "$service_name health check failed (HTTP $response)"
        return 1
    fi
}

backup_service() {
    local service_name=$1
    local service_file=$2
    
    log_info "Backing up $service_name ($service_file)..."
    
    gcloud compute ssh $GCE_INSTANCE \
        --zone=$GCE_ZONE \
        --project=$GCE_PROJECT \
        --command="
            mkdir -p $BACKUP_DIR/$service_name;
            if [ -f $REMOTE_DIR/$service_file ]; then
                cp $REMOTE_DIR/$service_file $BACKUP_DIR/$service_name/${service_file}.${TIMESTAMP};
                echo 'Backup created: $BACKUP_DIR/$service_name/${service_file}.${TIMESTAMP}';
            else
                echo 'No existing file to backup';
            fi
        " > /dev/null 2>&1
    
    log_info "Backup completed for $service_name"
}

deploy_service_file() {
    local service_name=$1
    local local_file=$2
    local remote_file=$3
    
    log_info "Deploying $service_name ($local_file -> $remote_file)..."
    
    # Copy file to GCE
    gcloud compute scp $local_file \
        $GCE_INSTANCE:$REMOTE_DIR/$remote_file \
        --zone=$GCE_ZONE \
        --project=$GCE_PROJECT
    
    log_info "File deployed for $service_name"
}

restart_service() {
    local service_name=$1
    
    log_info "Restarting $service_name..."
    
    gcloud compute ssh $GCE_INSTANCE \
        --zone=$GCE_ZONE \
        --project=$GCE_PROJECT \
        --command="pm2 restart $service_name" > /dev/null 2>&1
    
    # Wait for service to start
    sleep 5
    
    log_info "$service_name restarted"
}

rollback_service() {
    local service_name=$1
    local service_file=$2
    
    log_error "Rolling back $service_name..."
    
    gcloud compute ssh $GCE_INSTANCE \
        --zone=$GCE_ZONE \
        --project=$GCE_PROJECT \
        --command="
            LATEST_BACKUP=\$(ls -t $BACKUP_DIR/$service_name/${service_file}.* 2>/dev/null | head -1);
            if [ -n \"\$LATEST_BACKUP\" ]; then
                cp \$LATEST_BACKUP $REMOTE_DIR/$service_file;
                echo 'Rolled back to: \$LATEST_BACKUP';
            else
                echo 'No backup found for rollback';
            fi
        "
    
    restart_service $service_name
    log_info "Rollback completed for $service_name"
}

# Main deployment function
deploy_service() {
    local service_name=$1
    local port_file_pair=${SERVICES[$service_name]}
    local port=$(echo $port_file_pair | cut -d: -f1)
    local service_file=$(echo $port_file_pair | cut -d: -f2)
    local local_file="backend-services/$service_file"
    
    log_info "=========================================="
    log_info "Deploying: $service_name"
    log_info "Port: $port"
    log_info "File: $service_file"
    log_info "=========================================="
    
    # Pre-deployment health check
    if ! check_service_health $service_name $port; then
        log_warn "Service health check failed before deployment, but continuing..."
    fi
    
    # Backup existing service
    backup_service $service_name $service_file
    
    # Deploy new file
    if [ ! -f "$local_file" ]; then
        log_error "Local file not found: $local_file"
        return 1
    fi
    
    deploy_service_file $service_name $local_file $service_file
    
    # Restart service
    restart_service $service_name
    
    # Post-deployment health check
    if check_service_health $service_name $port; then
        log_info "✅ $service_name deployed successfully!"
        return 0
    else
        log_error "❌ $service_name deployment failed health check"
        log_warn "Attempting rollback..."
        rollback_service $service_name $service_file
        return 1
    fi
}

# Main script
main() {
    local target_service=${1:-"all"}
    
    log_info "Starting API deployment..."
    log_info "Target: $target_service"
    log_info "Timestamp: $TIMESTAMP"
    
    # Deploy specific service or all services
    if [ "$target_service" = "all" ]; then
        for service in "${!SERVICES[@]}"; do
            if ! deploy_service $service; then
                log_error "Failed to deploy $service"
                exit 1
            fi
            echo ""  # Blank line between services
        done
    else
        if [ -z "${SERVICES[$target_service]}" ]; then
            log_error "Unknown service: $target_service"
            log_info "Available services: ${!SERVICES[@]}"
            exit 1
        fi
        deploy_service $target_service
    fi
    
    log_info "=========================================="
    log_info "✅ Deployment completed successfully!"
    log_info "=========================================="
}

# Run main function
main "$@"

