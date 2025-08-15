# 🔐 Google OAuth 设置指南

## 问题诊断
Google登录按钮没有显示的原因：
1. ❌ Supabase环境变量未配置（还是占位符）
2. ❌ Supabase中未启用Google OAuth提供商

## 🚀 解决步骤

### **1. 配置Supabase环境变量**

在Vercel前端项目中设置以下环境变量：

```bash
# 在Vercel Dashboard > Settings > Environment Variables 中添加：

NEXT_PUBLIC_SUPABASE_URL=你的实际supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的实际supabase匿名密钥
SUPABASE_SERVICE_ROLE_KEY=你的实际supabase服务角色密钥
```

### **2. 在Supabase中启用Google OAuth**

#### **步骤A: 获取Supabase项目信息**
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 **Settings** > **API**
4. 复制以下信息：
   - **Project URL** (类似: `https://xxx.supabase.co`)
   - **anon public** key
   - **service_role** key (仅后端使用)

#### **步骤B: 配置Google OAuth提供商**
1. 在Supabase Dashboard中，进入 **Authentication** > **Providers**
2. 找到 **Google** 提供商
3. 点击启用开关
4. 配置以下设置：

```
✅ Enabled: 开启
Client ID: 你的Google OAuth客户端ID
Client Secret: 你的Google OAuth客户端密钥
Redirect URL: https://你的supabase项目.supabase.co/auth/v1/callback
```

#### **步骤C: 创建Google OAuth应用**
如果你还没有Google OAuth应用：

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 **Google+ API**
4. 进入 **APIs & Services** > **Credentials**
5. 点击 **Create Credentials** > **OAuth 2.0 Client IDs**
6. 配置：
   ```
   Application type: Web application
   Name: Saga App
   Authorized JavaScript origins: 
     - https://你的vercel域名.vercel.app
     - http://localhost:3000 (开发环境)
   Authorized redirect URIs:
     - https://你的supabase项目.supabase.co/auth/v1/callback
   ```

### **3. 更新Vercel环境变量**

在Vercel Dashboard中更新环境变量：

```bash
# 必需的Supabase变量
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon密钥
SUPABASE_SERVICE_ROLE_KEY=你的service_role密钥

# 可选的Google变量（用于前端显示）
NEXT_PUBLIC_GOOGLE_CLIENT_ID=你的google客户端ID
```

### **4. 重新部署前端**

更新环境变量后，重新部署Vercel项目：

```bash
# 在Vercel Dashboard中点击 "Redeploy" 
# 或者推送新的commit触发自动部署
```

## 🔍 **验证步骤**

### **检查环境变量是否生效**
1. 部署完成后访问你的网站
2. 打开浏览器开发者工具
3. 在Console中输入：
   ```javascript
   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
   ```
4. 应该显示真实的Supabase URL，而不是占位符

### **检查Google按钮是否显示**
1. 访问登录页面
2. 应该能看到 "使用Google登录" 按钮
3. 点击按钮应该跳转到Google OAuth页面

## 🛠️ **故障排除**

### **如果Google按钮仍然不显示**
1. **检查浏览器控制台错误**
2. **验证Supabase配置**：
   ```javascript
   // 在浏览器控制台中测试
   import { createClient } from '@supabase/supabase-js'
   const supabase = createClient(
     'your-supabase-url', 
     'your-anon-key'
   )
   console.log(supabase)
   ```

### **如果OAuth重定向失败**
1. **检查Supabase Redirect URL配置**
2. **确认Google OAuth应用的重定向URI**
3. **检查callback页面是否正常工作**

## 📋 **完整配置清单**

- [ ] ✅ 获取Supabase项目URL和密钥
- [ ] ✅ 在Supabase中启用Google OAuth提供商
- [ ] ✅ 创建Google OAuth应用
- [ ] ✅ 配置Google OAuth重定向URI
- [ ] ✅ 在Vercel中设置环境变量
- [ ] ✅ 重新部署前端应用
- [ ] ✅ 测试Google登录功能

## 🎯 **预期结果**

配置完成后，用户应该能够：
1. 在登录页面看到Google登录按钮
2. 点击按钮跳转到Google OAuth页面
3. 授权后自动跳转回应用并登录成功
4. 在仪表板中看到用户信息

**需要帮助？** 如果遇到问题，请检查：
- Supabase Dashboard中的Authentication日志
- Vercel部署日志
- 浏览器开发者工具中的网络请求和错误信息