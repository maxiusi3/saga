# Saga MVP Supabase 迁移指南

## 🎯 迁移概述

本指南将帮助您将Saga MVP从混合架构（本地PostgreSQL + JWT + Express后端）完全迁移到Supabase架构。

## ✅ 已完成的迁移工作

### 1. 新的API客户端
- ✅ 创建了统一的Supabase API客户端 (`packages/web/src/lib/api-supabase.ts`)
- ✅ 更新了现有API客户端以委托给Supabase (`packages/web/src/lib/api.ts`)
- ✅ 保持了向后兼容性，现有代码无需大量修改

### 2. 数据库函数
- ✅ 创建了Supabase数据库函数 (`supabase/migrations/001_create_database_functions.sql`)
- ✅ 实现了复杂业务逻辑：项目创建、邀请管理、支付处理

### 3. 环境配置
- ✅ 更新了生产环境配置模板 (`packages/web/.env.production.example`)
- ✅ 移除了后端相关配置，只保留Supabase和Stripe配置
- ✅ 创建了简化的Docker配置 (`docker-compose.supabase.yml`)

## 🚀 迁移步骤

### 第一步：设置Supabase项目

1. **创建Supabase项目**
   ```bash
   # 访问 https://supabase.com/dashboard
   # 创建新项目，记录项目URL和API密钥
   ```

2. **配置环境变量**
   ```bash
   # 复制并编辑环境变量
   cp packages/web/.env.production.example packages/web/.env.local
   
   # 填入实际的Supabase配置
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### 第二步：创建数据库结构

1. **在Supabase SQL编辑器中执行以下SQL**：

```sql
-- 用户资料表
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 资源钱包表
CREATE TABLE user_resource_wallets (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  project_vouchers INTEGER DEFAULT 0,
  facilitator_seats INTEGER DEFAULT 0,
  storyteller_seats INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 项目表
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  facilitator_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 项目角色表
CREATE TABLE project_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  project_id UUID REFERENCES projects(id),
  role TEXT NOT NULL CHECK (role IN ('facilitator', 'storyteller')),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, project_id, role)
);

-- 故事表
CREATE TABLE stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  storyteller_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT,
  audio_url TEXT,
  audio_duration INTEGER,
  transcript TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 邀请表
CREATE TABLE invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  inviter_id UUID REFERENCES auth.users(id),
  invitee_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('facilitator', 'storyteller')),
  status TEXT DEFAULT 'pending',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 座位交易表
CREATE TABLE seat_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  transaction_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  project_id UUID REFERENCES projects(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 导出请求表
CREATE TABLE export_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  options JSONB,
  download_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);
```

2. **设置行级安全策略（RLS）**：

```sql
-- 启用RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resource_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_requests ENABLE ROW LEVEL SECURITY;

-- 基本RLS策略
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own wallet" ON user_resource_wallets
  FOR SELECT USING (auth.uid() = user_id);

-- 更多策略请参考完整的迁移SQL文件
```

3. **创建数据库函数**：
   ```bash
   # 在Supabase SQL编辑器中执行
   # supabase/migrations/001_create_database_functions.sql 中的所有函数
   ```

### 第三步：数据迁移（如果有现有数据）

1. **导出现有数据**：
   ```bash
   pg_dump --data-only --no-owner --no-privileges saga_development > data_export.sql
   ```

2. **清理和转换数据**：
   ```bash
   # 根据新的表结构调整数据格式
   # 特别注意UUID字段和外键关系
   ```

3. **导入到Supabase**：
   ```bash
   # 在Supabase SQL编辑器中执行清理后的数据
   ```

### 第四步：更新应用代码

1. **前端代码已经更新**：
   - ✅ API客户端已迁移到Supabase
   - ✅ 认证系统已统一到Supabase Auth
   - ✅ 所有数据库操作已委托给Supabase

2. **支付处理更新**：
   ```typescript
   // packages/web/src/app/api/payments/complete/route.ts
   // 已更新为使用Supabase存储支付结果
   ```

### 第五步：测试迁移

1. **功能测试**：
   ```bash
   # 启动应用
   npm run dev
   
   # 测试核心功能
   # - 用户注册/登录
   # - 项目创建
   # - 成员邀请
   # - 故事录制
   # - 数据导出
   ```

2. **运行测试套件**：
   ```bash
   npm test
   ```

### 第六步：部署

1. **使用简化的Docker配置**：
   ```bash
   # 使用新的Supabase配置
   docker-compose -f docker-compose.supabase.yml up -d
   ```

2. **环境变量配置**：
   ```bash
   # 生产环境只需要Supabase和Stripe配置
   NEXT_PUBLIC_SUPABASE_URL=your-production-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
   STRIPE_SECRET_KEY=your-stripe-secret-key
   ```

## 🔧 迁移后的优势

### 简化的架构
- ❌ 移除了Express后端服务器
- ❌ 移除了本地PostgreSQL数据库
- ❌ 移除了Redis缓存
- ❌ 移除了自定义JWT认证
- ✅ 统一使用Supabase服务

### 降低的复杂性
- 更少的服务需要维护
- 更简单的部署流程
- 更好的可扩展性
- 内置的实时功能

### 成本优化
- 减少服务器资源需求
- Supabase的按使用量计费
- 更少的运维工作

## ⚠️ 注意事项

### 数据备份
- 在迁移前完整备份现有数据
- 测试数据恢复流程

### 功能验证
- 彻底测试所有核心功能
- 验证支付流程
- 确认数据导出功能

### 性能监控
- 监控Supabase查询性能
- 优化RLS策略
- 设置适当的索引

## 📞 支持

如果在迁移过程中遇到问题：

1. 检查Supabase控制台的日志
2. 验证RLS策略配置
3. 确认环境变量设置
4. 查看浏览器开发者工具的网络请求

迁移完成后，您将拥有一个更简单、更可维护的Saga MVP应用！
