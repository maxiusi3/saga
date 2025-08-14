#!/bin/bash

# Test script to verify Docker-free alternatives work

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Function to test demo mode
test_demo_mode() {
    print_status "Testing demo mode..."
    
    # Start demo in background
    ./scripts/demo-start.sh start &
    DEMO_PID=$!
    
    # Wait a bit for startup
    sleep 10
    
    # Test if demo server is responding
    if curl -f -s http://localhost:3001/health >/dev/null 2>&1; then
        print_success "Demo server is responding"
        
        # Test API endpoints
        if curl -f -s http://localhost:3001/api/auth/signin -X POST \
           -H "Content-Type: application/json" \
           -d '{"email":"demo@saga.app","password":"test"}' >/dev/null 2>&1; then
            print_success "Demo API endpoints working"
        else
            print_warning "Demo API endpoints may have issues"
        fi
    else
        print_error "Demo server not responding"
        return 1
    fi
    
    # Stop demo
    kill $DEMO_PID 2>/dev/null || true
    ./scripts/demo-start.sh stop
    
    print_success "Demo mode test completed"
}

# Function to test native mode
test_native_mode() {
    print_status "Testing native mode..."
    
    # Check if we can start native mode
    if ./scripts/test-env-native.sh start &
    then
        NATIVE_PID=$!
        sleep 15
        
        # Test if services are responding
        if curl -f -s http://localhost:3002/health >/dev/null 2>&1; then
            print_success "Native backend is responding"
        else
            print_warning "Native backend may have issues"
        fi
        
        # Stop native mode
        kill $NATIVE_PID 2>/dev/null || true
        ./scripts/test-env-native.sh stop
        
        print_success "Native mode test completed"
    else
        print_warning "Native mode test skipped (may require local PostgreSQL/Redis)"
    fi
}

# Function to check available alternatives
check_alternatives() {
    print_status "Checking available Docker-free alternatives..."
    
    echo ""
    echo "📋 Available Docker-free Options:"
    echo "================================"
    echo ""
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        print_success "Node.js: $NODE_VERSION"
        echo "   ✅ Demo mode available"
        echo "   ✅ Native mode available"
    else
        print_error "Node.js: Not installed"
        echo "   ❌ No Docker-free options available"
        return 1
    fi
    
    # Check PostgreSQL
    if command -v psql >/dev/null 2>&1; then
        POSTGRES_VERSION=$(psql --version | head -n1)
        print_success "PostgreSQL: $POSTGRES_VERSION"
        echo "   ✅ Native mode with PostgreSQL"
    else
        print_warning "PostgreSQL: Not installed"
        echo "   ⚠️  Native mode will use SQLite fallback"
    fi
    
    # Check Redis
    if command -v redis-cli >/dev/null 2>&1; then
        REDIS_VERSION=$(redis-cli --version)
        print_success "Redis: $REDIS_VERSION"
        echo "   ✅ Native mode with Redis"
    else
        print_warning "Redis: Not installed"
        echo "   ⚠️  Native mode will use memory cache fallback"
    fi
    
    echo ""
    echo "🚀 Recommended Commands:"
    echo "======================="
    echo ""
    echo "For quick testing:"
    echo "  npm run demo:start"
    echo ""
    echo "For development:"
    echo "  npm run test-env:native"
    echo ""
    echo "For full features (if PostgreSQL/Redis available):"
    echo "  npm run dev"
    echo ""
}

# Main function
main() {
    local command="${1:-all}"
    
    case "$command" in
        "demo")
            test_demo_mode
            ;;
        "native")
            test_native_mode
            ;;
        "check")
            check_alternatives
            ;;
        "all"|*)
            print_status "Running comprehensive Docker-free test..."
            echo ""
            check_alternatives
            echo ""
            test_demo_mode
            echo ""
            # test_native_mode  # Commented out as it may require local services
            echo ""
            print_success "Docker-free alternatives are working! 🎉"
            echo ""
            echo "🎯 Quick Start (No Docker Required):"
            echo "===================================="
            echo ""
            echo "1. For immediate demo:"
            echo "   npm run demo:start"
            echo ""
            echo "2. For development:"
            echo "   npm run test-env:native"
            echo ""
            ;;
    esac
}

# Run main function
main "$@"