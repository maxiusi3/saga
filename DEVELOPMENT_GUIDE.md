# Saga 开发环境使用指南

## 🚀 快速启动

### 启动开发环境
```bash
./scripts/dev-start-native.sh
```

### 停止开发环境
```bash
./scripts/stop-dev-servers.sh
```

### 快速测试
```bash
./scripts/quick-test.sh
```

## 📊 服务器信息

- **前端服务器**: http://localhost:3000
- **后端API服务器**: http://localhost:4000
- **健康检查**: http://localhost:4000/health

## 🔧 开发配置

### 后端服务器 (简化版)
- 端口: 4000
- 跳过所有外部服务依赖 (AWS, OpenAI, Stripe等)
- 返回模拟数据，适合前端开发和测试
- 支持所有核心API端点

### 前端服务器
- 端口: 3000
- Next.js 开发服务器
- 热重载支持
- API配置指向 http://localhost:4000

## 📋 可用的API端点

### 认证相关
- `POST /api/auth/signin` - 用户登录
- `POST /api/auth/signup` - 用户注册
- `GET /api/auth/me` - 获取用户信息

### 项目相关
- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建新项目
- `GET /api/projects/:id` - 获取项目详情

### 故事相关
- `GET /api/stories` - 获取故事列表
- `GET /api/projects/:projectId/stories` - 获取项目故事

### 资源相关
- `GET /api/users/:userId/wallet` - 获取用户资源钱包
- `GET /api/packages` - 获取套餐列表

### 支付相关
- `POST /api/payments/create-intent` - 创建支付意图

### 导出相关
- `GET /api/exports` - 获取导出列表
- `POST /api/exports` - 创建导出请求

### 提示相关
- `GET /api/prompts/next/:projectId` - 获取下一个提示

## 🧪 测试数据

后端服务器返回以下模拟数据：

### 用户信息
```json
{
  "id": "demo-user-1",
  "email": "demo@example.com",
  "name": "Demo User",
  "resourceWallet": {
    "projectVouchers": 1,
    "facilitatorSeats": 2,
    "storytellerSeats": 2
  }
}
```

### 项目信息
```json
{
  "id": "demo-project-1",
  "name": "Family Stories",
  "description": "Our family biography project",
  "status": "active",
  "facilitators": [...]
}
```

## 🔍 故障排除

### 端口被占用
如果遇到端口被占用的错误：
```bash
# 强制停止所有相关进程
./scripts/stop-dev-servers.sh

# 或者手动释放端口
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9
```

### 依赖问题
如果遇到依赖问题：
```bash
# 重新安装依赖
cd packages/backend && npm install
cd packages/web && npm install
```

### 清理缓存
如果遇到缓存问题：
```bash
# 清理构建缓存
rm -rf packages/web/.next
rm -rf packages/backend/dist
```

## 📝 开发注意事项

1. **简化后端**: 当前使用的是简化版后端，跳过了所有外部服务依赖
2. **模拟数据**: 所有API返回模拟数据，适合前端开发和测试
3. **热重载**: 前端支持热重载，修改代码后会自动刷新
4. **CORS配置**: 后端已配置CORS，支持前端跨域请求
5. **环境变量**: 前端API配置在 `packages/web/.env.local` 中

## 🎯 下一步

现在你可以：
1. 访问 http://localhost:3000 查看前端应用
2. 使用浏览器开发者工具查看网络请求
3. 修改前端代码进行开发和测试
4. 使用 `./scripts/quick-test.sh` 验证前后端通信

## 🔗 相关文件

- `packages/backend/src/simple-dev-server.ts` - 简化后端服务器
- `packages/web/.env.local` - 前端环境变量配置
- `scripts/dev-start-native.sh` - 启动脚本
- `scripts/stop-dev-servers.sh` - 停止脚本
- `scripts/quick-test.sh` - 测试脚本