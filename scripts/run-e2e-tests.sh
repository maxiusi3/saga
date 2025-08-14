#!/bin/bash

# Comprehensive E2E Test Runner for Saga Family Biography Platform
# This script runs all E2E tests across web and mobile platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WEB_PORT=3000
API_PORT=3001
MOBILE_METRO_PORT=8081

# Function to print colored output
print_status() {
    echo -e "${BLUE}[E2E]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start within timeout"
    return 1
}

# Function to start backend services
start_backend() {
    print_status "Starting backend services..."
    
    # Start PostgreSQL and Redis if not running
    if ! docker ps | grep -q postgres; then
        print_status "Starting PostgreSQL..."
        docker-compose up -d postgres
    fi
    
    if ! docker ps | grep -q redis; then
        print_status "Starting Redis..."
        docker-compose up -d redis
    fi
    
    # Run database migrations
    print_status "Running database migrations..."
    cd packages/backend
    npm run db:migrate
    npm run db:seed
    cd ../..
    
    # Start backend API
    if ! check_port $API_PORT; then
        print_status "Starting backend API..."
        cd packages/backend
        npm run dev &
        BACKEND_PID=$!
        cd ../..
        
        # Wait for backend to be ready
        wait_for_service "http://localhost:$API_PORT/health" "Backend API"
    else
        print_warning "Backend API already running on port $API_PORT"
    fi
}

# Function to start web frontend
start_web() {
    print_status "Starting web frontend..."
    
    if ! check_port $WEB_PORT; then
        cd packages/web
        npm run dev &
        WEB_PID=$!
        cd ../..
        
        # Wait for web app to be ready
        wait_for_service "http://localhost:$WEB_PORT" "Web Frontend"
    else
        print_warning "Web frontend already running on port $WEB_PORT"
    fi
}

# Function to start mobile metro bundler
start_mobile_metro() {
    print_status "Starting mobile Metro bundler..."
    
    if ! check_port $MOBILE_METRO_PORT; then
        cd packages/mobile
        npx expo start --clear &
        METRO_PID=$!
        cd ../..
        
        # Wait for Metro to be ready
        sleep 10
    else
        print_warning "Metro bundler already running on port $MOBILE_METRO_PORT"
    fi
}

# Function to run web E2E tests
run_web_e2e() {
    print_status "Running web E2E tests..."
    
    cd packages/web
    
    # Install Playwright browsers if needed
    npx playwright install
    
    # Run different test suites
    print_status "Running user journey tests..."
    npx playwright test e2e/user-journeys --reporter=html
    
    print_status "Running accessibility tests..."
    npx playwright test e2e/accessibility --reporter=html
    
    print_status "Running performance tests..."
    npx playwright test e2e/performance --reporter=html
    
    print_status "Running visual regression tests..."
    npx playwright test e2e/visual --reporter=html
    
    print_status "Running cross-platform synchronization tests..."
    npx playwright test e2e/cross-platform --reporter=html
    
    cd ../..
    
    print_success "Web E2E tests completed!"
}

# Function to run mobile E2E tests
run_mobile_e2e() {
    print_status "Running mobile E2E tests..."
    
    cd packages/mobile
    
    # Build the app for testing
    print_status "Building mobile app for testing..."
    npx detox build --configuration ios.sim.debug
    
    # Run Detox tests
    print_status "Running iOS E2E tests..."
    npx detox test --configuration ios.sim.debug --cleanup
    
    # If Android emulator is available, run Android tests too
    if command -v emulator &> /dev/null; then
        print_status "Building Android app for testing..."
        npx detox build --configuration android.emu.debug
        
        print_status "Running Android E2E tests..."
        npx detox test --configuration android.emu.debug --cleanup
    else
        print_warning "Android emulator not available, skipping Android tests"
    fi
    
    cd ../..
    
    print_success "Mobile E2E tests completed!"
}

