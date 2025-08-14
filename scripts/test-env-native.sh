#!/bin/bash

# Saga Test Environment - Native (Docker-free) Startup Script
# This script starts the complete test environment without Docker dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=3002
WEB_PORT=3003
POSTGRES_PORT=5433
REDIS_PORT=6380

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is available
is_port_available() {
    ! lsof -i :$1 >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=${3:-30}
    
    print_status "Waiting for $name to be ready..."
    for i in $(seq 1 $max_attempts); do
        if curl -f -s "$url" >/dev/null 2>&1; then
            print_success "$name is ready"
            return 0
        fi
        if [ $i -eq $max_attempts ]; then
            print_error "$name failed to start after $max_attempts attempts"
            return 1
        fi
        sleep 2
    done
}

# Function to check system dependencies
check_dependencies() {
    print_status "Checking system dependencies..."
    
    local missing_deps=()
    
    # Check Node.js
    if ! command_exists node; then
        missing_deps+=("node")
    else
        local node_version=$(node --version | sed 's/v//')
        local required_version="18.0.0"
        if ! node -e "process.exit(require('semver').gte('$node_version', '$required_version') ? 0 : 1)" 2>/dev/null; then
            print_warning "Node.js version $node_version found, but version $required_version or higher is recommended"
        fi
    fi
    
    # Check npm
    if ! command_exists npm; then
        missing_deps+=("npm")
    fi
    
    # Check curl for health checks
    if ! command_exists curl; then
        missing_deps+=("curl")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_error "Please install the missing dependencies and try again."
        exit 1
    fi
    
    print_success "All required dependencies are available"
}

# Function to check and setup PostgreSQL
setup_postgres() {
    print_status "Setting up PostgreSQL..."
    
    if command_exists psql && command_exists pg_ctl; then
        print_status "PostgreSQL found, checking if running..."
        
        # Try to connect to local PostgreSQL
        if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
            print_success "PostgreSQL is running on default port"
            
            # Create test database if it doesn't exist
            if ! psql -h localhost -p 5432 -U $(whoami) -lqt | cut -d \| -f 1 | grep -qw saga_test; then
                print_status "Creating test database..."
                createdb -h localhost -p 5432 saga_test 2>/dev/null || true
            fi
            
            export DATABASE_URL="postgresql://$(whoami)@localhost:5432/saga_test"
            print_success "Using local PostgreSQL database"
            return 0
        fi
    fi
    
    print_warning "Local PostgreSQL not available, using SQLite for testing"
    export DATABASE_URL="sqlite:./test.db"
    export DB_CLIENT="sqlite3"
}

# Function to check and setup Redis
setup_redis() {
    print_status "Setting up Redis..."
    
    if command_exists redis-server && command_exists redis-cli; then
        print_status "Redis found, checking if running..."
        
        # Try to connect to local Redis
        if redis-cli ping >/dev/null 2>&1; then
            print_success "Redis is running on default port"
            export REDIS_URL="redis://localhost:6379"
            return 0
        else
            print_status "Starting Redis server..."
            redis-server --daemonize yes --port 6379 >/dev/null 2>&1 || true
            sleep 2
            
            if redis-cli ping >/dev/null 2>&1; then
                print_success "Redis started successfully"
                export REDIS_URL="redis://localhost:6379"
                return 0
            fi
        fi
    fi
    
    print_warning "Redis not available, using in-memory cache"
    export REDIS_URL=""
    export USE_MEMORY_CACHE="true"
}

# Function to check ports
check_ports() {
    print_status "Checking port availability..."
    
    local ports=($BACKEND_PORT $WEB_PORT)
    local occupied_ports=()
    
    for port in "${ports[@]}"; do
        if ! is_port_available $port; then
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

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    npm install
    
    # Install workspace dependencies
    npm run setup 2>/dev/null || {
        print_warning "Setup script failed, installing dependencies manually..."
        npm install --workspace=packages/backend
        npm install --workspace=packages/web
        npm install --workspace=packages/shared
    }
    
    print_success "Dependencies installed"
}

