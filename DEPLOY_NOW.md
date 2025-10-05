# 🚀 立即部署指南

## ✅ 修复完成

所有代码已修复，不再调用 `localhost:3001`。现在可以部署了！

## 📋 部署前检查

### 1. Supabase 配置 ✅

确保你的 Supabase 项目已设置：
- ✅ 项目已创建
- ✅ 数据库表已创建（运行 `FINAL_SUPABASE_GUIDE.md` 中的 SQL）
- ✅ RLS 策略已配置

### 2. Vercel 环境变量 ⚠️

在 Vercel 项目设置中配置以下环境变量：

```env
# Supabase（必需）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Stripe（可选，支付功能需要）
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# 不要设置这些（已移除）
# ❌ NEXT_PUBLIC_API_URL
# ❌ NEXT_PUBLIC_WS_URL
```

## 🚀 部署步骤

### 方法 1：通过 Vercel Dashboard（推荐）

1. **登录 Vercel**：https://vercel.com
2. **找到你的项目**：saga-web
3. **进入 Settings → Environment Variables**
4. **添加上述环境变量**
5. **进入 Deployments 页面**
6. **点击最新部署旁边的 "..." → Redeploy**
7. **等待部署完成**（约 2-3 分钟）

### 方法 2：通过命令行

```bash
# 1. 确保在 web 目录
cd packages/web

# 2. 清理旧的构建文件
rm -rf .next

# 3. 部署到 Vercel
vercel --prod

# 4. 按提示操作
```

## ✅ 验证部署

### 1. 访问应用
打开：https://saga-web-livid.vercel.app

### 2. 检查设置页面
访问：https://saga-web-livid.vercel.app/settings

**预期结果**：
- ✅ 页面正常加载
- ✅ 没有 CORS 错误
- ✅ 可以查看和修改设置

### 3. 检查浏览器控制台
按 F12 打开开发者工具：
- ✅ 没有红色错误
- ✅ 没有 "localhost:3001" 相关的错误
- ✅ 没有 CORS 错误

### 4. 测试功能
- ✅ 登录/注册
- ✅ 查看设置
- ✅ 修改设置并保存
- ✅ 创建项目（如果有资源）

## 🐛 故障排查

### 问题 1：仍然看到 CORS 错误

**原因**：浏览器缓存了旧代码

**解决**：
1. 硬刷新页面：`Ctrl+Shift+R` (Windows) 或 `Cmd+Shift+R` (Mac)
2. 清除浏览器缓存
3. 使用隐私/无痕模式测试

### 问题 2：Supabase 连接失败

**检查**：
1. Vercel 环境变量是否正确设置
2. Supabase URL 格式：`https://xxx.supabase.co`
3. Supabase Anon Key 是否正确

**验证**：
```bash
# 在浏览器控制台运行
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
```

### 问题 3：数据库错误

**检查**：
1. Supabase 表是否已创建
2. RLS 策略是否已配置
3. 用户是否已认证

**查看 Supabase Logs**：
1. 登录 Supabase Dashboard
2. 进入 Logs 页面
3. 查看最近的错误

### 问题 4：页面空白

**检查**：
1. Vercel 部署日志是否有错误
2. 浏览器控制台是否有 JavaScript 错误
3. 网络请求是否成功

## 📊 监控

### Vercel Analytics
- 访问：https://vercel.com/your-project/analytics
- 查看：页面加载时间、错误率

### Supabase Logs
- 访问：https://app.supabase.com/project/_/logs
- 查看：数据库查询、错误日志

## 🎉 成功！

如果所有检查都通过，恭喜！你的应用现在是完全 serverless 的架构，运行在 Vercel + Supabase 上。

## 📝 下一步

1. **测试所有功能**
   - 用户注册/登录
   - 创建项目
   - 邀请成员
   - 上传故事

2. **配置自定义域名**（可选）
   - 在 Vercel 项目设置中添加域名
   - 配置 DNS 记录

3. **设置监控和告警**
   - 配置 Vercel 通知
   - 设置 Supabase 告警

4. **优化性能**
   - 启用 Vercel Edge Functions
   - 配置 Supabase Connection Pooling
   - 添加数据库索引

## 🆘 需要帮助？

如果遇到问题：
1. 查看 `SERVERLESS_MIGRATION_COMPLETE.md` 了解架构详情
2. 检查 Vercel 部署日志
3. 查看 Supabase 错误日志
4. 检查浏览器控制台错误
