# 监控和错误追踪设置指南

## 🎯 监控策略概览

### 核心监控指标
- **性能监控**: 页面加载时间、API响应时间
- **错误追踪**: JavaScript错误、API错误、构建错误
- **用户体验**: 核心Web指标、用户流程完成率
- **业务指标**: 用户注册、项目创建、故事录制成功率

## 🔧 Vercel内置监控

### 1. Vercel Analytics
```bash
# 安装Vercel Analytics
npm install @vercel/analytics

# 在应用中集成
# packages/web/src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### 2. Vercel Speed Insights
```bash
# 安装Speed Insights
npm install @vercel/speed-insights

# 集成到应用
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
```

## 🚨 错误追踪 - Sentry

### 1. Sentry设置
```bash
# 安装Sentry
npm install @sentry/nextjs

# 初始化配置
npx @sentry/wizard -i nextjs
```

### 2. 配置文件
```javascript
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: ['localhost', /^https:\/\/saga-app\.vercel\.app/],
    }),
  ],
})
```

```javascript
// sentry.server.config.js
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
})
```

### 3. 环境变量
```bash
# Vercel环境变量
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ORG=your-org
SENTRY_PROJECT=saga-app
SENTRY_AUTH_TOKEN=your-auth-token
```

## 📊 性能监控 - Web Vitals

### 1. 自定义Web Vitals追踪
```javascript
// packages/web/src/lib/web-vitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

function sendToAnalytics(metric) {
  // 发送到你的分析服务
  console.log(metric)
  
  // 发送到Vercel Analytics
  if (window.va) {
    window.va('track', 'Web Vital', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
    })
  }
}

export function reportWebVitals() {
  getCLS(sendToAnalytics)
  getFID(sendToAnalytics)
  getFCP(sendToAnalytics)
  getLCP(sendToAnalytics)
  getTTFB(sendToAnalytics)
}
```

### 2. 集成到应用
```javascript
// packages/web/src/app/layout.tsx
'use client'
import { useEffect } from 'react'
import { reportWebVitals } from '@/lib/web-vitals'

export default function RootLayout({ children }) {
  useEffect(() => {
    reportWebVitals()
  }, [])

  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

## 🔍 日志管理

### 1. 结构化日志
```javascript
// packages/web/src/lib/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data)
    // 发送到日志服务
  },
  
  error: (message: string, error?: Error, data?: any) => {
    console.error(`[ERROR] ${message}`, error, data)
    // 发送到Sentry
    if (typeof window !== 'undefined') {
      import('@sentry/nextjs').then(Sentry => {
        Sentry.captureException(error || new Error(message), {
          extra: data
        })
      })
    }
  },
  
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data)
  }
}
```

### 2. API错误追踪
```javascript
// packages/web/src/lib/api-client.ts
import { logger } from './logger'

export async function apiCall(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options)
    
    if (!response.ok) {
      logger.error(`API Error: ${response.status}`, undefined, {
        url,
        status: response.status,
        statusText: response.statusText
      })
    }
    
    return response
  } catch (error) {
    logger.error('Network Error', error as Error, { url })
    throw error
  }
}
```

## 📈 业务指标监控

### 1. 自定义事件追踪
```javascript
// packages/web/src/lib/analytics.ts
export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    // Vercel Analytics
    if (window.va) {
      window.va('track', event, properties)
    }
    
    // 自定义分析
    console.log('Analytics Event:', event, properties)
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
```

### 2. 用户流程监控
```javascript
// packages/web/src/hooks/use-funnel-tracking.ts
import { useEffect } from 'react'
import { analytics } from '@/lib/analytics'

export function useFunnelTracking(step: string, data?: any) {
  useEffect(() => {
    analytics.track('Funnel Step', { step, ...data })
  }, [step, data])
}

// 使用示例
function SignupPage() {
  useFunnelTracking('signup_page_viewed')
  
  const handleSignup = () => {
    useFunnelTracking('signup_attempted')
    // 注册逻辑
  }
}
```

## 🚨 告警设置

### 1. Vercel告警
- 部署失败告警
- 性能下降告警
- 错误率上升告警

### 2. Sentry告警
```javascript
// Sentry告警规则示例
{
  "conditions": [
    {
      "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
      "interval": "1m",
      "value": 10
    }
  ],
  "actions": [
    {
      "id": "sentry.rules.actions.notify_event.NotifyEventAction"
    }
  ]
}
```

### 3. 自定义健康检查
```javascript
// packages/web/src/app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    supabase: await checkSupabase(),
    storage: await checkStorage(),
    timestamp: new Date().toISOString()
  }
  
  const isHealthy = Object.values(checks).every(check => 
    typeof check === 'boolean' ? check : true
  )
  
  return Response.json(checks, { 
    status: isHealthy ? 200 : 503 
  })
}
```

## 📊 监控仪表板

### 1. Vercel Dashboard
- 访问: https://vercel.com/dashboard
- 查看: 部署状态、性能指标、错误日志

### 2. Sentry Dashboard
- 访问: https://sentry.io
- 查看: 错误详情、性能问题、发布健康

### 3. 自定义仪表板
```javascript
// packages/web/src/app/admin/monitoring/page.tsx
export default function MonitoringDashboard() {
  return (
    <div>
      <h1>Saga监控仪表板</h1>
      
      {/* 实时指标 */}
      <MetricsGrid />
      
      {/* 错误趋势 */}
      <ErrorTrends />
      
      {/* 性能图表 */}
      <PerformanceCharts />
      
      {/* 用户活动 */}
      <UserActivity />
    </div>
  )
}
```

## 🔧 设置脚本

### 1. 快速设置脚本
```bash
#!/bin/bash
# scripts/setup-monitoring.sh

echo "🔧 设置监控和错误追踪..."

# 安装依赖
npm install @vercel/analytics @vercel/speed-insights @sentry/nextjs web-vitals

# 初始化Sentry
npx @sentry/wizard -i nextjs

# 设置环境变量提醒
echo "⚠️  请在Vercel中设置以下环境变量:"
echo "   NEXT_PUBLIC_SENTRY_DSN"
echo "   SENTRY_ORG"
echo "   SENTRY_PROJECT"
echo "   SENTRY_AUTH_TOKEN"

echo "✅ 监控设置完成！"
```

### 2. 验证脚本
```bash
#!/bin/bash
# scripts/verify-monitoring.sh

echo "🔍 验证监控配置..."

# 检查Sentry配置
if [ -f "sentry.client.config.js" ]; then
    echo "✅ Sentry客户端配置存在"
else
    echo "❌ Sentry客户端配置缺失"
fi

# 检查Analytics集成
if grep -q "@vercel/analytics" packages/web/package.json; then
    echo "✅ Vercel Analytics已安装"
else
    echo "❌ Vercel Analytics未安装"
fi

echo "✅ 监控验证完成！"
```

## 📚 最佳实践

### 1. 监控策略
- **分层监控**: 基础设施 → 应用 → 业务
- **主动告警**: 问题发生前预警
- **用户体验**: 关注真实用户体验指标

### 2. 错误处理
- **优雅降级**: 错误不影响核心功能
- **详细日志**: 便于问题定位
- **快速恢复**: 自动重试和故障转移

### 3. 性能优化
- **持续监控**: 定期检查性能指标
- **渐进优化**: 基于数据驱动优化
- **用户反馈**: 结合用户反馈改进

---

通过完整的监控和错误追踪设置，你可以：
- 🔍 实时了解应用健康状况
- 🚨 快速发现和解决问题
- 📊 基于数据优化用户体验
- 💡 持续改进产品质量