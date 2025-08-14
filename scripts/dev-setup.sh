#!/bin/bash

# Saga 本地开发环境设置脚本
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "🚀 开始设置 Saga 本地开发环境..."

# 检查必要的工具
print_status "检查必要的工具..."

if ! command -v node &> /dev/null; then
    print_error "Node.js 未安装。请先安装 Node.js 18+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm 未安装。请先安装 npm"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_error "Docker 未安装。请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose 未安装。请先安装 Docker Compose"
    exit 1
fi

print_success "所有必要工具已安装"

# 安装依赖
print_status "安装项目依赖..."
npm install

# 启动数据库和Redis
print_status "启动数据库和Redis服务..."
docker-compose up -d postgres redis

# 等待数据库启动
print_status "等待数据库启动..."
sleep 10

# 检查数据库连接
print_status "检查数据库连接..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker exec saga-postgres pg_isready -U saga_user -d saga_development > /dev/null 2>&1; then
        print_success "数据库连接成功"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "数据库连接失败，请检查 Docker 服务"
        exit 1
    fi
    
    print_status "等待数据库启动... (尝试 $attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

# 运行数据库迁移
print_status "运行数据库迁移..."
cd packages/backend
npm run db:migrate

# 运行数据库种子数据
print_status "插入种子数据..."
npm run db:seed

cd ../..

print_success "✅ 本地开发环境设置完成！"

echo ""
echo "🎉 环境设置完成！现在你可以："
echo ""
echo "1. 启动后端服务："
echo "   cd packages/backend && npm run dev"
echo ""
echo "2. 启动前端服务（新终端）："
echo "   cd packages/web && npm run dev"
echo ""
echo "3. 在浏览器中访问："
echo "   前端: http://localhost:3000"
echo "   后端API: http://localhost:3001"
echo "   健康检查: http://localhost:3001/health"
echo ""
echo "4. 数据库信息："
echo "   Host: localhost:5432"
echo "   Database: saga_development"
echo "   Username: saga_user"
echo "   Password: saga_password"
echo ""
echo "5. Redis信息："
echo "   Host: localhost:6379"
echo ""
echo "📝 注意："
echo "- 第一次运行可能需要几分钟来编译"
echo "- 如果遇到端口冲突，请检查 3000 和 3001 端口是否被占用"
echo "- 可以使用 'npm run dev:all' 同时启动前后端服务"