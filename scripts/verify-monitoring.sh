#!/bin/bash

echo "🔍 验证监控配置..."

# 检查依赖
echo "📦 检查依赖安装:"
cd packages/web

if grep -q "@vercel/analytics" package.json; then
    echo "   ✅ Vercel Analytics"
else
    echo "   ❌ Vercel Analytics"
fi

if grep -q "@sentry/nextjs" package.json; then
    echo "   ✅ Sentry"
else
    echo "   ❌ Sentry"
fi

if grep -q "web-vitals" package.json; then
    echo "   ✅ Web Vitals"
else
    echo "   ❌ Web Vitals"
fi

cd ../..

# 检查配置文件
echo ""
echo "📁 检查配置文件:"

files=(
    "packages/web/src/lib/web-vitals.ts"
    "packages/web/src/lib/logger.ts"
    "packages/web/src/lib/analytics.ts"
    "packages/web/src/app/api/health/route.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file"
    fi
done

# 检查Sentry配置
echo ""
echo "🚨 检查Sentry配置:"
if [ -f "packages/web/sentry.client.config.js" ]; then
    echo "   ✅ Sentry客户端配置"
else
    echo "   ❌ Sentry客户端配置"
fi

if [ -f "packages/web/sentry.server.config.js" ]; then
    echo "   ✅ Sentry服务端配置"
else
    echo "   ❌ Sentry服务端配置"
fi

echo ""
echo "✅ 监控验证完成！"
