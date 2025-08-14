#!/bin/bash

# 🚀 Saga后端部署脚本 - 技术小白版

echo "🎯 开始部署Saga后端到Vercel..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 检查是否安装了Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "📦 正在安装Vercel CLI..."
    npm install -g vercel
fi

# 进入后端目录
cd packages/backend

echo "🔧 准备后端部署配置..."

# 创建.vercelignore文件
cat > .vercelignore << EOF
node_modules
.env
.env.local
*.log
.DS_Store
coverage
.nyc_output
EOF

# 更新package.json的scripts
echo "📝 更新package.json配置..."

# 部署到Vercel
echo "🚀 开始部署到Vercel..."
echo "请按照提示操作："
echo "1. 选择你的Vercel账户"
echo "2. 项目名称建议：saga-backend"
echo "3. 确认部署"

vercel --prod

echo "✅ 后端部署完成！"
echo "📋 请记录显示的部署URL，稍后需要用到"
echo ""
echo "🔄 下一步：更新前端的API_URL环境变量"