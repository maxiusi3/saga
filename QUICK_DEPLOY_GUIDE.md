# Quick Deploy Guide

## 🚀 Deploy to Production in 5 Minutes

### Prerequisites
- Server with Docker installed
- Domain name configured
- Database ready (PostgreSQL)
- Supabase project created

### Step 1: Clone and Configure (2 min)

```bash
# Clone repository
git clone <your-repo-url>
cd saga

# Create environment file
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

**Required Environment Variables:**
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=<generate-strong-random-key>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<your-key>
SUPABASE_SERVICE_ROLE_KEY=<your-key>
FRONTEND_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

### Step 2: Deploy (2 min)

```bash
# Run deployment script
./deploy-production.sh
```

The script will:
- ✅ Check prerequisites
- ✅ Validate environment variables
- ✅ Build Docker images
- ✅ Start services
- ✅ Run database migrations
- ✅ Verify health checks

### Step 3: Verify (1 min)

```bash
# Check services are running
docker-compose -f docker-compose.production.yml ps

# Test backend
curl http://localhost:3001/health

# Test frontend
curl http://localhost:3000
```

### Done! 🎉

Your application is now running:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

## Next Steps

### Configure SSL/HTTPS

```bash
# Install certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com -d api.your-domain.com

# Configure Nginx (see PRODUCTION_DEPLOYMENT.md)
```

### Set Up Monitoring

```bash
# View logs
docker-compose -f docker-compose.production.yml logs -f

# Check resource usage
docker stats
```

### Configure Backups

```bash
# Database backup
docker-compose -f docker-compose.production.yml exec backend npm run backup

# Schedule daily backups
crontab -e
# Add: 0 2 * * * /path/to/backup-script.sh
```

## Common Commands

```bash
# View logs
docker-compose -f docker-compose.production.yml logs -f

# Restart services
docker-compose -f docker-compose.production.yml restart

# Stop services
docker-compose -f docker-compose.production.yml down

# Update deployment
git pull
./deploy-production.sh

# Run migrations
docker-compose -f docker-compose.production.yml exec backend npm run migrate:latest

# Rollback migration
docker-compose -f docker-compose.production.yml exec backend npm run migrate:rollback
```

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs

# Check environment variables
cat .env.production

# Verify database connection
docker-compose -f docker-compose.production.yml exec backend npm run db:test
```

### Database connection failed
```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check firewall rules
# Ensure database port is accessible from server
```

### Frontend not loading
```bash
# Check frontend logs
docker-compose -f docker-compose.production.yml logs frontend

# Verify environment variables
docker-compose -f docker-compose.production.yml exec frontend env | grep NEXT_PUBLIC
```

## Platform-Specific Guides

### Deploy to Vercel + Railway

**Frontend (Vercel):**
1. Connect GitHub repository
2. Set root directory: `packages/web`
3. Add environment variables
4. Deploy

**Backend (Railway):**
1. Create new project from GitHub
2. Set root directory: `packages/backend`
3. Add PostgreSQL database
4. Add environment variables
5. Deploy
6. Run migrations

### Deploy to AWS

See `docs/aws-deployment.md`

### Deploy to Google Cloud

See `docs/gcp-deployment.md`

## Support

- 📖 Full guide: `PRODUCTION_DEPLOYMENT.md`
- ✅ Checklist: `DEPLOYMENT_CHECKLIST.md`
- 🔧 Backend guide: `BACKEND_START_GUIDE.md`
- 📊 Session summary: `SESSION_COMPLETE_SUMMARY.md`

## Security Reminders

- ✅ Change all default passwords
- ✅ Use strong JWT_SECRET
- ✅ Enable HTTPS
- ✅ Configure firewall
- ✅ Set up monitoring
- ✅ Enable backups
- ✅ Review security headers
- ✅ Configure rate limiting

---

**Need help?** Check the full documentation or create an issue.
