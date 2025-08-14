#!/bin/bash

# 🔍 Saga部署状态检查脚本

echo "🔍 检查Saga项目部署状态..."
echo ""

# 检查环境变量文件
echo "📋 检查环境变量配置："

if [ -f "packages/web/.env.local" ]; then
    echo "✅ 前端环境变量文件存在"
    
    # 检查Supabase配置
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" packages/web/.env.local; then
        echo "✅ Supabase URL已配置"
    else
        echo "❌ 缺少Supabase URL配置"
    fi
    
    if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" packages/web/.env.local; then
        echo "✅ Supabase匿名密钥已配置"
    else
        echo "❌ 缺少Supabase匿名密钥配置"
    fi
    
    # 检查API URL
    if grep -q "NEXT_PUBLIC_API_URL" packages/web/.env.local; then
        echo "✅ API URL已配置"
        API_URL=$(grep "NEXT_PUBLIC_API_URL" packages/web/.env.local | cut -d'=' -f2)
        echo "   当前API URL: $API_URL"
    else
        echo "❌ 缺少API URL配置"
    fi
else
    echo "❌ 前端环境变量文件不存在"
fi

echo ""

# 检查后端配置
echo "📋 检查后端配置："

if [ -f "packages/backend/vercel.json" ]; then
    echo "✅ 后端Vercel配置文件存在"
else
    echo "❌ 后端Vercel配置文件不存在"
fi

if [ -f "packages/backend/package.json" ]; then
    echo "✅ 后端package.json存在"
else
    echo "❌ 后端package.json不存在"
fi

echo ""

# 提供下一步建议
echo "🎯 下一步建议："
echo ""

if [ ! -f "packages/web/.env.local" ] || ! grep -q "your_supabase" packages/web/.env.local; then
    echo "1. 📝 请先完成Supabase环境变量配置"
    echo "   - 在packages/web/.env.local中填入真实的Supabase URL和密钥"
fi

if [ ! -f "packages/backend/vercel.json" ]; then
    echo "2. 🚀 运行后端部署脚本："
    echo "   ./scripts/deploy-backend-to-vercel.sh"
fi

if grep -q "localhost:4000" packages/web/.env.local; then
    echo "3. 🔄 部署后端后，更新前端的API_URL为实际的Vercel URL"
fi

echo ""
echo "📞 如需帮助，请提供此检查结果！"