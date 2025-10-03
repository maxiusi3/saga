#!/bin/bash

echo "🚀 Starting Saga Backend Server..."
echo ""

# Navigate to backend directory
cd packages/backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Check if database exists
if [ ! -f "dev.sqlite3" ]; then
  echo "🗄️  Running database migrations..."
  npm run migrate
  
  echo "🌱 Seeding database..."
  npx knex seed:run
fi

# Start the server
echo "🎯 Starting backend server on port 3001..."
echo "📊 Dashboard will be available at http://localhost:3000"
echo "🔌 API will be available at http://localhost:3001/api"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
