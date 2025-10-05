# 🚀 Vercel + Supabase Deployment Guide

## Overview

Deploy Saga using:
- **Frontend**: Vercel (Next.js)
- **Backend**: Vercel Serverless Functions or separate deployment
- **Database**: Supabase (PostgreSQL + Auth)
- **Source Control**: GitHub

## Architecture

```
GitHub Repository
    ↓
    ├─→ Vercel (Frontend + Backend API)
    └─→ Supabase (Database + Auth)
```

## Prerequisites

✅ You already have:
- GitHub repository
- Vercel account
- Supabase project

## Step-by-Step Deployment

### Part 1: Supabase Setup (5 minutes)

#### 1. Get Supabase Credentials

Go to your Supabase project dashboard:
- URL: `https://app.supabase.com/project/YOUR_PROJECT_ID`

**Get these values**:
1. Go to **Settings** → **API**
   - `Project URL`: `https://xxx.supabase.co`
   - `anon public key`: `eyJhbG...`
   - `service_role key`: `eyJhbG...` (keep secret!)

2. Go to **Settings** → **Database**
   - `Connection string`: `postgresql://postgres:[YOUR-PASSWORD]@xxx.supabase.co:5432/postgres`

#### 2. Run Database Migrations

**Option A: Using Supabase SQL Editor (Recommended)**

1. Go to **SQL Editor** in Supabase dashboard
2. Create a new query
3. Copy and paste the migration SQL from `supabase-migration.sql` file

Or copy this safe version:

```sql
-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Notification settings
    notification_email BOOLEAN DEFAULT true,
    notification_push BOOLEAN DEFAULT true,
    notification_story_updates BOOLEAN DEFAULT true,
    notification_follow_up_questions BOOLEAN DEFAULT true,
    notification_weekly_digest BOOLEAN DEFAULT false,
    notification_marketing_emails BOOLEAN DEFAULT false,
    
    -- Accessibility settings
    accessibility_font_size VARCHAR(20) DEFAULT 'standard',
    accessibility_high_contrast BOOLEAN DEFAULT false,
    accessibility_reduced_motion BOOLEAN DEFAULT false,
    accessibility_screen_reader BOOLEAN DEFAULT false,
    
    -- Audio settings
    audio_volume INTEGER DEFAULT 75,
    audio_quality VARCHAR(20) DEFAULT 'high',
    
    -- Privacy settings
    privacy_profile_visible BOOLEAN DEFAULT true,
    privacy_story_sharing BOOLEAN DEFAULT true,
    privacy_data_analytics BOOLEAN DEFAULT false,
    privacy_two_factor_auth BOOLEAN DEFAULT false,
    
    -- Language settings
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Create user_resource_wallets table
CREATE TABLE IF NOT EXISTS user_resource_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    project_vouchers INTEGER DEFAULT 0,
    facilitator_seats INTEGER DEFAULT 0,
    storyteller_seats INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    facilitator_id UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'active',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_members table
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('facilitator', 'storyteller')),
    status VARCHAR(20) DEFAULT 'active',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(project_id, user_id)
);

-- Create stories table
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    storyteller_id UUID NOT NULL REFERENCES auth.users(id),
    
    title VARCHAR(255),
    ai_generated_title VARCHAR(255),
    transcript TEXT,
    ai_summary TEXT,
    audio_url TEXT,
    photo_url TEXT,
    duration INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_resource_wallets_user_id ON user_resource_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_facilitator_id ON projects(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_project_id ON stories(project_id);
CREATE INDEX IF NOT EXISTS idx_stories_storyteller_id ON stories(storyteller_id);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resource_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_settings
CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_resource_wallets
CREATE POLICY "Users can view own wallet" ON user_resource_wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON user_resource_wallets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet" ON user_resource_wallets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for projects
CREATE POLICY "Users can view projects they're members of" ON projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Facilitators can update their projects" ON projects
    FOR UPDATE USING (facilitator_id = auth.uid());

CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (facilitator_id = auth.uid());

-- RLS Policies for project_members
CREATE POLICY "Users can view project members" ON project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
        )
    );

-- RLS Policies for stories
CREATE POLICY "Users can view stories in their projects" ON stories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = stories.project_id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Storytellers can create stories" ON stories
    FOR INSERT WITH CHECK (storyteller_id = auth.uid());

CREATE POLICY "Storytellers can update own stories" ON stories
    FOR UPDATE USING (storyteller_id = auth.uid());
```

4. Click **Run** to execute

**Option B: Using Local Migration**

```bash
# In your local terminal
cd packages/backend

# Set Supabase database URL
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@xxx.supabase.co:5432/postgres"

# Run migrations
npm run migrate:latest
```

### Part 2: Vercel Deployment (10 minutes)

#### 1. Deploy Frontend

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard

2. **Import Project**:
   - Click "Add New..." → "Project"
   - Select your GitHub repository
   - Click "Import"

3. **Configure Project**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `packages/web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

4. **Environment Variables** (Click "Environment Variables"):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# API URL (will be your backend URL)
NEXT_PUBLIC_API_URL=https://your-backend.vercel.app/api

# Environment
NODE_ENV=production
```

5. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete (~2-3 minutes)
   - Note your frontend URL: `https://your-app.vercel.app`

