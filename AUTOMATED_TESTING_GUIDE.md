# Saga 浏览器自动化测试指南

## 🤖 MCP配置已完成

### 添加的MCP服务器
```json
{
  "mcpServers": {
    "streamable-mcp-server": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:12306/mcp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## 🚀 使用方法

### 1. 启动streamable-mcp-server
确保streamable-mcp-server在端口12306上运行：
```bash
# 启动streamable-mcp-server (具体命令可能因安装方式而异)
streamable-mcp-server --port 12306
```

### 2. 启动Saga开发环境
```bash
./scripts/dev-start-native.sh
```

### 3. 运行自动化测试准备脚本
```bash
./scripts/automated-browser-test.sh
```

## 🧪 自动化测试用例

### 测试套件概览
- ✅ **首页加载测试** - 验证首页正常加载
- ✅ **登录流程测试** - 自动化登录流程
- ✅ **仪表板访问测试** - 验证认证后页面访问
- ✅ **项目管理测试** - 测试项目相关功能
- ✅ **资源管理测试** - 测试资源钱包功能
- ✅ **购买流程测试** - 测试购买页面功能

### 详细测试用例

#### 1. 首页加载测试
```javascript
// 使用streamable-mcp-server工具执行
{
  "name": "首页加载测试",
  "url": "http://localhost:3000/",
  "expectedTitle": "Saga - Family Biography Platform",
  "expectedElements": ["h1", "nav", ".hero-section"]
}
```

#### 2. 登录流程测试
```javascript
{
  "name": "登录页面测试",
  "url": "http://localhost:3000/auth/signin",
  "actions": [
    {
      "type": "fill",
      "selector": "input[type='email']",
      "value": "demo@saga.com"
    },
    {
      "type": "fill", 
      "selector": "input[type='password']",
      "value": "password"
    },
    {
      "type": "click",
      "selector": "button[type='submit']"
    }
  ]
}
```

#### 3. 仪表板功能测试
```javascript
{
  "name": "仪表板访问测试",
  "url": "http://localhost:3000/dashboard",
  "requiresAuth": true,
  "expectedElements": [".sidebar", ".main-content", "h1"]
}
```

## 🔧 在Kiro中使用MCP工具

### 基本浏览器操作
使用streamable-mcp-server工具可以执行以下操作：

1. **打开页面**
   ```
   请使用streamable-mcp-server打开 http://localhost:3000
   ```

2. **填写表单**
   ```
   请在登录页面填写邮箱 demo@saga.com 和密码 password
   ```

3. **点击按钮**
   ```
   请点击登录按钮提交表单
   ```

4. **验证页面元素**
   ```
   请检查页面是否包含仪表板的主要元素
   ```

5. **截图验证**
   ```
   请截图当前页面以验证显示效果
   ```

### 完整测试流程示例
```
1. 打开首页 http://localhost:3000
2. 验证页面标题和主要元素
3. 导航到登录页面 /auth/signin
4. 填写登录表单 (demo@saga.com / password)
5. 提交登录表单
6. 验证跳转到仪表板
7. 测试各个功能页面的访问
8. 截图记录测试结果
```

## 📋 测试检查清单

### 页面加载测试
- [ ] 首页正常加载
- [ ] 登录页面正常加载
- [ ] 注册页面正常加载
- [ ] 仪表板页面正常加载
- [ ] 项目页面正常加载
- [ ] 资源管理页面正常加载
- [ ] 购买页面正常加载

### 功能测试
- [ ] 用户登录功能正常
- [ ] 用户注册功能正常
- [ ] 页面导航功能正常
- [ ] 表单提交功能正常
- [ ] 数据显示功能正常

### 响应式测试
- [ ] 桌面端显示正常
- [ ] 平板端显示正常
- [ ] 移动端显示正常

### 性能测试
- [ ] 页面加载时间 < 3秒
- [ ] 交互响应时间 < 1秒
- [ ] 无JavaScript错误
- [ ] 无控制台警告

## 🎯 测试目标

### 主要目标
1. **验证所有页面正常加载** - 确保没有404错误
2. **验证用户流程完整** - 从注册到使用的完整体验
3. **验证UI组件正常** - 按钮、表单、导航等
4. **验证数据交互** - 前后端API调用正常

### 成功标准
- ✅ 所有页面返回200状态码
- ✅ 登录/注册流程无错误
- ✅ 页面元素正确显示
- ✅ 用户交互响应正常
- ✅ 无JavaScript控制台错误

## 🔍 故障排除

### 常见问题
1. **streamable-mcp-server连接失败**
   - 检查服务器是否在端口12306运行
   - 验证URL配置是否正确

2. **页面加载失败**
   - 确认开发服务器正在运行
   - 检查前后端服务器状态

3. **登录失败**
   - 使用正确的演示账户凭据
   - 检查后端认证API状态

### 调试步骤
1. 运行 `./scripts/automated-browser-test.sh` 检查环境
2. 验证所有服务器正常运行
3. 在浏览器中手动测试功能
4. 检查控制台错误信息

## 📊 测试报告

测试完成后，请记录：
- 测试执行时间
- 通过/失败的测试用例
- 发现的问题和错误
- 性能指标
- 截图证据

## 🎉 开始测试

现在你可以：
1. 在Kiro中使用streamable-mcp-server工具
2. 执行自动化浏览器测试
3. 验证Saga应用的所有功能
4. 生成测试报告

MCP配置已完成，开始你的自动化测试之旅吧！🚀