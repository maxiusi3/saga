#!/bin/bash

echo "🚀 启动Saga简化开发环境"
echo "========================"

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

# 停止现有进程
echo -e "${YELLOW}🛑 停止现有服务器进程...${NC}"
pkill -f "next dev" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true
pkill -f "node.*backend" 2>/dev/null || true
pkill -f "ts-node" 2>/dev/null || true

# 等待进程完全停止
sleep 3

# 清理构建缓存
echo -e "${YELLOW}🧹 清理构建缓存...${NC}"
rm -rf packages/web/.next 2>/dev/null || true
rm -rf packages/backend/dist 2>/dev/null || true

# 检查依赖
echo -e "${BLUE}📦 检查依赖安装...${NC}"
if [ ! -d "packages/web/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Web依赖未安装，正在安装...${NC}"
    cd packages/web && npm install && cd ../..
fi

if [ ! -d "packages/backend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Backend依赖未安装，正在安装...${NC}"
    cd packages/backend && npm install && cd ../..
fi

# 启动简化后端服务器
echo -e "${BLUE}🔧 启动简化后端服务器...${NC}"
cd packages/backend

# 设置环境变量
export NODE_ENV=development
export PORT=3001
export DEMO_MODE=true

# 后台启动后端
npx ts-node src/simple-dev-server.ts > ../../backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ 简化后端服务器启动中 (PID: $BACKEND_PID)${NC}"

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
sleep 8

# 健康检查函数
check_service() {
    local url=$1
    local name=$2
    local max_attempts=15
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
if check_service "http://localhost:3001/health" "后端服务器"; then
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

# 测试核心API端点
echo -e "${BLUE}🧪 测试核心API端点...${NC}"
declare -a api_tests=(
    "http://localhost:3001/health|健康检查"
    "http://localhost:3001/api/health|API健康检查"
    "http://localhost:3001/api/projects|项目API"
)

for url_info in "${api_tests[@]}"; do
    IFS='|' read -r url name <<< "$url_info"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ $name: $status${NC}"
    else
        echo -e "${RED}❌ $name: $status${NC}"
    fi
done

# 测试核心页面
echo -e "${BLUE}🧪 测试核心页面...${NC}"
declare -a page_tests=(
    "http://localhost:3000|首页"
    "http://localhost:3000/auth/signin|登录页"
)

for url_info in "${page_tests[@]}"; do
    IFS='|' read -r url name <<< "$url_info"
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ $name: $status${NC}"
    else
        echo -e "${YELLOW}⚠️  $name: $status (可能需要等待)${NC}"
    fi
done

# 显示服务器状态总结
echo ""
echo -e "${BLUE}📊 服务器状态总结${NC}"
echo "===================="
echo -e "后端服务器 (http://localhost:3001): $BACKEND_STATUS"
echo -e "前端服务器 (http://localhost:3000): $FRONTEND_STATUS"
echo ""

# 显示有用的信息
echo -e "${BLUE}🔗 访问链接${NC}"
echo "===================="
echo "• 前端应用: http://localhost:3000"
echo "• 后端API: http://localhost:3001"
echo "• 健康检查: http://localhost:3001/health"
echo "• API健康检查: http://localhost:3001/api/health"
echo ""

echo -e "${BLUE}📝 开发说明${NC}"
echo "===================="
echo "• 使用简化后端服务器，跳过外部服务依赖"
echo "• 所有API返回模拟数据，适合前端开发和测试"
echo "• 查看日志: tail -f backend.log 或 tail -f frontend.log"
echo "• 停止服务器: pkill -f 'next dev' && pkill -f 'ts-node'"
echo ""

# 保存PID到文件以便后续停止
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

echo -e "${GREEN}🎉 开发环境启动完成！${NC}"