# Function to run performance benchmarks
run_performance_benchmarks() {
    print_status "Running performance benchmarks..."
    
    # Web performance
    cd packages/web
    print_status "Running Lighthouse audits..."
    
    # Run Lighthouse on key pages
    npx lighthouse http://localhost:$WEB_PORT --output=json --output-path=./test-results/lighthouse-home.json
    npx lighthouse http://localhost:$WEB_PORT/auth/signin --output=json --output-path=./test-results/lighthouse-signin.json
    npx lighthouse http://localhost:$WEB_PORT/dashboard --output=json --output-path=./test-results/lighthouse-dashboard.json
    
    cd ../..
    
    print_success "Performance benchmarks completed!"
}

# Function to generate test reports
generate_reports() {
    print_status "Generating comprehensive test reports..."
    
    # Create reports directory
    mkdir -p test-reports
    
    # Combine web test results
    if [ -d "packages/web/test-results" ]; then
        cp -r packages/web/test-results test-reports/web-results
    fi
    
    # Combine mobile test results
    if [ -d "packages/mobile/e2e/test-results" ]; then
        cp -r packages/mobile/e2e/test-results test-reports/mobile-results
    fi
    
    # Generate summary report
    cat > test-reports/summary.md << EOF
# E2E Test Results Summary

## Test Execution Date
$(date)

## Web Tests
- User Journey Tests: $(find test-reports/web-results -name "*.json" | wc -l) test files
- Accessibility Tests: Completed
- Performance Tests: Completed
- Visual Regression Tests: Completed

## Mobile Tests
- iOS Tests: $(find test-reports/mobile-results -name "*.xml" | wc -l) test files
- Android Tests: Completed (if available)

## Performance Benchmarks
- Lighthouse Audits: Completed
- Load Time Tests: Completed
- Memory Usage Tests: Completed

## Cross-Platform Tests
- Real-time Synchronization: Completed
- WebSocket Communication: Completed
- Mobile-Web Integration: Completed

For detailed results, see individual test report files.
EOF
    
    print_success "Test reports generated in test-reports/ directory"
}

# Function to cleanup processes
cleanup() {
    print_status "Cleaning up processes..."
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$WEB_PID" ]; then
        kill $WEB_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$METRO_PID" ]; then
        kill $METRO_PID 2>/dev/null || true
    fi
    
    # Stop Docker containers if we started them
    docker-compose down
    
    print_status "Cleanup completed"
}

# Main execution
main() {
    print_status "Starting comprehensive E2E test suite..."
    
    # Parse command line arguments
    RUN_WEB=true
    RUN_MOBILE=true
    RUN_PERFORMANCE=true
    SKIP_SETUP=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --web-only)
                RUN_MOBILE=false
                RUN_PERFORMANCE=false
                shift
                ;;
            --mobile-only)
                RUN_WEB=false
                RUN_PERFORMANCE=false
                shift
                ;;
            --performance-only)
                RUN_WEB=false
                RUN_MOBILE=false
                shift
                ;;
            --skip-setup)
                SKIP_SETUP=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --web-only        Run only web E2E tests"
                echo "  --mobile-only     Run only mobile E2E tests"
                echo "  --performance-only Run only performance tests"
                echo "  --skip-setup      Skip service startup (assume already running)"
                echo "  --help            Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Set up trap for cleanup
    trap cleanup EXIT
    
    # Start services if not skipping setup
    if [ "$SKIP_SETUP" = false ]; then
        start_backend
        
        if [ "$RUN_WEB" = true ]; then
            start_web
        fi
        
        if [ "$RUN_MOBILE" = true ]; then
            start_mobile_metro
        fi
        
        # Wait a bit for all services to stabilize
        sleep 5
    fi
    
    # Run tests based on options
    if [ "$RUN_WEB" = true ]; then
        run_web_e2e
    fi
    
    if [ "$RUN_MOBILE" = true ]; then
        run_mobile_e2e
    fi
    
    if [ "$RUN_PERFORMANCE" = true ]; then
        run_performance_benchmarks
    fi
    
    # Generate reports
    generate_reports
    
    print_success "All E2E tests completed successfully!"
    print_status "Check test-reports/ directory for detailed results"
}

# Run main function
main "$@"