#!/bin/bash

# Start development servers with timeout protection
set -e

echo "🚀 Starting Saga development servers..."

# Function to cleanup processes on exit
cleanup() {
    echo "🛑 Stopping servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$WEB_PID" ]; then
        kill $WEB_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend server in background
echo "📡 Starting backend server..."
cd packages/backend
npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend is still running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend server failed to start"
    exit 1
fi

echo "✅ Backend server started (PID: $BACKEND_PID)"

# Start web server in background
echo "🌐 Starting web server..."
cd ../web
npm run dev &
WEB_PID=$!

# Wait a moment for web to start
sleep 3

# Check if web is still running
if ! kill -0 $WEB_PID 2>/dev/null; then
    echo "❌ Web server failed to start"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Web server started (PID: $WEB_PID)"

echo ""
echo "🎉 Development servers are running:"
echo "   Backend: http://localhost:3001"
echo "   Web:     http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user to stop
wait