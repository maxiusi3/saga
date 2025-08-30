# Saga MVP 快速启动指南

## 🚀 快速开始

### 前置要求
- Node.js 18+
- Docker & Docker Compose
- Git

### 1. 克隆和安装
```bash
# 克隆项目
git clone <repository-url>
cd saga传奇

# 安装依赖
npm install

# 安装各包依赖
cd packages/web && npm install
cd ../backend && npm install
cd ../shared && npm install
```

### 2. 环境配置
```bash
# 复制环境变量模板
cp packages/web/.env.example packages/web/.env.local
cp packages/backend/.env.example packages/backend/.env

# 编辑环境变量（使用占位符密钥进行开发）
# 前端 (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder_key

# 后端 (.env)
DATABASE_URL=postgresql://saga_user:saga_password@localhost:5432/saga_development
STRIPE_SECRET_KEY=sk_test_placeholder_key
JWT_SECRET=development-jwt-secret
```

### 3. 启动开发环境
```bash
# 启动数据库和Redis
docker-compose up -d postgres redis

# 运行数据库迁移
cd packages/backend
npm run migrate

# 启动后端服务
npm run dev

# 新终端启动前端
cd packages/web
npm run dev
```

### 4. 访问应用
- 前端：http://localhost:3000
- 后端API：http://localhost:3001
- 数据库：localhost:5432

## 🧪 测试

### 运行所有测试
```bash
# 前端测试
cd packages/web
npm test

# 后端测试
cd packages/backend
npm test

# E2E测试
npm run test:e2e
```

### 测试支付功能
使用Stripe测试卡号：
- 成功：4242424242424242
- 失败：4000000000000002

## 🏗️ 生产部署

### 1. 准备生产环境
```bash
# 复制生产环境配置
cp packages/web/.env.production.example packages/web/.env.production

# 编辑生产环境变量（替换占位符）
# 重要：必须使用真实的Stripe密钥
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_actual_key
STRIPE_SECRET_KEY=sk_live_your_actual_key
DATABASE_URL=your_production_database_url
```

### 2. 部署到生产环境
```bash
# 使用部署脚本
chmod +x scripts/deploy.sh
./scripts/deploy.sh production

# 或使用Docker Compose
docker-compose --profile production up -d
```

### 3. 健康检查
```bash
# 检查服务状态
./scripts/deploy.sh health

# 手动检查
curl http://localhost:3000/health
curl http://localhost:3001/health
```

## 📊 监控

### 访问监控面板
- Prometheus：http://localhost:9090
- Grafana：http://localhost:3001 (admin/saga_grafana_password)

### 关键指标
- 用户注册转化率
- Package购买成功率
- 故事录制完成率
- API响应时间

## 🔧 常见问题

### Q: 支付测试失败
A: 确保使用正确的测试卡号，检查Stripe配置

### Q: 录音功能不工作
A: 检查浏览器权限，确保HTTPS环境

### Q: 数据库连接失败
A: 检查Docker容器状态，确认数据库配置

### Q: 前端构建失败
A: 清除缓存：`rm -rf .next node_modules && npm install`

## 📝 开发工作流

### 1. 功能开发
```bash
# 创建功能分支
git checkout -b feature/new-feature

# 开发和测试
npm run dev
npm test

# 提交代码
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
```

### 2. 代码质量
```bash
# 代码格式化
npm run format

# 类型检查
npm run type-check

# Lint检查
npm run lint
```

### 3. 数据库迁移
```bash
# 创建新迁移
cd packages/backend
npm run migrate:make migration_name

# 运行迁移
npm run migrate

# 回滚迁移
npm run migrate:rollback
```

## 🎯 核心功能测试

### 1. 用户注册和购买
1. 访问 http://localhost:3000
2. 注册新用户
3. 购买Saga Package（使用测试卡）
4. 验证Resource Wallet更新

### 2. 项目创建和邀请
1. 创建新项目
2. 邀请家庭成员
3. 验证座位分配

### 3. 故事录制
1. 作为Storyteller登录
2. 接受项目邀请
3. 录制故事
4. 验证转录功能

### 4. 数据导出
1. 作为Facilitator
2. 导出项目数据
3. 验证ZIP文件结构

## 🔒 安全注意事项

### 开发环境
- 使用占位符API密钥
- 本地HTTPS证书（可选）
- 开发数据库隔离

### 生产环境
- 真实Stripe密钥
- SSL证书配置
- 环境变量加密
- 定期安全更新

## 📞 获取帮助

### 文档
- API文档：http://localhost:3001/docs
- 组件文档：Storybook（如果配置）

### 日志
- 前端：浏览器开发者工具
- 后端：`docker-compose logs backend`
- 数据库：`docker-compose logs postgres`

### 调试
```bash
# 前端调试
npm run dev -- --inspect

# 后端调试
npm run dev:debug

# 数据库调试
docker-compose exec postgres psql -U saga_user -d saga_development
```

---

**快速启动完成！** 🎉

现在您可以开始使用Saga MVP进行家庭故事收集了。记住在生产环境中替换所有占位符配置。
