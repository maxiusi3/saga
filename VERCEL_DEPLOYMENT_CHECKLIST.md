# ✅ Vercel + Supabase Deployment Checklist

## Pre-Deployment (5 minutes)

### Supabase Setup
- [ ] Supabase project created
- [ ] Get Project URL from Settings → API
- [ ] Get anon public key from Settings → API
- [ ] Get service_role key from Settings → API
- [ ] Get database connection string from Settings → Database
- [ ] Copy password from database settings

### GitHub Setup
- [ ] Code pushed to GitHub repository
- [ ] Repository is accessible
- [ ] Main branch is up to date

### Vercel Account
- [ ] Vercel account created
- [ ] GitHub connected to Vercel
- [ ] Ready to import project

## Step 1: Database Setup (5 minutes)

- [ ] Open Supabase SQL Editor
- [ ] Copy migration SQL from `VERCEL_SUPABASE_DEPLOYMENT.md`
- [ ] Run migration SQL
- [ ] Verify tables created:
  - [ ] user_settings
  - [ ] user_resource_wallets
  - [ ] projects
  - [ ] project_members
  - [ ] stories
- [ ] Verify indexes created
- [ ] Verify RLS policies enabled

## Step 2: Deploy Frontend (5 minutes)

### Import Project
- [ ] Go to Vercel Dashboard
- [ ] Click "Add New..." → "Project"
- [ ] Select GitHub repository
- [ ] Click "Import"

### Configure Frontend
- [ ] Framework: Next.js (auto-detected)
- [ ] Root Directory: `packages/web`
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `.next`
- [ ] Install Command: `npm install`

### Environment Variables
Add these in Vercel:
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://xxx.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbG...`
- [ ] `NEXT_PUBLIC_API_URL` = `https://your-backend.vercel.app/api` (temporary)
- [ ] `NODE_ENV` = `production`

### Deploy
- [ ] Click "Deploy"
- [ ] Wait for build (~2-3 minutes)
- [ ] Note frontend URL: `https://_____.vercel.app`
- [ ] Verify deployment successful

## Step 3: Deploy Backend (5 minutes)

### Import Backend Project
- [ ] Go to Vercel Dashboard
- [ ] Click "Add New..." → "Project"
- [ ] Select same GitHub repository
- [ ] Click "Import"

### Configure Backend
- [ ] Framework: Other
- [ ] Root Directory: `packages/backend`
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Install Command: `npm install`

### Environment Variables
Add these in Vercel:
- [ ] `DATABASE_URL` = `postgresql://postgres:[PASSWORD]@xxx.supabase.co:5432/postgres`
- [ ] `JWT_SECRET` = Generate strong key (32+ chars)
- [ ] `SUPABASE_URL` = `https://xxx.supabase.co`
- [ ] `SUPABASE_ANON_KEY` = `eyJhbG...`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbG...`
- [ ] `PORT` = `3001`
- [ ] `NODE_ENV` = `production`
- [ ] `FRONTEND_URL` = Your frontend URL from Step 2
- [ ] `RATE_LIMIT_WINDOW_MS` = `900000`
- [ ] `RATE_LIMIT_MAX_REQUESTS` = `100`

### Deploy
- [ ] Click "Deploy"
- [ ] Wait for build (~2-3 minutes)
- [ ] Note backend URL: `https://_____.vercel.app`
- [ ] Verify deployment successful

## Step 4: Update Frontend (2 minutes)

### Update API URL
- [ ] Go to Frontend project in Vercel
- [ ] Go to Settings → Environment Variables
- [ ] Update `NEXT_PUBLIC_API_URL` to backend URL from Step 3
- [ ] Click "Save"

### Redeploy
- [ ] Go to Deployments tab
- [ ] Click "..." on latest deployment
- [ ] Click "Redeploy"
- [ ] Wait for redeployment

## Step 5: Verification (5 minutes)

### Test Backend
```bash
# Replace with your backend URL
curl https://your-backend.vercel.app/health
```
- [ ] Returns: `{"status":"ok","timestamp":"..."}`

### Test Frontend
- [ ] Visit frontend URL
- [ ] Page loads without errors
- [ ] No console errors in browser

### Test Authentication
- [ ] Click "Sign Up"
- [ ] Create test account
- [ ] Verify email (if required)
- [ ] Log in successfully
- [ ] Redirected to dashboard

### Test Features
- [ ] Dashboard loads
- [ ] Settings page loads
- [ ] Can edit profile
- [ ] Can save settings
- [ ] Settings persist after refresh
- [ ] Can create project
- [ ] No errors in console

## Step 6: Custom Domain (Optional)

### Frontend Domain
- [ ] Go to Frontend project → Settings → Domains
- [ ] Add domain: `your-domain.com`
- [ ] Configure DNS as instructed
- [ ] Wait for DNS propagation
- [ ] Verify HTTPS works

### Backend Domain
- [ ] Go to Backend project → Settings → Domains
- [ ] Add domain: `api.your-domain.com`
- [ ] Configure DNS as instructed
- [ ] Wait for DNS propagation
- [ ] Verify HTTPS works

### Update Environment Variables
- [ ] Update frontend `NEXT_PUBLIC_API_URL` to `https://api.your-domain.com/api`
- [ ] Update backend `FRONTEND_URL` to `https://your-domain.com`
- [ ] Redeploy both projects

## Post-Deployment

### Monitoring Setup
- [ ] Enable Vercel Analytics
- [ ] Set up error tracking (Sentry)
- [ ] Configure uptime monitoring
- [ ] Set up alerts

### Security
- [ ] Verify HTTPS enabled
- [ ] Check RLS policies in Supabase
- [ ] Review environment variables
- [ ] Test rate limiting
- [ ] Verify CORS configuration

### Documentation
- [ ] Document deployment URLs
- [ ] Save environment variables securely
- [ ] Update team documentation
- [ ] Create runbook for common issues

### Backup
- [ ] Enable Supabase backups (Pro plan)
- [ ] Test database backup/restore
- [ ] Document backup procedure

## Troubleshooting

### Build Fails
- [ ] Check build logs in Vercel
- [ ] Verify all environment variables set
- [ ] Check for TypeScript errors
- [ ] Verify dependencies installed

### API Not Working
- [ ] Test health endpoint
- [ ] Check backend logs in Vercel
- [ ] Verify DATABASE_URL correct
- [ ] Check CORS configuration

### Authentication Issues
- [ ] Verify Supabase keys correct
- [ ] Check JWT_SECRET set
- [ ] Test Supabase auth in dashboard
- [ ] Check browser console for errors

## Success Criteria

Your deployment is successful when:
- [ ] ✅ Frontend loads without errors
- [ ] ✅ Backend health check returns 200
- [ ] ✅ Users can sign up
- [ ] ✅ Users can log in
- [ ] ✅ Dashboard displays correctly
- [ ] ✅ Settings can be saved
- [ ] ✅ Projects can be created
- [ ] ✅ No console errors
- [ ] ✅ HTTPS enabled
- [ ] ✅ Monitoring active

## Quick Reference

### URLs
- Frontend: `https://_____.vercel.app`
- Backend: `https://_____.vercel.app`
- Supabase: `https://_____.supabase.co`

### Important Commands
```bash
# Test backend
curl https://your-backend.vercel.app/health

# View logs
vercel logs <deployment-url>

# Redeploy
vercel --prod
```

### Support
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Project Docs: `VERCEL_SUPABASE_DEPLOYMENT.md`

---

**Estimated Time**: 20-30 minutes
**Difficulty**: Easy
**Status**: Ready to deploy
