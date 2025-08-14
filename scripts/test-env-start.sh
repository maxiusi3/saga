#!/bin/bash

# Saga Test Environment Startup Script
# This script starts the complete test environment locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to check if ports are available
check_ports() {
    local ports=(3002 3003 5433 6380 8080)
    local occupied_ports=()
    
    for port in "${ports[@]}"; do
        if lsof -i :$port &> /dev/null; then
            occupied_ports+=($port)
        fi
    done
    
    if [ ${#occupied_ports[@]} -gt 0 ]; then
        print_error "The following ports are already in use: ${occupied_ports[*]}"
        print_error "Please stop the services using these ports or use different ports."
        exit 1
    fi
    
    print_success "All required ports are available"
}

# Function to clean up previous test environment
cleanup_previous() {
    print_status "Cleaning up previous test environment..."
    
    # Stop and remove containers
    docker-compose -f docker-compose.test.yml down --remove-orphans 2>/dev/null || true
    
    # Remove unused volumes (optional)
    if [ "${1:-}" = "--clean-volumes" ]; then
        print_warning "Removing test volumes (this will delete test data)..."
        docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true
    fi
    
    print_success "Previous environment cleaned up"
}

# Function to build images
build_images() {
    print_status "Building Docker images for test environment..."
    
    # Build images
    docker-compose -f docker-compose.test.yml build --no-cache
    
    print_success "Docker images built successfully"
}

# Function to start services
start_services() {
    print_status "Starting test environment services..."
    
    # Start database and Redis first
    print_status "Starting database and Redis..."
    docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
    
    # Wait for database and Redis to be ready
    print_status "Waiting for database and Redis to be ready..."
    sleep 10
    
    # Check database health
    for i in {1..30}; do
        if docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U saga_test_user -d saga_test &> /dev/null; then
            print_success "Database is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Database failed to start after 30 attempts"
            exit 1
        fi
        sleep 2
    done
    
    # Check Redis health
    for i in {1..30}; do
        if docker-compose -f docker-compose.test.yml exec -T redis-test redis-cli ping &> /dev/null; then
            print_success "Redis is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Redis failed to start after 30 attempts"
            exit 1
        fi
        sleep 2
    done
    
    # Start backend
    print_status "Starting backend service..."
    docker-compose -f docker-compose.test.yml up -d backend-test
    
    # Wait for backend to be ready
    print_status "Waiting for backend to be ready..."
    for i in {1..60}; do
        if curl -f -s http://localhost:3002/health &> /dev/null; then
            print_success "Backend is ready"
            break
        fi
        if [ $i -eq 60 ]; then
            print_error "Backend failed to start after 60 attempts"
            exit 1
        fi
        sleep 2
    done
    
    # Start frontend
    print_status "Starting frontend service..."
    docker-compose -f docker-compose.test.yml up -d web-test
    
    # Wait for frontend to be ready
    print_status "Waiting for frontend to be ready..."
    for i in {1..60}; do
        if curl -f -s http://localhost:3003 &> /dev/null; then
            print_success "Frontend is ready"
            break
        fi
        if [ $i -eq 60 ]; then
            print_error "Frontend failed to start after 60 attempts"
            exit 1
        fi
        sleep 2
    done
    
    # Start Nginx proxy
    print_status "Starting Nginx proxy..."
    docker-compose -f docker-compose.test.yml up -d nginx-test
    
    # Wait for Nginx to be ready
    print_status "Waiting for Nginx to be ready..."
    for i in {1..30}; do
        if curl -f -s http://localhost:8080/health &> /dev/null; then
            print_success "Nginx proxy is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Nginx failed to start after 30 attempts"
            exit 1
        fi
        sleep 2
    done
    
    print_success "All services started successfully"
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Run migrations inside the backend container
    docker-compose -f docker-compose.test.yml exec -T backend-test npm run db:migrate
    
    # Run seed data
    docker-compose -f docker-compose.test.yml exec -T backend-test npm run db:seed
    
    print_success "Database migrations completed"
}

# Function to run health checks
run_health_checks() {
    print_status "Running health checks..."
    
    local services=(
        "http://localhost:3002/health|Backend API"
        "http://localhost:3003|Frontend"
        "http://localhost:8080/health|Nginx Proxy"
        "http://localhost:8080/api/health|API through Proxy"
    )
    
    for service in "${services[@]}"; do
        IFS='|' read -r url name <<< "$service"
        
        if curl -f -s "$url" &> /dev/null; then
            print_success "$name health check passed"
        else
            print_error "$name health check failed"
            return 1
        fi
    done
    
    print_success "All health checks passed"
}

# Function to show environment info
show_environment_info() {
    print_success "Test environment is ready! 🚀"
    echo ""
    echo "📋 Environment Information:"
    echo "=========================="
    echo ""
    echo "🌐 URLs:"
    echo "   Application (via Nginx): http://localhost:8080"
    echo "   Frontend (direct):       http://localhost:3003"
    echo "   Backend API (direct):    http://localhost:3002"
    echo "   API via Proxy:           http://localhost:8080/api"
    echo ""
    echo "🗄️  Database:"
    echo "   Host: localhost:5433"
    echo "   Database: saga_test"
    echo "   Username: saga_test_user"
    echo "   Password: saga_test_password"
    echo ""
    echo "🔴 Redis:"
    echo "   Host: localhost:6380"
    echo ""
    echo "📊 Health Checks:"
    echo "   Backend:  http://localhost:3002/health"
    echo "   Proxy:    http://localhost:8080/health"
    echo ""
    echo "🧪 Test Credentials:"
    echo "   Email: test@saga.app"
    echo "   Password: TestPassword123!"
    echo ""
    echo "📝 Useful Commands:"
    echo "   View logs:     docker-compose -f docker-compose.test.yml logs -f"
    echo "   Stop services: docker-compose -f docker-compose.test.yml down"
    echo "   Run tests:     docker-compose -f docker-compose.test.yml --profile testing up test-runner"
    echo "   Database CLI:  docker-compose -f docker-compose.test.yml exec postgres-test psql -U saga_test_user -d saga_test"
    echo ""
}

# Function to run tests
run_tests() {
    print_status "Running test suite..."
    
    # Run the test runner service
    docker-compose -f docker-compose.test.yml --profile testing up --abort-on-container-exit test-runner
    
    print_success "Test suite completed"
}

# Function to show logs
show_logs() {
    print_status "Showing logs for all services..."
    docker-compose -f docker-compose.test.yml logs -f
}

# Function to stop environment
stop_environment() {
    print_status "Stopping test environment..."
    docker-compose -f docker-compose.test.yml down
    print_success "Test environment stopped"
}

# Main function
main() {
    local command="${1:-start}"
    local clean_volumes="${2:-}"
    
    case "$command" in
        "start")
            print_status "Starting Saga test environment..."
            check_docker
            check_ports
            cleanup_previous "$clean_volumes"
            build_images
            start_services
            run_migrations
            run_health_checks
            show_environment_info
            ;;
        "stop")
            stop_environment
            ;;
        "restart")
            stop_environment
            sleep 2
            main start "$clean_volumes"
            ;;
        "test")
            run_tests
            ;;
        "logs")
            show_logs
            ;;
        "clean")
            cleanup_previous --clean-volumes
            ;;
        "health")
            run_health_checks
            ;;
        "info")
            show_environment_info
            ;;
        "help"|*)
            echo "Saga Test Environment Management Script"
            echo ""
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  start [--clean-volumes]  Start the test environment (default)"
            echo "  stop                     Stop the test environment"
            echo "  restart [--clean-volumes] Restart the test environment"
            echo "  test                     Run the test suite"
            echo "  logs                     Show logs for all services"
            echo "  clean                    Clean up volumes and containers"
            echo "  health                   Run health checks"
            echo "  info                     Show environment information"
            echo "  help                     Show this help message"
            echo ""
            echo "Options:"
            echo "  --clean-volumes          Remove volumes (deletes data)"
            echo ""
            echo "Examples:"
            echo "  $0 start"
            echo "  $0 start --clean-volumes"
            echo "  $0 test"
            echo "  $0 logs"
            ;;
    esac
}

# Run main function with all arguments
main "$@"