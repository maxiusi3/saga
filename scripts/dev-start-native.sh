#!/bin/bash

echo "🚀 启动Saga原生开发环境"
echo "========================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 强制停止所有相关进程
echo -e "${YELLOW}🛑 强制停止所有相关进程...${NC}"
pkill -9 -f "next" 2>/dev/null || true
pkill -9 -f "nodemon" 2>/dev/null || true
pkill -9 -f "ts-node" 2>/dev/null || true
pkill -9 -f "node.*backend" 2>/dev/null || true

# 强制释放端口
for port in 3000 3001 4000 5000; do
    if lsof -ti:$port > /dev/null 2>&1; then
        echo -e "${YELLOW}强制释放端口 $port...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    fi
done

# 等待进程完全停止
sleep 3

# 清理构建缓存
echo -e "${YELLOW}🧹 清理构建缓存...${NC}"
rm -rf packages/web/.next 2>/dev/null || true
rm -rf packages/backend/dist 2>/dev/null || true
rm -f backend.log frontend.log 2>/dev/null || true

# 检查依赖
echo -e "${BLUE}📦 检查依赖安装...${NC}"
if [ ! -d "packages/backend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Backend依赖未安装，正在安装...${NC}"
    cd packages/backend && npm install && cd ../..
fi

if [ ! -d "packages/web/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Web依赖未安装，正在安装...${NC}"
    cd packages/web && npm install && cd ../..
fi

# 启动后端服务器
echo -e "${BLUE}🔧 启动简化后端服务器 (端口4000)...${NC}"
cd packages/backend

# 直接在前台启动后端，这样可以看到错误
echo -e "${YELLOW}📝 启动后端服务器...${NC}"
PORT=4000 NODE_ENV=development DEMO_MODE=true npx ts-node src/simple-dev-server.ts &
BACKEND_PID=$!
echo -e "${GREEN}✅ 后端服务器启动中 (PID: $BACKEND_PID)${NC}"

cd ../..

# 等待后端启动
echo -e "${YELLOW}⏳ 等待后端服务器启动...${NC}"
sleep 5

# 检查后端是否启动成功
if curl -s -f "http://localhost:4000/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务器启动成功${NC}"
else
    echo -e "${RED}❌ 后端服务器启动失败${NC}"
    echo -e "${YELLOW}检查后端进程状态...${NC}"
    if ps -p $BACKEND_PID > /dev/null; then
        echo -e "${YELLOW}后端进程仍在运行，可能需要更多时间启动${NC}"
    else
        echo -e "${RED}后端进程已退出${NC}"
        exit 1
    fi
fi

# 启动前端服务器
echo -e "${BLUE}🌐 启动前端服务器 (端口3000)...${NC}"
cd packages/web

# 启动前端
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✅ 前端服务器启动中 (PID: $FRONTEND_PID)${NC}"

cd ../..

# 等待前端启动
echo -e "${YELLOW}⏳ 等待前端服务器启动...${NC}"
sleep 10

# 检查前端是否启动成功
if curl -s -f "http://localhost:3000" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 前端服务器启动成功${NC}"
else
    echo -e "${YELLOW}⚠️  前端服务器可能还在启动中${NC}"
fi

# 显示服务器状态总结
echo ""
echo -e "${BLUE}📊 服务器状态总结${NC}"
echo "===================="
echo -e "后端服务器 (http://localhost:4000): $(curl -s -f "http://localhost:4000/health" > /dev/null 2>&1 && echo -e "${GREEN}✅ 运行中${NC}" || echo -e "${RED}❌ 未响应${NC}")"
echo -e "前端服务器 (http://localhost:3000): $(curl -s -f "http://localhost:3000" > /dev/null 2>&1 && echo -e "${GREEN}✅ 运行中${NC}" || echo -e "${YELLOW}⚠️  启动中${NC}")"
echo ""

# 显示有用的信息
echo -e "${BLUE}🔗 访问链接${NC}"
echo "===================="
echo "• 前端应用: http://localhost:3000"
echo "• 后端API: http://localhost:4000"
echo "• 健康检查: http://localhost:4000/health"
echo "• API健康检查: http://localhost:4000/api/health"
echo ""

echo -e "${BLUE}📝 开发说明${NC}"
echo "===================="
echo "• 使用简化后端服务器，跳过外部服务依赖"
echo "• 所有API返回模拟数据，适合前端开发和测试"
echo "• 停止服务器: ./scripts/stop-dev-servers.sh"
echo ""

# 保存PID到文件以便后续停止
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

echo -e "${GREEN}🎉 开发环境启动完成！${NC}"
echo -e "${YELLOW}💡 提示: 如果前端还在启动中，请等待几分钟后访问 http://localhost:3000${NC}"