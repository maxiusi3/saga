# 🚀 Quick Start - Docker-Free Options

## 立即可用的选项

### ⭐️ 推荐：简单Demo API
最快速、最可靠的选项，30秒启动：

```bash
npm run demo:simple
```

**提供功能：**
- ✅ 完整REST API (认证、项目、故事)
- ✅ 预加载demo数据
- ✅ 零配置需求
- ✅ 完美用于前端开发

**测试API：**
```bash
# 健康检查
curl http://localhost:3005/health

# 登录测试
curl -X POST http://localhost:3005/api/auth/signin \
     -H 'Content-Type: application/json' \
     -d '{"email":"demo@saga.app","password":"test"}'
```

### 🔧 Native环境 (如果需要数据库)
```bash
npm run test-env:native
```

**提供功能：**
- ✅ 使用本地PostgreSQL (如果可用)
- ✅ 自动fallback到SQLite
- ✅ 完整数据库功能

## 故障排除

### 如果遇到端口占用
所有脚本都会自动寻找可用端口，无需手动处理。

### 如果遇到依赖问题
```bash
# 安装缺失的依赖
cd packages/web
npm install @tailwindcss/forms @tailwindcss/typography

cd ../backend  
npm install ts-node
```

### 如果需要完整前端界面
由于Next.js编译问题，推荐：
1. 使用简单demo API: `npm run demo:simple`
2. 单独启动前端开发服务器:
   ```bash
   cd packages/web
   NEXT_PUBLIC_API_URL=http://localhost:3005 npm run dev
   ```

## 🎯 开发工作流推荐

### 前端开发者
```bash
# 1. 启动demo API
npm run demo:simple

# 2. 在另一个终端启动前端
cd packages/web
NEXT_PUBLIC_API_URL=http://localhost:3005 npm run dev
```

### 后端开发者
```bash
# 使用native环境获得完整数据库功能
npm run test-env:native
```

### 快速演示
```bash
# 只需要API演示
npm run demo:simple

# 查看API文档
open http://localhost:3005/health
```

## 📊 端口信息

- **简单Demo API**: 3005 (自动寻找可用端口)
- **Native后端**: 3002
- **Native前端**: 3003
- **完整Demo后端**: 3005
- **完整Demo前端**: 3006

## ✅ 验证安装

```bash
# 检查所有Docker-free选项
npm run test:docker-free check

# 测试简单demo
npm run demo:simple:test
```

## 🎉 成功！

现在你有了完全不依赖Docker的开发环境！

**最推荐的开始方式：**
```bash
npm run demo:simple
```

然后在浏览器中访问 http://localhost:3005/health 验证API正常工作。