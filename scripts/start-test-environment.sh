#!/bin/bash

echo "🚀 启动Saga测试环境"
echo "===================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查Node.js版本
echo -e "${BLUE}📋 检查系统环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js未安装${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js版本: $NODE_VERSION${NC}"

# 检查npm版本
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm未安装${NC}"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ npm版本: $NPM_VERSION${NC}"

# 停止现有进程
echo -e "${YELLOW}🛑 停止现有服务器进程...${NC}"
pkill -f "next dev" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true
pkill -f "node.*backend" 2>/dev/null || true

# 等待进程完全停止
sleep 2

# 清理构建缓存
echo -e "${YELLOW}🧹 清理构建缓存...${NC}"
rm -rf packages/web/.next 2>/dev/null || true
rm -rf packages/backend/dist 2>/dev/null || true

# 检查依赖
echo -e "${BLUE}📦 检查依赖安装...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  根目录依赖未安装，正在安装...${NC}"
    npm install
fi

if [ ! -d "packages/web/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Web依赖未安装，正在安装...${NC}"
    cd packages/web && npm install && cd ../..
fi

if [ ! -d "packages/backend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Backend依赖未安装，正在安装...${NC}"
    cd packages/backend && npm install && cd ../..
fi

# 启动后端服务器
echo -e "${BLUE}🔧 启动后端服务器...${NC}"
cd packages/backend

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env文件不存在，从.env.example复制...${NC}"
    cp .env.example .env
fi

# 后台启动后端
npm run dev > ../../backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ 后端服务器启动中 (PID: $BACKEND_PID)${NC}"

cd ../..

# 启动前端服务器
echo -e "${BLUE}🌐 启动前端服务器...${NC}"
cd packages/web

# 后台启动前端
npm run dev > ../../frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✅ 前端服务器启动中 (PID: $FRONTEND_PID)${NC}"

cd ../..

# 等待服务器启动
echo -e "${YELLOW}⏳ 等待服务器启动...${NC}"
sleep 10

# 健康检查函数
check_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $name 运行正常${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ 等待 $name 启动... (尝试 $attempt/$max_attempts)${NC}"
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ $name 启动失败${NC}"
    return 1
}

# 检查后端健康状态
echo -e "${BLUE}🔍 检查后端服务器健康状态...${NC}"
if check_service "http://localhost:5000/health" "后端服务器"; then
    BACKEND_STATUS="✅ 运行中"
else
    BACKEND_STATUS="❌ 启动失败"
    echo -e "${RED}后端日志:${NC}"
    tail -20 backend.log
fi

# 检查前端健康状态
echo -e "${BLUE}🔍 检查前端服务器健康状态...${NC}"
if check_service "http://localhost:3000" "前端服务器"; then
    FRONTEND_STATUS="✅ 运行中"
else
    FRONTEND_STATUS="❌ 启动失败"
    echo -e "${RED}前端日志:${NC}"
    tail -20 frontend.log
fi

# 测试核心页面
echo -e "${BLUE}🧪 测试核心页面...${NC}"
declare -a test_urls=(
    "http://localhost:3000|首页"
    "http://localhost:3000/auth/signin|登录页"
    "http://localhost:3000/dashboard|仪表板"
    "http://localhost:3000/dashboard/resources|资源管理"
    "http://localhost:3000/dashboard/purchase|购买页面"
)

for url_info in "${test_urls[@]}"; do
    IFS='|' read -r url name <<< "$url_info"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ $name: $status${NC}"
    else
        echo -e "${RED}❌ $name: $status${NC}"
    fi
done

# 显示服务器状态总结
echo ""
echo -e "${BLUE}📊 服务器状态总结${NC}"
echo "===================="
echo -e "后端服务器 (http://localhost:5000): $BACKEND_STATUS"
echo -e "前端服务器 (http://localhost:3000): $FRONTEND_STATUS"
echo ""

# 显示有用的信息
echo -e "${BLUE}🔗 访问链接${NC}"
echo "===================="
echo "• 前端应用: http://localhost:3000"
echo "• 后端API: http://localhost:5000"
echo "• 健康检查: http://localhos