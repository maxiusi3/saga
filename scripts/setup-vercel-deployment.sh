#!/bin/bash

# Saga MVP - Vercel Deployment Setup Script
# This script helps configure Vercel deployment for the unified Supabase architecture

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Saga MVP - Vercel Deployment Setup${NC}"
echo -e "${BLUE}======================================${NC}"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel@latest
fi

# Check if user is logged in to Vercel
echo -e "${BLUE}🔐 Checking Vercel authentication...${NC}"
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Please log in to Vercel first:${NC}"
    echo "vercel login"
    exit 1
fi

echo -e "${GREEN}✅ Vercel CLI ready${NC}"

# Navigate to web package
cd packages/web

echo -e "${BLUE}📦 Setting up Vercel project for saga-web...${NC}"

# Link or create Vercel project
if [ ! -f ".vercel/project.json" ]; then
    echo -e "${YELLOW}🔗 Linking to Vercel project...${NC}"
    vercel link --yes
else
    echo -e "${GREEN}✅ Already linked to Vercel project${NC}"
fi

# Set up environment variables
echo -e "${BLUE}🔧 Configuring environment variables...${NC}"

# Production environment variables
echo -e "${YELLOW}Setting up PRODUCTION environment variables...${NC}"

# Supabase configuration
read -p "Enter your Supabase Project URL: " SUPABASE_URL
read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY
read -s -p "Enter your Supabase Service Role Key: " SUPABASE_SERVICE_ROLE_KEY
echo

# Stripe configuration
read -p "Enter your Stripe Publishable Key (or press Enter for placeholder): " STRIPE_PUBLISHABLE_KEY
read -s -p "Enter your Stripe Secret Key (or press Enter for placeholder): " STRIPE_SECRET_KEY
echo

# App URL
read -p "Enter your app URL (e.g., https://saga-web-livid.vercel.app): " APP_URL

# Set default values if empty
STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY:-"pk_test_placeholder_key"}
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-"sk_test_placeholder_key"}

# Set production environment variables
echo -e "${BLUE}📝 Setting production environment variables...${NC}"

vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "$SUPABASE_URL"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "$SUPABASE_ANON_KEY"
vercel env add SUPABASE_SERVICE_ROLE_KEY production <<< "$SUPABASE_SERVICE_ROLE_KEY"
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production <<< "$STRIPE_PUBLISHABLE_KEY"
vercel env add STRIPE_SECRET_KEY production <<< "$STRIPE_SECRET_KEY"
vercel env add NEXT_PUBLIC_APP_URL production <<< "$APP_URL"

# Set preview environment variables (same as production for now)
echo -e "${BLUE}📝 Setting preview environment variables...${NC}"

vercel env add NEXT_PUBLIC_SUPABASE_URL preview <<< "$SUPABASE_URL"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview <<< "$SUPABASE_ANON_KEY"
vercel env add SUPABASE_SERVICE_ROLE_KEY preview <<< "$SUPABASE_SERVICE_ROLE_KEY"
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY preview <<< "$STRIPE_PUBLISHABLE_KEY"
vercel env add STRIPE_SECRET_KEY preview <<< "$STRIPE_SECRET_KEY"
vercel env add NEXT_PUBLIC_APP_URL preview <<< "$APP_URL"

echo -e "${GREEN}✅ Environment variables configured${NC}"

# Configure build settings
echo -e "${BLUE}⚙️  Configuring build settings...${NC}"

# Create or update vercel.json with proper build configuration
cat > vercel.json << EOF
{
  "version": 2,
  "name": "saga-web",
  "buildCommand": "cd ../.. && npm run build:web",
  "outputDirectory": ".next",
  "installCommand": "cd ../.. && npm ci && cd packages/web && npm ci",
  "framework": "nextjs",
  "functions": {
    "src/app/api/**/*.ts": {
      "runtime": "nodejs18.x"
    }
  }
}
EOF

echo -e "${GREEN}✅ Build configuration updated${NC}"

# Test deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"
read -p "Would you like to deploy now? (y/N): " DEPLOY_NOW

if [[ $DEPLOY_NOW =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🚀 Deploying to Vercel...${NC}"
    vercel --prod
    echo -e "${GREEN}✅ Deployment complete!${NC}"
else
    echo -e "${YELLOW}⏭️  Skipping deployment. You can deploy later with: vercel --prod${NC}"
fi

# Go back to root directory
cd ../..

# Display GitHub Actions setup instructions
echo -e "${BLUE}📋 GitHub Actions Setup Instructions${NC}"
echo -e "${BLUE}====================================${NC}"
echo -e "${YELLOW}To complete the automated deployment setup:${NC}"
echo ""
echo -e "${GREEN}1. Add the following secrets to your GitHub repository:${NC}"
echo "   - VERCEL_TOKEN (get from https://vercel.com/account/tokens)"
echo "   - VERCEL_ORG_ID (found in .vercel/project.json)"
echo "   - VERCEL_PROJECT_ID (found in .vercel/project.json)"
echo ""
echo -e "${GREEN}2. Your GitHub Actions workflow is already configured in:${NC}"
echo "   .github/workflows/deploy-vercel.yml"
echo ""
echo -e "${GREEN}3. Push to main branch to trigger production deployment${NC}"
echo -e "${GREEN}4. Create PR to trigger preview deployment${NC}"
echo ""

# Display project information
if [ -f "packages/web/.vercel/project.json" ]; then
    echo -e "${BLUE}📊 Project Information${NC}"
    echo -e "${BLUE}=====================${NC}"
    echo -e "${GREEN}Vercel Project ID:${NC} $(cat packages/web/.vercel/project.json | grep -o '"projectId":"[^"]*' | cut -d'"' -f4)"
    echo -e "${GREEN}Vercel Org ID:${NC} $(cat packages/web/.vercel/project.json | grep -o '"orgId":"[^"]*' | cut -d'"' -f4)"
fi

echo ""
echo -e "${GREEN}🎉 Vercel deployment setup complete!${NC}"
echo -e "${BLUE}Your Saga MVP is ready for automated deployment with the unified Supabase architecture.${NC}"

# Architecture summary
echo ""
echo -e "${BLUE}🏗️  Architecture Summary${NC}"
echo -e "${BLUE}=======================${NC}"
echo -e "${GREEN}✅ Frontend:${NC} Next.js on Vercel (saga-web)"
echo -e "${GREEN}✅ Backend:${NC} Supabase (unified architecture)"
echo -e "${GREEN}✅ Database:${NC} Supabase PostgreSQL"
echo -e "${GREEN}✅ Auth:${NC} Supabase Auth"
echo -e "${GREEN}✅ Storage:${NC} Supabase Storage"
echo -e "${GREEN}✅ Payments:${NC} Stripe integration"
echo -e "${GREEN}✅ Deployment:${NC} GitHub Actions → Vercel"
echo ""
echo -e "${YELLOW}Note: Backend deployment (saga-backend) is no longer needed${NC}"
echo -e "${YELLOW}due to the migration to unified Supabase architecture.${NC}"
