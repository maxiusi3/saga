# Production Deployment Checklist

## Pre-Deployment

### Environment Setup
- [ ] Domain name configured and DNS pointing to server
- [ ] SSL certificate obtained (Let's Encrypt or purchased)
- [ ] Server provisioned (minimum 2GB RAM, 2 CPU cores)
- [ ] Docker and Docker Compose installed
- [ ] Git installed on server
- [ ] Firewall configured (ports 80, 443, 22 open)

### Database Setup
- [ ] PostgreSQL database provisioned (managed service recommended)
- [ ] Database credentials secured
- [ ] Database backups configured
- [ ] Connection pooling configured (if needed)

### Supabase Setup
- [ ] Supabase project created
- [ ] Authentication providers configured
- [ ] API keys obtained
- [ ] Database policies configured
- [ ] Storage buckets created (if needed)

### Environment Variables
- [ ] `.env.production` created
- [ ] `DATABASE_URL` configured
- [ ] `JWT_SECRET` generated (strong random key)
- [ ] `SUPABASE_URL` configured
- [ ] `SUPABASE_ANON_KEY` configured
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configured
- [ ] `FRONTEND_URL` configured
- [ ] `NEXT_PUBLIC_API_URL` configured
- [ ] All secrets are unique and strong

## Deployment Steps

### 1. Clone Repository
```bash
- [ ] git clone <repository-url>
- [ ] cd saga
```

### 2. Configure Environment
```bash
- [ ] Copy .env.production.example to .env.production
- [ ] Edit .env.production with production values
- [ ] Verify all environment variables
```

### 3. Build and Deploy
```bash
- [ ] Run: ./deploy-production.sh
- [ ] Verify build completes successfully
- [ ] Check all containers are running
```

### 4. Database Migration
```bash
- [ ] Run migrations: docker-compose -f docker-compose.production.yml exec backend npm run migrate:latest
- [ ] Verify migrations completed
- [ ] Check database tables created
```

### 5. Health Checks
```bash
- [ ] Backend health: curl http://localhost:3001/health
- [ ] Frontend health: curl http://localhost:3000
- [ ] Database connection: Test via backend API
```

## Post-Deployment

### Security
- [ ] HTTPS/SSL configured and working
- [ ] HTTP redirects to HTTPS
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Firewall rules applied
- [ ] SSH key-based authentication only
- [ ] Fail2ban or similar configured
- [ ] Database not publicly accessible
- [ ] Environment variables not exposed

### Monitoring
- [ ] Uptime monitoring configured (UptimeRobot, Pingdom, etc.)
- [ ] Error tracking configured (Sentry)
- [ ] Log aggregation configured
- [ ] Performance monitoring configured
- [ ] Alerts configured for critical issues
- [ ] Health check endpoints monitored

### Backups
- [ ] Database backup schedule configured
- [ ] Backup restoration tested
- [ ] File backup configured (if applicable)
- [ ] Backup retention policy defined
- [ ] Off-site backup storage configured

### Documentation
- [ ] Deployment process documented
- [ ] Environment variables documented
- [ ] Rollback procedure documented
- [ ] Troubleshooting guide created
- [ ] Team access documented

## Verification Tests

### Frontend Tests
- [ ] Homepage loads correctly
- [ ] User can sign up
- [ ] User can log in
- [ ] Dashboard displays correctly
- [ ] Settings page works
- [ ] Projects can be created
- [ ] Stories can be recorded
- [ ] All navigation works
- [ ] Mobile responsive
- [ ] No console errors

### Backend Tests
- [ ] Health endpoint responds: `/health`
- [ ] Authentication works
- [ ] Settings API works: `/api/settings/*`
- [ ] Projects API works: `/api/projects/*`
- [ ] Dashboard API works: `/api/dashboard/*`
- [ ] Error handling works
- [ ] Rate limiting works
- [ ] CORS configured correctly

### Database Tests
- [ ] Connections work
- [ ] Queries execute correctly
- [ ] Migrations applied
- [ ] Indexes created
- [ ] Constraints enforced
- [ ] Backups working

### Performance Tests
- [ ] Page load times acceptable (<3s)
- [ ] API response times acceptable (<500ms)
- [ ] Database queries optimized
- [ ] Images optimized
- [ ] Caching configured
- [ ] CDN configured (if applicable)

## Rollback Plan

### If Deployment Fails
1. [ ] Stop new deployment: `docker-compose -f docker-compose.production.yml down`
2. [ ] Checkout previous version: `git checkout <previous-tag>`
3. [ ] Rebuild: `docker-compose -f docker-compose.production.yml up -d --build`
4. [ ] Rollback migrations if needed: `npm run migrate:rollback`
5. [ ] Verify old version works
6. [ ] Investigate and fix issues
7. [ ] Document what went wrong

## Maintenance

### Regular Tasks
- [ ] Weekly: Review logs for errors
- [ ] Weekly: Check disk space
- [ ] Weekly: Review performance metrics
- [ ] Monthly: Update dependencies
- [ ] Monthly: Review and rotate logs
- [ ] Monthly: Test backup restoration
- [ ] Quarterly: Security audit
- [ ] Quarterly: Performance optimization review

### Updates
- [ ] Test updates in staging first
- [ ] Schedule maintenance window
- [ ] Notify users of downtime
- [ ] Create backup before update
- [ ] Deploy update
- [ ] Verify update successful
- [ ] Monitor for issues

## Emergency Contacts

- [ ] DevOps team contact info documented
- [ ] Database admin contact info documented
- [ ] Hosting provider support info documented
- [ ] On-call rotation schedule defined

## Sign-off

- [ ] Deployment tested by: _________________ Date: _______
- [ ] Security reviewed by: _________________ Date: _______
- [ ] Performance verified by: ______________ Date: _______
- [ ] Documentation reviewed by: ____________ Date: _______
- [ ] Approved for production by: ___________ Date: _______

## Notes

Additional notes or issues encountered during deployment:

```
[Add notes here]
```

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Version**: _______________
**Commit Hash**: _______________
