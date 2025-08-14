# Saga 手动测试最终指南

## 🚀 快速启动 (推荐)

### 方案1: 智能启动脚本 (包含3分钟超时保护)
```bash
./scripts/start-manual-testing.sh
```

### 方案2: 快速启动脚本 (超简单版本)
```bash
./scripts/quick-manual-test.sh
```

### 方案3: 手动启动 (如果脚本失败)
```bash
# 终端1 - 启动后端
cd packages/backend
node quick-server.js  # 或 npm run dev-test

# 终端2 - 启动前端  
cd packages/web
npm run dev
```

## 🛠️ 故障排除

### 如果服务器卡住
1. **强制终止所有进程**:
   ```bash
   pkill -f "nodemon\|next\|ts-node"
   ```

2. **清理端口占用**:
   ```bash
   lsof -ti:3001 | xargs kill -9
   lsof -ti:3000 | xargs kill -9
   ```

3. **重新启动**:
   ```bash
   ./scripts/quick-manual-test.sh
   ```

### 如果TypeScript编译错误
- 使用 `quick-server.js` (纯JavaScript，无编译)
- 或使用 `npm run dev-test` (简化的TypeScript服务器)

## 🧪 测试流程

### 1. 验证服务器启动
```bash
# 检查后端
curl http://localhost:3001/health

# 检查前端
curl http://localhost:3000
```

### 2. 测试用户注册
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试用户",
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

### 3. 测试用户登录
```bash
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@example.com",
    "password": "TestPassword123"
  }'
```

### 4. 测试认证端点
```bash
curl -H "Authorization: Bearer mock-token" \
  http://localhost:3001/api/auth/profile
```

## 🌐 Web界面测试

### 访问地址
- **主页**: http://localhost:3000
- **注册页**: http://localhost:3000/auth/signup  
- **登录页**: http://localhost:3000/auth/signin

### 测试步骤
1. 打开主页，检查界面加载
2. 点击"Start Your Family's Saga"按钮
3. 填写注册表单并提交
4. 检查是否成功跳转到仪表板
5. 测试登录流程
6. 验证认证状态

## 📊 预期结果

### 成功指标
- ✅ 后端健康检查返回 `{"status": "ok"}`
- ✅ 前端页面正常加载
- ✅ 注册API返回成功响应
- ✅ 登录API返回JWT令牌
- ✅ 认证端点验证令牌

### 模拟数据说明
- 所有API使用模拟数据响应
- JWT令牌为 `mock-token`
- 用户ID为 `test-user`
- 无真实数据库操作

## 🔧 开发者选项

### 查看服务器日志
```bash
# 后端日志
tail -f packages/backend/logs/app.log

# 前端日志 (在启动终端查看)
```

### 调试模式
```bash
# 启用详细日志
DEBUG=* ./scripts/start-manual-testing.sh
```

### 重置环境
```bash
# 完全清理并重启
pkill -f "node\|npm"
sleep 3
./scripts/quick-manual-test.sh
```

## ⚠️ 注意事项

1. **超时保护**: 脚本包含3分钟超时，防止无限卡住
2. **端口冲突**: 自动清理3000和3001端口
3. **进程管理**: Ctrl+C会正确清理所有子进程
4. **错误恢复**: 失败时自动尝试备用方案
5. **兼容性**: 支持macOS和Linux环境

## 🎯 测试重点

### 前端测试
- [ ] 页面加载速度
- [ ] 表单验证
- [ ] 错误处理
- [ ] 响应式设计
- [ ] 导航功能

### 后端测试  
- [ ] API响应时间
- [ ] 错误状态码
- [ ] 数据验证
- [ ] 认证流程
- [ ] CORS配置

### 集成测试
- [ ] 前后端通信
- [ ] 认证状态同步
- [ ] 错误信息显示
- [ ] 用户体验流程

---

**🚀 开始测试**: 运行 `./scripts/start-manual-testing.sh` 即可开始！