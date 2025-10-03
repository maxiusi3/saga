# Saga Deployment Guide

This guide covers how to deploy the Saga application with the new backend settings APIs and integrated quick access functionality.

## Quick Start

### Option 1: Docker Deployment (Recommended)

1. **Prerequisites**
   - Docker and Docker Compose installed
   - Ports 3000, 3001, and 5432 available

2. **Deploy**
   ```bash
   ./deploy.sh
   ```

3. **Access**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Database: localhost:5432

### Option 2: Local Development

1. **Prerequisites**
   - Node.js 18+
   - PostgreSQL 15+
   - npm or yarn

2. **Setup**
   ```bash
   ./dev-setup.sh
   ```

3. **Start Development Servers**
   ```bash
   ./start-dev.sh
   ```

## What's New

### Backend APIs Implemented ✅

- **Settings Management**: Complete CRUD operations for user settings
- **Resource Wallet**: Package/seat system for project management
- **Authentication**: JWT-based authentication middleware
- **Database**: PostgreSQL with Knex.js migrations
- **Validation**: Input validation with Joi
- **Error Handling**: Comprehensive error handling and logging

### Frontend Enhancements ✅

- **Quick Access Integration**: Moved from floating toolbar to settings page
- **Real-time Settings**: Accessibility settings apply immediately
- **Backend Integration**: All settings persist to database
- **Modern UI**: Enhanced settings interface with better UX
- **Loading States**: Proper loading and error handling

### API Endpoints Available

```
GET  /api/settings/profile          - Get user profile
PUT  /api/settings/profile          - Update user profile
GET  /api/settings/notifications    - Get notification settings
PUT  /api/settings/notifications    - Update notification settings
GET  /api/settings/accessibility    - Get accessibility settings
PUT  /api/settings/accessibility    - Update accessibility settings
GET  /api/settings/audio           - Get audio settings
PUT  /api/settings/audio           - Update audio settings
GET  /api/settings/privacy         - Get privacy settings
PUT  /api/settings/privacy         - Update privacy settings
GET  /api/settings/language        - Get language settings
PUT  /api/settings/language        - Update language settings
GET  /api/settings/wallet          - Get resource wallet status
```

## Configuration

### Environment Variables

**Backend (.env)**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=saga_dev
DB_USER=postgres
DB_PASSWORD=password
JWT_SECRET=your-secret-key
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env.local)**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Database Setup

The system automatically creates the following tables:
- `users` - User accounts
- `user_settings` - User preferences and settings
- `user_resource_wallets` - Resource management
- `resource_usage_history` - Usage tracking
- `projects` - Project management (basic structure)

## Features

### Settings Management

1. **User Profile**
   - Name, email, phone, avatar, bio
   - Real-time updates with backend persistence

2. **Quick Access (Accessibility)**
   - High contrast mode toggle
   - Reduced motion toggle
   - Screen reader optimizations
   - Font size selection (Standard/Large/Extra Large)
   - Immediate DOM application

3. **Notifications**
   - Email notifications
   - Push notifications
   - Story updates
   - Follow-up questions
   - Weekly digest
   - Marketing emails

4. **Audio Settings**
   - Volume control
   - Quality selection (Low/Medium/High)

5. **Privacy & Security**
   - Profile visibility
   - Story sharing permissions
   - Data analytics opt-in/out
   - Two-factor authentication

6. **Language & Region**
   - Language selection
   - Timezone configuration

### Resource Wallet System

- Project vouchers tracking
- Facilitator seats management
- Storyteller seats management
- Usage history logging

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   pg_isready -h localhost -p 5432
   
   # Start PostgreSQL with Docker
   docker run -d --name saga-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15
   ```

2. **Port Already in Use**
   ```bash
   # Check what's using the port
   lsof -i :3000
   lsof -i :3001
   
   # Kill the process
   kill -9 <PID>
   ```

3. **Migration Errors**
   ```bash
   # Reset migrations
   cd packages/backend
   npm run migrate:rollback
   npm run migrate
   ```

4. **Frontend Build Errors**
   ```bash
   # Clear Next.js cache
   cd packages/web
   rm -rf .next
   npm run build
   ```

### Logs and Debugging

**Docker Deployment**
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

**Local Development**
- Backend logs: Console output from `npm run dev`
- Frontend logs: Browser console and terminal output
- Database logs: PostgreSQL logs

## Production Deployment

For production deployment, update the following:

1. **Security**
   - Change JWT_SECRET to a strong random key
   - Use environment-specific database credentials
   - Enable HTTPS
   - Configure proper CORS origins

2. **Database**
   - Use managed PostgreSQL service
   - Configure connection pooling
   - Set up backups

3. **Monitoring**
   - Add application monitoring (e.g., Sentry)
   - Set up health checks
   - Configure logging aggregation

4. **Performance**
   - Enable Redis for caching
   - Configure CDN for static assets
   - Optimize database queries

## Next Steps

The backend is now ready for the next phase of development:

1. **Dashboard APIs** - Project overview and statistics
2. **Project Management APIs** - Full project CRUD operations
3. **Stories APIs** - Story management and interaction
4. **AI Prompt System** - Intelligent story prompting
5. **Purchase System** - Resource package purchasing

All the foundation is in place with proper authentication, settings management, and the resource wallet system.