#### 2. Deploy Backend

**Option A: Separate Vercel Project (Recommended)**

1. **Create New Project** in Vercel:
   - Click "Add New..." → "Project"
   - Select same GitHub repository
   - Click "Import"

2. **Configure Backend Project**:
   - **Framework Preset**: Other
   - **Root Directory**: `packages/backend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Environment Variables**:

```env
# Database
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@xxx.supabase.co:5432/postgres

# JWT
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

4. **Deploy**:
   - Click "Deploy"
   - Note your backend URL: `https://your-backend.vercel.app`

5. **Update Frontend Environment**:
   - Go back to frontend project
   - Update `NEXT_PUBLIC_API_URL` to your backend URL
   - Redeploy frontend

**Option B: Vercel Serverless Functions**

If you want to use Vercel serverless functions instead:

1. Move backend API routes to `packages/web/pages/api/`
2. Configure as serverless functions
3. Use same environment variables in frontend project

### Part 3: Configure Custom Domain (Optional)

#### 1. Add Domain to Vercel

**Frontend**:
1. Go to Project Settings → Domains
2. Add your domain: `your-domain.com`
3. Follow DNS configuration instructions

**Backend**:
1. Go to Backend Project Settings → Domains
2. Add subdomain: `api.your-domain.com`
3. Follow DNS configuration instructions

#### 2. Update Environment Variables

Update frontend environment:
```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api
```

Update backend environment:
```env
FRONTEND_URL=https://your-domain.com
```

Redeploy both projects.

### Part 4: Verification (5 minutes)

#### 1. Test Backend

```bash
# Health check
curl https://your-backend.vercel.app/health

# Should return: {"status":"ok","timestamp":"..."}
```

#### 2. Test Frontend

1. Visit: `https://your-app.vercel.app`
2. Sign up / Log in
3. Go to Settings page
4. Try saving settings
5. Check browser console for errors

#### 3. Test Full Flow

1. ✅ User can sign up
2. ✅ User can log in
3. ✅ Dashboard loads
4. ✅ Settings can be saved
5. ✅ Projects can be created
6. ✅ No console errors

## Automatic Deployments

### GitHub Integration

Vercel automatically deploys when you push to GitHub:

- **Production**: Push to `main` branch
- **Preview**: Push to any other branch or PR

### Deployment Workflow

```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push origin main

# Vercel automatically:
# 1. Detects push
# 2. Builds project
# 3. Runs tests
# 4. Deploys to production
# 5. Sends notification
```

## Environment Management

### Development
```env
# .env.local (not committed)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Production
```env
# Vercel Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api
```

## Monitoring

### Vercel Analytics

1. Go to Project → Analytics
2. View:
   - Page views
   - Performance metrics
   - Error rates
   - Geographic distribution

### Supabase Monitoring

1. Go to Supabase Dashboard
2. Check:
   - Database usage
   - API requests
   - Auth users
   - Storage usage

### Error Tracking

Add Sentry for error tracking:

```bash
# Install Sentry
npm install @sentry/nextjs

# Configure in next.config.js
```

## Troubleshooting

### Build Fails

**Check build logs**:
1. Go to Vercel project
2. Click on failed deployment
3. View build logs
4. Fix errors and push again

**Common issues**:
- Missing environment variables
- TypeScript errors
- Missing dependencies

### API Not Working

**Check**:
1. Backend is deployed
2. Environment variables are set
3. CORS is configured
4. Database connection works

**Test**:
```bash
curl https://your-backend.vercel.app/health
```

### Database Connection Failed

**Check**:
1. DATABASE_URL is correct
2. Supabase project is active
3. Connection pooling configured
4. IP whitelist (if any)

## Scaling

### Vercel Scaling

Vercel automatically scales:
- Serverless functions
- Edge network
- CDN caching

### Supabase Scaling

Upgrade Supabase plan for:
- More database storage
- More API requests
- Better performance
- Priority support

## Cost Estimation

### Free Tier

**Vercel**:
- Unlimited deployments
- 100GB bandwidth/month
- Serverless function executions

**Supabase**:
- 500MB database
- 2GB bandwidth
- 50,000 monthly active users

### Paid Plans

**Vercel Pro** ($20/month):
- More bandwidth
- Better performance
- Team features

**Supabase Pro** ($25/month):
- 8GB database
- 50GB bandwidth
- Daily backups

## Security Checklist

- [x] Environment variables secured
- [x] HTTPS enabled (automatic on Vercel)
- [x] Row Level Security enabled in Supabase
- [x] JWT_SECRET is strong and unique
- [x] Service role key kept secret
- [x] CORS configured properly
- [x] Rate limiting enabled

## Backup Strategy

### Database Backups

**Supabase Pro**:
- Automatic daily backups
- Point-in-time recovery
- Manual backup option

**Manual Backup**:
```bash
# Export database
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## Next Steps

1. ✅ Set up custom domain
2. ✅ Configure monitoring
3. ✅ Set up error tracking (Sentry)
4. ✅ Enable analytics
5. ✅ Configure backups
6. ✅ Set up CI/CD tests
7. ✅ Create staging environment

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **GitHub Issues**: Your repository issues

---

**Deployment Status**: ✅ Ready to deploy
**Estimated Time**: 20-30 minutes
**Difficulty**: Easy
