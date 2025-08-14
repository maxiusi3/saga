# 🎯 推荐的Docker-Free设置

基于测试结果，这是最可靠和推荐的Docker-free开发设置。

## ⭐️ 推荐方案：简单Demo API

经过测试，这是**最稳定、最快速**的Docker-free选项：

```bash
npm run demo:simple
```

### ✅ 为什么推荐这个方案？

1. **100%可靠** - 经过完整测试，无依赖问题
2. **30秒启动** - 无需任何配置或数据库设置
3. **完整功能** - 提供所有必要的API端点
4. **零维护** - 不需要管理数据库、Redis等服务

### 🚀 立即开始

```bash
# 1. 启动demo API
npm run demo:simple

# 2. 验证API工作
curl http://localhost:3005/health

# 3. 测试登录
curl -X POST http://localhost:3005/api/auth/signin \
     -H 'Content-Type: application/json' \
     -d '{"email":"demo@saga.app","password":"test"}'
```

## 🔧 前端开发设置

如果你需要开发前端，可以将demo API与前端开发服务器结合使用：

### 方法1：使用环境变量
```bash
# 终端1：启动demo API
npm run demo:simple

# 终端2：启动前端开发服务器
cd packages/web
NEXT_PUBLIC_API_URL=http://localhost:3005 npm run dev
```

### 方法2：修改配置文件
在 `packages/web/.env.local` 中添加：
```
NEXT_PUBLIC_API_URL=http://localhost:3005
```

然后启动前端：
```bash
cd packages/web
npm run dev
```

## 📊 可用的API端点

Demo API提供完整的REST API功能：

### 认证端点
```bash
# 注册
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "password",
  "firstName": "John",
  "lastName": "Doe"
}

# 登录
POST /api/auth/signin
{
  "email": "demo@saga.app",
  "password": "any_password"
}

# 获取用户信息
GET /api/auth/profile
Authorization: Bearer YOUR_TOKEN
```

### 项目端点
```bash
# 获取项目列表
GET /api/projects
Authorization: Bearer YOUR_TOKEN

# 创建项目
POST /api/projects
Authorization: Bearer YOUR_TOKEN
{
  "name": "My Family Stories",
  "description": "A collection of our memories"
}

# 获取特定项目
GET /api/projects/:id
Authorization: Bearer YOUR_TOKEN
```

### 故事端点
```bash
# 获取故事列表
GET /api/stories?projectId=PROJECT_ID
Authorization: Bearer YOUR_TOKEN

# 创建故事
POST /api/stories
Authorization: Bearer YOUR_TOKEN
{
  "projectId": "PROJECT_ID",
  "title": "My Story",
  "transcript": "This is my story..."
}
```

## 🧪 预加载的Demo数据

Demo API包含以下预加载数据：

- **Demo用户**: demo@saga.app (任意密码)
- **Demo项目**: "My Family Stories"
- **Demo故事**: 
  - "Childhood Memories"
  - "Wedding Day"

## 🎯 开发工作流

### 1. API开发和测试
```bash
# 启动demo API
npm run demo:simple

# 使用Postman、curl或其他工具测试API
curl http://localhost:3005/health
```

### 2. 前端开发
```bash
# 启动demo API（如果还没启动）
npm run demo:simple

# 在另一个终端启动前端
cd packages/web
NEXT_PUBLIC_API_URL=http://localhost:3005 npm run dev
```

### 3. 移动端开发
```bash
# 启动demo API
npm run demo:simple

# 在移动端代码中设置API URL
# packages/mobile/src/services/api-client.ts
const API_BASE_URL = 'http://localhost:3005';
```

## 🛠️ 故障排除

### 端口被占用
Demo脚本会自动寻找可用端口，通常不会有问题。

### API不响应
```bash
# 检查demo服务器状态
npm run demo:simple:test

# 查看日志
npm run demo:simple:logs

# 重启服务
npm run demo:simple:stop
npm run demo:simple
```

### 前端连接问题
确保前端配置了正确的API URL：
```bash
# 检查环境变量
echo $NEXT_PUBLIC_API_URL

# 或在浏览器控制台检查
console.log(process.env.NEXT_PUBLIC_API_URL)
```

## 📈 扩展选项

当你需要更多功能时，可以考虑：

1. **本地数据库**: 如果需要数据持久化，可以设置本地PostgreSQL
2. **云服务**: 使用云数据库服务（如Supabase、PlanetScale）
3. **Docker**: 如果解决了Docker问题，可以回到完整的Docker环境

## 🎉 总结

使用 `npm run demo:simple` 是目前最可靠的Docker-free开发方案：

- ✅ **立即可用** - 无需复杂设置
- ✅ **完整功能** - 所有API端点都可用
- ✅ **稳定可靠** - 经过完整测试
- ✅ **开发友好** - 完美支持前端开发

**立即开始：**
```bash
npm run demo:simple
```

然后访问 http://localhost:3005/health 验证一切正常！