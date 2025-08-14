#!/bin/bash

echo "🚀 启动简化后端服务器"
echo "===================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 停止现有进程
echo -e "${YELLOW}🛑 停止现有后端进程...${NC}"
pkill -f "nodemon.*backend" 2>/dev/null || true
pkill -f "node.*backend" 2>/dev/null || true
pkill -f "ts-node.*backend" 2>/dev/null || true

# 等待进程完全停止
sleep 2

# 进入后端目录
cd packages/backend

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  依赖未安装，正在安装...${NC}"
    npm install
fi

# 启动简化服务器
echo -e "${BLUE}🔧 启动简化后端服务器...${NC}"
echo -e "${YELLOW}📝 使用简化配置，跳过外部服务依赖${NC}"

# 设置环境变量
export NODE_ENV=development
export PORT=5000
export DEMO_MODE=true

# 启动服务器
npx ts-node src/simple-dev-server.ts

echo -e "${GREEN}✅ 简化后端服务器已启动${NC}"