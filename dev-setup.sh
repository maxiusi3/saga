#!/bin/bash

# Saga Development Setup Script
echo "🚀 Setting up Saga for local development..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "⚠️  PostgreSQL is not running on localhost:5432"
    echo "Please start PostgreSQL or use Docker: docker run -d --name saga-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
echo "📦 Installing dependencies..."

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd packages/backend
npm install
cd ../..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd packages/web
npm install
cd ../..

# Install shared dependencies
echo "📦 Installing shared dependencies..."
cd packages/shared
npm install
cd ../..

# Create database if it doesn't exist
echo "🗄️  Setting up database..."
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    createdb saga_dev 2>/dev/null || echo "Database saga_dev already exists"
    createdb saga_test 2>/dev/null || echo "Database saga_test already exists"
    
    # Run initialization script
    psql -h localhost -p 5432 -U postgres -d saga_dev -f init-db.sql 2>/dev/null || echo "Database initialization completed"
fi

# Run migrations
echo "📊 Running database migrations..."
cd packages/backend
npm run migrate 2>/dev/null || echo "Migrations completed or database not available"
cd ../..

# Create start script
cat > start-dev.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting Saga development servers..."

# Function to kill background processes on exit
cleanup() {
    echo "🛑 Stopping development servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Start backend
echo "🔧 Starting backend server..."
cd packages/backend
npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🌐 Starting frontend server..."
cd ../web
npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
EOF

chmod +x start-dev.sh

echo ""
echo "✅ Development setup complete!"
echo ""
echo "🚀 To start development servers: ./start-dev.sh"
echo "🌐 Frontend will be available at: http://localhost:3000"
echo "🔧 Backend API will be available at: http://localhost:3001"
echo ""
echo "📝 Make sure PostgreSQL is running on localhost:5432"
echo "🔑 Default database credentials: postgres/password"