# 🚀 Start Here: Vercel + Supabase Deployment

## 你需要的一切都在这里

### 📋 你已经有的
- ✅ GitHub 仓库
- ✅ Vercel 账号
- ✅ Supabase 项目

### ⏱️ 部署时间
**总计**: 20-30 分钟
- 数据库设置: 5 分钟
- 前端部署: 5 分钟
- 后端部署: 5 分钟
- 验证测试: 5 分钟

## 🎯 快速开始（3步）

### 第1步：准备 Supabase 信息 (2分钟)

打开你的 Supabase 项目：https://app.supabase.com

**获取这些值**：

1. **Settings → API**
   ```
   Project URL: https://xxx.supabase.co
   anon public: eyJhbG...
   service_role: eyJhbG... (保密!)
   ```

2. **Settings → Database**
   ```
   Connection string: postgresql://postgres:[PASSWORD]@xxx.supabase.co:5432/postgres
   ```

### 第2步：运行数据库迁移 (3分钟)

1. 打开 Supabase **SQL Editor**
2. 点击 "New query"
3. 复制 `supabase-migration.sql` 文件的全部内容
4. 粘贴到 SQL Editor
5. 点击 **Run**

**如果遇到 "policy already exists" 错误**:
- 这是正常的，说明之前已经运行过
- 使用 `supabase-migration.sql` 文件（它会先删除旧策略）
- 或查看 `SUPABASE_MIGRATION_FIX.md` 获取帮助

**简化版本**（如果你想手动输入）:

```sql
-- 创建基础表
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_email BOOLEAN DEFAULT true,
    notification_push BOOLEAN DEFAULT true,
    accessibility_font_size VARCHAR(20) DEFAULT 'standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE user_resource_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_vouchers INTEGER DEFAULT 0,
    facilitator_seats INTEGER DEFAULT 0,
    storyteller_seats INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    facilitator_id UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resource_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 基础 RLS 策略
CREATE POLICY "Users can manage own settings" ON user_settings
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own wallet" ON user_resource_wallets
    USING (auth.uid() = user_id);
```

4. 点击 **Run** 执行

### 第3步：部署到 Vercel (15分钟)

#### A. 部署前端 (5分钟)

1. **Vercel Dashboard** → "Add New..." → "Project"
2. 选择你的 GitHub 仓库
3. **配置**：
   - Root Directory: `packages/web`
   - Framework: Next.js (自动检测)
4. **环境变量**：
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   NEXT_PUBLIC_API_URL=https://your-backend.vercel.app/api
   NODE_ENV=production
   ```
5. 点击 **Deploy**
6. 记下 URL: `https://your-app.vercel.app`

#### B. 部署后端 (5分钟)

1. **Vercel Dashboard** → "Add New..." → "Project"
2. 选择同一个 GitHub 仓库
3. **配置**：
   - Root Directory: `packages/backend`
   - Framework: Other
4. **环境变量**：
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@xxx.supabase.co:5432/postgres
   JWT_SECRET=<生成一个强密钥，至少32字符>
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   NODE_ENV=production
   FRONTEND_URL=https://your-app.vercel.app
   ```
5. 点击 **Deploy**
6. 记下 URL: `https://your-backend.vercel.app`

#### C. 更新前端 API URL (2分钟)

1. 回到前端项目
2. Settings → Environment Variables
3. 更新 `NEXT_PUBLIC_API_URL` 为后端 URL
4. Deployments → Redeploy

## ✅ 验证部署

### 测试后端
```bash
curl https://your-backend.vercel.app/health
# 应该返回: {"status":"ok","timestamp":"..."}
```

### 测试前端
1. 访问: `https://your-app.vercel.app`
2. 注册新账号
3. 登录
4. 查看 Dashboard
5. 测试 Settings 页面

## 🎉 完成！

如果所有测试通过，你的应用已经成功部署！

### 下一步

1. **配置自定义域名** (可选)
   - Frontend: `your-domain.com`
   - Backend: `api.your-domain.com`

2. **设置监控**
   - Vercel Analytics
   - Sentry 错误追踪
   - Uptime 监控

3. **配置备份**
   - Supabase 自动备份 (Pro 计划)

## 📚 详细文档

需要更多信息？查看：

- **完整指南**: `VERCEL_SUPABASE_DEPLOYMENT.md`
- **检查清单**: `VERCEL_DEPLOYMENT_CHECKLIST.md`
- **故障排除**: 见完整指南

## 🆘 遇到问题？

### 构建失败
- 检查 Vercel 构建日志
- 验证所有环境变量已设置
- 确认依赖已安装

### API 不工作
```bash
# 测试健康检查
curl https://your-backend.vercel.app/health

# 检查后端日志
# Vercel Dashboard → Backend Project → Logs
```

### 数据库连接失败
- 验证 DATABASE_URL 正确
- 检查 Supabase 项目是否激活
- 确认密码正确

## 💡 提示

### 生成强 JWT_SECRET
```bash
# 在终端运行
openssl rand -base64 32
```

### 查看实时日志
```bash
# 安装 Vercel CLI
npm i -g vercel

# 查看日志
vercel logs <your-deployment-url>
```

### 自动部署
每次推送到 GitHub main 分支，Vercel 会自动部署！

```bash
git add .
git commit -m "Update feature"
git push origin main
# Vercel 自动部署 🚀
```

## 📊 成本

### 免费额度
- **Vercel**: 100GB 带宽/月
- **Supabase**: 500MB 数据库, 2GB 带宽

### 升级选项
- **Vercel Pro**: $20/月
- **Supabase Pro**: $25/月

## 🔐 安全提示

- ✅ 使用强 JWT_SECRET (32+ 字符)
- ✅ 保密 service_role key
- ✅ 启用 Supabase RLS
- ✅ HTTPS 自动启用 (Vercel)
- ✅ 定期更新依赖

---

**准备好了吗？** 开始第1步！⬆️

**需要帮助？** 查看完整文档或创建 issue
