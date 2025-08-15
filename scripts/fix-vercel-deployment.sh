#!/bin/bash

# 修复 Vercel 部署问题的脚本

echo "🔧 修复 Vercel 部署配置..."

# 1. 清理现有配置
echo "清理现有 Vercel 配置..."
rm -rf .vercel
rm -rf packages/web/.vercel
rm -f vercel.json
rm -f packages/web/vercel.json

# 2. 在根目录创建正确的 vercel.json
echo "创建根目录 vercel.json..."
cat > vercel.json << 'EOF'
{
  "buildCommand": "npm run build:vercel",
  "outputDirectory": "packages/web/.next",
  "installCommand": "npm ci",
  "framework": "nextjs"
}
EOF

# 3. 测试本地构建
echo "测试本地构建..."
npm run build:vercel

if [ $? -eq 0 ]; then
    echo "✅ 本地构建成功"
    
    # 4. 部署到 Vercel
    echo "部署到 Vercel..."
    vercel --prod
    
    if [ $? -eq 0 ]; then
        echo "✅ Vercel 部署成功"
    else
        echo "❌ Vercel 部署失败"
        exit 1
    fi
else
    echo "❌ 本地构建失败"
    exit 1
fi

echo "🎉 部署修复完成！"