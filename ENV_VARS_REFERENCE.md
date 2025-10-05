# 🔑 Environment Variables Reference

## Quick Copy-Paste Templates

### Frontend (Vercel Project 1)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# API
NEXT_PUBLIC_API_URL=https://your-backend.vercel.app/api

# Environment
NODE_ENV=production
```

### Backend (Vercel Project 2)

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

## Where to Find Values

### Supabase Values

**Location**: https://app.supabase.com/project/YOUR_PROJECT_ID

| Variable | Where to Find | Example |
|----------|---------------|---------|
| `SUPABASE_URL` | Settings → API → Project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Settings → API → anon public | `eyJhbG...` (long string) |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role | `eyJhbG...` (long string) |
| `DATABASE_URL` | Settings → Database → Connection string | `postgresql://postgres:...` |

**⚠️ Important**: 
- `SUPABASE_ANON_KEY` is public (safe to expose)
- `SUPABASE_SERVICE_ROLE_KEY` is secret (never expose!)

### Generate JWT_SECRET

```bash
# Option 1: OpenSSL
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Online
# Visit: https://generate-secret.vercel.app/32
```

**Result**: Something like `xK7mP9nQ2wR5tY8uI1oP3aS6dF9gH2jK4lZ7xC0vB5nM8qW1eR4tY7uI0oP3aS6d`

### Vercel URLs

After deploying:
- Frontend: Shown in Vercel dashboard after deployment
- Backend: Shown in Vercel dashboard after deployment

Format: `https://your-project-name.vercel.app`

## Step-by-Step Setup

### 1. Get Supabase Credentials (2 min)

```bash
# Open Supabase Dashboard
https://app.supabase.com

# Navigate to your project
# Click: Settings → API

# Copy these 3 values:
✓ Project URL
✓ anon public key
✓ service_role key

# Then: Settings → Database
✓ Connection string (with your password)
```

### 2. Generate JWT Secret (30 sec)

```bash
openssl rand -base64 32
# Copy the output
```

### 3. Deploy Frontend (5 min)

In Vercel, add these environment variables:

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: [Paste from Supabase]

Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [Paste from Supabase]

Name: NEXT_PUBLIC_API_URL
Value: https://your-backend.vercel.app/api
(Use temporary value, update after backend deployed)

Name: NODE_ENV
Value: production
```

### 4. Deploy Backend (5 min)

In Vercel, add these environment variables:

```
Name: DATABASE_URL
Value: [Paste from Supabase, replace [YOUR-PASSWORD]]

Name: JWT_SECRET
Value: [Paste generated secret]

Name: SUPABASE_URL
Value: [Same as frontend]

Name: SUPABASE_ANON_KEY
Value: [Same as frontend]

Name: SUPABASE_SERVICE_ROLE_KEY
Value: [Paste from Supabase]

Name: PORT
Value: 3001

Name: NODE_ENV
Value: production

Name: FRONTEND_URL
Value: [Your frontend URL from step 3]

Name: RATE_LIMIT_WINDOW_MS
Value: 900000

Name: RATE_LIMIT_MAX_REQUESTS
Value: 100
```

### 5. Update Frontend API URL (2 min)

After backend is deployed:
1. Go to frontend project in Vercel
2. Settings → Environment Variables
3. Edit `NEXT_PUBLIC_API_URL`
4. Change to: `https://your-backend.vercel.app/api`
5. Redeploy

## Verification Checklist

### Frontend Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` starts with `https://`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` starts with `eyJ`
- [ ] `NEXT_PUBLIC_API_URL` ends with `/api`
- [ ] `NODE_ENV` is `production`

### Backend Variables
- [ ] `DATABASE_URL` starts with `postgresql://`
- [ ] `JWT_SECRET` is at least 32 characters
- [ ] `SUPABASE_URL` matches frontend
- [ ] `SUPABASE_ANON_KEY` matches frontend
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is different from anon key
- [ ] `FRONTEND_URL` matches your frontend URL
- [ ] All variables are set

## Common Mistakes

### ❌ Wrong DATABASE_URL Format
```
Wrong: postgresql://postgres@xxx.supabase.co:5432/postgres
Right: postgresql://postgres:YOUR_PASSWORD@xxx.supabase.co:5432/postgres
```
**Fix**: Add `:YOUR_PASSWORD` after `postgres`

### ❌ Missing /api in API URL
```
Wrong: NEXT_PUBLIC_API_URL=https://backend.vercel.app
Right: NEXT_PUBLIC_API_URL=https://backend.vercel.app/api
```
**Fix**: Add `/api` at the end

### ❌ Using Service Role Key in Frontend
```
Wrong: NEXT_PUBLIC_SUPABASE_ANON_KEY=<service_role_key>
Right: NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_public_key>
```
**Fix**: Use anon key (public), not service role key (secret)

### ❌ Weak JWT Secret
```
Wrong: JWT_SECRET=secret123
Right: JWT_SECRET=xK7mP9nQ2wR5tY8uI1oP3aS6dF9gH2jK4lZ7xC0vB5nM8qW1eR4tY7uI0oP3aS6d
```
**Fix**: Generate strong random key (32+ characters)

## Testing Variables

### Test Backend Connection
```bash
# Replace with your backend URL
curl https://your-backend.vercel.app/health

# Should return:
{"status":"ok","timestamp":"2024-01-15T..."}
```

### Test Frontend
1. Open: `https://your-frontend.vercel.app`
2. Open browser console (F12)
3. Check for errors
4. Try to sign up/login

### Test Database
```bash
# Test connection (replace with your DATABASE_URL)
psql "postgresql://postgres:PASSWORD@xxx.supabase.co:5432/postgres" -c "SELECT 1"

# Should return:
 ?column? 
----------
        1
```

## Security Best Practices

### ✅ Do
- Use strong, random JWT_SECRET
- Keep service_role key secret
- Use environment variables (never hardcode)
- Rotate secrets regularly
- Use different values for dev/prod

### ❌ Don't
- Commit secrets to Git
- Share service_role key
- Use weak passwords
- Reuse secrets across projects
- Expose secrets in client code

## Backup Your Variables

Save your environment variables securely:

```bash
# Create a secure backup file (DO NOT COMMIT)
cat > .env.backup << 'EOF'
# Frontend
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=...

# Backend
DATABASE_URL=...
JWT_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...
EOF

# Encrypt the backup
gpg -c .env.backup

# Store encrypted file safely
# Delete unencrypted version
rm .env.backup
```

## Quick Reference Card

Print this and keep it handy:

```
┌─────────────────────────────────────────────┐
│         SAGA ENVIRONMENT VARIABLES          │
├─────────────────────────────────────────────┤
│ Frontend (4 variables):                     │
│  • NEXT_PUBLIC_SUPABASE_URL                 │
│  • NEXT_PUBLIC_SUPABASE_ANON_KEY            │
│  • NEXT_PUBLIC_API_URL                      │
│  • NODE_ENV                                 │
├─────────────────────────────────────────────┤
│ Backend (10 variables):                     │
│  • DATABASE_URL                             │
│  • JWT_SECRET                               │
│  • SUPABASE_URL                             │
│  • SUPABASE_ANON_KEY                        │
│  • SUPABASE_SERVICE_ROLE_KEY                │
│  • PORT                                     │
│  • NODE_ENV                                 │
│  • FRONTEND_URL                             │
│  • RATE_LIMIT_WINDOW_MS                     │
│  • RATE_LIMIT_MAX_REQUESTS                  │
└─────────────────────────────────────────────┘
```

---

**Need help?** Check `VERCEL_SUPABASE_DEPLOYMENT.md` for detailed guide
