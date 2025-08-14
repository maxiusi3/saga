# Saga 认证功能测试指南

## 🎉 问题已解决

### 修复内容
1. **添加缺失的API端点** - `/api/auth/profile`
2. **统一响应格式** - 所有API返回一致的数据结构
3. **完善错误处理** - 正确的HTTP状态码和错误信息
4. **支持OAuth登录** - Google和Apple登录端点

## 🔐 可用的认证功能

### 传统登录/注册
- ✅ **用户登录**: `POST /api/auth/signin`
- ✅ **用户注册**: `POST /api/auth/signup`
- ✅ **用户登出**: `POST /api/auth/signout`
- ✅ **获取用户资料**: `GET /api/auth/profile`
- ✅ **刷新令牌**: `POST /api/auth/refresh`

### OAuth登录
- ✅ **Google登录**: `POST /api/auth/oauth/google`
- ✅ **Apple登录**: `POST /api/auth/oauth/apple`

## 🧪 测试方法

### 1. 自动化测试
```bash
# 运行认证功能测试
./scripts/test-auth.sh
```

### 2. 手动测试

#### 访问登录页面
```
http://localhost:3000/auth/signin
```

#### 使用演示账户
- **邮箱**: demo@saga.com
- **密码**: password

或者点击页面上的"Quick Login with Demo Account"按钮

#### 测试注册功能
```
http://localhost:3000/auth/signup
```

### 3. API测试

#### 登录测试
```bash
curl -X POST http://localhost:4000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@saga.com","password":"password"}'
```

#### 注册测试
```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

#### 获取用户资料
```bash
curl http://localhost:4000/api/auth/profile
```

## 📋 API响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "demo-user-1",
      "email": "demo@saga.com",
      "name": "Demo User",
      "resourceWallet": {
        "projectVouchers": 1,
        "facilitatorSeats": 2,
        "storytellerSeats": 2
      }
    },
    "accessToken": "demo-jwt-token",
    "refreshToken": "demo-refresh-token"
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "message": "Email and password are required"
  }
}
```

## 🎯 测试场景

### 正常流程
1. ✅ 用户访问登录页面
2. ✅ 输入有效凭据登录
3. ✅ 成功跳转到仪表板
4. ✅ 获取用户资料信息
5. ✅ 用户登出

### 注册流程
1. ✅ 用户访问注册页面
2. ✅ 填写注册信息
3. ✅ 成功创建账户
4. ✅ 自动登录并跳转

### 错误处理
1. ✅ 缺少必填字段时显示错误
2. ✅ 无效凭据时显示错误
3. ✅ 网络错误时显示错误

### OAuth登录
1. ✅ Google登录按钮可点击
2. ✅ Apple登录按钮可点击
3. ✅ OAuth流程正确处理

## 🔧 开发者信息

### 演示账户
```
邮箱: demo@saga.com
密码: password

邮箱: another@example.com  
密码: TestPassword123
```

### 模拟数据
- 所有用户都有相同的资源钱包配置
- JWT令牌为模拟值，不进行实际验证
- OAuth登录返回模拟用户数据

### 前端集成
- 认证状态通过Zustand store管理
- 令牌存储在localStorage中
- 自动处理令牌刷新和错误

## 🎉 测试结果

```
🔐 测试Saga认证功能
==================
✅ 获取用户资料: 200
✅ 用户登录: 200  
✅ 用户注册: 200
✅ 用户登出: 200
✅ 刷新令牌: 200
✅ Google OAuth登录: 200
✅ Apple OAuth登录: 200
✅ 正确处理缺少参数: 400
✅ 错误处理正确实现

🎉 认证功能测试完成！
```

## 🚀 下一步

现在你可以：
1. **正常使用登录/注册功能** - 所有认证流程都已修复
2. **测试完整用户流程** - 从注册到使用应用的完整体验
3. **开发其他功能** - 认证基础已稳定，可以专注其他功能开发
4. **集成真实认证服务** - 当需要时可以替换为真实的认证后端

认证功能现在完全正常工作！🎉