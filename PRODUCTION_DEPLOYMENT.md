# Production Deployment Guide

## Overview

This guide covers deploying the Saga application to production with all the latest features including settings APIs, resource management, and project management.

## Prerequisites

- Domain name configured
- SSL certificate (Let's Encrypt recommended)
- Server with Docker and Docker Compose
- PostgreSQL database (managed service recommended)
- Supabase project (for authentication)
- Environment variables configured

## Deployment Options

### Option 1: Docker Deployment (Recommended)

#### Step 1: Prepare Environment Variables

Create production environment files:

**Backend (.env.production)**
```env
# Database (use managed PostgreSQL service)
DATABASE_URL=postgresql://user:password@your-db-host:5432/saga_production

# JWT
JWT_SECRET=<generate-strong-random-key>
JWT_EXPIRES_IN=7d

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://your-domain.com
```

**Frontend (.env.production)**
```env
# API
NEXT_PUBLIC_API_URL=https://api.your-domain.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# Environment
NODE_ENV=production
```

#### Step 2: Create Production Docker Compose

Create `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./packages/backend
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    container_name: saga-backend-prod
    restart: always
    environment:
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      PORT: 3001
      NODE_ENV: production
      FRONTEND_URL: ${FRONTEND_URL}
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  frontend:
    build:
      context: ./packages/web
      dockerfile: Dockerfile.production
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    container_name: saga-frontend-prod
    restart: always
    ports:
      - "3000:3000"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    container_name: saga-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### Step 3: Create Nginx Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:3001;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    # Frontend
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # Backend API
    server {
        listen 443 ssl http2;
        server_name api.your-domain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        location / {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

#### Step 4: Deploy

```bash
# 1. Clone repository on server
git clone <your-repo-url>
cd saga

# 2. Set up environment variables
cp .env.production.example .env.production
# Edit .env.production with your values

# 3. Build and start services
docker-compose -f docker-compose.production.yml up -d --build

# 4. Run migrations
docker-compose -f docker-compose.production.yml exec backend npm run migrate:latest

# 5. Check status
docker-compose -f docker-compose.production.yml ps

# 6. View logs
docker-compose -f docker-compose.production.yml logs -f
```

### Option 2: Platform as a Service (Vercel + Railway)

#### Frontend on Vercel

1. **Connect Repository**
   - Go to Vercel dashboard
   - Import your repository
   - Select `packages/web` as root directory

2. **Configure Environment Variables**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key>
   NODE_ENV=production
   ```

3. **Deploy**
   - Vercel will automatically deploy on push to main branch

#### Backend on Railway

1. **Create New Project**
   - Go to Railway dashboard
   - Create new project from GitHub repo
   - Select `packages/backend` as root directory

2. **Add PostgreSQL Database**
   - Add PostgreSQL service
   - Railway will provide DATABASE_URL

3. **Configure Environment Variables**
   ```
   DATABASE_URL=<provided-by-railway>
   JWT_SECRET=<generate-strong-key>
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=<your-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-key>
   PORT=3001
   NODE_ENV=production
   FRONTEND_URL=https://your-app.vercel.app
   ```

4. **Deploy**
   - Railway will automatically deploy
   - Run migrations: `npm run migrate:latest`

### Option 3: AWS/GCP/Azure

See detailed cloud provider guides in `/docs/cloud-deployment/`

## Database Setup

### Managed PostgreSQL (Recommended)

Use a managed PostgreSQL service:
- **AWS RDS**
- **Google Cloud SQL**
- **Azure Database for PostgreSQL**
- **Supabase Database**
- **Railway PostgreSQL**

### Migration

```bash
# Run migrations
npm run migrate:latest

# Seed initial data (optional)
npm run seed:run

# Rollback if needed
npm run migrate:rollback
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET
- [ ] Configure CORS properly
- [ ] Enable HTTPS/SSL
- [ ] Set up rate limiting
- [ ] Configure security headers
- [ ] Enable database backups
- [ ] Set up monitoring and alerts
- [ ] Configure log aggregation
- [ ] Enable DDoS protection
- [ ] Set up firewall rules
- [ ] Use environment variables for secrets
- [ ] Enable database connection pooling
- [ ] Configure session management
- [ ] Set up API authentication
- [ ] Enable audit logging

## Monitoring

### Health Checks

```bash
# Backend health
curl https://api.your-domain.com/health

# Frontend health
curl https://your-domain.com

# Database health
psql $DATABASE_URL -c "SELECT 1"
```

### Logging

Configure centralized logging:
- **Sentry** for error tracking
- **LogRocket** for session replay
- **DataDog** for APM
- **CloudWatch** for AWS
- **Stackdriver** for GCP

### Metrics

Monitor key metrics:
- Response times
- Error rates
- Database query performance
- Memory usage
- CPU usage
- Disk usage
- Network traffic

## Backup Strategy

### Database Backups

```bash
# Automated daily backups
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup-20240115.sql
```

### File Backups

- User uploads
- Configuration files
- SSL certificates
- Environment variables

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.production.yml
services:
  backend:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

### Load Balancing

Use Nginx or cloud load balancer to distribute traffic across multiple backend instances.

### Database Scaling

- Read replicas for read-heavy workloads
- Connection pooling (PgBouncer)
- Query optimization
- Indexing strategy

## Rollback Procedure

```bash
# 1. Stop current deployment
docker-compose -f docker-compose.production.yml down

# 2. Checkout previous version
git checkout <previous-commit>

# 3. Rebuild and deploy
docker-compose -f docker-compose.production.yml up -d --build

# 4. Rollback migrations if needed
docker-compose -f docker-compose.production.yml exec backend npm run migrate:rollback
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL
   - Verify network connectivity
   - Check firewall rules

2. **Authentication Errors**
   - Verify Supabase configuration
   - Check JWT_SECRET
   - Validate token expiration

3. **CORS Errors**
   - Update CORS_ORIGIN
   - Check FRONTEND_URL
   - Verify Nginx configuration

4. **Performance Issues**
   - Check database query performance
   - Monitor memory usage
   - Review API response times
   - Check for N+1 queries

## Post-Deployment

### Verification

- [ ] Frontend loads correctly
- [ ] Backend API responds
- [ ] Database connections work
- [ ] Authentication works
- [ ] Settings can be saved
- [ ] Projects can be created
- [ ] Stories can be recorded
- [ ] All features functional

### Monitoring Setup

- [ ] Set up uptime monitoring
- [ ] Configure error alerts
- [ ] Enable performance monitoring
- [ ] Set up log aggregation
- [ ] Configure backup alerts

## Support

For deployment issues:
1. Check logs: `docker-compose logs -f`
2. Verify environment variables
3. Test database connectivity
4. Check API endpoints
5. Review Nginx configuration

## Next Steps

After successful deployment:
1. Set up CI/CD pipeline
2. Configure automated backups
3. Set up monitoring dashboards
4. Create runbooks for common issues
5. Document deployment procedures
6. Set up staging environment
7. Configure automated testing
