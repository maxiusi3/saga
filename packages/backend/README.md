# Saga Backend API

Node.js/Express backend server for the Saga family biography platform.

## 🏗️ Architecture

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Knex.js ORM
- **Cache**: Redis for sessions and real-time data
- **Authentication**: JWT with refresh token rotation
- **Real-time**: Socket.io for WebSocket connections
- **File Storage**: AWS S3 with CloudFront CDN
- **Background Jobs**: Bull Queue for async processing

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- AWS S3 bucket (for file storage)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start database and Redis
docker-compose up -d

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Start development server
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://saga_user:saga_password@localhost:5432/saga_development

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# AWS
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=saga-media-bucket

# External APIs
OPENAI_API_KEY=your-openai-api-key
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key

# v1.5 Resource Wallet Configuration
DEFAULT_PROJECT_VOUCHERS=1
DEFAULT_FACILITATOR_SEATS=2
DEFAULT_STORYTELLER_SEATS=2
MAX_PROJECT_VOUCHERS=10
MAX_FACILITATOR_SEATS=20
MAX_STORYTELLER_SEATS=20
```

## 📡 API Endpoints

### Authentication (v1.5)
- `POST /api/auth/signup` - User registration with automatic wallet creation
- `POST /api/auth/signin` - User login
- `POST /api/auth/oauth/google` - Google OAuth
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/signout` - User logout

### User Profile & Wallet
- `GET /api/users/me/profile` - Get user profile with wallet information
- `GET /api/users/me/wallet` - Get wallet balance
- `GET /api/users/me/transactions` - Get transaction history

### Projects
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/invitation` - Generate invitation

### Stories
- `GET /api/projects/:projectId/stories` - List project stories
- `POST /api/projects/:projectId/stories` - Upload new story
- `GET /api/stories/:id` - Get story details
- `PUT /api/stories/:id/transcript` - Update transcript
- `POST /api/stories/:id/interactions` - Add interaction

### Exports
- `POST /api/projects/:id/export` - Request data export
- `GET /api/exports/:id/status` - Check export status
- `GET /api/exports/:id/download` - Download export

## 🗄️ Database Schema

### Core Tables (v1.5)

```sql
-- Users table (unified account model)
users (id, email, phone, name, oauth_provider, oauth_id, created_at, updated_at)

-- Resource wallets for package/seat management
user_resource_wallets (user_id, project_vouchers, facilitator_seats, storyteller_seats, updated_at)

-- Transaction audit log
seat_transactions (id, user_id, transaction_type, resource_type, amount, project_id, created_at)

-- Project-specific roles (replaces global roles)
project_roles (id, user_id, project_id, role, created_at, updated_at)

-- Projects table (simplified)
projects (id, name, created_by, status, created_at, updated_at)

-- Stories table with chapter references
stories (id, project_id, title, audio_url, transcript, photo_url, chapter_id, status, created_at, updated_at)

-- Interactions with facilitator attribution
interactions (id, story_id, facilitator_id, type, content, answered_at, created_at)

-- Role-specific invitations
invitations (id, project_id, role, token, expires_at, used_at, created_at)

-- Subscriptions as single source of truth
subscriptions (id, project_id, facilitator_id, status, current_period_end, created_at, updated_at)
```

### Migrations

```bash
# Create new migration
npx knex migrate:make migration_name

# Run migrations
npm run db:migrate

# Rollback migrations
npm run db:migrate:rollback

# Reset database
npm run db:reset
```

## 🔌 WebSocket Events

### Client to Server
- `join_project` - Join project room
- `leave_project` - Leave project room

### Server to Client
- `story_uploaded` - New story uploaded
- `interaction_added` - New comment/follow-up
- `transcript_updated` - Transcript edited
- `export_ready` - Export completed

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

```
src/
├── __tests__/          # Integration tests
├── controllers/
│   └── __tests__/      # Controller unit tests
├── services/
│   └── __tests__/      # Service unit tests
└── utils/
    └── __tests__/      # Utility unit tests
```

## 🚀 Deployment

### Docker Build

```bash
# Build Docker image
docker build -t saga-backend .

# Run container
docker run -p 3001:3001 saga-backend
```

### Production Environment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🔧 Development

### Code Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Route handlers
├── middleware/       # Express middleware
├── models/          # Database models
├── routes/          # API route definitions
├── services/        # Business logic
├── utils/           # Helper functions
├── websocket/       # Socket.io handlers
└── index.ts         # Application entry point
```

### Adding New Features

1. **Create migration** for database changes
2. **Add model** in `src/models/`
3. **Create service** in `src/services/`
4. **Add controller** in `src/controllers/`
5. **Define routes** in `src/routes/`
6. **Write tests** for all components

### Error Handling

All errors follow consistent format:

```typescript
{
  error: {
    code: string,
    message: string,
    details?: any
  },
  timestamp: string,
  path: string
}
```

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

### Logging

- **Development**: Console logging with colors
- **Production**: Structured JSON logging
- **Error Tracking**: Sentry integration

### Performance

- **Database**: Query optimization and indexing
- **Cache**: Redis for frequently accessed data
- **Rate Limiting**: API endpoint protection
- **File Upload**: Streaming and progress tracking

## 🔒 Security

- **Input Validation**: Express-validator middleware
- **SQL Injection**: Parameterized queries with Knex
- **XSS Protection**: Helmet.js security headers
- **CORS**: Configured for specific origins
- **File Upload**: Type and size validation
- **Authentication**: JWT with secure refresh rotation

## 📚 Additional Resources

- [API Documentation](docs/api.md)
- [Authentication v1.5 Guide](docs/authentication-v1.5.md)
- [Database Schema](docs/schema.md)
- [Deployment Guide](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)