# Manual Testing Guide - Saga Development Environment

## 🚀 Server Status

### ✅ Backend Server (http://localhost:3001)
- **Status**: Running successfully
- **Database**: Connected (SQLite)
- **Health Endpoints**: Working
- **Issue**: Some routes failed to load due to TypeScript compilation errors

### ✅ Web Server (http://localhost:3000)  
- **Status**: Running successfully
- **Framework**: Next.js with hot reload
- **Landing Page**: Fully functional

## 🔧 Current Issues & Solutions

### Backend Route Loading
**Issue**: Auth and other API routes are not loading due to TypeScript compilation errors.

**Root Cause**: 
1. Express User type conflicts with custom User type
2. Generic ApiResponse type usage
3. Missing method names in models

**Status**: Partially fixed, but routes still not loading in dev-server

## 🧪 Available Testing Endpoints

### Working Endpoints
```bash
# Health checks (✅ Working)
curl http://localhost:3001/health
curl http://localhost:3001/api/health

# Web application (✅ Working)
open http://localhost:3000
```

### Not Currently Working
```bash
# API routes (❌ Not loading due to TypeScript errors)
curl -X POST http://localhost:3001/api/auth/signup
curl -X POST http://localhost:3001/api/auth/signin
curl http://localhost:3001/api/projects
```

## 🛠️ Recommended Testing Approach

### Phase 1: Fix Remaining TypeScript Issues
1. **Complete ApiResponse fixes** in all controllers
2. **Resolve Express type conflicts** completely
3. **Fix missing model methods** across all models
4. **Test route loading** in dev-server

### Phase 2: Basic API Testing
Once routes are loading:

```bash
# User Registration
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "TestPassword123"
  }'

# User Login  
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@example.com",
    "password": "TestPassword123"
  }'

# Protected Route (with JWT token)
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  http://localhost:3001/api/auth/profile
```

### Phase 3: Web Application Testing
```bash
# Landing page
open http://localhost:3000

# Authentication flows
open http://localhost:3000/auth/signup
open http://localhost:3000/auth/signin

# Dashboard (after login)
open http://localhost:3000/dashboard
```

## 🔍 Debugging Steps

### Check Backend Logs
The backend server shows compilation errors on startup. Key issues to resolve:

1. **ApiResponse Generic Type**: All controllers need `ApiResponse<T>` instead of `ApiResponse`
2. **Express User Type**: Need proper type augmentation
3. **Model Methods**: Ensure all referenced methods exist

### Check Route Loading
Monitor the dev-server console for:
```
Some routes failed to load: [error details]
```

### Database Verification
```bash
# Check if database is accessible
cd packages/backend
npm run db:migrate
npm run db:seed
```

## 📋 Test Scenarios (Once Routes Are Fixed)

### Authentication Flow
1. **User Registration**
   - Valid email/password
   - Invalid email format
   - Weak password
   - Duplicate email

2. **User Login**
   - Valid credentials
   - Invalid credentials
   - Missing fields

3. **JWT Token Validation**
   - Valid token access
   - Expired token
   - Invalid token
   - Missing token

### Project Management
1. **Project Creation**
   - Valid project data
   - Resource wallet consumption
   - Insufficient resources

2. **Invitation System**
   - Send facilitator invitation
   - Send storyteller invitation
   - Accept invitation
   - Expired invitation

### Story & Prompt System
1. **Prompt Delivery**
   - Get next prompt
   - Chapter progression
   - User-generated prompts

2. **Story Submission**
   - Audio upload
   - Transcript processing
   - Photo attachment

## 🎯 Success Criteria

### Backend API
- [ ] All routes load without TypeScript errors
- [ ] Health endpoints respond correctly
- [ ] Authentication endpoints work
- [ ] Protected routes validate JWT tokens
- [ ] Database operations succeed

### Web Application
- [ ] Landing page loads correctly
- [ ] Authentication forms work
- [ ] Dashboard is accessible after login
- [ ] Navigation functions properly
- [ ] Error handling displays appropriately

## 🚨 Current Blockers

1. **TypeScript Compilation Errors**: Preventing route loading
2. **Route Import Failures**: Dev-server can't load main API routes
3. **Type Definition Conflicts**: Express vs Custom User types

## 📞 Next Actions

1. **Fix all TypeScript errors** in controllers and models
2. **Test route loading** in development server
3. **Verify API endpoints** respond correctly
4. **Test web application** authentication flow
5. **Document working test cases**

---

**Note**: The development environment is partially functional. The web server works perfectly, and the backend server runs with database connectivity, but API routes need TypeScript fixes before full testing can proceed.