#!/bin/bash

# Saga MVP Deployment Script
# This script handles deployment to production environment

set -e  # Exit on any error

# Configuration
ENVIRONMENT=${1:-production}
BUILD_ID=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backups/saga-${BUILD_ID}"
LOG_FILE="/var/log/saga-deploy-${BUILD_ID}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker is not running"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if required environment files exist
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if [[ ! -f ".env.production" ]]; then
            error "Production environment file (.env.production) not found"
        fi
    fi
    
    success "Prerequisites check passed"
}

# Create backup
create_backup() {
    log "Creating backup before deployment..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    if docker-compose ps postgres | grep -q "Up"; then
        log "Backing up PostgreSQL database..."
        docker-compose exec -T postgres pg_dump -U saga_user saga_production > "$BACKUP_DIR/database.sql"
        success "Database backup created"
    fi
    
    # Backup uploaded files
    if [[ -d "uploads" ]]; then
        log "Backing up uploaded files..."
        cp -r uploads "$BACKUP_DIR/"
        success "Files backup created"
    fi
    
    # Backup current environment
    if [[ -f ".env.production" ]]; then
        cp .env.production "$BACKUP_DIR/"
    fi
    
    success "Backup created at $BACKUP_DIR"
}

# Build and deploy
deploy() {
    log "Starting deployment for environment: $ENVIRONMENT"
    
    # Pull latest code (if in CI/CD environment)
    if [[ -n "$CI" ]]; then
        log "Pulling latest code..."
        git pull origin main
    fi
    
    # Build Docker images
    log "Building Docker images..."
    docker-compose build --no-cache
    success "Docker images built successfully"
    
    # Stop existing services
    log "Stopping existing services..."
    docker-compose down
    
    # Start new services
    log "Starting new services..."
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker-compose --profile production up -d
    else
        docker-compose up -d
    fi
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_health
    
    success "Deployment completed successfully"
}

# Health check
check_health() {
    log "Performing health checks..."
    
    # Check frontend health
    if curl -f http://localhost:3000/health &> /dev/null; then
        success "Frontend is healthy"
    else
        error "Frontend health check failed"
    fi
    
    # Check backend health
    if curl -f http://localhost:3001/health &> /dev/null; then
        success "Backend is healthy"
    else
        error "Backend health check failed"
    fi
    
    # Check database connection
    if docker-compose exec -T postgres pg_isready -U saga_user -d saga_production &> /dev/null; then
        success "Database is healthy"
    else
        error "Database health check failed"
    fi
    
    success "All health checks passed"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    sleep 10
    
    # Run migrations
    docker-compose exec backend npm run migrate
    
    success "Database migrations completed"
}

# Cleanup old images and containers
cleanup() {
    log "Cleaning up old Docker images and containers..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused containers
    docker container prune -f
    
    # Remove unused volumes (be careful with this in production)
    if [[ "$ENVIRONMENT" != "production" ]]; then
        docker volume prune -f
    fi
    
    success "Cleanup completed"
}

# Rollback function
rollback() {
    log "Rolling back to previous version..."
    
    # Stop current services
    docker-compose down
    
    # Restore database from backup
    if [[ -f "$BACKUP_DIR/database.sql" ]]; then
        log "Restoring database from backup..."
        docker-compose up -d postgres
        sleep 10
        docker-compose exec -T postgres psql -U saga_user -d saga_production < "$BACKUP_DIR/database.sql"
    fi
    
    # Restore files
    if [[ -d "$BACKUP_DIR/uploads" ]]; then
        log "Restoring uploaded files..."
        rm -rf uploads
        cp -r "$BACKUP_DIR/uploads" .
    fi
    
    # Start services with previous version
    # This would typically involve checking out previous git commit or using previous Docker images
    warning "Manual intervention may be required to complete rollback"
    
    success "Rollback initiated"
}

# Send deployment notification
send_notification() {
    local status=$1
    local message=$2
    
    # Send to Slack, Discord, or other notification service
    # This is a placeholder - implement based on your notification preferences
    log "Notification: $status - $message"
    
    # Example Slack webhook (uncomment and configure)
    # curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"Saga Deployment $status: $message\"}" \
    #     "$SLACK_WEBHOOK_URL"
}

# Main deployment flow
main() {
    log "Starting Saga MVP deployment process..."
    log "Environment: $ENVIRONMENT"
    log "Build ID: $BUILD_ID"
    
    # Trap errors and send notification
    trap 'send_notification "FAILED" "Deployment failed at $(date)"' ERR
    
    check_prerequisites
    create_backup
    deploy
    run_migrations
    cleanup
    
    send_notification "SUCCESS" "Deployment completed successfully at $(date)"
    success "Saga MVP deployment completed successfully!"
    log "Build ID: $BUILD_ID"
    log "Log file: $LOG_FILE"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "health")
        check_health
        ;;
    "backup")
        create_backup
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|health|backup}"
        echo "  deploy   - Deploy the application (default)"
        echo "  rollback - Rollback to previous version"
        echo "  health   - Check application health"
        echo "  backup   - Create backup only"
        exit 1
        ;;
esac
