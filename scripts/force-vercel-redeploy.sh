#!/bin/bash

# Force Vercel Redeploy Script
# This script makes meaningful changes to force Vercel to redeploy

echo "🔄 Forcing Vercel redeploy with code changes..."

# Get current timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Update deployment trigger file with more content
cat > VERCEL_DEPLOYMENT_TRIGGER.md << EOF
# Vercel Deployment Trigger - $TIMESTAMP

This file is used to force Vercel deployments when automatic detection fails.

## Last Update
- **Timestamp**: $(date)
- **Trigger**: Force redeploy after CI fixes
- **Status**: Attempting deployment

## Recent Changes
- ✅ Fixed Simple CI workflow (now passing)
- ✅ Fixed Minimal CI workflow (now passing)  
- 🔄 Updated Vercel configuration for monorepo
- 🔄 Simplified build commands
- 🔄 Added proper workspace handling

## Configuration Updates
- Updated vercel.json with simplified build command
- Added build:vercel script to root package.json
- Ensured shared package builds before web package

## Expected Deployment Flow
1. Install dependencies: \`npm ci\`
2. Build shared package: \`npm run build --workspace=packages/shared\`
3. Build web package: \`npm run build --workspace=packages/web\`
4. Deploy from: \`packages/web/.next\`

## Troubleshooting
If this deployment still fails:
1. Check Vercel project settings
2. Verify Git integration is working
3. Check build logs for specific errors
4. Consider manual deployment via Vercel CLI

---
**Deployment ID**: FORCE_DEPLOY_$TIMESTAMP
EOF

# Also update a source file to ensure Vercel sees a real change
echo "// Updated: $TIMESTAMP" >> packages/web/src/app/globals.css

# Add all changes
git add .

# Commit with force deploy message
git commit -m "deploy: Force Vercel redeploy - $TIMESTAMP

🚀 FORCE DEPLOYMENT TRIGGER

Changes made:
- Update deployment trigger documentation
- Simplify Vercel build configuration  
- Add build:vercel script to root package.json
- Touch source files to ensure change detection

CI Status: ✅ Both Simple CI and Minimal CI passing
Expected: Vercel should detect these changes and start deployment

Build Command: npm run build:vercel
Output Directory: packages/web/.next"

# Push to trigger deployment
git push

echo ""
echo "✅ Force deployment changes pushed to GitHub"
echo "🔄 Vercel should now detect the changes and start deployment"
echo ""
echo "📊 Monitor deployment:"
echo "   - GitHub: https://github.com/maxiusi3/saga/actions"
echo "   - Vercel: https://vercel.com/dashboard"
echo ""
echo "🔍 If still no deployment, check:"
echo "   1. Vercel project Git integration settings"
echo "   2. Branch configuration (should be 'main')"
echo "   3. Build command configuration in Vercel dashboard"