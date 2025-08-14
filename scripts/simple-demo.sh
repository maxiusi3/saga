#!/bin/bash

# Simple Saga Demo - Just the API server with demo data
# This script starts only the demo API server for quick testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEMO_PORT=3005

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

# Function to check if port is available
is_port_available() {
    ! lsof -i :$1 >/dev/null 2>&1
}

# Function to find available port
find_available_port() {
    local start_port=$1
    local port=$start_port
    
    while [ $port -lt $((start_port + 100)) ]; do
        if is_port_available $port; then
            echo $port
            return 0
        fi
        port=$((port + 1))
    done
    
    print_error "Could not find available port starting from $start_port"
    return 1
}

# Function to check dependencies
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node >/dev/null 2>&1; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    if ! command -v npm >/dev/null 2>&1; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Function to find available port
find_demo_port() {
    print_status "Finding available port..."
    
    if ! is_port_available $DEMO_PORT; then
        print_warning "Port $DEMO_PORT is in use, finding alternative..."
        DEMO_PORT=$(find_available_port 3005)
        if [ $? -ne 0 ]; then
            exit 1
        fi
        print_status "Using demo port: $DEMO_PORT"
    fi
    
    print_success "Port assigned: $DEMO_PORT"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing backend dependencies..."
    
    cd packages/backend
    npm install >/dev/null 2>&1
    cd ../..
    
    print_success "Dependencies installed"
}

# Function to start demo server
start_demo_server() {
    print_status "Starting demo API server..."
    
    # Create logs directory
    mkdir -p logs
    
    # Start demo server
    cd packages/backend
    PORT=$DEMO_PORT npx ts-node src/demo-server.ts > ../../logs/simple-demo.log 2>&1 &
    DEMO_PID=$!
    echo $DEMO_PID > ../../.simple-demo.pid
    cd ../..
    
    # Wait for demo server to be ready
    print_status "Waiting for demo server to start..."
    for i in {1..30}; do
        if curl -f -s "http://localhost:$DEMO_PORT/health" >/dev/null 2>&1; then
            print_success "Demo server started successfully (PID: $DEMO_PID)"
            return 0
        fi
        if [ $i -eq 30 ]; then
            print_error "Demo server failed to start after 30 attempts"
            print_status "Check logs/simple-demo.log for details"
            return 1
        fi
        sleep 2
    done
}

# Function to test API endpoints
test_api_endpoints() {
    print_status "Testing API endpoints..."
    
    # Test health endpoint
    if curl -f -s "http://localhost:$DEMO_PORT/health" >/dev/null 2>&1; then
        print_success "Health endpoint working"
    else
        print_warning "Health endpoint may have issues"
    fi
    
    # Test auth endpoint
    if curl -f -s "http://localhost:$DEMO_PORT/api/auth/signin" \
       -X POST \
       -H "Content-Type: application/json" \
       -d '{"email":"demo@saga.app","password":"test"}' >/dev/null 2>&1; then
        print_success "Auth endpoint working"
    else
        print_warning "Auth endpoint may have issues"
    fi
    
    print_success "API endpoints tested"
}

# Function to show demo info
show_demo_info() {
    print_success "Simple Saga Demo API is ready! 🚀"
    echo ""
    echo "📋 Demo API Information:"
    echo "======================="
    echo ""
    echo "🌐 API Server:"
    echo "   URL: http://localhost:$DEMO_PORT"
    echo "   Health: http://localhost:$DEMO_PORT/health"
    echo ""
    echo "🧪 Demo Credentials:"
    echo "   Email: demo@saga.app"
    echo "   Password: any password (demo mode)"
    echo ""
    echo "📊 Available Endpoints:"
    echo "   POST /api/auth/signin    - Sign in"
    echo "   POST /api/auth/signup    - Sign up"
    echo "   GET  /api/projects       - Get projects"
    echo "   POST /api/projects       - Create project"
    echo "   GET  /api/stories        - Get stories"
    echo "   POST /api/stories        - Create story"
    echo ""
    echo "💾 Data Storage:"
    echo "   Type: In-memory (demo data only)"
    echo "   Note: All data will be lost when the server restarts"
    echo ""
    echo "📝 Useful Commands:"
    echo "   View logs:    tail -f logs/simple-demo.log"
    echo "   Stop demo:    $0 stop"
    echo "   Test API:     curl http://localhost:$DEMO_PORT/health"
    echo ""
    echo "🧪 Quick Test:"
    echo "   curl -X POST http://localhost:$DEMO_PORT/api/auth/signin \\"
    echo "        -H 'Content-Type: application/json' \\"
    echo "        -d '{\"email\":\"demo@saga.app\",\"password\":\"test\"}'"
    echo ""
    echo "🎯 Next Steps:"
    echo "   • Use this API with your frontend application"
    echo "   • Set NEXT_PUBLIC_API_URL=http://localhost:$DEMO_PORT"
    echo "   • Or test endpoints directly with curl/Postman"
    echo ""
}

# Function to stop services
stop_services() {
    print_status "Stopping demo server..."
    
    # Stop demo server
    if [ -f .simple-demo.pid ]; then
        DEMO_PID=$(cat .simple-demo.pid)
        if kill -0 $DEMO_PID 2>/dev/null; then
            kill $DEMO_PID
            print_success "Demo server stopped (PID: $DEMO_PID)"
        fi
        rm -f .simple-demo.pid
    fi
    
    # Clean up any remaining processes
    pkill -f "demo-server" 2>/dev/null || true
    
    print_success "Demo server stopped"
}

# Function to show logs
show_logs() {
    print_status "Showing demo logs..."
    
    if [ -f logs/simple-demo.log ]; then
        tail -f logs/simple-demo.log
    else
        print_warning "No log file found"
    fi
}

# Function to clean up
cleanup() {
    print_status "Cleaning up demo environment..."
    
    # Remove log files
    rm -rf logs/
    
    # Remove PID files
    rm -f .simple-demo.pid
    
    print_success "Cleanup completed"
}

# Main function
main() {
    local command="${1:-start}"
    
    case "$command" in
        "start")
            print_status "Starting simple Saga demo API..."
            check_dependencies
            find_demo_port
            install_dependencies
            start_demo_server
            test_api_endpoints
            show_demo_info
            
            # Keep the server running
            print_status "Demo server is running. Press Ctrl+C to stop."
            wait
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            sleep 2
            main start
            ;;
        "logs")
            show_logs
            ;;
        "clean")
            stop_services
            cleanup
            ;;
        "test")
            if [ -f .simple-demo.pid ]; then
                test_api_endpoints
            else
                print_error "Demo server is not running. Start it first with: $0 start"
            fi
            ;;
        "help"|*)
            echo "Simple Saga Demo API Management Script"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  start     Start the demo API server (default)"
            echo "  stop      Stop the demo API server"
            echo "  restart   Restart the demo API server"
            echo "  logs      Show logs for the demo server"
            echo "  test      Test API endpoints"
            echo "  clean     Clean up files and stop services"
            echo "  help      Show this help message"
            echo ""
            echo "This script runs a lightweight demo API server with:"
            echo "• In-memory data storage (no database required)"
            echo "• Pre-loaded demo data"
            echo "• No Docker dependencies"
            echo "• Full REST API functionality"
            echo "• Perfect for frontend development and testing"
            echo ""
            ;;
    esac
}

# Trap to cleanup on exit
trap 'stop_services' EXIT INT TERM

# Run main function with all arguments
main "$@"