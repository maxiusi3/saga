# Saga Family Biography - GitHub + Supabase + Vercel 部署指南

## 技术栈概述

**GitHub + Supabase + Vercel** 是一个强大的现代化部署组合：

- **GitHub**: 代码托管和版本控制
- **Supabase**: 开源 Firebase 替代品，提供数据库、认证、存储、实时功能
- **Vercel**: 前端和全栈应用的部署平台，优化的 Next.js 支持

## 架构调整建议

### 🔄 从当前架构到 Supabase 架构的迁移

```
当前架构:                    →    Supabase 架构:
├── PostgreSQL (自托管)      →    ├── Supabase Database (PostgreSQL)
├── Node.js/Express API      →    ├── Supabase Edge Functions
├── Firebase Auth            →    ├── Supabase Auth
├── AWS S3                   →    ├── Supabase Storage
├── SendGrid                 →    ├── Supabase (+ SendGrid)
├── WebSocket                →    ├── Supabase Realtime
└── Next.js Web              →    └── Next.js (Vercel)
```

## 第一步：GitHub 仓库设置

### 1.1 创建 GitHub 仓库
```bash
# 如果还没有推送到 GitHub
git init
git add .
git commit -m "Initial commit: Saga Family Biography v1.5 MVP"
git branch -M main
git remote add origin https://github.com/yourusername/saga-family-biography.git
git push -u origin main
```

### 1.2 设置 GitHub Actions (可选但推荐)
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test --workspace=packages/shared
      - run: npm run test --workspace=packages/web
      - run: npm run build --workspace=packages/web
```

## 第二步：Supabase 项目设置

### 2.1 创建 Supabase 项目
1. 访问 [supabase.com](https://supabase.com)
2. 创建新项目
3. 选择区域（推荐选择离用户最近的区域）
4. 记录项目 URL 和 anon key

### 2.2 数据库迁移到 Supabase

创建 Supabase 迁移脚本：

```bash
# 安装 Supabase CLI
npm install -g supabase

# 初始化 Supabase 项目
supabase init

# 链接到你的 Supabase 项目
supabase link --project-ref YOUR_PROJECT_REF
```

创建迁移转换脚本：
```javascript
// scripts/migrate-to-supabase.js
const fs = require('fs');
const path = require('path');

// 读取现有的 Knex 迁移文件
const migrationsDir = 'packages/backend/migrations';
const supabaseMigrationsDir = 'supabase/migrations';

// 转换 Knex 迁移到 Supabase SQL 格式
function convertKnexToSupabase() {
  const migrationFiles = fs.readdirSync(migrationsDir);
  
  migrationFiles.forEach(file => {
    if (file.endsWith('.js')) {
      // 读取 Knex 迁移文件并转换为 SQL
      console.log(`Converting ${file}...`);
      // 实现转换逻辑
    }
  });
}

convertKnexToSupabase();
```

### 2.3 Supabase 认证设置

```sql
-- supabase/migrations/001_auth_setup.sql

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建用户资源钱包表
CREATE TABLE user_resource_wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_vouchers INTEGER DEFAULT 0,
  facilitator_seats INTEGER DEFAULT 0,
  storyteller_seats INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用 RLS (Row Level Security)
ALTER TABLE user_resource_wallets ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Users can view own wallet" ON user_resource_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON user_resource_wallets
  FOR UPDATE USING (auth.uid() = user_id);
```

### 2.4 Supabase 存储设置

```sql
-- 创建存储桶
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('story-audio', 'story-audio', false),
  ('story-photos', 'story-photos', false),
  ('exports', 'exports', false);