# Function to setup database
setup_database() {
    print_status "Setting up database..."
    
    # Set environment variables for backend
    export NODE_ENV=test
    export PORT=$BACKEND_PORT
    
    # Run migrations
    cd packages/backend
    npm run db:migrate 2>/dev/null || {
        print_warning "Migration failed, creating database schema manually..."
        # Create basic tables if migrations fail
        node -e "
        const knex = require('knex')(require('./knexfile.js').test);
        knex.schema.hasTable('users').then(exists => {
            if (!exists) {
                console.log('Creating basic schema...');
                return knex.schema.createTable('users', table => {
                    table.increments('id').primary();
                    table.string('email').unique().notNullable();
                    table.string('name').notNullable();
                    table.timestamps(true, true);
                });
            }
        }).then(() => knex.destroy()).catch(console.error);
        " 2>/dev/null || true
    }
    
    # Run seeds
    npm run db:seed 2>/dev/null || {
        print_warning "Seeding failed, will use demo data"
    }
    
    cd ../..
    print_success "Database setup completed"
}

# Function to start backend
start_backend() {
    print_status "Starting backend service..."
    
    # Set environment variables
    export NODE_ENV=test
    export PORT=$BACKEND_PORT
    export JWT_SECRET="test-jwt-secret-key"
    export OPENAI_API_KEY="test-key"
    export AWS_ACCESS_KEY_ID="test"
    export AWS_SECRET_ACCESS_KEY="test"
    export AWS_REGION="us-east-1"
    export S3_BUCKET="test-bucket"
    
    # Start backend in background
    cd packages/backend
    npm run dev > ../../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../../.backend.pid
    cd ../..
    
    # Wait for backend to be ready
    if wait_for_service "http://localhost:$BACKEND_PORT/health" "Backend API" 60; then
        print_success "Backend started successfully (PID: $BACKEND_PID)"
    else
        print_error "Backend failed to start"
        return 1
    fi
}

# Function to start frontend
start_frontend() {
    print_status "Starting frontend service..."
    
    # Set environment variables
    export NODE_ENV=development
    export PORT=$WEB_PORT
    export NEXT_PUBLIC_API_URL="http://localhost:$BACKEND_PORT"
    
    # Start frontend in background
    cd packages/web
    npm run dev > ../../logs/web.log 2>&1 &
    WEB_PID=$!
    echo $WEB_PID > ../../.web.pid
    cd ../..
    
    # Wait for frontend to be ready
    if wait_for_service "http://localhost:$WEB_PORT" "Frontend" 60; then
        print_success "Frontend started successfully (PID: $WEB_PID)"
    else
        print_error "Frontend failed to start"
        return 1
    fi
}

# Function to run health checks
run_health_checks() {
    print_status "Running health checks..."
    
    local services=(
        "http://localhost:$BACKEND_PORT/health|Backend API"
        "http://localhost:$WEB_PORT|Frontend"
    )
    
    for service in "${services[@]}"; do
        IFS='|' read -r url name <<< "$service"
        
        if curl -f -s "$url" >/dev/null 2>&1; then
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
    print_success "Native test environment is ready! 🚀"
    echo ""
    echo "📋 Environment Information:"
    echo "=========================="
    echo ""
    echo "🌐 URLs:"
    echo "   Frontend:    http://localhost:$WEB_PORT"
    echo "   Backend API: http://localhost:$BACKEND_PORT"
    echo ""
    echo "🗄️  Database:"
    if [[ "$DATABASE_URL" == sqlite* ]]; then
        echo "   Type: SQLite (file: ./test.db)"
    else
        echo "   URL: $DATABASE_URL"
    fi
    echo ""
    echo "🔴 Cache:"
    if [[ "$USE_MEMORY_CACHE" == "true" ]]; then
        echo "   Type: In-memory cache"
    else
        echo "   URL: $REDIS_URL"
    fi
    echo ""
    echo "📊 Health Checks:"
    echo "   Backend:  http://localhost:$BACKEND_PORT/health"
    echo "   Frontend: http://localhost:$WEB_PORT"
    echo ""
    echo "🧪 Demo Credentials:"
    echo "   Email: demo@saga.app"
    echo "   Password: any password"
    echo ""
    echo "📝 Useful Commands:"
    echo "   View backend logs:  tail -f logs/backend.log"
    echo "   View frontend logs: tail -f logs/web.log"
    echo "   Stop services:      $0 stop"
    echo "   Run tests:          npm test"
    echo ""
    echo "📁 Log Files:"
    echo "   Backend:  logs/backend.log"
    echo "   Frontend: logs/web.log"
    echo ""
}

