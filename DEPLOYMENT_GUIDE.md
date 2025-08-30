# Saga MVP - Automated Deployment Guide

## 🎯 Overview

This guide will help you set up automated deployment for Saga MVP using GitHub Actions and Vercel, with the unified Supabase architecture.

## 🏗️ Architecture Summary

**After Supabase Migration:**
- ✅ **Frontend**: Next.js deployed to Vercel (`saga-web`)
- ✅ **Backend**: Supabase (unified managed service)
- ✅ **Database**: Supabase PostgreSQL
- ✅ **Authentication**: Supabase Auth
- ✅ **Storage**: Supabase Storage
- ✅ **Payments**: Stripe integration
- ❌ **Backend Deployment**: No longer needed (removed `saga-backend`)

## 🚀 Quick Setup

### 1. Prerequisites

```bash
# Install Vercel CLI
npm install -g vercel@latest

# Login to Vercel
vercel login

# Ensure you have access to:
# - GitHub repository: https://github.com/maxiusi3/saga
# - Vercel account with appropriate permissions
# - Supabase project with credentials
```

### 2. Automated Setup

Run the setup script to configure everything automatically:

```bash
chmod +x scripts/setup-vercel-deployment.sh
./scripts/setup-vercel-deployment.sh
```

This script will:
- Link your project to Vercel
- Configure environment variables
- Set up build configuration
- Provide GitHub Actions setup instructions

### 3. Manual Setup (Alternative)

If you prefer manual setup:

#### Step 3.1: Link Vercel Project

```bash
cd packages/web
vercel link
# Follow prompts to link to existing project or create new one
```

#### Step 3.2: Configure Environment Variables

Set up production environment variables:

```bash
# Supabase Configuration
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Enter: https://encdblxyxztvfxotfuyh.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Enter: your-supabase-anon-key

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Enter: your-supabase-service-role-key

# Stripe Configuration
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
# Enter: pk_live_your_key (or pk_test_placeholder_key for testing)

vercel env add STRIPE_SECRET_KEY production
# Enter: sk_live_your_key (or sk_test_placeholder_key for testing)

# App Configuration
vercel env add NEXT_PUBLIC_APP_URL production
# Enter: https://saga-web-livid.vercel.app
```

Repeat for preview environment:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
# ... repeat for all variables
```

## 🔧 GitHub Actions Configuration

### Required GitHub Secrets

Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

```bash
# Get these values from packages/web/.vercel/project.json after linking
VERCEL_ORG_ID=your-org-id
VERCEL_PROJECT_ID=your-project-id

# Get from https://vercel.com/account/tokens
VERCEL_TOKEN=your-vercel-token
```

### Workflow Files

The following workflow files are already configured:

1. **`.github/workflows/deploy-vercel.yml`** - Main deployment workflow
2. **`.github/workflows/environment-sync.yml`** - Environment variable management

## 📦 Deployment Process

### Automatic Deployments

- **Production**: Push to `main` branch
- **Preview**: Create/update Pull Request

### Manual Deployment

```bash
# Deploy to production
cd packages/web
vercel --prod

# Deploy preview
vercel
```

## 🔍 Monitoring and Verification

### Health Checks

The deployment includes automatic health checks:

1. **Build Verification**: Ensures successful build
2. **Deployment Status**: Confirms deployment completion
3. **Basic Health Check**: Verifies application startup

### Manual Verification

After deployment, verify:

```bash
# Check deployment status
curl https://your-deployment-url/health

# Verify Supabase connection
# Check browser console for any connection errors

# Test core functionality
# - User registration/login
# - Project creation (if you have resources)
# - Basic navigation
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Check build logs in GitHub Actions
# Common causes:
# - Missing environment variables
# - TypeScript errors
# - Missing dependencies
```

**Solution**: 
- Verify all environment variables are set
- Check for TypeScript errors locally
- Ensure all dependencies are installed

#### 2. Environment Variable Issues

```bash
# Verify environment variables are set
vercel env ls

# Pull environment variables locally for testing
vercel env pull .env.local
```

#### 3. Supabase Connection Issues

**Symptoms**: 
- Authentication failures
- Database connection errors
- API calls failing

**Solution**:
- Verify Supabase URL and keys
- Check Supabase project status
- Ensure RLS policies are properly configured

#### 4. Stripe Integration Issues

**Symptoms**:
- Payment form not loading
- Stripe errors in console

**Solution**:
- Verify Stripe keys are correct
- Check if using test vs live keys appropriately
- Ensure Stripe webhook endpoints are configured

### Debug Commands

```bash
# Check Vercel project configuration
cd packages/web
vercel inspect

# View deployment logs
vercel logs

# Test build locally
npm run build

# Check environment variables
vercel env ls
```

## 📊 Deployment Checklist

### Pre-Deployment

- [ ] Supabase project is set up and configured
- [ ] Database schema is deployed (run `supabase-minimal-setup.sql`)
- [ ] Environment variables are configured in Vercel
- [ ] GitHub secrets are added
- [ ] Local build passes (`npm run build`)

### Post-Deployment

- [ ] Deployment completed successfully
- [ ] Health check passes
- [ ] Supabase connection works
- [ ] Authentication flow works
- [ ] Payment integration loads (even with placeholder keys)
- [ ] Core user flows are functional

### Production Readiness

- [ ] Replace Stripe placeholder keys with live keys
- [ ] Configure custom domain (if needed)
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategies
- [ ] Review security headers and CSP

## 🔄 Continuous Deployment

### Branch Strategy

- **`main`** → Production deployment
- **`develop`** → Preview deployment
- **Feature branches** → Preview deployment via PR

### Environment Promotion

1. **Development** → Test locally with `.env.local`
2. **Preview** → Deploy via PR for review
3. **Production** → Merge to main for live deployment

## 📞 Support

### Resources

- **Vercel Documentation**: https://vercel.com/docs
- **GitHub Actions**: https://docs.github.com/en/actions
- **Supabase Docs**: https://supabase.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment

### Getting Help

1. Check deployment logs in GitHub Actions
2. Review Vercel function logs
3. Check Supabase dashboard for errors
4. Verify environment variable configuration

---

**🎉 Your Saga MVP is now ready for automated deployment with the unified Supabase architecture!**
