#!/bin/bash

# Setup Test Environment for Saga Family Biography
# Prepares everything needed for comprehensive testing

set -e

echo "🔧 Setting up Test Environment for Saga Family Biography"
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

# Create test environment file if it doesn't exist
setup_test_env() {
    log_info "Setting up test environment variables..."
    
    if [ ! -f "packages/backend/.env.test" ]; then
        cat > packages/backend/.env.test << EOF
# Test Environment Configuration
NODE_ENV=test
PORT=3001

# Test Database
DATABASE_URL=sqlite:./test.db

# Authentication
JWT_SECRET=test-jwt-secret-key-for-testing-only
JWT_EXPIRES_IN=24h

# Firebase (Test Configuration)
FIREBASE_PROJECT_ID=saga-test-project
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTEST_PRIVATE_KEY\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=test@saga-test-project.iam.gserviceaccount.com

# OpenAI (Test Configuration)
OPENAI_API_KEY=sk-test-key-for-testing
OPENAI_MODEL=gpt-3.5-turbo

# AWS S3 (Test Configuration)
AWS_ACCESS_KEY_ID=test-access-key
AWS_SECRET_ACCESS_KEY=test-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=saga-test-bucket

# Stripe (Test Configuration)
STRIPE_SECRET_KEY=sk_test_test_key
STRIPE_WEBHOOK_SECRET=whsec_test_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_test_test_key

# SendGrid (Test Configuration)
SENDGRID_API_KEY=SG.test-api-key
FROM_EMAIL=test@saga-app.com

# Speech-to-Text (Test Configuration)
SPEECH_TO_TEXT_API_KEY=test-stt-api-key
SPEECH_TO_TEXT_PROVIDER=mock

# Redis (Test Configuration)
REDIS_URL=redis://localhost:6379/1

# Webhook URLs
WEBHOOK_BASE_URL=http://localhost:3001

# File Upload Limits
MAX_FILE_SIZE=52428800
MAX_AUDIO_DURATION=600

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=info
EOF
        log_success "Created test environment file"
    else
        log_info "Test environment file already exists"
    fi
}

# Setup test database
setup_test_database() {
    log_info "Setting up test database..."
    
    cd packages/backend
    
    # Remove existing test database
    if [ -f "test.db" ]; then
        rm test.db
        log_info "Removed existing test database"
    fi
    
    # Run migrations
    log_info "Running database migrations..."
    NODE_ENV=test npm run --workspace=@saga/backend db:migrate
    
    # Run seeds
    log_info "Seeding test database..."
    NODE_ENV=test npm run --workspace=@saga/backend db:seed
    
    cd ../..
    log_success "Test database setup complete"
}

# Install all dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Root dependencies
    log_info "Installing root dependencies..."
    npm install
    
    # Backend dependencies
    log_info "Installing backend dependencies..."
    cd packages/backend && npm install && cd ../..
    
    # Web dependencies
    log_info "Installing web dependencies..."
    cd packages/web && npm install && cd ../..
    
    # Mobile dependencies
    log_info "Installing mobile dependencies..."
    cd packages/mobile && npm install && cd ../..
    
    # Shared dependencies
    log_info "Installing shared dependencies..."
    cd packages/shared && npm install && cd ../..
    
    log_success "All dependencies installed"
}

# Build shared package
build_shared() {
    log_info "Building shared package..."
    cd packages/shared
    npm run build
    cd ../..
    log_success "Shared package built"
}

# Setup test data
setup_test_data() {
    log_info "Setting up test data..."
    
    # Create test audio files directory
    mkdir -p packages/backend/test-assets/audio
    mkdir -p packages/backend/test-assets/images
    
    # Create sample test audio file (silence)
    if command -v ffmpeg &> /dev/null; then
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 5 -q:a 9 -acodec libmp3lame packages/backend/test-assets/audio/test-recording.mp3 -y 2>/dev/null
        log_success "Created test audio file"
    else
        log_warning "ffmpeg not found, skipping test audio file creation"
    fi
    
    # Create test configuration files
    cat > test-config.json << EOF
{
  "testUsers": [
    {
      "id": "test-facilitator-1",
      "email": "facilitator1@test.com",
      "name": "Test Facilitator 1",
      "role": "facilitator"
    },
    {
      "id": "test-storyteller-1", 
      "email": "storyteller1@test.com",
      "name": "Test Storyteller 1",
      "role": "storyteller"
    }
  ],
  "testProjects": [
    {
      "id": "test-project-1",
      "name": "Test Family Biography",
      "description": "A test project for comprehensive testing"
    }
  ],
  "testPrompts": [
    {
      "text": "Tell me about your earliest childhood memory.",
      "chapter": "Early Life & Family"
    },
    {
      "text": "What was your favorite family tradition growing up?",
      "chapter": "Early Life & Family"
    }
  ]
}
EOF
    
    log_success "Test data setup complete"
}

