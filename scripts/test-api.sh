#!/bin/bash

# API 测试脚本
set -e

API_URL="http://localhost:3001"

echo "🧪 测试 Saga API 端点..."

# 测试健康检查
echo "1. 测试健康检查端点..."
if curl -s "$API_URL/health" | grep -q "ok"; then
    echo "✅ 健康检查通过"
else
    echo "❌ 健康检查失败"
    exit 1
fi

# 测试用户注册
echo "2. 测试用户注册..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/signup" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@example.com",
        "password": "TestPassword123!",
        "firstName": "Test",
        "lastName": "User"
    }')

if echo "$REGISTER_RESPONSE" | grep -q "token\|email"; then
    echo "✅ 用户注册成功"
else
    echo "⚠️  用户注册响应: $REGISTER_RESPONSE"
fi

# 测试用户登录
echo "3. 测试用户登录..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/signin" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@example.com",
        "password": "TestPassword123!"
    }')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo "✅ 用户登录成功"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "🔑 获取到访问令牌"
else
    echo "⚠️  用户登录响应: $LOGIN_RESPONSE"
fi

# 测试受保护的端点
if [ ! -z "$TOKEN" ]; then
    echo "4. 测试受保护的端点..."
    PROFILE_RESPONSE=$(curl -s -X GET "$API_URL/api/auth/profile" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$PROFILE_RESPONSE" | grep -q "email"; then
        echo "✅ 受保护端点访问成功"
    else
        echo "⚠️  受保护端点响应: $PROFILE_RESPONSE"
    fi
fi

echo ""
echo "🎉 API 测试完成！"
echo "📝 你现在可以："
echo "   - 访问前端: http://localhost:3000"
echo "   - 使用测试账号登录: test@example.com / TestPassword123!"
echo "   - 查看API文档: http://localhost:3001/api-docs (如果配置了)"