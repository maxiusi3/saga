# Backend Setup Guide

## 🚀 Quick Start

### 1. Start the Backend Server

```bash
./start-backend.sh
```

This will:
- Install dependencies if needed
- Run database migrations
- Seed the database with test data
- Start the backend server on port 3001

### 2. Test the API

In a new terminal:

```bash
./test-api.sh
```

This will test the basic API endpoints.

## 📊 API Endpoints

### Public Endpoints

- `GET /health` - Health check

### Protected Endpoints (require authentication)

#### Dashboard APIs
- `GET /api/dashboard/overview` - Get dashboard overview
- `GET /api/dashboard/projects` - Get user's projects
- `GET /api/dashboard/wallet` - Get resource wallet
- `GET /api/dashboard/activity` - Get recent activity
- `GET /api/dashboard/stats` - Get dashboard statistics

#### Settings APIs
- `GET /api/settings/profile` - Get user profile
- `PUT /api/settings/profile` - Update user profile
- `GET /api/settings/notifications` - Get notification settings
- `PUT /api/settings/notifications` - Update notification settings
- `GET /api/settings/accessibility` - Get accessibility settings
- `PUT /api/settings/accessibility` - Update accessibility settings
- `GET /api/settings/wallet` - Get resource wallet

## 🗄️ Database

The backend uses SQLite for development:
- Database file: `packages/backend/dev.sqlite3`
- Migrations: `packages/backend/migrations/`
- Seeds: `packages/backend/seeds/`

### Database Commands

```bash
cd packages/backend

# Run migrations
npm run migrate

# Rollback migrations
npm run migrate:rollback

# Create new migration
npm run migrate:make migration_name

# Seed database
npx knex seed:run
```

## 🔐 Authentication

The backend uses JWT for authentication. To test authenticated endpoints:

1. Login through the frontend (http://localhost:3000)
2. Open browser DevTools > Application > Local Storage
3. Copy the `auth_token` value
4. Use it in API requests:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/dashboard/wallet
```

## 🧪 Testing with Real Data

### Test User Data

The seed file creates a test user with:
- User ID: `test-user-1`
- Project Vouchers: 2
- Facilitator Seats: 1
- Storyteller Seats: 3

### Creating Test Data

You can modify `packages/backend/seeds/test_data.js` to add more test data.

## 🐛 Troubleshooting

### Port Already in Use

If port 3001 is already in use:

```bash
# Find the process
lsof -i :3001

# Kill it
kill -9 PID
```

### Database Issues

If you encounter database issues:

```bash
cd packages/backend

# Delete the database
rm dev.sqlite3

# Re-run migrations and seeds
npm run migrate
npx knex seed:run
```

### Module Not Found

If you get module not found errors:

```bash
cd packages/backend
rm -rf node_modules package-lock.json
npm install
```

## 📝 Development

### Adding New API Endpoints

1. Create controller in `src/controllers/`
2. Create service in `src/services/`
3. Create model in `src/models/` (if needed)
4. Add route in `src/routes/`
5. Register route in `src/index.ts`

### Database Migrations

```bash
# Create migration
npm run migrate:make create_table_name

# Edit the migration file in migrations/
# Then run:
npm run migrate
```

## 🔗 Frontend Integration

The frontend is configured to connect to the backend at:
- Development: `http://localhost:3001/api`
- Production: Set `NEXT_PUBLIC_API_URL` environment variable

### Environment Variables

Frontend (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Backend (`.env`):
```
PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secret-key
```

## 📚 Next Steps

1. ✅ Backend server is running
2. ✅ Database is set up
3. ✅ Test data is seeded
4. ⏳ Connect frontend to backend
5. ⏳ Implement authentication flow
6. ⏳ Add more API endpoints as needed

## 🆘 Need Help?

Check the logs:
- Backend logs: Console output from `./start-backend.sh`
- Frontend logs: Browser DevTools Console
- Database: `packages/backend/dev.sqlite3` (use SQLite browser)
