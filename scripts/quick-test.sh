#!/bin/bash

echo "🧪 Saga前后端联调快速测试"
echo "========================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试后端API端点
echo -e "${BLUE}🔍 测试后端API端点...${NC}"

declare -a api_tests=(
    "http://localhost:4000/health|健康检查"
    "http://localhost:4000/api/health|API健康检查"
    "http://localhost:4000/api/projects|项目列表API"
    "http://localhost:4000/api/auth/me|用户信息API"
    "http://localhost:4000/api/packages|套餐列表API"
)

for url_info in "${api_tests[@]}"; do
    IFS='|' read -r url name <<< "$url_info"
    
    echo -e "${YELLOW}测试: $name${NC}"
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url" 2>/dev/null)
    http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo $response | sed -e 's/HTTPSTATUS:.*//g')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ $name: $http_code${NC}"
        echo -e "${BLUE}   响应: $(echo $body | head -c 100)...${NC}"
    else
        echo -e "${RED}❌ $name: $http_code${NC}"
    fi
    echo ""
done

# 测试前端页面
echo -e "${BLUE}🌐 测试前端页面...${NC}"

declare -a page_tests=(
    "http://localhost:3000|首页"
    "http://localhost:3000/auth/signin|登录页"
    "http://localhost:3000/dashboard|仪表板"
)

for url_info in "${page_tests[@]}"; do
    IFS='|' read -r url name <<< "$url_info"
    
    echo -e "${YELLOW}测试: $name${NC}"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ $name: $status${NC}"
    else
        echo -e "${RED}❌ $name: $status${NC}"
    fi
done

echo ""
echo -e "${BLUE}📊 测试总结${NC}"
echo "===================="
echo -e "后端API服务器: $(curl -s -f "http://localhost:4000/health" > /dev/null 2>&1 && echo -e "${GREEN}✅ 正常${NC}" || echo -e "${RED}❌ 异常${NC}")"
echo -e "前端Web服务器: $(curl -s -f "http://localhost:3000" > /dev/null 2>&1 && echo -e "${GREEN}✅ 正常${NC}" || echo -e "${RED}❌ 异常${NC}")"
echo ""

# 测试前后端通信
echo -e "${BLUE}🔗 测试前后端通信...${NC}"
echo -e "${YELLOW}检查前端是否能正确调用后端API...${NC}"

# 检查前端环境变量配置
if grep -q "NEXT_PUBLIC_API_URL=http://localhost:4000" packages/web/.env.local; then
    echo -e "${GREEN}✅ 前端API配置正确${NC}"
else
    echo -e "${RED}❌ 前端API配置错误${NC}"
fi

echo ""
echo -e "${GREEN}🎉 快速测试完成！${NC}"
echo -e "${YELLOW}💡 如果所有测试都通过，你可以开始前后端联调开发了${NC}"