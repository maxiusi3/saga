#!/bin/bash

# Vercel部署状态检查脚本
echo "🔍 检查Vercel部署状态..."
echo "=================================="

# 检查是否安装了vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI未安装"
    echo "📦 安装命令: npm i -g vercel"
    echo ""
    echo "🌐 或者访问Vercel Dashboard查看部署状态:"
    echo "   https://vercel.com/dashboard"
    exit 1
fi

echo "✅ Vercel CLI已安装"
echo ""

# 检查项目状态
echo "📊 项目部署信息:"
vercel ls 2>/dev/null || echo "⚠️  需要先登录: vercel login"

echo ""
echo "🔗 快速链接:"
echo "   • Vercel Dashboard: https://vercel.com/dashboard"
echo "   • GitHub Actions: https://github.com/maxiusi3/saga/actions"
echo "   • 项目仓库: https://github.com/maxiusi3/saga"

echo ""
echo "📋 检查清单:"
echo "   □ Vercel检测到新提交"
echo "   □ 构建开始执行"
echo "   □ 依赖安装成功"
echo "   □ Next.js构建完成"
echo "   □ 部署成功"
echo "   □ 域名可访问"

echo ""
echo "🚨 如果部署失败，检查:"
echo "   1. 环境变量配置"
echo "   2. 构建日志错误"
echo "   3. 依赖版本冲突"
echo "   4. 内存/超时限制"