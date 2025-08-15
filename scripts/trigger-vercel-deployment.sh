#!/bin/bash

# Trigger Vercel Deployment Script
# This script forces a new Vercel deployment by making a small change

echo "🚀 Triggering Vercel deployment..."

# Get current timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create a deployment trigger file
echo "# Deployment Trigger - $TIMESTAMP" > VERCEL_DEPLOYMENT_TRIGGER.md
echo "" >> VERCEL_DEPLOYMENT_TRIGGER.md
echo "This file is used to trigger Vercel deployments." >> VERCEL_DEPLOYMENT_TRIGGER.md
echo "Last triggered: $(date)" >> VERCEL_DEPLOYMENT_TRIGGER.md
echo "" >> VERCEL_DEPLOYMENT_TRIGGER.md
echo "## Recent Changes" >> VERCEL_DEPLOYMENT_TRIGGER.md
echo "- Fixed Simple CI workflow" >> VERCEL_DEPLOYMENT_TRIGGER.md
echo "- Updated Vercel configuration for monorepo" >> VERCEL_DEPLOYMENT_TRIGGER.md
echo "- Fixed Web package build process" >> VERCEL_DEPLOYMENT_TRIGGER.md

# Add to git
git add VERCEL_DEPLOYMENT_TRIGGER.md

# Commit with deployment trigger message
git commit -m "deploy: Trigger Vercel deployment - $TIMESTAMP

- Update Vercel configuration for monorepo structure
- Fix Web package build process to include shared dependencies
- Force deployment trigger after CI fixes"

# Push to trigger deployment
git push

echo "✅ Deployment trigger pushed to GitHub"
echo "🔄 Vercel should now detect the changes and start a new deployment"
echo ""
echo "Monitor deployment at: https://vercel.com/dashboard"