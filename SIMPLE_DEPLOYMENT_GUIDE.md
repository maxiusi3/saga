# 🚀 Saga项目部署指南 - 技术小白版

## 📍 **你现在的状态**
✅ Supabase项目已创建  
✅ Vercel环境变量已设置  
🔄 需要部署后端API  
🔄 需要配置登录功能  

---

## 🎯 **第3步：部署后端API**

### **什么是后端API？**
后端API就像餐厅的厨房，负责处理用户登录、数据存储等功能。现在你的网站只有"前台"（用户看到的页面），没有"厨房"（处理逻辑的服务器）。

### **操作步骤：**

#### **3.1 在Vercel创建新项目**
1. 打开 [vercel.com](https://vercel.com)
2. 点击 "New Project"
3. 选择你的GitHub仓库 `saga`
4. **重要**：在 "Configure Project" 页面：
   - **Root Directory**: 设置为 `packages/backend`
   - **Framework Preset**: 选择 "Other"
   - 点击 "Deploy"

#### **3.2 等待部署完成**
- 大约需要2-3分钟
- 部署成功后会显示一个网址，比如：`https://saga-backend-xxx.vercel.app`

#### **3.3 记录后端网址**
- 复制这个网址，我们稍后需要用到

---

## 🎯 **第4步：连接前端和后端**

### **操作步骤：**

#### **4.1 更新前端配置**
1. 在Vercel中打开你的前端项目（之前部署的那个）
2. 进入 "Settings" → "Environment Variables"
3. 找到 `NEXT_PUBLIC_API_URL` 这一行
4. 把值改为你刚才记录的后端网址
5. 点击 "Save"

#### **4.2 重新部署前端**
1. 在前端项目页面，点击 "Deployments"
2. 点击最新的部署右边的三个点 "..."
3. 选择 "Redeploy"
4. 等待重新部署完成

---

## 🎯 **第5步：配置Google登录**

### **操作步骤：**

#### **5.1 在Google创建OAuth应用**
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 "Google+ API"
4. 创建 "OAuth 2.0 客户端ID"
5. 设置授权重定向URI：
   - `https://你的前端网址.vercel.app/auth/callback`
   - `https://你的supabase项目.supabase.co/auth/v1/callback`

#### **5.2 在Supabase配置Google登录**
1. 打开你的Supabase项目
2. 进入 "Authentication" → "Providers"
3. 找到 "Google" 并点击
4. 输入从Google获得的：
   - Client ID
   - Client Secret
5. 点击 "Save"

#### **5.3 在Vercel添加Google配置**
1. 在前端项目的环境变量中添加：
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: 你的Google Client ID
2. 重新部署前端

---

## 🎯 **测试登录功能**

### **操作步骤：**
1. 打开你的网站
2. 点击 "登录" 或 "Sign In"
3. 选择 "Google登录"
4. 如果一切正常，应该能成功登录

---

## 🆘 **如果遇到问题**

### **常见问题：**

#### **问题1：后端部署失败**
- 检查Root Directory是否设置为 `packages/backend`
- 检查是否选择了正确的GitHub仓库

#### **问题2：登录按钮没反应**
- 检查前端的 `NEXT_PUBLIC_API_URL` 是否正确
- 检查后端是否成功部署

#### **问题3：Google登录失败**
- 检查重定向URI是否正确设置
- 检查Google Client ID是否正确

---

## 📞 **需要帮助？**

如果遇到任何问题，请告诉我：
1. 你在哪一步遇到了问题
2. 具体的错误信息是什么
3. 截图（如果有的话）

我会帮你一步步解决！🤝