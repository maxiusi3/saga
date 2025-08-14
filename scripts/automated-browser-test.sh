#!/bin/bash

echo "🤖 Saga浏览器自动化测试"
echo "======================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查streamable-mcp-server是否运行
echo -e "${BLUE}🔍 检查streamable-mcp-server状态...${NC}"
if curl -s -f "http://127.0.0.1:12306/mcp" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ streamable-mcp-server运行正常${NC}"
else
    echo -e "${RED}❌ streamable-mcp-server未运行${NC}"
    echo -e "${YELLOW}请确保streamable-mcp-server在端口12306上运行${NC}"
    echo -e "${YELLOW}启动命令示例: streamable-mcp-server --port 12306${NC}"
    exit 1
fi

# 检查开发服务器状态
echo -e "${BLUE}🔍 检查开发服务器状态...${NC}"
if curl -s -f "http://localhost:3000" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 前端服务器运行正常${NC}"
else
    echo -e "${RED}❌ 前端服务器未运行${NC}"
    echo -e "${YELLOW}请先启动开发服务器: ./scripts/dev-start-native.sh${NC}"
    exit 1
fi

if curl -s -f "http://localhost:4000/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务器运行正常${NC}"
else
    echo -e "${RED}❌ 后端服务器未运行${NC}"
    echo -e "${YELLOW}请先启动开发服务器: ./scripts/dev-start-native.sh${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📋 自动化测试计划${NC}"
echo "===================="
echo "1. 测试首页加载"
echo "2. 测试登录流程"
echo "3. 测试仪表板访问"
echo "4. 测试项目创建"
echo "5. 测试资源管理页面"
echo "6. 测试购买页面"
echo ""

echo -e "${YELLOW}💡 提示: 这个脚本准备了自动化测试框架${NC}"
echo -e "${YELLOW}   实际的浏览器控制需要通过MCP工具来执行${NC}"
echo -e "${YELLOW}   请在Kiro中使用streamable-mcp-server工具进行测试${NC}"
echo ""

echo -e "${GREEN}🎉 自动化测试环境准备完成！${NC}"
echo ""
echo -e "${BLUE}📝 下一步操作${NC}"
echo "===================="
echo "1. 在Kiro中使用streamable-mcp-server工具"
echo "2. 执行浏览器自动化测试"
echo "3. 验证所有页面和功能"
echo ""

# 创建测试用例文件
echo -e "${BLUE}📄 创建测试用例文件...${NC}"
cat > automated-test-cases.json << 'EOF'
{
  "testSuite": "Saga Web Application",
  "baseUrl": "http://localhost:3000",
  "testCases": [
    {
      "name": "首页加载测试",
      "url": "/",
      "expectedTitle": "Saga - Family Biography Platform",
      "expectedElements": [
        "h1",
        "nav",
        ".hero-section"
      ]
    },
    {
      "name": "登录页面测试",
      "url": "/auth/signin",
      "expectedTitle": "Saga - Family Biography Platform",
      "expectedElements": [
        "form",
        "input[type='email']",
        "input[type='password']",
        "button[type='submit']"
      ],
      "actions": [
        {
          "type": "fill",
          "selector": "input[type='email']",
          "value": "demo@saga.com"
        },
        {
          "type": "fill",
          "selector": "input[type='password']",
          "value": "password"
        },
        {
          "type": "click",
          "selector": "button[type='submit']"
        }
      ]
    },
    {
      "name": "仪表板访问测试",
      "url": "/dashboard",
      "requiresAuth": true,
      "expectedElements": [
        ".sidebar",
        ".main-content",
        "h1"
      ]
    },
    {
      "name": "项目页面测试",
      "url": "/dashboard/projects",
      "requiresAuth": true,
      "expectedElements": [
        ".projects-list",
        "button"
      ]
    },
    {
      "name": "资源管理页面测试",
      "url": "/dashboard/resources",
      "requiresAuth": true,
      "expectedElements": [
        ".resource-wallet",
        ".wallet-summary"
      ]
    },
    {
      "name": "购买页面测试",
      "url": "/dashboard/purchase",
      "requiresAuth": true,
      "expectedElements": [
        ".package-list",
        ".pricing-card"
      ]
    }
  ]
}
EOF

echo -e "${GREEN}✅ 测试用例文件已创建: automated-test-cases.json${NC}"
echo ""

echo -e "${BLUE}🔧 MCP配置信息${NC}"
echo "===================="
echo "服务器名称: streamable-mcp-server"
echo "类型: streamable-http"
echo "URL: http://127.0.0.1:12306/mcp"
echo "状态: 已配置"
echo ""

echo -e "${GREEN}🎯 准备就绪！${NC}"
echo "现在可以在Kiro中使用streamable-mcp-server工具进行浏览器自动化测试了。"