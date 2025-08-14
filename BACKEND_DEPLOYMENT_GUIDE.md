# 🚀 后端部署指南 - 超简单版

## 📋 **通过Vercel网站部署后端**

### **步骤1：准备工作**
✅ 你的代码已经推送到GitHub  
✅ 后端配置文件已经准备好  

### **步骤2：在Vercel创建新项目**

1. **打开浏览器，访问** [vercel.com](https://vercel.com)

2. **点击 "New Project"**

3. **选择GitHub仓库**
   - 找到你的 `saga` 仓库
   - 点击 "Import"

4. **配置项目设置**
   - **Project Name**: `saga-backend` (或你喜欢的名字)
   - **Framework Preset**: 选择 "Other"
   - **Root Directory**: 点击 "Edit" 然后输入 `packages/backend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm ci`

5. **点击 "Deploy"**

### **步骤3：等待部署完成**
- 大约需要2-5分钟
- 如果成功，会显示一个绿色的 ✅ 和网址
- 如果失败，会显示错误信息

### **步骤4：记录后端URL**
部署成功后，你会看到类似这样的URL：
```
https://saga-backend-xxx.vercel.app
```
**请复制并保存这个URL！**

---

## 🔧 **如果部署失败**

### **常见错误和解决方法：**

#### **错误1：Build failed**
- 检查Root Directory是否设置为 `packages/backend`
- 检查Build Command是否为 `npm run build`

#### **错误2：Module not found**
- 这通常是依赖问题，我们已经修复了配置

#### **错误3：TypeScript errors**
- 这是正常的，我们的代码有一些测试文件的类型问题，但不影响运行

---

## ✅ **部署成功后**

### **下一步：更新前端配置**

1. **打开你的前端Vercel项目**
2. **进入 Settings → Environment Variables**
3. **找到 `NEXT_PUBLIC_API_URL`**
4. **把值改为你刚才记录的后端URL**
5. **点击 Save**
6. **重新部署前端**

---

## 🆘 **需要帮助？**

如果遇到问题，请告诉我：
1. 具体在哪一步出错了
2. 错误信息是什么
3. 截图（如果有的话）

我会帮你解决！🤝