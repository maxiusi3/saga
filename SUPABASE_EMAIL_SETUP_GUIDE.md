# 📧 Supabase邮件服务配置指南

## 🎯 **问题解决**

你的邮件注册问题是因为Supabase需要配置SMTP服务才能发送邮件。

## 🚀 **立即解决方案**

### **方案1: 配置Supabase SMTP（推荐）**

1. **访问Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/encdblxyxztvfxotfuyh/settings/auth
   ```

2. **配置SMTP设置**
   - 进入 **Settings** > **Authentication** > **SMTP Settings**
   - 启用 **Enable custom SMTP**
   - 配置以下信息：

   ```
   SMTP Host: smtp.gmail.com (如果使用Gmail)
   SMTP Port: 587
   SMTP User: your-email@gmail.com
   SMTP Pass: your-app-password (Gmail应用密码)
   Sender Name: Saga Family Stories
   Sender Email: your-email@gmail.com
   ```

3. **Gmail应用密码设置**
   - 访问 https://myaccount.google.com/security
   - 启用两步验证
   - 生成应用密码用于SMTP

### **方案2: 使用SendGrid（专业方案）**

1. **注册SendGrid账号**
   - 访问 https://sendgrid.com
   - 注册免费账号（每月100封邮件）

2. **获取API密钥**
   - 在SendGrid Dashboard创建API Key
   - 复制API密钥

3. **配置Supabase**
   ```
   SMTP Host: smtp.sendgrid.net
   SMTP Port: 587
   SMTP User: apikey
   SMTP Pass: 你的SendGrid API密钥
   Sender Name: Saga Family Stories
   Sender Email: noreply@yourdomain.com
   ```

## 🔧 **URL配置**

在Supabase Authentication Settings中配置：

```
Site URL: https://saga-web.vercel.app
Additional Redirect URLs:
- https://saga-web.vercel.app/auth/callback
- http://localhost:3000/auth/callback
- http://localhost:3001/auth/callback
```

## 📝 **邮件模板配置**

在Supabase > Authentication > Email Templates中：

1. **确认邮件模板**
   ```html
   <h2>确认您的邮箱</h2>
   <p>感谢注册Saga！请点击下面的链接确认您的邮箱：</p>
   <p><a href="{{ .ConfirmationURL }}">确认邮箱</a></p>
   ```

2. **重置密码模板**
   ```html
   <h2>重置密码</h2>
   <p>点击下面的链接重置您的密码：</p>
   <p><a href="{{ .ConfirmationURL }}">重置密码</a></p>
   ```

## 🧪 **测试步骤**

1. 配置完SMTP后，尝试注册新账号
2. 检查邮箱（包括垃圾邮件文件夹）
3. 点击验证链接完成注册

## 🔍 **故障排除**

### **如果仍然收不到邮件：**

1. **检查Supabase日志**
   - 在Dashboard > Logs中查看错误信息

2. **验证SMTP配置**
   - 确保SMTP凭据正确
   - 测试SMTP连接

3. **检查邮件过滤**
   - 查看垃圾邮件文件夹
   - 添加发件人到白名单

### **Google登录TrustedHTML错误**
这些错误来自浏览器插件，不影响应用功能：
- 可以忽略这些错误
- 或者在隐私模式下测试Google登录

## 📋 **快速检查清单**

- [ ] 配置Supabase SMTP设置
- [ ] 设置正确的重定向URL
- [ ] 配置邮件模板
- [ ] 测试邮件发送
- [ ] 验证Google OAuth配置

## 🎉 **完成后**

配置完成后，用户注册时将能够：
1. 收到验证邮件
2. 点击链接完成验证
3. 正常登录使用应用

需要帮助配置具体的SMTP服务吗？
