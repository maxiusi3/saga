# Saga 本地开发环境指南

本指南将帮助你在本地设置和运行 Saga 应用进行开发和测试。

## 前置要求

确保你的系统已安装以下工具：

- **Node.js** 18+ 
- **npm** 9+
- **Docker** 和 **Docker Compose**
- **Git**

## 快速开始

### 1. 一键设置环境

```bash
# 克隆项目（如果还没有）
git clone <repository-url>
cd saga-family-biography

# 运行自动设置脚本
npm run setup
```

这个脚本会：
- 安装所有依赖
- 启动 PostgreSQL 和 Redis 容器
- 运行数据库迁移
- 插入测试数据

### 2. 启动开发服务器

```bash
# 同时启动前端和后端
npm run dev
```

或者分别启动：

```bash
# 终端1: 启动后端
npm run dev:backend

# 终端2: 启动前端  
npm run dev:web
```

### 3. 访问应用

- **前端应用**: http://localhost:3000
- **后端API**: http://localhost:3001
- **健康检查**: http://localhost:3001/health

## 测试账号

设置完成后，你可以使用以下测试账号：

- **邮箱**: test@example.com
- **密码**: TestPassword123!

## 数据库信息

- **Host**: localhost:5432
- **Database**: saga_development
- **Username**: saga_user
- **Password**: saga_password

你可以使用任何 PostgreSQL 客户端连接到数据库查看数据。

## 常用命令

### 数据库操作

```bash
# 运行迁移
npm run db:migrate

# 插入种子数据
npm run db:seed

# 重置数据库（删除所有数据并重新迁移）
npm run db:reset
```

### Docker 操作

```bash
# 启动数据库服务
npm run docker:up

# 停止数据库服务
npm run docker:down

# 查看日志
npm run docker:logs
```

### 测试

```bash
# 运行所有测试
npm test

# 运行后端测试
npm run test:backend

# 运行前端测试
npm run test:web

# 运行E2E测试
npm run test:e2e
```

### 代码质量

```bash
# 运行 ESLint
npm run lint

# 修复 ESLint 问题
npm run lint:fix

# 类型检查
npm run type-check
```

## API 测试

运行 API 测试脚本来验证后端服务：

```bash
./scripts/test-api.sh
```

## 开发工作流

### 1. 功能开发

1. 创建新分支
2. 修改代码
3. 运行测试确保没有破坏现有功能
4. 提交代码

### 2. 数据库更改

如果需要修改数据库结构：

1. 创建新的迁移文件：
   ```bash
   cd packages/backend
   npx knex migrate:make migration_name
   ```

2. 编辑迁移文件

3. 运行迁移：
   ```bash
   npm run db:migrate
   ```

### 3. 添加新的API端点

1. 在 `packages/backend/src/routes/` 中添加路由
2. 在 `packages/backend/src/controllers/` 中添加控制器
3. 在 `packages/backend/src/services/` 中添加业务逻辑
4. 添加相应的测试

### 4. 前端开发

1. 在 `packages/web/src/app/` 中添加页面
2. 在 `packages/web/src/components/` 中添加组件
3. 在 `packages/web/src/stores/` 中管理状态
4. 添加相应的测试

## 故障排除

### 端口冲突

如果遇到端口冲突：

```bash
# 检查端口占用
lsof -i :3000
lsof -i :3001
lsof -i :5432
lsof -i :6379

# 杀死占用端口的进程
kill -9 <PID>
```

### 数据库连接问题

```bash
# 重启数据库容器
docker-compose restart postgres

# 检查数据库状态
docker-compose ps

# 查看数据库日志
docker-compose logs postgres
```

### 依赖问题

```bash
# 清理并重新安装依赖
rm -rf node_modules packages/*/node_modules
npm install
```

### 数据库重置

```bash
# 完全重置数据库
docker-compose down -v
docker-compose up -d postgres redis
sleep 10
npm run db:migrate
npm run db:seed
```

## 环境变量

### 后端环境变量 (packages/backend/.env)

主要的环境变量已经在 `.env` 文件中配置好了。如果需要测试特定功能，你可能需要配置：

- `OPENAI_API_KEY`: OpenAI API密钥（用于AI提示生成）
- `STRIPE_SECRET_KEY`: Stripe密钥（用于支付功能）
- `AWS_*`: AWS配置（用于文件上传）

### 前端环境变量 (packages/web/.env.local)

前端环境变量也已经配置好了，指向本地后端服务。

## 生产环境差异

本地开发环境与生产环境的主要差异：

1. **数据库**: 本地使用 Docker PostgreSQL，生产使用 AWS RDS
2. **文件存储**: 本地模拟文件上传，生产使用 AWS S3
3. **认证**: 本地主要使用邮箱密码，生产支持 OAuth
4. **监控**: 本地禁用了大部分监控功能
5. **安全**: 本地使用简化的安全配置

## 获取帮助

如果遇到问题：

1. 检查控制台错误信息
2. 查看 Docker 容器日志
3. 运行 API 测试脚本
4. 检查数据库连接
5. 查看本文档的故障排除部分

## 下一步

环境设置完成后，你可以：

1. 浏览前端界面，了解用户体验
2. 使用 API 测试工具（如 Postman）测试后端接口
3. 查看数据库结构和数据
4. 运行测试套件
5. 开始开发新功能

祝你开发愉快！🚀