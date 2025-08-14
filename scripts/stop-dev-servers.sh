#!/bin/bash

echo "🛑 停止Saga开发服务器"
echo "===================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 停止所有相关进程
echo -e "${YELLOW}🛑 停止所有开发服务器进程...${NC}"

# 停止Next.js开发服务器
pkill -f "next dev" 2>/dev/null && echo -e "${GREEN}✅ Next.js服务器已停止${NC}" || echo -e "${YELLOW}⚠️  Next.js服务器未运行${NC}"

# 停止nodemon进程
pkill -f "nodemon" 2>/dev/null && echo -e "${GREEN}✅ Nodemon进程已停止${NC}" || echo -e "${YELLOW}⚠️  Nodemon进程未运行${NC}"

# 停止ts-node进程
pkill -f "ts-node" 2>/dev/null && echo -e "${GREEN}✅ ts-node进程已停止${NC}" || echo -e "${YELLOW}⚠️  ts-node进程未运行${NC}"

# 停止Node.js后端进程
pkill -f "node.*backend" 2>/dev/null && echo -e "${GREEN}✅ Node.js后端进程已停止${NC}" || echo -e "${YELLOW}⚠️  Node.js后端进程未运行${NC}"

# 停止特定端口的进程
echo -e "${YELLOW}🔍 检查端口占用...${NC}"

# 检查并停止3000端口进程
if lsof -ti:3000 > /dev/null 2>&1; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✅ 端口3000已释放${NC}"
else
    echo -e "${YELLOW}⚠️  端口3000未被占用${NC}"
fi

# 检查并停止5000端口进程
if lsof -ti:5000 > /dev/null 2>&1; then
    lsof -ti:5000 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✅ 端口5000已释放${NC}"
else
    echo -e "${YELLOW}⚠️  端口5000未被占用${NC}"
fi

# 检查并停止3001端口进程
if lsof -ti:3001 > /dev/null 2>&1; then
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✅ 端口3001已释放${NC}"
else
    echo -e "${YELLOW}⚠️  端口3001未被占用${NC}"
fi

# 检查并停止4000端口进程
if lsof -ti:4000 > /dev/null 2>&1; then
    lsof -ti:4000 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✅ 端口4000已释放${NC}"
else
    echo -e "${YELLOW}⚠️  端口4000未被占用${NC}"
fi

# 清理PID文件
rm -f .backend.pid .frontend.pid

# 清理日志文件
echo -e "${YELLOW}🧹 清理日志文件...${NC}"
rm -f backend.log frontend.log

echo -e "${GREEN}🎉 所有开发服务器已停止${NC}"