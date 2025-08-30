# Supabase 迁移计划

## 🎯 迁移目标

将项目从混合架构（本地PostgreSQL + JWT + Express后端）完全迁移到Supabase架构，实现：
- 统一的认证系统（Supabase Auth）
- 统一的数据库访问（Supabase Database）
- 简化的架构和部署

## 📊 当前状态分析

### 问题识别
1. **认证系统冲突**：
   - 前端：使用Supabase Auth (`packages/web/src/stores/auth-store.ts`)
   - 后端：使用JWT认证 (`packages/backend/src/config/auth.ts`)

2. **数据库访问冲突**：
   - 后端：Knex.js + PostgreSQL (`packages/backend/src/config/database.ts`)
   - 前端：期望Supabase客户端 (`packages/web/src/lib/supabase.ts`)

3. **API路由混乱**：
   - 部分功能使用Supabase直接调用
   - 部分功能调用Express后端API

## 🚀 迁移策略

### 阶段1：数据库迁移
1. **导出现有数据库结构**
2. **在Supabase中重建表结构**
3. **迁移数据**
4. **设置RLS（行级安全）策略**

### 阶段2：认证系统统一
1. **移除后端JWT认证**
2. **统一使用Supabase Auth**
3. **更新所有API调用**

### 阶段3：API重构
1. **将核心业务逻辑迁移到Supabase Functions**
2. **保留复杂业务逻辑在后端（使用Supabase客户端）**
3. **更新前端API调用**

### 阶段4：支付集成调整
1. **更新Stripe webhook处理**
2. **调整支付完成后的数据库操作**

## 📋 详细迁移步骤

### Step 1: 数据库结构迁移

#### 1.1 导出现有表结构
```sql
-- 从现有PostgreSQL导出表结构
pg_dump --schema-only --no-owner --no-privileges saga_development > schema.sql
```

#### 1.2 在Supabase中创建表
```sql
-- 主要表结构（需要在Supabase SQL编辑器中执行）

-- 用户表（Supabase Auth会自动创建auth.users，我们创建profiles表）
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
```

#### 1.3 设置RLS策略
```sql
-- 启用RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resource_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_transactions ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 用户只能访问自己的钱包
CREATE POLICY "Users can view own wallet" ON user_resource_wallets
  FOR SELECT USING (auth.uid() = user_id);

-- 项目访问策略
CREATE POLICY "Users can view projects they're involved in" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_roles 
      WHERE project_id = projects.id 
      AND user_id = auth.uid()
    )
  );

-- 更多RLS策略...
```

### Step 2: 认证系统迁移

#### 2.1 更新前端API客户端
```typescript
// packages/web/src/lib/api-supabase.ts
import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

class SupabaseApiClient {
  private supabase = createClientSupabase()

  // 项目管理
  async getProjects() {
    const { data, error } = await this.supabase
      .from('projects')
      .select(`
        *,
        project_roles!inner(role),
        stories(count)
      `)
    
    if (error) throw error
    return data
  }

  async createProject(projectData: { name: string; description: string }) {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // 检查用户是否有项目券
    const { data: wallet } = await this.supabase
      .from('user_resource_wallets')
      .select('project_vouchers')
      .eq('user_id', user.id)
      .single()

    if (!wallet || wallet.project_vouchers < 1) {
      throw new Error('Insufficient project vouchers')
    }

    // 使用事务创建项目
    const { data, error } = await this.supabase.rpc('create_project_with_role', {
      project_name: projectData.name,
      project_description: projectData.description,
      facilitator_id: user.id
    })

    if (error) throw error
    return data
  }

  // 资源钱包管理
  async getWallet() {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await this.supabase
      .from('user_resource_wallets')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) throw error
    return data
  }

  // 支付处理
  async purchasePackage(packageId: string, paymentIntentId: string) {
    const { data, error } = await this.supabase.rpc('process_package_purchase', {
      package_id: packageId,
      payment_intent_id: paymentIntentId
    })

    if (error) throw error
    return data
  }
}

export const supabaseApi = new SupabaseApiClient()
```

#### 2.2 创建Supabase Functions
```sql
-- packages/supabase/functions/create-project-with-role.sql
CREATE OR REPLACE FUNCTION create_project_with_role(
  project_name TEXT,
  project_description TEXT,
  facilitator_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_project_id UUID;
  wallet_vouchers INTEGER;
BEGIN
  -- 检查用户钱包
  SELECT project_vouchers INTO wallet_vouchers
  FROM user_resource_wallets
  WHERE user_id = facilitator_id;

  IF wallet_vouchers < 1 THEN
    RAISE EXCEPTION 'Insufficient project vouchers';
  END IF;

  -- 创建项目
  INSERT INTO projects (name, description, facilitator_id)
  VALUES (project_name, project_description, facilitator_id)
  RETURNING id INTO new_project_id;

  -- 添加facilitator角色
  INSERT INTO project_roles (user_id, project_id, role)
  VALUES (facilitator_id, new_project_id, 'facilitator');

  -- 消费项目券
  UPDATE user_resource_wallets
  SET project_vouchers = project_vouchers - 1,
      updated_at = NOW()
  WHERE user_id = facilitator_id;

  -- 记录交易
  INSERT INTO seat_transactions (user_id, transaction_type, resource_type, amount, project_id)
  VALUES (facilitator_id, 'consume', 'project_voucher', -1, new_project_id);

  RETURN new_project_id;
END;
$$;
```

### Step 3: 支付系统调整

#### 3.1 更新支付完成处理
```typescript
// packages/web/src/app/api/payments/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId } = await request.json()
    const supabase = createServerSupabase()

    // 验证支付状态（与Stripe）
    // ... Stripe验证逻辑

    // 使用Supabase处理包购买
    const { data, error } = await supabase.rpc('process_package_purchase', {
      payment_intent_id: paymentIntentId
    })

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Payment processing failed' },
      { status: 500 }
    )
  }
}
```

### Step 4: 移除后端依赖

#### 4.1 更新Docker配置
```yaml
# docker-compose.yml - 移除后端服务
version: '3.8'

services:
  # 移除 postgres, redis, backend 服务
  # 只保留前端
  frontend:
    build:
      context: .
      target: frontend
    environment:
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    ports:
      - "3000:3000"
```

#### 4.2 更新环境变量
```bash
# packages/web/.env.production.example
# 移除后端相关配置，只保留Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe配置保持不变
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_SECRET_KEY=sk_live_your_key
```

## ⚠️ 迁移注意事项

### 数据迁移
1. **备份现有数据**：完整备份PostgreSQL数据
2. **测试迁移脚本**：在测试环境验证迁移过程
3. **分批迁移**：大量数据分批处理

### 功能验证
1. **认证流程**：注册、登录、密码重置
2. **项目管理**：创建、邀请、角色管理
3. **支付流程**：购买、激活、钱包更新
4. **数据导出**：确保导出功能正常

### 性能考虑
1. **RLS策略优化**：确保查询性能
2. **索引创建**：为常用查询创建索引
3. **连接池配置**：Supabase连接池设置

## 📅 迁移时间表

- **第1周**：数据库结构迁移和RLS设置
- **第2周**：认证系统统一和API重构
- **第3周**：支付系统调整和测试
- **第4周**：全面测试和部署

## 🧪 测试策略

1. **单元测试更新**：更新所有测试以使用Supabase
2. **集成测试**：验证完整用户流程
3. **性能测试**：确保迁移后性能不下降
4. **安全测试**：验证RLS策略有效性

这个迁移计划将彻底解决技术栈不一致问题，简化架构，提高可维护性。
