#!/bin/bash

echo "🔄 Restarting Saga Backend..."

# Kill any process using port 3001
echo "📍 Checking for processes on port 3001..."
PIDS=$(lsof -ti:3001)
if [ ! -z "$PIDS" ]; then
  echo "🔪 Killing processes: $PIDS"
  kill -9 $PIDS 2>/dev/null
  sleep 1
else
  echo "✅ Port 3001 is free"
fi

# Kill any tsx watch processes
echo "🔪 Killing any existing tsx watch processes..."
pkill -f "tsx watch" 2>/dev/null
sleep 1

# Navigate to backend directory and start
echo "🚀 Starting backend server..."
cd packages/backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Start the backend
echo "▶️  Running npm run dev..."
npm run dev

echo "✅ Backend startup script completed"