# Validate environment
validate_environment() {
    log_info "Validating test environment..."
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 18+ required, found version $(node --version)"
        exit 1
    fi
    log_success "Node.js version check passed"
    
    # Check npm version
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    log_success "npm check passed"
    
    # Check if ports are available
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Port 3000 is in use (Web frontend)"
    fi
    
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Port 3001 is in use (Backend API)"
    fi
    
    # Test database connection
    cd packages/backend
    if NODE_ENV=test npm run db:version >/dev/null 2>&1; then
        log_success "Database connection test passed"
    else
        log_warning "Database connection test failed"
    fi
    cd ../..
    
    log_success "Environment validation complete"
}

# Create test scripts
create_test_scripts() {
    log_info "Creating additional test scripts..."
    
    # Quick test script
    cat > scripts/quick-test.sh << 'EOF'
#!/bin/bash
# Quick test script for individual components

set -e

case "$1" in
    "wallet")
        echo "Testing Resource Wallet System..."
        cd packages/backend && npm test -- --testPathPattern=resource-wallet
        ;;
    "auth")
        echo "Testing Authentication System..."
        cd packages/backend && npm test -- --testPathPattern=auth
        ;;
    "prompts")
        echo "Testing AI Prompt System..."
        cd packages/backend && npm test -- --testPathPattern=ai-prompt-service
        ;;
    "recording")
        echo "Testing Recording & STT Pipeline..."
        cd packages/backend && npm test -- --testPathPattern=stt
        cd ../mobile && npm test -- --testPathPattern=recording
        ;;
    "stories")
        echo "Testing Story Management..."
        cd packages/backend && npm test -- --testPathPattern=stories
        ;;
    "export")
        echo "Testing Data Export System..."
        cd packages/backend && npm test -- --testPathPattern=export
        ;;
    "web")
        echo "Testing Web Dashboard..."
        cd packages/web && npm test
        ;;
    "mobile")
        echo "Testing Mobile App..."
        cd packages/mobile && npm test
        ;;
    *)
        echo "Usage: $0 {wallet|auth|prompts|recording|stories|export|web|mobile}"
        echo "Example: $0 wallet"
        exit 1
        ;;
esac

echo "✅ Test completed successfully!"
EOF
    
    chmod +x scripts/quick-test.sh
    
    # Performance test script
    cat > scripts/performance-test.sh << 'EOF'
#!/bin/bash
# Performance testing script

set -e

echo "🚀 Running Performance Tests..."

# Backend performance tests
echo "Testing API performance..."
cd packages/backend
npm test -- --testPathPattern=performance

# Load testing
echo "Running load tests..."
npm test -- --testPathPattern=load-testing

# Memory usage test
echo "Testing memory usage..."
node --expose-gc --max-old-space-size=512 -e "
const used = process.memoryUsage();
console.log('Memory usage:');
for (let key in used) {
  console.log(\`\${key}: \${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB\`);
}
"

echo "✅ Performance tests completed!"
EOF
    
    chmod +x scripts/performance-test.sh
    
    log_success "Test scripts created"
}

# Main setup function
main() {
    echo "Starting test environment setup..."
    echo "This will prepare everything needed for comprehensive testing"
    echo ""
    
    setup_test_env
    install_dependencies
    build_shared
    setup_test_database
    setup_test_data
    validate_environment
    create_test_scripts
    
    echo ""
    echo "=============================================================="
    echo "🎉 Test Environment Setup Complete!"
    echo "=============================================================="
    echo ""
    echo "Next steps:"
    echo "1. Run comprehensive tests: ./scripts/comprehensive-test-suite.sh"
    echo "2. Run quick component tests: ./scripts/quick-test.sh [component]"
    echo "3. Run performance tests: ./scripts/performance-test.sh"
    echo "4. Start development servers: npm run dev"
    echo ""
    echo "For detailed testing instructions, see: COMPREHENSIVE_TESTING_GUIDE.md"
    echo ""
    log_success "Ready for testing! 🚀"
}

# Run main function
main "$@"