-- 设置存储策略
CREATE POLICY "Users can upload their own audio" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'story-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own audio" ON storage.objects
  FOR SELECT USING (bucket_id = 'story-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## 第三步：代码调整

### 3.1 创建 Supabase 客户端配置

```typescript
// packages/web/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// 服务端客户端
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
```

### 3.2 更新认证系统

```typescript
// packages/web/src/lib/auth.ts
import { supabase } from './supabase'

export const authService = {
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    return { data, error }
  },

  async signInWithApple() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  }
}
```

### 3.3 创建 API 路由 (Next.js API Routes)

```typescript
// packages/web/src/app/api/projects/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .eq('created_by', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ projects })
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { name, description } = await request.json()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 检查用户是否有项目券
  const { data: wallet } = await supabase
    .from('user_resource_wallets')
    .select('project_vouchers')
    .eq('user_id', user.id)
    .single()

  if (!wallet || wallet.project_vouchers < 1) {
    return NextResponse.json({ error: 'Insufficient project vouchers' }, { status: 400 })
  }

  // 创建项目并消费券
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name,
      description,
      created_by: user.id
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 消费项目券
  await supabase
    .from('user_resource_wallets')
    .update({ project_vouchers: wallet.project_vouchers - 1 })
    .eq('user_id', user.id)

  return NextResponse.json({ project })
}
```

### 3.4 实时功能集成

```typescript
// packages/web/src/hooks/use-realtime-stories.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Story } from '@/types/story'

export function useRealtimeStories(projectId: string) {
  const [stories, setStories] = useState<Story[]>([])

  useEffect(() => {
    // 获取初始数据
    const fetchStories = async () => {
      const { data } = await supabase
        .from('stories')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      
      if (data) setStories(data)
    }

    fetchStories()

    // 设置实时订阅
    const channel = supabase
      .channel('stories')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stories',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setStories(prev => [payload.new as Story, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setStories(prev => prev.map(story => 
              story.id === payload.new.id ? payload.new as Story : story
            ))
          } else if (payload.eventType === 'DELETE') {
            setStories(prev => prev.filter(story => story.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  return stories
}
```

## 第四步：Vercel 部署

### 4.1 Vercel 项目设置

1. 访问 [vercel.com](https://vercel.com)
2. 连接 GitHub 账户
3. 导入 Saga 仓库
4. 选择 `packages/web` 作为根目录

### 4.2 环境变量配置

在 Vercel 项目设置中添加环境变量：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=your-openai-key

# Stripe
STRIPE_SECRET_KEY=your-stripe-secret-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret

# SendGrid (如果继续使用)
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# App Settings
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 4.3 Vercel 配置文件

```json
// vercel.json
{
  "buildCommand": "npm run build --workspace=packages/web",
  "outputDirectory": "packages/web/.next",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "functions": {
    "packages/web/src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

### 4.4 构建优化

```javascript
// packages/web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['your-project.supabase.co'],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // 优化构建
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 启用 SWC minify
  swcMinify: true,
}

module.exports = nextConfig
```

## 第五步：移动应用调整

### 5.1 React Native Supabase 集成

```bash
# 安装 Supabase React Native 客户端
npm install @supabase/supabase-js react-native-url-polyfill
```

```typescript
// packages/mobile/src/lib/supabase.ts
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = 'https://your-project.supabase.co'
const supabaseAnonKey = 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

### 5.2 移动认证流程

```typescript
// packages/mobile/src/services/auth-service.ts
import { supabase } from '../lib/supabase'

export const mobileAuthService = {
  async signInWithApple() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
    })
    return { data, error }
  },

  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
    return { data, error }
  },

  async uploadAudio(audioUri: string, fileName: string) {
    const { data, error } = await supabase.storage
      .from('story-audio')
      .upload(`${Date.now()}_${fileName}`, {
        uri: audioUri,
        type: 'audio/mp4',
        name: fileName,
      })
    
    return { data, error }
  }
}
```

## 第六步：部署脚本更新

创建新的部署脚本：

```bash
#!/bin/bash
# scripts/deploy-supabase-vercel.sh

set -e

echo "🚀 Deploying Saga to Supabase + Vercel..."

# 1. 推送到 GitHub
echo "📤 Pushing to GitHub..."
git add .
git commit -m "Deploy: $(date)"
git push origin main

# 2. 运行 Supabase 迁移
echo "🗄️ Running Supabase migrations..."
supabase db push

# 3. 部署到 Vercel (自动触发)
echo "🌐 Vercel deployment will be triggered automatically..."

# 4. 运行种子数据 (如果需要)
echo "🌱 Running seed data..."
supabase db seed

echo "✅ Deployment completed!"
echo "🔗 Check your Vercel dashboard for deployment status"
```

## 成本分析

### 💰 预估月度成本 (500 活跃用户)

| 服务 | 免费额度 | 付费价格 | 预估成本 |
|------|----------|----------|----------|
| **GitHub** | 无限公共仓库 | $4/月 (私有) | $0-4 |
| **Supabase** | 500MB 数据库, 1GB 存储 | $25/月 (Pro) | $0-25 |
| **Vercel** | 100GB 带宽 | $20/月 (Pro) | $0-20 |
| **总计** | | | **$0-49/月** |

### 🆚 与 AWS 对比

| 方案 | 设置复杂度 | 维护成本 | 月度费用 | 扩展性 |
|------|------------|----------|----------|--------|
| **GitHub+Supabase+Vercel** | 低 | 低 | $0-49 | 中-高 |
| **AWS (原方案)** | 高 | 高 | $50-200+ | 高 |

## 迁移建议和最佳实践

### 🔄 迁移策略

1. **渐进式迁移**
   - 先迁移 Web 应用到 Vercel
   - 然后迁移数据库到 Supabase
   - 最后迁移认证和存储

2. **数据迁移**
   ```bash
   # 导出现有数据
   pg_dump your_current_db > backup.sql
   
   # 导入到 Supabase
   psql -h db.your-project.supabase.co -U postgres -d postgres < backup.sql
   ```

3. **测试策略**
   - 使用 Supabase 的分支功能进行测试
   - 设置 staging 环境
   - 逐步切换流量

### 🛡️ 安全最佳实践

1. **Row Level Security (RLS)**
   ```sql
   -- 确保所有表都启用 RLS
   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
   
   -- 创建细粒度策略
   CREATE POLICY "Users can only see their projects" ON projects
     FOR SELECT USING (
       auth.uid() IN (
         SELECT user_id FROM project_roles WHERE project_id = projects.id
       )
     );
   ```

2. **API 安全**
   ```typescript
   // 中间件验证
   export async function middleware(request: NextRequest) {
     const supabase = createMiddlewareClient({ req: request, res: response })
     const { data: { session } } = await supabase.auth.getSession()
     
     if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
       return NextResponse.redirect(new URL('/auth/signin', request.url))
     }
   }
   ```

### 📊 监控和分析

1. **Supabase 分析**
   - 内置数据库性能监控
   - API 使用统计
   - 实时连接监控

2. **Vercel 分析**
   - 页面性能监控
   - 用户访问统计
   - 错误跟踪

3. **自定义分析**
   ```typescript
   // 集成 Posthog 或 Mixpanel
   import { PostHog } from 'posthog-js'
   
   export const analytics = {
     track: (event: string, properties?: any) => {
       if (typeof window !== 'undefined') {
         PostHog.capture(event, properties)
       }
     }
   }
   ```

## 下一步行动计划

### 🎯 立即行动 (第1周)
1. ✅ 创建 Supabase 项目
2. ✅ 设置 GitHub 仓库
3. ✅ 配置 Vercel 项目
4. ✅ 迁移核心数据库表

### 📈 短期目标 (第2-4周)
1. 🔄 迁移认证系统
2. 🔄 更新 API 路由
3. 🔄 测试实时功能
4. 🔄 部署到生产环境

### 🚀 长期优化 (1-3月)
1. 📊 性能优化
2. 🔍 监控和分析
3. 📱 移动应用优化
4. 🌍 全球 CDN 优化

这个方案将大大简化你的部署和维护工作，同时保持高性能和可扩展性。需要我详细解释任何部分吗？