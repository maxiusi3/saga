# Saga - Family Biography Platform

Saga is an AI-powered family biography platform that facilitates meaningful intergenerational storytelling through asynchronous conversation. The system connects Facilitators (typically adult children) with Storytellers (typically parents) to preserve and share family memories through AI-guided prompts, voice recordings, and interactive feedback loops.

## 🏗️ Architecture

This is a monorepo containing:

- **Backend** (`packages/backend`): Node.js/Express API server
- **Web App** (`packages/web`): Next.js application for Facilitators
- **Mobile App** (`packages/mobile`): React Native app for Storytellers
- **Shared** (`packages/shared`): Common TypeScript types and utilities

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Optional: Docker and Docker Compose (for full environment)
- Optional: PostgreSQL and Redis (for native environment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd saga-family-biography
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

### 🎯 Choose Your Environment

#### Option 1: Demo Mode (Fastest - No Dependencies)
Perfect for quick testing and demos with in-memory data:

```bash
# Start demo environment (no Docker/database required)
npm run demo:start

# Access the app at http://localhost:3000
# Demo credentials: demo@saga.app (any password)
```

#### Option 2: Native Environment (Docker-free)
Uses local PostgreSQL/Redis if available, falls back to SQLite/memory cache:

```bash
# Start native test environment
npm run test-env:native

# Stop the environment
npm run test-env:native:stop
```

#### Option 3: Docker Environment (Full Setup)
Complete environment with all services in containers:

```bash
# Start PostgreSQL and Redis
npm run docker:up

# Start all development servers
npm run dev

# Or use the complete test environment
npm run test-env:start
```

### 🔧 Environment Setup

4. **Set up environment variables** (for non-demo modes)
   ```bash
   cp packages/backend/.env.example packages/backend/.env
   # Edit the .env file with your configuration
   ```

5. **Run database migrations** (for non-demo modes)
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

## 🧪 Testing Environments

Saga provides multiple testing environments for different use cases:

### 🎭 Demo Mode (No Dependencies)

Perfect for quick demos and testing without any setup:

```bash
# Start demo environment
npm run demo:start

# Access the application
open http://localhost:3000

# Demo credentials
# Email: demo@saga.app
# Password: any password

# Stop demo
npm run demo:stop
```

**Features:**
- ✅ No Docker required
- ✅ No database setup needed
- ✅ In-memory data storage
- ✅ Pre-loaded demo data
- ✅ Full UI functionality

### 🏠 Native Test Environment (Docker-free)

Uses local services when available, with intelligent fallbacks:

```bash
# Start native test environment
npm run test-env:native

# Access the application
open http://localhost:3003

# Stop environment
npm run test-env:native:stop
```

**Features:**
- ✅ No Docker required
- ✅ Uses local PostgreSQL if available (falls back to SQLite)
- ✅ Uses local Redis if available (falls back to memory cache)
- ✅ Full database migrations and seeding
- ✅ Complete API functionality

### 🐳 Docker Test Environment (Full Setup)

Complete containerized environment:

```bash
# Start full test environment
npm run test-env:start

# Access the application
open http://localhost:8080

# Test credentials
# Email: test@saga.app
# Password: TestPassword123!
```

**Features:**
- ✅ Complete isolation
- ✅ Production-like environment
- ✅ All services containerized
- ✅ Nginx proxy included

### ☁️ Cloud Test Environment

Deploy to AWS test environment:

```bash
# Deploy to AWS test environment
npm run deploy:test

# Validate deployment
npm run deploy:test:validate
```

### 🚫 Docker-Free Development

If you prefer to avoid Docker entirely, use these commands:

```bash
# Quick demo (fastest)
npm run demo:start

# Native environment (more complete)
npm run test-env:native

# Regular development (requires local PostgreSQL/Redis)
npm run dev
```

For detailed testing information, see [Test Environment Guide](docs/TEST_ENVIRONMENT.md).

### 🚫 Need Docker-Free Options?

If you can't or don't want to use Docker, we have you covered! See our [Docker-Free Development Guide](docs/DOCKER_FREE_GUIDE.md) for multiple alternatives:

- **Quick API Demo**: `npm run demo:simple` (30 seconds setup)
- **Native Environment**: `npm run test-env:native` (uses local PostgreSQL/Redis or fallbacks)
- **Full Demo**: `npm run demo:start` (complete web interface)

## 📚 Documentation

- [Local Development Guide](docs/LOCAL_DEVELOPMENT.md) - Setting up local development
- [Test Environment Guide](docs/TEST_ENVIRONMENT.md) - Testing environments and strategies
- [Security Documentation](docs/SECURITY.md) - Security measures and best practices
- [CI/CD Guide](docs/CI-CD.md) - Deployment and automation
- [API Documentation](packages/backend/README.md) - Backend API reference

## 🛠️ Development Commands

### General Commands

```bash
# Install dependencies
npm install

# Start all development servers
npm run dev

# Build all packages
npm run build

# Run all tests
npm test

# Run linting
npm run lint

# Type checking
npm run type-check
```

### Package-Specific Commands

```bash
# Backend development
npm run dev:backend

# Web development  
npm run dev:web

# Mobile development
npm run dev:mobile

# Run backend tests
npm run test:backend

# Run web tests
npm run test:web

# Run E2E tests
npm run test:e2e
```

### Database Commands

```bash
# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Reset database
npm run db:reset
```

### Docker Commands

```bash
# Start services
npm run docker:up

# Stop services
npm run docker:down

# View logs
npm run docker:logs
```

### Test Environment Commands

```bash
# Start test environment
npm run test-env:start

# Stop test environment
npm run test-env:stop

# Run tests in test environment
npm run test-env:test

# View test environment logs
npm run test-env:logs

# Clean test environment
npm run test-env:clean
```

## 🏃‍♂️ Quick Development Setup

For the fastest way to get started:

```bash
# One-command setup
npm run setup

# Or use the quick start script
npm run quick-start
```

This will:
- Install all dependencies
- Start Docker services
- Run database migrations
- Start development servers
- Open the application in your browser
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

### Development URLs

- **API Server**: http://localhost:3001
- **Web App**: http://localhost:3000
- **Mobile App**: Use Expo Go app with QR code

## 📦 Package Scripts

### Root Level Commands

```bash
# Development
npm run dev                 # Start all development servers
npm run dev:backend        # Start backend only
npm run dev:web           # Start web app only
npm run dev:mobile        # Start mobile app only

# Building
npm run build             # Build all packages
npm run build:backend     # Build backend only
npm run build:web         # Build web app only
npm run build:mobile      # Build mobile app only

# Testing
npm run test              # Run all tests
npm run test:backend      # Run backend tests
npm run test:web          # Run web tests
npm run test:mobile       # Run mobile tests
npm run test:e2e          # Run end-to-end tests

# Code Quality
npm run lint              # Lint all packages
npm run lint:fix          # Fix linting issues
npm run type-check        # TypeScript type checking

# Database
npm run db:migrate        # Run database migrations
npm run db:seed           # Seed database with test data
npm run db:reset          # Reset database (rollback + migrate + seed)

# Docker
npm run docker:up         # Start PostgreSQL and Redis
npm run docker:down       # Stop containers
npm run docker:logs       # View container logs
```

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 18+ with Express.js
- **Database**: PostgreSQL 15+ with Knex.js migrations
- **Cache**: Redis 7+ for sessions and real-time data
- **Storage**: AWS S3 + CloudFront CDN
- **Real-time**: Socket.io for WebSocket connections
- **Queue**: Bull Queue for background processing
- **Auth**: JWT with refresh token rotation

### Web Frontend (Facilitators)
- **Framework**: Next.js 14+ with App Router
- **UI**: React 18 + Tailwind CSS
- **State**: Zustand for client state management
- **Forms**: React Hook Form with Zod validation
- **HTTP**: Axios with request/response interceptors

### Mobile App (Storytellers)
- **Framework**: React Native 0.72+ with Expo
- **Navigation**: React Navigation 6
- **Audio**: expo-av for recording and playback
- **State**: Zustand for state management
- **Forms**: React Hook Form with Zod validation

### External Services
- **AI**: OpenAI GPT-4 for prompts and summarization
- **STT**: Google Cloud Speech-to-Text
- **Payments**: Stripe (web), Apple Pay/Google Pay (mobile)
- **Push Notifications**: Firebase Cloud Messaging
- **Email**: SendGrid for transactional emails

## 🏃‍♂️ Development Workflow

### Code Quality Standards

- **TypeScript**: Strict mode enabled, no `any` types
- **ESLint**: Airbnb config with accessibility rules
- **Prettier**: Consistent code formatting
- **Testing**: Minimum 80% code coverage required
- **Commits**: Conventional commit format

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature development branches
- `hotfix/*`: Critical production fixes

### Testing Strategy

- **Unit Tests**: Jest for all packages
- **Integration Tests**: API and database testing
- **E2E Tests**: Playwright (web) and Detox (mobile)
- **Performance Tests**: Load testing with Artillery

## 🚢 Deployment

### Environments

- **Development**: Local Docker containers
- **Staging**: AWS ECS with reduced capacity
- **Production**: AWS ECS with auto-scaling

### CI/CD Pipeline

GitHub Actions workflow includes:
- Linting and type checking
- Unit and integration tests
- Docker image building
- Automated deployment to staging/production

### Infrastructure (AWS)

- **Compute**: ECS Fargate with Application Load Balancer
- **Database**: RDS PostgreSQL with Multi-AZ
- **Cache**: ElastiCache Redis cluster
- **Storage**: S3 with CloudFront CDN
- **Monitoring**: CloudWatch + DataDog

## 🔒 Security

- **Data Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Authentication**: JWT with secure refresh rotation
- **File Upload**: Type validation, size limits, virus scanning
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Comprehensive sanitization

## 📚 Documentation

- [Requirements](/.kiro/specs/saga-family-biography/requirements.md)
- [Design Document](/.kiro/specs/saga-family-biography/design.md)
- [Implementation Tasks](/.kiro/specs/saga-family-biography/tasks.md)
- [API Documentation](packages/backend/README.md)
- [Web App Guide](packages/web/README.md)
- [Mobile App Guide](packages/mobile/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For development support, please check:
- [Troubleshooting Guide](docs/troubleshooting.md)
- [Development Setup](docs/development.md)
- [Deployment Guide](docs/deployment.md)

---

**Built with ❤️ for preserving family memories across generations**