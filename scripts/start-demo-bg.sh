#!/bin/bash

# Start Saga Demo API in background
# This script starts the demo server and keeps it running in the background

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEMO_PORT=3005

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
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

# Find available port
if ! is_port_available $DEMO_PORT; then
    print_status "Port $DEMO_PORT is in use, finding alternative..."
    DEMO_PORT=$(find_available_port 3005)
    if [ $? -ne 0 ]; then
        exit 1
    fi
fi

print_status "Starting Saga Demo API on port $DEMO_PORT..."

# Create logs directory
mkdir -p logs

# Start demo server in background
cd packages/backend
PORT=$DEMO_PORT nohup npx ts-node src/demo-server.ts > ../../logs/demo-bg.log 2>&1 &
DEMO_PID=$!
echo $DEMO_PID > ../../.demo-bg.pid
cd ../..

# Wait a moment for startup
sleep 5

# Test if server is running
if curl -f -s "http://localhost:$DEMO_PORT/health" >/dev/null 2>&1; then
    print_success "Demo API started successfully! 🚀"
    echo ""
    echo "📋 Demo API Information:"
    echo "======================="
    echo ""
    echo "🌐 API Server:"
    echo "   URL: http://localhost:$DEMO_PORT"
    echo "   Health: http://localhost:$DEMO_PORT/health"
    echo "   PID: $DEMO_PID"
    echo ""
    echo "🧪 Demo Credentials:"
    echo "   Email: demo@saga.app"
    echo "   Password: any password (demo mode)"
    echo ""
    echo "📝 Useful Commands:"
    echo "   Test API:     curl http://localhost:$DEMO_PORT/health"
    echo "   View logs:    tail -f logs/demo-bg.log"
    echo "   Stop demo:    kill $DEMO_PID"
    echo "   Or use:       ./scripts/stop-demo-bg.sh"
    echo ""
    echo "🎯 The server is now running in the background!"
    echo "   You can close this terminal and the server will keep running."
else
    print_error "Failed to start demo server"
    # Clean up PID file if startup failed
    rm -f .demo-bg.pid
    exit 1
fi