# Supabase配置指南

## 当前部署URL
https://saga-81wxqpwfi-fangzero-3350s-projects.vercel.app

## Supabase控制台配置

### 1. 进入Supabase控制台
https://supabase.com/dashboard/project/encdblxyxztvfxotfuyh/auth/url-configuration

### 2. 更新Site URL
```
https://saga-81wxqpwfi-fangzero-3350s-projects.vercel.app
```

### 3. 更新Redirect URLs
```
https://saga-81wxqpwfi-fangzero-3350s-projects.vercel.app/
https://saga-81wxqpwfi-fangzero-3350s-projects.vercel.app/auth/callback
https://saga-81wxqpwfi-fangzero-3350s-projects.vercel.app/auth/verify
https://saga-81wxqpwfi-fangzero-3350s-projects.vercel.app/auth/confirm
https://saga-81wxqpwfi-fangzero-3350s-projects.vercel.app/**
http://localhost:3000/
http://localhost:3000/auth/callback
http://localhost:3000/auth/verify
http://localhost:3000/auth/confirm
```

### 4. 邮件模板配置（可选）

如果需要自定义邮件验证模板，可以在 Authentication → Email Templates 中修改：

```html
<h2>确认您的注册</h2>
<p>点击下面的链接来确认您的账户：</p>
<p><a href="{{ .ConfirmationURL }}">确认邮箱</a></p>
```

## 验证流程说明

1. 用户注册后收到验证邮件
2. 点击邮件中的验证链接
3. 链接重定向到应用首页，带有验证参数
4. EmailVerificationHandler组件检测验证参数
5. 自动处理验证并登录用户
6. 跳转到Dashboard

## 测试步骤

1. 注册新账户
2. 检查邮箱
3. 点击验证链接
4. 确认自动登录并跳转到Dashboard
