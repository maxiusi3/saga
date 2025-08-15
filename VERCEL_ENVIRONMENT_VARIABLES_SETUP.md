# Vercel环境变量配置指南

## 🎯 必需的环境变量

### 1. Supabase配置
```bash
# Supabase项目URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase匿名密钥（公开安全）
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase服务角色密钥（服务端使用，保密）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. API配置
```bash
# 后端API URL
NEXT_PUBLIC_API_URL=https://saga-backend.vercel.app

# 前端应用URL
NEXT_PUBLIC_APP_URL=https://saga-app.vercel.app
```

### 3. OAuth配置
```bash
# Google OAuth
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz

# Apple OAuth (移动端)
APPLE_CLIENT_ID=com.saga.app
APPLE_TEAM_ID=ABCD123456
APPLE_KEY_ID=ABCD123456
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### 4. 支付配置
```bash
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51AbCdEf...
STRIPE_SECRET_KEY=sk_live_51AbCdEf...
STRIPE_WEBHOOK_SECRET=whsec_AbCdEf...
```

### 5. 外部服务
```bash
# OpenAI
OPENAI_API_KEY=sk-proj-AbCdEf...

# AWS S3
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_S3_BUCKET=saga-storage

# SendGrid
SENDGRID_API_KEY=SG.AbCdEf...
SENDGRID_FROM_EMAIL=noreply@saga.app

# Firebase (推送通知)
FIREBASE_PROJECT_ID=saga-app
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@saga-app.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### 6. 安全配置
```bash
# JWT密钥
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# 加密密钥
ENCRYPTION_KEY=your-32-char-encryption-key-here

# 会话密钥
SESSION_SECRET=your-session-secret-key-here
```

## 🔧 Vercel配置步骤

### 方法1: Vercel Dashboard
1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 进入 **Settings** → **Environment Variables**
4. 逐个添加上述环境变量
5. 选择适当的环境：Production, Preview, Development

### 方法2: Vercel CLI
```bash
# 登录Vercel
vercel login

# 设置环境变量
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# 批量导入（如果有.env文件）
vercel env pull .env.production
```

### 方法3: 批量脚本
```bash
#!/bin/bash
# 批量设置环境变量脚本

# Supabase
vercel env add NEXT_PUBLIC_SUPABASE_URL "https://your-project.supabase.co" production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY "your-anon-key" production
vercel env add SUPABASE_SERVICE_ROLE_KEY "your-service-role-key" production

# API URLs
vercel env add NEXT_PUBLIC_API_URL "https://saga-backend.vercel.app" production
vercel env add NEXT_PUBLIC_APP_URL "https://saga-app.vercel.app" production

# OAuth
vercel env add GOOGLE_CLIENT_ID "your-google-client-id" production
vercel env add GOOGLE_CLIENT_SECRET "your-google-client-secret" production

# 继续添加其他变量...
```

## 🚨 安全注意事项

### 公开变量 (NEXT_PUBLIC_*)
- ✅ 可以在客户端访问
- ✅ 包含在构建输出中
- ⚠️ 不要包含敏感信息

### 私有变量
- 🔒 仅在服务端可访问
- 🔒 不会暴露给客户端
- ✅ 适合API密钥、数据库凭据

### 最佳实践
1. **分环境管理**: Production, Preview, Development
2. **定期轮换**: 定期更新API密钥
3. **最小权限**: 只给必要的权限
4. **监控使用**: 监控API使用情况
5. **备份配置**: 保存环境变量备份

## 📋 配置验证清单

### Supabase连接
- [ ] 数据库连接成功
- [ ] 认证服务工作
- [ ] 存储服务可用

### OAuth认证
- [ ] Google登录正常
- [ ] Apple登录正常（移动端）
- [ ] 回调URL配置正确

### 支付系统
- [ ] Stripe测试模式工作
- [ ] Webhook接收正常
- [ ] 支付流程完整

### 外部服务
- [ ] OpenAI API响应
- [ ] 文件上传到S3
- [ ] 邮件发送成功
- [ ] 推送通知工作

## 🔍 故障排除

### 常见问题
1. **构建失败**: 检查必需的环境变量是否设置
2. **运行时错误**: 检查变量值是否正确
3. **认证失败**: 检查OAuth配置和回调URL
4. **API错误**: 检查服务端环境变量

### 调试命令
```bash
# 检查环境变量
vercel env ls

# 拉取当前配置
vercel env pull .env.local

# 查看构建日志
vercel logs [deployment-url]
```

## 📞 获取帮助

如果遇到问题：
1. 检查 [Vercel文档](https://vercel.com/docs/concepts/projects/environment-variables)
2. 查看项目构建日志
3. 验证第三方服务配置
4. 联系相关服务支持团队

---

**重要**: 请确保所有敏感信息都通过环境变量管理，永远不要在代码中硬编码密钥！