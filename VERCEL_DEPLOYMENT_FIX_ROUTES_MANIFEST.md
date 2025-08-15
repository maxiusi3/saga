# Vercel部署修复：Routes Manifest错误

## 🚨 问题分析

### 错误信息
```
Error: The file "/vercel/path0/packages/web/packages/web/.next/routes-manifest.json" couldn't be found.
```

### 问题原因
路径中出现了重复的`packages/web/packages/web`，这表明Vercel在处理monorepo时的路径配置有问题。

## 🔧 修复方案

### 1. 更新vercel.json配置
```json
{
  "buildCommand": "npm run build --workspace=packages/shared && npm run build --workspace=packages/web",
  "outputDirectory": "packages/web/.next",
  "installCommand": "npm ci",
  "framework": null
}
```

### 2. 关键修复点
- **直接使用workspace命令**: 避免自定义脚本的路径问题
- **明确指定framework**: 设置为null避免自动检测问题
- **简化构建流程**: 直接调用workspace构建命令

### 3. 验证构建
```bash
# 本地测试构建
npm run build --workspace=packages/shared
npm run build --workspace=packages/web

# 检查输出目录
ls -la packages/web/.next/
```

## 📋 部署检查清单

### 构建验证
- [ ] shared包构建成功
- [ ] web包构建成功
- [ ] .next目录存在
- [ ] routes-manifest.json存在

### 文件检查
```bash
# 检查关键文件
ls packages/web/.next/routes-manifest.json
ls packages/web/.next/server/
ls packages/web/.next/static/
```

### 环境变量
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] 其他必需的环境变量

## 🚀 重新部署步骤

### 1. 提交修复
```bash
git add vercel.json
git commit -m "fix: resolve Vercel routes-manifest path issue"
git push
```

### 2. 手动部署
```bash
vercel --prod
```

### 3. 监控部署
- 检查Vercel Dashboard
- 查看构建日志
- 验证部署成功

## 🔍 故障排除

### 如果仍然失败
1. **检查工作目录**: 确保Vercel在正确的目录执行构建
2. **验证依赖**: 确保所有依赖正确安装
3. **检查环境变量**: 验证所有必需的环境变量已设置
4. **查看详细日志**: 使用`vercel logs`查看详细错误信息

### 备用方案
如果问题持续，可以考虑：
1. 使用单独的部署配置
2. 重构为单包结构
3. 使用Docker部署

## 📞 获取帮助

- **Vercel文档**: https://vercel.com/docs/concepts/monorepos
- **Next.js部署**: https://nextjs.org/docs/deployment
- **GitHub Issues**: 检查相关问题和解决方案

---

**注意**: 这个修复应该解决路径重复的问题，确保Vercel能正确找到routes-manifest.json文件。