# Function to stop services
stop_services() {
    print_status "Stopping services..."
    
    # Stop backend
    if [ -f .backend.pid ]; then
        BACKEND_PID=$(cat .backend.pid)
        if kill -0 $BACKEND_PID 2>/dev/null; then
            kill $BACKEND_PID
            print_success "Backend stopped (PID: $BACKEND_PID)"
        fi
        rm -f .backend.pid
    fi
    
    # Stop frontend
    if [ -f .web.pid ]; then
        WEB_PID=$(cat .web.pid)
        if kill -0 $WEB_PID 2>/dev/null; then
            kill $WEB_PID
            print_success "Frontend stopped (PID: $WEB_PID)"
        fi
        rm -f .web.pid
    fi
    
    # Clean up any remaining processes
    pkill -f "packages/backend" 2>/dev/null || true
    pkill -f "packages/web" 2>/dev/null || true
    
    print_success "All services stopped"
}

# Function to show logs
show_logs() {
    print_status "Showing logs..."
    
    if [ -f logs/backend.log ] && [ -f logs/web.log ]; then
        tail -f logs/backend.log logs/web.log
    elif [ -f logs/backend.log ]; then
        tail -f logs/backend.log
    elif [ -f logs/web.log ]; then
        tail -f logs/web.log
    else
        print_warning "No log files found"
    fi
}

# Function to run tests
run_tests() {
    print_status "Running test suite..."
    
    # Run backend tests
    cd packages/backend
    npm test
    cd ../..
    
    # Run frontend tests
    cd packages/web
    npm test
    cd ../..
    
    print_success "Test suite completed"
}

# Function to clean up
cleanup() {
    print_status "Cleaning up..."
    
    # Remove log files
    rm -rf logs/
    
    # Remove PID files
    rm -f .backend.pid .web.pid
    
    # Remove test database
    rm -f test.db
    
    print_success "Cleanup completed"
}

# Main function
main() {
    local command="${1:-start}"
    
    # Create logs directory
    mkdir -p logs
    
    case "$command" in
        "start")
            print_status "Starting Saga native test environment..."
            check_dependencies
            setup_postgres
            setup_redis
            check_ports
            install_dependencies
            setup_database
            start_backend
            start_frontend
            run_health_checks
            show_environment_info
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            sleep 2
            main start
            ;;
        "test")
            run_tests
            ;;
        "logs")
            show_logs
            ;;
        "clean")
            stop_services
            cleanup
            ;;
        "health")
            run_health_checks
            ;;
        "info")
            show_environment_info
            ;;
        "help"|*)
            echo "Saga Native Test Environment Management Script"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  start     Start the native test environment (default)"
            echo "  stop      Stop the test environment"
            echo "  restart   Restart the test environment"
            echo "  test      Run the test suite"
            echo "  logs      Show logs for all services"
            echo "  clean     Clean up files and stop services"
            echo "  health    Run health checks"
            echo "  info      Show environment information"
            echo "  help      Show this help message"
            echo ""
            echo "This script runs the test environment without Docker dependencies."
            echo "It will use local PostgreSQL/Redis if available, or fallback to SQLite/memory cache."
            echo ""
            ;;
    esac
}

# Trap to cleanup on exit
trap 'stop_services' EXIT INT TERM

# Run main function with all arguments
main "$@"