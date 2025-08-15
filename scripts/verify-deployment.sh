#!/bin/bash

# 部署验证脚本
echo "🔍 Saga应用部署验证"
echo "=================================="

# 获取部署URL
if [ -z "$1" ]; then
    echo "📝 用法: $0 <deployment-url>"
    echo "   例如: $0 https://saga-app.vercel.app"
    echo ""
    echo "💡 提示: 在Vercel Dashboard中找到你的部署URL"
    exit 1
fi

DEPLOYMENT_URL="$1"
echo "🌐 验证URL: $DEPLOYMENT_URL"
echo ""

# 基础连接测试
echo "1️⃣ 基础连接测试..."
if curl -s --head "$DEPLOYMENT_URL" | head -n 1 | grep -q "200 OK"; then
    echo "   ✅ 网站可访问"
else
    echo "   ❌ 网站无法访问"
    echo "   💡 检查: 部署是否成功，URL是否正确"
fi

# 检查关键页面
echo ""
echo "2️⃣ 关键页面检查..."

pages=(
    "/"
    "/auth/signin"
    "/auth/signup"
    "/dashboard"
)

for page in "${pages[@]}"; do
    url="${DEPLOYMENT_URL}${page}"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$status" = "200" ]; then
        echo "   ✅ $page (HTTP $status)"
    elif [ "$status" = "404" ]; then
        echo "   ❌ $page (HTTP $status - 页面不存在)"
    elif [ "$status" = "500" ]; then
        echo "   ❌ $page (HTTP $status - 服务器错误)"
    else
        echo "   ⚠️  $page (HTTP $status)"
    fi
done

# 检查静态资源
echo ""
echo "3️⃣ 静态资源检查..."

assets=(
    "/_next/static/css"
    "/_next/static/chunks"
    "/favicon.ico"
)

for asset in "${assets[@]}"; do
    url="${DEPLOYMENT_URL}${asset}"
    if curl -s --head "$url" | head -n 1 | grep -q "200\|301\|302"; then
        echo "   ✅ $asset"
    else
        echo "   ❌ $asset"
    fi
done

# API健康检查
echo ""
echo "4️⃣ API健康检查..."

api_endpoints=(
    "/api/health"
    "/api/auth/session"
)

for endpoint in "${api_endpoints[@]}"; do
    url="${DEPLOYMENT_URL}${endpoint}"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$status" = "200" ]; then
        echo "   ✅ $endpoint (HTTP $status)"
    else
        echo "   ❌ $endpoint (HTTP $status)"
    fi
done

# 环境变量检查
echo ""
echo "5️⃣ 环境变量检查..."
echo "   💡 检查浏览器控制台是否有环境变量相关错误"
echo "   💡 验证Supabase连接是否正常"
echo "   💡 确认OAuth配置是否正确"

# 性能检查
echo ""
echo "6️⃣ 性能检查..."
load_time=$(curl -s -o /dev/null -w "%{time_total}" "$DEPLOYMENT_URL")
echo "   ⏱️  页面加载时间: ${load_time}s"

if (( $(echo "$load_time < 3.0" | bc -l) )); then
    echo "   ✅ 加载速度良好"
elif (( $(echo "$load_time < 5.0" | bc -l) )); then
    echo "   ⚠️  加载速度一般"
else
    echo "   ❌ 加载速度较慢"
fi

# 总结
echo ""
echo "📊 验证总结"
echo "=================================="
echo "🌐 部署URL: $DEPLOYMENT_URL"
echo ""
echo "📋 手动验证清单:"
echo "   □ 用户注册/登录功能"
echo "   □ 项目创建功能"
echo "   □ 故事录制功能"
echo "   □ 文件上传功能"
echo "   □ 支付流程"
echo "   □ 邮件通知"
echo "   □ 移动端兼容性"

echo ""
echo "🔧 如果发现问题:"
echo "   1. 检查Vercel构建日志"
echo "   2. 验证环境变量配置"
echo "   3. 查看浏览器控制台错误"
echo "   4. 检查网络请求失败"

echo ""
echo "📚 有用链接:"
echo "   • Vercel Dashboard: https://vercel.com/dashboard"
echo "   • 构建日志: vercel logs $DEPLOYMENT_URL"
echo "   • 项目仓库: https://github.com/maxiusi3/saga"