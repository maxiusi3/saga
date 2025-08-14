#!/bin/bash

# 同时启动前端和后端开发服务器
set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_status "🚀 启动 Saga 开发服务器..."

# 检查数据库是否运行
if ! docker ps | grep -q saga-postgres; then
    print_status "启动数据库服务..."
    docker-compose up -d postgres redis
    sleep 5
fi

# 使用 concurrently 同时运行前后端
if command -v npx &> /dev/null; then
    print_status "使用 concurrently 同时启动前后端服务..."
    npx concurrently \
        --names "BACKEND,FRONTEND" \
        --prefix-colors "blue,green" \
        --kill-others \
        "cd packages/backend && npm run dev" \
        "cd packages/web && npm run dev"
else
    print_status "concurrently 未安装，请手动启动服务："
    echo "终端1: cd packages/backend && npm run dev"
    echo "终端2: cd packages/web && npm run dev"
fi