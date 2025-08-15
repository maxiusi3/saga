#!/bin/bash

# Vercel构建脚本
echo "🔧 开始Vercel构建流程..."

# 构建shared包
echo "📦 构建shared包..."
cd packages/shared
npm run build
if [ $? -ne 0 ]; then
    echo "❌ shared包构建失败"
    exit 1
fi
echo "✅ shared包构建成功"

# 构建web包
echo "📦 构建web包..."
cd ../web
npm run build
if [ $? -ne 0 ]; then
    echo "❌ web包构建失败"
    exit 1
fi
echo "✅ web包构建成功"

echo "🎉 Vercel构建完成！"