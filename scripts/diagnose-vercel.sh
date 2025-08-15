#!/bin/bash

# Vercel Deployment Diagnosis Script

echo "🔍 Diagnosing Vercel Deployment Issues..."
echo "========================================"

echo ""
echo "📁 Project Structure:"
echo "- Root: $(pwd)"
echo "- Web package: $(test -d packages/web && echo "✅ EXISTS" || echo "❌ MISSING")"
echo "- Shared package: $(test -d packages/shared && echo "✅ EXISTS" || echo "❌ MISSING")"

echo ""
echo "📄 Configuration Files:"
echo "- vercel.json: $(test -f vercel.json && echo "✅ EXISTS" || echo "❌ MISSING")"
echo "- package.json: $(test -f package.json && echo "✅ EXISTS" || echo "❌ MISSING")"
echo "- web/package.json: $(test -f packages/web/package.json && echo "✅ EXISTS" || echo "❌ MISSING")"

echo ""
echo "🔧 Vercel Configuration:"
if [ -f vercel.json ]; then
    echo "Current vercel.json:"
    cat vercel.json | jq '.' 2>/dev/null || cat vercel.json
else
    echo "❌ No vercel.json found"
fi

echo ""
echo "📦 Build Scripts:"
echo "Root package.json build scripts:"
if [ -f package.json ]; then
    grep -A 5 '"scripts"' package.json | grep -E '(build|vercel)'
else
    echo "❌ No root package.json found"
fi

echo ""
echo "Web package.json build scripts:"
if [ -f packages/web/package.json ]; then
    grep -A 10 '"scripts"' packages/web/package.json | grep -E '(build|vercel|dev|start)'
else
    echo "❌ No web package.json found"
fi

echo ""
echo "🧪 Testing Build Commands:"
echo "Testing if build:vercel script exists in root..."
if npm run build:vercel --dry-run 2>/dev/null; then
    echo "✅ build:vercel script found in root"
else
    echo "❌ build:vercel script not found in root"
fi

echo ""
echo "📊 Git Status:"
echo "Current branch: $(git branch --show-current)"
echo "Last commit: $(git log -1 --oneline)"
echo "Uncommitted changes: $(git status --porcelain | wc -l | tr -d ' ') files"

echo ""
echo "🔄 Recent Commits (last 5):"
git log --oneline -5

echo ""
echo "💡 Recommendations:"
echo "1. Ensure Vercel project is connected to the correct GitHub repo"
echo "2. Check that Vercel is watching the 'main' branch"
echo "3. Verify build command in Vercel dashboard matches vercel.json"
echo "4. Check Vercel build logs for specific error messages"
echo "5. Consider manual deployment: vercel --prod"

echo ""
echo "🚀 Next Steps:"
echo "Run: ./scripts/force-vercel-redeploy.sh"
echo "Then monitor: https://vercel.com/dashboard"