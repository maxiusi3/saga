#!/bin/bash

# Saga Production Deployment Script
set -e

echo "🚀 Saga Production Deployment"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Please do not run as root${NC}"
   exit 1
fi

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Check environment file
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}⚠️  .env.production not found${NC}"
    echo "Creating from template..."
    
    cat > .env.production << 'EOF'
# Database
DATABASE_URL=postgresql://user:password@host:5432/saga_production

# JWT
JWT_SECRET=CHANGE_THIS_TO_STRONG_RANDOM_KEY
JWT_EXPIRES_IN=7d

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Frontend
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF
    
    echo -e "${YELLOW}⚠️  Please edit .env.production with your values${NC}"
    echo "Press Enter when ready to continue..."
    read
fi

# Load environment variables
set -a
source .env.production
set +a

# Validate critical environment variables
echo "🔐 Validating environment variables..."

if [ "$JWT_SECRET" = "CHANGE_THIS_TO_STRONG_RANDOM_KEY" ]; then
    echo -e "${RED}❌ Please change JWT_SECRET in .env.production${NC}"
    exit 1
fi

if [[ "$DATABASE_URL" == *"user:password@host"* ]]; then
    echo -e "${RED}❌ Please configure DATABASE_URL in .env.production${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables validated${NC}"
echo ""

# Ask for confirmation
echo "📋 Deployment Summary:"
echo "  Frontend URL: $FRONTEND_URL"
echo "  Backend URL: $NEXT_PUBLIC_API_URL"
echo "  Environment: production"
echo ""
read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Stop existing containers
echo ""
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.production.yml down 2>/dev/null || true

# Build images
echo ""
echo "🏗️  Building Docker images..."
docker-compose -f docker-compose.production.yml build --no-cache

# Start services
echo ""
echo "🚀 Starting services..."
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo ""
echo "🔍 Checking service health..."

# Check backend
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    echo "Showing backend logs:"
    docker-compose -f docker-compose.production.yml logs backend
    exit 1
fi

# Check frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend may still be starting...${NC}"
fi

# Run database migrations
echo ""
echo "📊 Running database migrations..."
docker-compose -f docker-compose.production.yml exec -T backend npm run migrate:latest

# Show deployment status
echo ""
echo "📊 Deployment Status:"
docker-compose -f docker-compose.production.yml ps

# Show logs
echo ""
echo "📋 Recent logs:"
docker-compose -f docker-compose.production.yml logs --tail=20

# Success message
echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "🌐 Access your application:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:3001"
echo "  Health Check: http://localhost:3001/health"
echo ""
echo "📝 Useful commands:"
echo "  View logs: docker-compose -f docker-compose.production.yml logs -f"
echo "  Stop services: docker-compose -f docker-compose.production.yml down"
echo "  Restart services: docker-compose -f docker-compose.production.yml restart"
echo "  Check status: docker-compose -f docker-compose.production.yml ps"
echo ""
echo "🔒 Security reminders:"
echo "  - Configure SSL/HTTPS"
echo "  - Set up firewall rules"
echo "  - Enable monitoring"
echo "  - Configure backups"
echo ""
