#!/bin/bash

# 注册流程修复部署脚本
# 将修复的代码部署到生产环境

set -e

echo "🚀 开始部署注册流程修复到生产环境"
echo "=================================="

# 检查 Git 状态
echo "📋 检查 Git 状态..."
git status

# 添加修改的文件
echo "📁 添加修改的文件..."
git add packages/web/src/app/auth/signup/page.tsx
git add packages/web/src/app/auth/callback/page.tsx
git add packages/web/src/app/dashboard/page.tsx
git add packages/web/src/lib/api.ts
git add packages/web/src/components/error-tracking-provider.tsx
git add packages/web/src/components/analytics-provider.tsx

# 添加测试和文档文件
git add test-registration-flow.js
git add test-ui-improvements.html
git add check-supabase-settings.js
git add REGISTRATION_FIX_REPORT.md
git add deploy-registration-fix.sh

# 提交更改
echo "💾 提交更改..."
git commit -m "fix: 修复注册流程UX和邮箱验证问题

- 注册成功后隐藏表单，显示邮箱验证指导
- 修复邮箱验证链接格式错误 (添加 emailRedirectTo)
- 改进 auth callback 页面令牌处理
- 在仪表板添加验证成功欢迎消息
- 防止注册成功后重复操作
- 添加 mock API 支持本地开发

修复问题:
1. 注册成功后表单仍可重复提交
2. 邮箱验证链接导致 404 错误

测试: 自动化测试通过，UI 改进验证完成"

# 推送到远程仓库
echo "🌐 推送到远程仓库..."
git push origin main

# 检查部署状态
echo "🔍 检查部署状态..."
echo "请访问以下链接查看部署进度:"
echo "- Vercel Dashboard: https://vercel.com/dashboard"
echo "- GitHub Actions: https://github.com/your-repo/actions"

echo ""
echo "✅ 代码已成功推送到生产环境"
echo "🎯 生产环境测试步骤:"
echo "1. 等待 Vercel 自动部署完成 (通常 2-5 分钟)"
echo "2. 访问生产环境注册页面"
echo "3. 使用真实邮箱进行注册测试"
echo "4. 验证 UI 改进和邮箱验证流程"

echo ""
echo "📋 生产环境 URL (请替换为实际域名):"
echo "- 注册页面: https://your-domain.com/auth/signup"
echo "- 登录页面: https://your-domain.com/auth/signin"
echo "- 仪表板: https://your-domain.com/dashboard"

echo ""
echo "⚠️  重要提醒:"
echo "1. 确保 Supabase 项目中配置了正确的生产环境 URL"
echo "2. 检查 Site URL 和 Redirect URLs 设置"
echo "3. 验证邮件模板配置正确"

echo ""
echo "🏁 部署完成！"