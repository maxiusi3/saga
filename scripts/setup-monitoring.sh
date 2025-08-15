#!/bin/bash

# 监控和错误追踪设置脚本
echo "🔧 Saga监控系统设置"
echo "=================================="

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

echo "✅ 在项目根目录"
echo ""

# 1. 安装监控依赖
echo "1️⃣ 安装监控依赖..."
cd packages/web

# Vercel Analytics和Speed Insights
if ! grep -q "@vercel/analytics" package.json; then
    echo "   📦 安装Vercel Analytics..."
    npm install @vercel/analytics @vercel/speed-insights
    echo "   ✅ Vercel Analytics已安装"
else
    echo "   ✅ Vercel Analytics已存在"
fi

# Web Vitals
if ! grep -q "web-vitals" package.json; then
    echo "   📦 安装Web Vitals..."
    npm install web-vitals
    echo "   ✅ Web Vitals已安装"
else
    echo "   ✅ Web Vitals已存在"
fi

# Sentry
if ! grep -q "@sentry/nextjs" package.json; then
    echo "   📦 安装Sentry..."
    npm install @sentry/nextjs
    echo "   ✅ Sentry已安装"
else
    echo "   ✅ Sentry已存在"
fi

cd ../..

# 2. 创建监控配置文件
echo ""
echo "2️⃣ 创建监控配置文件..."

# Web Vitals配置
if [ ! -f "packages/web/src/lib/web-vitals.ts" ]; then
    mkdir -p packages/web/src/lib
    cat > packages/web/src/lib/web-vitals.ts << 'EOF'
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

function sendToAnalytics(metric: any) {
  // 发送到Vercel Analytics
  if (typeof window !== 'undefined' && (window as any).va) {
    (window as any).va('track', 'Web Vital', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
    })
  }
  
  // 发送到控制台（开发环境）
  if (process.env.NODE_ENV === 'development') {
    console.log('Web Vital:', metric)
  }
}

export function reportWebVitals() {
  getCLS(sendToAnalytics)
  getFID(sendToAnalytics)
  getFCP(sendToAnalytics)
  getLCP(sendToAnalytics)
  getTTFB(sendToAnalytics)
}
EOF
    echo "   ✅ Web Vitals配置已创建"
else
    echo "   ✅ Web Vitals配置已存在"
fi

# Logger配置
if [ ! -f "packages/web/src/lib/logger.ts" ]; then
    cat > packages/web/src/lib/logger.ts << 'EOF'
export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data)
  },
  
  error: (message: string, error?: Error, data?: any) => {
    console.error(`[ERROR] ${message}`, error, data)
    
    // 发送到Sentry（仅在浏览器环境）
    if (typeof window !== 'undefined') {
      import('@sentry/nextjs').then(Sentry => {
        Sentry.captureException(error || new Error(message), {
          extra: data
        })
      }).catch(() => {
        // Sentry未配置时忽略错误
      })
    }
  },
  
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data)
  }
}
EOF
    echo "   ✅ Logger配置已创建"
else
    echo "   ✅ Logger配置已存在"
fi

# Analytics配置
if [ ! -f "packages/web/src/lib/analytics.ts" ]; then
    cat > packages/web/src/lib/analytics.ts << 'EOF'
export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    // Vercel Analytics
    if (typeof window !== 'undefined' && (window as any).va) {
      (window as any).va('track', event, properties)
    }
    
    // 开发环境日志
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', event, properties)
    }
  },
  
  // 业务关键事件
  userRegistered: (userId: string) => {
    analytics.track('User Registered', { userId })
  },
  
  projectCreated: (projectId: string, userId: string) => {
    analytics.track('Project Created', { projectId, userId })
  },
  
  storyRecorded: (storyId: string, duration: number) => {
    analytics.track('Story Recorded', { storyId, duration })
  },
  
  paymentCompleted: (amount: number, currency: string) => {
    analytics.track('Payment Completed', { amount, currency })
  }
}
EOF
    echo "   ✅ Analytics配置已创建"
else
    echo "   ✅ Analytics配置已存在"
fi

# 3. 创建健康检查API
echo ""
echo "3️⃣ 创建健康检查API..."

if [ ! -f "packages/web/src/app/api/health/route.ts" ]; then
    mkdir -p packages/web/src/app/api/health
    cat > packages/web/src/app/api/health/route.ts << 'EOF'
export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  }
  
  return Response.json(checks, { status: 200 })
}
EOF
    echo "   ✅ 健康检查API已创建"
else
    echo "   ✅ 健康检查API已存在"
fi

# 4. 更新Layout文件
echo ""
echo "4️⃣ 更新Layout文件集成监控..."

# 检查是否已经集成
if ! grep -q "@vercel/analytics" packages/web/src/app/layout.tsx; then
    echo "   ⚠️  需要手动更新packages/web/src/app/layout.tsx"
    echo "   📝 添加以下导入和组件:"
    echo ""
    cat << 'EOF'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

// 在body标签内添加:
<Analytics />
<SpeedInsights />
EOF
else
    echo "   ✅ Layout文件已集成监控"
fi

# 5. 环境变量提醒
echo ""
echo "5️⃣ 环境变量配置提醒..."
echo "   📋 需要在Vercel中设置以下环境变量:"
echo ""
echo "   # Sentry配置"
echo "   NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id"
echo "   SENTRY_ORG=your-org"
echo "   SENTRY_PROJECT=saga-app"
echo "   SENTRY_AUTH_TOKEN=your-auth-token"
echo ""
echo "   # 其他监控配置"
echo "   NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your-analytics-id"

# 6. Sentry初始化
echo ""
echo "6️⃣ Sentry初始化..."
cd packages/web

if [ ! -f "sentry.client.config.js" ]; then
    echo "   🔧 运行Sentry向导..."
    echo "   💡 如果需要，请运行: npx @sentry/wizard -i nextjs"
else
    echo "   ✅ Sentry配置已存在"
fi

cd ../..

# 7. 创建验证脚本
echo ""
echo "7️⃣ 创建监控验证脚本..."

cat > scripts/verify-monitoring.sh << 'EOF'
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
EOF

chmod +x scripts/verify-monitoring.sh

echo "   ✅ 验证脚本已创建"

# 完成总结
echo ""
echo "🎉 监控设置完成！"
echo "=================================="
echo ""
echo "📋 完成的配置:"
echo "   ✅ 安装了监控依赖"
echo "   ✅ 创建了配置文件"
echo "   ✅ 设置了健康检查API"
echo "   ✅ 创建了验证脚本"
echo ""
echo "🔧 下一步操作:"
echo "   1. 运行验证脚本: ./scripts/verify-monitoring.sh"
echo "   2. 在Vercel中配置环境变量"
echo "   3. 初始化Sentry: cd packages/web && npx @sentry/wizard -i nextjs"
echo "   4. 更新Layout文件集成Analytics组件"
echo "   5. 部署并测试监控功能"
echo ""
echo "📚 参考文档:"
echo "   • MONITORING_AND_ERROR_TRACKING_SETUP.md"
echo "   • Vercel Analytics: https://vercel.com/analytics"
echo "   • Sentry文档: https://docs.sentry.io/platforms/javascript/guides/nextjs/"