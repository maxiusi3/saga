#!/bin/bash

# 🚀 Force Vercel Deployment Script
# This script creates multiple deployment triggers to ensure Vercel detects changes

echo "🚀 强制触发Vercel部署..."

# 1. 创建一个临时文件来触发部署
echo "📝 创建部署触发文件..."
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
echo "// Deployment trigger - $TIMESTAMP" > packages/web/public/deployment-trigger.txt

# 2. 提交更改
echo "📤 提交部署触发文件..."
git add packages/web/public/deployment-trigger.txt
git commit -m "chore: Force deployment trigger - $TIMESTAMP

🔄 DEPLOYMENT TRIGGER FILE:
- Created deployment-trigger.txt with timestamp
- This should force Vercel to detect changes and deploy
- Timestamp: $TIMESTAMP"

# 3. 推送到GitHub
echo "🌐 推送到GitHub..."
git push origin main

# 4. 创建另一个空提交作为备用
echo "🔄 创建空提交作为备用..."
git commit --allow-empty -m "chore: Backup empty commit for deployment - $TIMESTAMP"
git push origin main

echo "✅ 部署触发完成！"
echo ""
echo "📋 检查清单："
echo "1. 等待3-5分钟"
echo "2. 检查Vercel Dashboard中的部署状态"
echo "3. 访问网站查看更新"
echo "4. 查看登录页面的时间戳验证部署"
echo ""
echo "🔍 如果仍然没有部署，请检查："
echo "- Vercel项目是否正确连接到GitHub仓库"
echo "- GitHub webhook是否正常工作"
echo "- Vercel项目设置中的自动部署是否启用"