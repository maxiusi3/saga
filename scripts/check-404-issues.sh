#!/bin/bash

echo "🔍 404问题检测脚本"
echo "===================="

# 检查前端服务器状态
echo "📡 检查前端服务器状态..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ 前端服务器运行正常 (http://localhost:3000)"
else
    echo "❌ 前端服务器无法访问 (状态码: $FRONTEND_STATUS)"
    echo "请先启动前端服务器: npm run dev"
    exit 1
fi

echo ""
echo "🧪 测试核心页面..."

# 测试核心页面
declare -a page_names=("Home" "SignIn" "SignUp" "Dashboard")
declare -a page_urls=("/" "/auth/signin" "/auth/signup" "/dashboard")

for i in "${!page_names[@]}"; do
    page_name="${page_names[$i]}"
    page_url="${page_urls[$i]}"
    url="http://localhost:3000$page_url"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        echo "✅ $page_name: $status"
    else
        echo "⚠️  $page_name: $status ($page_url)"
    fi
done

echo ""
echo "📁 检查静态资源..."

# 检查静态资源
declare -a resource_names=("favicon.ico" "favicon.svg")
declare -a resource_urls=("/favicon.ico" "/favicon.svg")

for i in "${!resource_names[@]}"; do
    resource_name="${resource_names[$i]}"
    resource_url="${resource_urls[$i]}"
    url="http://localhost:3000$resource_url"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        echo "✅ $resource_name: $status"
    else
        echo "❌ $resource_name: $status ($resource_url)"
    fi
done

echo ""
echo "🔧 后端API检测..."

# 检查后端服务器
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health 2>/dev/null || echo "000")

if [ "$BACKEND_STATUS" = "200" ]; then
    echo "✅ 后端服务器运行正常 (http://localhost:5000)"
    
    # 测试API端点
    declare -a api_names=("Health" "Auth")
    declare -a api_urls=("/health" "/api/auth/me")
    
    for i in "${!api_names[@]}"; do
        api_name="${api_names[$i]}"
        api_url="${api_urls[$i]}"
        url="http://localhost:5000$api_url"
        status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        echo "📡 $api_name: $status"
    done
else
    echo "⚠️  后端服务器未运行 (状态码: $BACKEND_STATUS)"
    echo "   这可能导致API相关的404错误"
    echo "   启动后端: cd packages/backend && npm start"
fi

echo ""
echo "📋 总结和建议"
echo "=============="

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ 前端服务器正常，主要页面可以访问"
    echo ""
    echo "🔍 手动检测步骤:"
    echo "1. 在浏览器中打开 http://localhost:3000"
    echo "2. 按F12打开开发者工具"
    echo "3. 切换到Network标签"
    echo "4. 刷新页面并查看红色的404请求"
    echo "5. 测试登录、注册等功能"
    echo ""
    
    if [ "$BACKEND_STATUS" != "200" ]; then
        echo "⚠️  注意: 后端服务器未运行，可能会有API相关的404错误"
        echo "   但这不影响前端页面的基本显示"
    fi
    
    echo "📊 如果看到404错误，请记录具体的URL路径"
    echo "   大部分404可能是正常的开发环境现象"
else
    echo "❌ 前端服务器无法访问，请先解决服务器启动问题"
fi

echo ""
echo "🎯 完成检测！"