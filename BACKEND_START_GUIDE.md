# Backend Start Guide

## Quick Start

### Option 1: Using the restart script (Recommended)
```bash
./restart-backend.sh
```

### Option 2: Manual start
```bash
# 1. Navigate to backend directory
cd packages/backend

# 2. Start the server
npm run dev
```

### Option 3: Using the dev-setup script
```bash
./dev-setup.sh
```

## Troubleshooting

### Port 3001 Already in Use

If you see `EADDRINUSE: address already in use :::3001`, run:

```bash
# Kill processes on port 3001
lsof -ti:3001 | xargs kill -9

# Or kill all tsx watch processes
pkill -f "tsx watch"

# Then restart
cd packages/backend && npm run dev
```

### Backend Not Responding

1. **Check if backend is running:**
   ```bash
   lsof -i:3001
   ```

2. **Check backend logs:**
   ```bash
   # If running in background
   tail -f /tmp/backend.log
   
   # Or check the terminal where you started it
   ```

3. **Test health endpoint:**
   ```bash
   curl http://localhost:3001/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

4. **Test settings endpoint (with auth):**
   ```bash
   # Get your auth token from browser console:
   # localStorage.getItem('sb-localhost-auth-token')
   
   export AUTH_TOKEN='your-token-here'
   curl -H "Authorization: Bearer $AUTH_TOKEN" \
     http://localhost:3001/api/settings/profile
   ```

### Database Connection Issues

If you see database errors:

```bash
# 1. Make sure PostgreSQL is running
docker ps | grep postgres

# 2. If not running, start it
docker-compose up -d postgres

# 3. Run migrations
cd packages/backend
npm run migrate:latest

# 4. Seed test data (optional)
npm run seed:run
```

### Environment Variables

Make sure `packages/backend/.env` exists and has:

```env
# Database
DATABASE_URL=postgresql://saga_user:saga_password@localhost:5432/saga_db

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Current Status

### ✅ Fixed Issues
- API endpoints now use correct `/api` prefix
- Settings service uses singleton Supabase client
- All routes properly configured

### ⚠️ Known Issues
- Backend needs to be manually started
- Port 3001 sometimes gets stuck (use kill commands above)

### 🔄 To Start Backend Now

**In a new terminal window, run:**

```bash
cd packages/backend
npm run dev
```

You should see:
```
🚀 Saga Backend Server running on port 3001
📊 Environment: development
```

### 🧪 Verify Backend is Working

```bash
# Test 1: Health check
curl http://localhost:3001/health

# Test 2: Settings endpoint (needs auth token)
# First, get token from browser console:
# JSON.parse(localStorage.getItem('sb-localhost-auth-token')).access_token

# Then test:
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/settings/profile
```

## Frontend Connection

Once backend is running, the frontend will automatically connect to:
- `http://localhost:3001/api/settings/*`
- `http://localhost:3001/api/projects/*`
- `http://localhost:3001/api/dashboard/*`

## Development Workflow

1. **Start Backend** (in terminal 1):
   ```bash
   cd packages/backend
   npm run dev
   ```

2. **Start Frontend** (in terminal 2):
   ```bash
   cd packages/web
   npm run dev
   ```

3. **Access Application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Backend Health: http://localhost:3001/health

## Next Steps

After starting the backend:

1. ✅ Refresh the settings page at http://localhost:3000/dashboard/settings
2. ✅ Check browser console - should see no more timeout errors
3. ✅ Try saving settings - should work now
4. ✅ Check backend terminal - should see API requests logged

## Need Help?

If backend still won't start:

1. Check if port 3001 is free: `lsof -i:3001`
2. Check if PostgreSQL is running: `docker ps`
3. Check environment variables: `cat packages/backend/.env`
4. Check for errors: Look at terminal output when starting backend
