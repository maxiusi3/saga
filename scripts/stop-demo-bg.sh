#!/bin/bash

# Stop Saga Demo API running in background

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
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

print_status "Stopping Saga Demo API..."

# Stop demo server
if [ -f .demo-bg.pid ]; then
    DEMO_PID=$(cat .demo-bg.pid)
    if kill -0 $DEMO_PID 2>/dev/null; then
        kill $DEMO_PID
        print_success "Demo server stopped (PID: $DEMO_PID)"
    else
        print_status "Demo server was not running (PID: $DEMO_PID)"
    fi
    rm -f .demo-bg.pid
else
    print_status "No PID file found, checking for demo-server processes..."
    # Try to kill any demo-server processes
    pkill -f "demo-server" 2>/dev/null && print_success "Stopped demo-server processes" || print_status "No demo-server processes found"
fi

print_success "Demo API stopped"