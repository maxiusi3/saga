# 🚀 Saga - Production Deployment

## Quick Links

- 📖 [Quick Deploy Guide](QUICK_DEPLOY_GUIDE.md) - Deploy in 5 minutes
- 📋 [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) - Complete checklist
- 🔧 [Full Deployment Guide](PRODUCTION_DEPLOYMENT.md) - Detailed instructions
- ✅ [Deployment Ready](DEPLOYMENT_READY.md) - Current status

## Current Status

✅ **All features verified locally and ready for production**

### What's Working
- User authentication and authorization
- Settings management (profile, notifications, accessibility)
- Resource wallet system (projects, facilitator seats, storyteller seats)
- Project management with validity tracking
- Dashboard with statistics
- Member management with role-based access
- Story management (basic structure ready)

### Technology Stack
- **Frontend**: Next.js 14 with TypeScript
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL 15
- **Authentication**: Supabase Auth
- **Deployment**: Docker + Docker Compose

## Deployment Options

### 1. Docker Deployment (Recommended for VPS)

**Best for**: VPS, dedicated servers, self-hosting

```bash
# Quick deploy
./deploy-production.sh
```

**Pros**:
- Full control
- Consistent environment
- Easy rollback
- Cost-effective

**Cons**:
- Requires server management
- Manual scaling

### 2. Platform as a Service (Easiest)

**Best for**: Quick deployment, automatic scaling

**Frontend on Vercel**:
- Connect GitHub repository
- Auto-deploy on push
- Global CDN
- Free tier available

**Backend on Railway**:
- One-click PostgreSQL
- Auto-deploy on push
- Easy scaling
- Free tier available

**Pros**:
- Zero server management
- Automatic scaling
- Built-in monitoring
- Easy setup

**Cons**:
- Higher cost at scale
- Less control

### 3. Cloud Providers (Enterprise)

**Best for**: Large scale, enterprise needs

- **AWS**: EC2 + RDS + S3
- **Google Cloud**: Compute Engine + Cloud SQL
- **Azure**: App Service + Database

**Pros**:
- Enterprise features
- Advanced monitoring
- High availability
- Compliance certifications

**Cons**:
- Complex setup
- Higher cost
- Requires expertise

## Quick Start

### Prerequisites

1. **Domain Name**: your-domain.com
2. **Database**: PostgreSQL (managed service recommended)
3. **Supabase Project**: For authentication
4. **Server**: With Docker installed (for Docker deployment)

### 5-Minute Deploy

```bash
# 1. Clone repository
git clone <your-repo-url>
cd saga

# 2. Configure environment
cp .env.production.example .env.production
nano .env.production  # Edit with your values

# 3. Deploy
./deploy-production.sh

# 4. Verify
curl http://localhost:3001/health
curl http://localhost:3000
```

### Environment Variables

**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Strong random key (32+ characters)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `FRONTEND_URL` - Your production domain
- `NEXT_PUBLIC_API_URL` - Your API endpoint

See `.env.production.example` for complete list.

## Post-Deployment

### 1. Configure SSL/HTTPS

```bash
# Using Let's Encrypt
sudo certbot certonly --standalone -d your-domain.com
```

### 2. Set Up Monitoring

- **Uptime**: UptimeRobot, Pingdom
- **Errors**: Sentry
- **Performance**: New Relic, DataDog
- **Logs**: Papertrail, CloudWatch

### 3. Configure Backups

```bash
# Database backup
docker-compose -f docker-compose.production.yml exec backend npm run backup

# Schedule daily backups
crontab -e
# Add: 0 2 * * * /path/to/backup-script.sh
```

### 4. Security Hardening

- [ ] Enable HTTPS
- [ ] Configure firewall
- [ ] Set up fail2ban
- [ ] Enable rate limiting
- [ ] Configure security headers
- [ ] Review CORS settings
- [ ] Rotate secrets regularly

## Maintenance

### View Logs
```bash
docker-compose -f docker-compose.production.yml logs -f
```

### Restart Services
```bash
docker-compose -f docker-compose.production.yml restart
```

### Update Deployment
```bash
git pull
./deploy-production.sh
```

### Rollback
```bash
git checkout <previous-version>
./deploy-production.sh
```

## Troubleshooting

### Services Won't Start
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs

# Verify environment variables
cat .env.production

# Check Docker status
docker ps -a
```

### Database Connection Failed
```bash
# Test database
psql $DATABASE_URL -c "SELECT 1"

# Check firewall
# Ensure database port is accessible
```

### Frontend Not Loading
```bash
# Check frontend logs
docker-compose -f docker-compose.production.yml logs frontend

# Verify build
docker-compose -f docker-compose.production.yml exec frontend npm run build
```

## Support

### Documentation
- [Quick Deploy Guide](QUICK_DEPLOY_GUIDE.md)
- [Full Deployment Guide](PRODUCTION_DEPLOYMENT.md)
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md)
- [Backend Start Guide](BACKEND_START_GUIDE.md)

### Common Issues
- **Port in use**: `lsof -i :3001` and kill process
- **Database connection**: Check DATABASE_URL and firewall
- **Authentication errors**: Verify Supabase configuration
- **CORS errors**: Check FRONTEND_URL and CORS_ORIGIN

### Getting Help
1. Check documentation
2. Review logs
3. Test health endpoints
4. Verify environment variables
5. Check firewall rules

## Architecture

```
┌─────────────────────────────────────────────┐
│           Users (Browser/Mobile)            │
└─────────────────┬───────────────────────────┘
                  │
                  │ HTTPS
                  ▼
┌─────────────────────────────────────────────┐
│              Nginx (Reverse Proxy)          │
│         SSL Termination, Load Balancing     │
└─────────┬───────────────────────┬───────────┘
          │                       │
          │                       │
          ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│   Frontend       │    │   Backend API    │
│   (Next.js)      │    │   (Express)      │
│   Port 3000      │    │   Port 3001      │
└──────────────────┘    └────────┬─────────┘
                                 │
                                 │
                                 ▼
                        ┌──────────────────┐
                        │   PostgreSQL     │
                        │   Database       │
                        └──────────────────┘
```

## Features

### Implemented ✅
- User authentication (Supabase)
- Settings management
- Resource wallet system
- Project management
- Dashboard statistics
- Member management
- Role-based access control
- Project validity tracking

### Coming Soon 🔄
- Story recording and playback
- AI prompt system
- Chapter summaries
- Follow-up questions
- Email notifications
- File uploads
- Advanced analytics

## Performance

### Optimization
- Next.js static generation
- API response caching
- Database query optimization
- Image optimization
- Code splitting
- Lazy loading

### Scaling
- Horizontal scaling with Docker replicas
- Database read replicas
- CDN for static assets
- Redis for caching (optional)
- Load balancing

## Security

### Implemented
- JWT authentication
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection
- CSRF protection
- Security headers
- CORS configuration

### Best Practices
- Strong password requirements
- Secure session management
- Regular security audits
- Dependency updates
- Error logging
- Access control

## License

[Your License Here]

## Contact

[Your Contact Information]

---

**Ready to deploy?** Start with the [Quick Deploy Guide](QUICK_DEPLOY_GUIDE.md)!
