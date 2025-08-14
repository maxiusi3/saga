# Saga Family Biography - GitHub + Supabase + Vercel 部署检查清单

## 🚀 快速部署指南

### 第一步：GitHub 设置 ✅
- [ ] 创建 GitHub 仓库
- [ ] 推送代码到 main 分支
- [ ] 设置 GitHub Actions (可选)

```bash
git init
git add .
git commit -m "Initial commit: Saga Family Biography v1.5 MVP"
git branch -M main
git remote add origin https://github.com/yourusername/saga-family-biography.git
git push -u origin main
```

### 第二步：Supabase 项目设置 ✅
- [ ] 在 [supabase.com](https://supabase.com) 创建新项目
- [ ] 记录项目 URL 和 API Keys
- [ ] 运行迁移脚本

```bash
# 安装 Supabase CLI
npm install -g supabase

# 运行迁移脚本
chmod +x scripts/migrate-to-supabase.sh
./scripts/migrate-to-supabase.sh

# 链接到你的项目
supabase link --project-ref YOUR_PROJECT_REF

# 推送数据库迁移
supabase db push

# 运行种子数据
supabase db seed
```

### 第三步：Vercel 部署设置 ✅
- [ ] 在 [vercel.com](https://vercel.com) 连接 GitHub
- [ ] 导入 Saga 仓库
- [ ] 配置构建设置
- [ ] 设置环境变量

#### Vercel 构建配置
```
Framework Preset: Next.js
Root Directory: packages/web
Build Command: npm run build
Output Directory: .next
Install Command: npm ci
```

#### 必需的环境变量
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

# App Settings
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 第四步：Supabase 配置 ✅

#### 4.1 认证设置
- [ ] 启用 Google OAuth
- [ ] 启用 Apple OAuth
- [ ] 配置重定向 URLs

在 Supabase Dashboard > Authentication > Settings:
```
Site URL: https://your-app.vercel.app
Additional Redirect URLs: 
- https://your-app.vercel.app/auth/callback
- http://localhost:3000/auth/callback
```

#### 4.2 存储设置
- [ ] 创建存储桶
- [ ] 设置存储策略

在 Supabase Dashboard > Storage:
```sql
-- 创建存储桶
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('story-audio', 'story-audio', false),
  ('story-photos', 'story-photos', false),
  ('exports', 'exports', false);
```

#### 4.3 API 设置
- [ ] 检查 RLS 策略
- [ ] 测试 API 连接

### 第五步：测试部署 ✅

#### 5.1 本地测试
```bash
# 启动 Supabase 本地环境
supabase start

# 启动 Web 应用
npm run dev --workspace=packages/web

# 测试功能
- 用户注册/登录
- 项目创建
- 故事录制上传
- 实时功能
```

#### 5.2 生产测试
- [ ] 访问 Vercel 部署的应用
- [ ] 测试用户注册流程
- [ ] 测试支付功能
- [ ] 测试文件上传
- [ ] 测试实时更新

### 第六步：域名和 SSL ✅
- [ ] 配置自定义域名 (可选)
- [ ] 验证 SSL 证书
- [ ] 更新重定向 URLs

### 第七步：监控和分析 ✅
- [ ] 设置 Vercel Analytics
- [ ] 配置 Supabase 监控
- [ ] 设置错误跟踪 (Sentry)

## 🔧 故障排除

### 常见问题

#### 1. 构建失败
```bash
# 检查依赖
npm ci

# 本地构建测试
npm run build --workspace=packages/web

# 检查 TypeScript 错误
npm run type-check --workspace=packages/web
```

#### 2. 数据库连接问题
```bash
# 检查 Supabase 连接
supabase status

# 测试数据库连接
supabase db ping
```

#### 3. 认证问题
- 检查 OAuth 配置
- 验证重定向 URLs
- 检查环境变量

#### 4. 存储问题
- 验证存储桶权限
- 检查 RLS 策略
- 测试文件上传

## 📊 性能优化

### Vercel 优化
```javascript
// next.config.js
module.exports = {
  // 启用 SWC minify
  swcMinify: true,
  
  // 图片优化
  images: {
    domains: ['your-project.supabase.co'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // 压缩
  compress: true,
  
  // 生产环境移除 console
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}
```

### Supabase 优化
- 使用适当的索引
- 优化 RLS 策略
- 启用连接池
- 使用 CDN 缓存

## 🔒 安全检查清单

### Supabase 安全
- [ ] 启用 RLS 所有表
- [ ] 验证策略正确性
- [ ] 限制 API 访问
- [ ] 定期轮换密钥

### Vercel 安全
- [ ] 设置安全头
- [ ] 启用 HTTPS
- [ ] 配置 CSP
- [ ] 限制 API 路由

### 应用安全
- [ ] 输入验证
- [ ] SQL 注入防护
- [ ] XSS 防护
- [ ] CSRF 保护

## 💰 成本监控

### Supabase 使用量监控
- 数据库大小
- API 请求数
- 存储使用量
- 带宽使用

### Vercel 使用量监控
- 函数执行时间
- 带宽使用
- 构建时间
- 团队席位

## 📈 扩展计划

### 短期扩展 (1-3月)
- [ ] 添加更多 OAuth 提供商
- [ ] 实现缓存策略
- [ ] 优化数据库查询
- [ ] 添加监控告警

### 长期扩展 (3-12月)
- [ ] 多区域部署
- [ ] 微服务架构
- [ ] 高级分析
- [ ] 企业功能

## 🎯 成功指标

### 技术指标
- [ ] 页面加载时间 < 3秒
- [ ] API 响应时间 < 200ms
- [ ] 正常运行时间 > 99.9%
- [ ] 错误率 < 0.1%

### 业务指标
- [ ] 用户注册转化率 > 5%
- [ ] 项目激活率 > 60%
- [ ] 用户留存率 > 15%
- [ ] 客户满意度 > 4.0/5.0

## 📞 支持联系

### 技术支持
- Supabase: [support.supabase.com](https://support.supabase.com)
- Vercel: [vercel.com/support](https://vercel.com/support)
- GitHub: [support.github.com](https://support.github.com)

### 社区资源
- Supabase Discord
- Vercel Discord
- Next.js 社区

---

**部署完成后，记得更新这个检查清单的状态！** ✅