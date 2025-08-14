#!/bin/bash

echo "🔍 检查Saga应用路由状态"
echo ""

# 前端路由检查
echo "📱 前端路由检查:"
routes=(
  "/"
  "/auth/signup"
  "/auth/signin"
  "/dashboard"
  "/dashboard/projects"
  "/dashboard/stories"
  "/dashboard/profile"
)

for route in "${routes[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$route")
  if [ "$status" = "200" ]; then
    echo "  ✅ $route - $status"
  else
    echo "  ❌ $route - $status"
  fi
done

echo ""
echo "🔧 后端API检查:"
api_routes=(
  "/health"
  "/api/health"
  "/api/auth/signup"
  "/api/auth/signin"
)

for route in "${api_routes[@]}"; do
  if [[ "$route" == *"/auth/"* ]]; then
    # POST请求
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3001$route" -H "Content-Type: application/json" -d '{}')
  else
    # GET请求
    status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001$route")
  fi
  
  if [ "$status" = "200" ] || [ "$status" = "201" ] || [ "$status" = "400" ]; then
    echo "  ✅ $route - $status"
  else
    echo "  ❌ $route - $status"
  fi
done

echo ""
echo "🌐 常见404问题检查:"

# 检查favicon
status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/favicon.ico")
echo "  favicon.ico: $status"

# 检查静态资源
status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/_next/static/css/app/layout.css")
echo "  CSS资源: $status"

# 检查不存在的路由
status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/nonexistent")
echo "  不存在路由: $status (应该是404)"

echo ""
echo "📊 总结:"
echo "  如果看到404错误，可能原因："
echo "  1. 静态资源加载失败 (CSS, JS, 图片)"
echo "  2. API调用路径错误"
echo "  3. 前端路由配置问题"
echo "  4. 浏览器开发者工具中的网络请求失败"