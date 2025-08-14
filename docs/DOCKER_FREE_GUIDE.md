# Docker-Free Development Guide

This guide provides multiple ways to run Saga without Docker dependencies.

## 🎯 Quick Start Options

### Option 1: Simple Demo API (Fastest)
Perfect for API testing and frontend development:

```bash
# Start demo API server
npm run demo:simple

# Test the API
curl http://localhost:3005/health

# Stop the demo
npm run demo:simple:stop
```

**Features:**
- ✅ No Docker required
- ✅ No database setup needed
- ✅ In-memory data storage
- ✅ Pre-loaded demo data
- ✅ Full REST API functionality
- ✅ Perfect for frontend development

### Option 2: Native Test Environment
Uses local services with intelligent fallbacks:

```bash
# Start native test environment
npm run test-env:native

# Stop the environment
npm run test-env:native:stop
```

**Features:**
- ✅ No Docker required
- ✅ Uses local PostgreSQL if available (falls back to SQLite)
- ✅ Uses local Redis if available (falls back to memory cache)
- ✅ Full database migrations and seeding
- ✅ Complete API functionality

### Option 3: Full Demo Environment
Complete demo with frontend and backend:

```bash
# Start full demo environment
npm run demo:start

# Stop the demo
npm run demo:stop
```

**Features:**
- ✅ No Docker required
- ✅ Complete web interface
- ✅ Demo API server
- ✅ In-memory data storage

## 📊 Comparison Table

| Feature | Simple Demo | Native Environment | Full Demo | Docker Environment |
|---------|-------------|-------------------|-----------|-------------------|
| Setup Time | < 1 minute | 2-3 minutes | 3-5 minutes | 5-10 minutes |
| Dependencies | Node.js only | Node.js + optional PostgreSQL/Redis | Node.js | Docker + Docker Compose |
| Database | In-memory | SQLite/PostgreSQL | In-memory | PostgreSQL |
| Cache | In-memory | Memory/Redis | In-memory | Redis |
| Frontend | No | No | Yes | Yes |
| API Server | Yes | Yes | Yes | Yes |
| Data Persistence | No | Yes (with PostgreSQL) | No | Yes |
| Best For | API testing, Frontend dev | Full development | Complete demo | Production-like testing |

## 🚀 Available Commands

### Simple Demo API
```bash
npm run demo:simple          # Start demo API
npm run demo:simple:stop     # Stop demo API
npm run demo:simple:logs     # View logs
npm run demo:simple:test     # Test API endpoints
```

### Native Environment
```bash
npm run test-env:native         # Start native environment
npm run test-env:native:stop    # Stop native environment
npm run test-env:native:restart # Restart native environment
npm run test-env:native:logs    # View logs
npm run test-env:native:clean   # Clean up and stop
npm run test-env:native:health  # Run health checks
```

### Full Demo Environment
```bash
npm run demo:start    # Start full demo
npm run demo:stop     # Stop demo
npm run demo:restart  # Restart demo
npm run demo:logs     # View logs
npm run demo:clean    # Clean up
```

### Testing Docker-Free Options
```bash
npm run test:docker-free        # Test all Docker-free options
npm run test:docker-free check  # Check available alternatives
```

## 🔧 Configuration

### Environment Variables

For **Simple Demo API**:
- No configuration needed - works out of the box

For **Native Environment**:
- `DATABASE_URL` - PostgreSQL connection string (optional, defaults to SQLite)
- `REDIS_URL` - Redis connection string (optional, defaults to memory cache)

For **Full Demo Environment**:
- `NEXT_PUBLIC_API_URL` - API server URL (automatically set)

### Port Configuration

All scripts automatically find available ports if the default ones are in use:

- **Simple Demo API**: Default 3005, auto-finds alternatives
- **Native Environment**: Backend 3002, Web 3003
- **Full Demo**: Demo server 3005, Web 3006

## 🧪 API Testing

### Demo Credentials
```
Email: demo@saga.app
Password: any password (demo mode accepts any password)
```

### Sample API Calls

**Health Check:**
```bash
curl http://localhost:3005/health
```

**Sign In:**
```bash
curl -X POST http://localhost:3005/api/auth/signin \
     -H 'Content-Type: application/json' \
     -d '{"email":"demo@saga.app","password":"test"}'
```

**Get Projects:**
```bash
curl -X GET http://localhost:3005/api/projects \
     -H 'Authorization: Bearer YOUR_TOKEN'
```

## 🛠️ Troubleshooting

### Common Issues

**Port Already in Use:**
- All scripts automatically find alternative ports
- Check what's using a port: `lsof -i :PORT_NUMBER`

**Missing Dependencies:**
- Install Node.js 18+: `brew install node` (macOS) or download from nodejs.org
- Install npm: Usually comes with Node.js

**Frontend Build Issues:**
- Missing Tailwind plugins: `cd packages/web && npm install @tailwindcss/forms @tailwindcss/typography`
- Network issues: The simple demo API doesn't require frontend compilation

**Database Issues (Native Environment):**
- PostgreSQL not available: Script automatically falls back to SQLite
- Redis not available: Script automatically falls back to memory cache

### Getting Help

**Check System Dependencies:**
```bash
npm run test:docker-free check
```

**View Logs:**
```bash
# Simple demo
npm run demo:simple:logs

# Native environment
npm run test-env:native:logs

# Full demo
npm run demo:logs
```

**Clean Up:**
```bash
# Stop all services and clean up
npm run demo:simple:stop
npm run test-env:native:clean
npm run demo:clean
```

## 🎯 Recommended Workflow

### For Frontend Development
1. Start the simple demo API: `npm run demo:simple`
2. Set `NEXT_PUBLIC_API_URL=http://localhost:3005` in your frontend
3. Develop against the demo API with pre-loaded data

### For Backend Development
1. Start the native environment: `npm run test-env:native`
2. Use real database (PostgreSQL/SQLite) for data persistence
3. Test with full API functionality

### For Full System Testing
1. Start the full demo: `npm run demo:start`
2. Test complete user flows
3. Verify frontend-backend integration

### For Production-like Testing
1. Use the Docker environment: `npm run test-env:start`
2. Test with containerized services
3. Validate deployment configurations

## 📚 Additional Resources

- [Local Development Guide](LOCAL_DEVELOPMENT.md) - Complete development setup
- [Test Environment Guide](TEST_ENVIRONMENT.md) - All testing options
- [API Documentation](../packages/backend/README.md) - Backend API reference

## 🎉 Success!

You now have multiple Docker-free options to run Saga:

- **Quick API testing**: `npm run demo:simple`
- **Full development**: `npm run test-env:native`
- **Complete demo**: `npm run demo:start`

Choose the option that best fits your needs and start developing!