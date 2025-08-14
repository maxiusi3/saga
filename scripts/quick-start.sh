#!/bin/bash

# 快速启动脚本 - 不依赖数据库
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_status "🚀 Saga 快速启动脚本"

# 检查命令行参数
MODE=${1:-demo}

case "$MODE" in
    "demo")
        print_status "启动演示模式..."
        ;;
    "test")
        print_status "启动测试环境..."
        ;;
    "dev")
        print_status "启动开发环境..."
        ;;
    *)
        echo "用法: $0 [demo|test|dev]"
        echo ""
        echo "模式说明:"
        echo "  demo - 演示模式（内存数据，快速启动）"
        echo "  test - 测试环境（Docker，完整功能）"
        echo "  dev  - 开发环境（需要数据库）"
        exit 1
        ;;
esac

# 检查依赖是否已安装
if [ ! -d "packages/backend/node_modules" ]; then
    print_status "安装后端依赖..."
    cd packages/backend && npm install --legacy-peer-deps && cd ../..
fi

if [ ! -d "packages/web/node_modules" ]; then
    print_status "安装前端依赖..."
    cd packages/web && npm install --legacy-peer-deps && cd ../..
fi

if [ ! -d "packages/shared/dist" ]; then
    print_status "构建共享包..."
    cd packages/shared && npm run build && cd ../..
fi

print_warning "注意：此演示模式使用模拟数据，不会持久化到数据库"

# 创建演示模式的环境变量
cat > packages/backend/.env << EOF
NODE_ENV=development
PORT=3001
API_BASE_URL=http://localhost:3001
WEB_APP_URL=http://localhost:3000
JWT_SECRET=demo-jwt-secret-key
JWT_REFRESH_SECRET=demo-refresh-secret-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
LOG_LEVEL=info
DEMO_MODE=true
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
EOF

print_success "✅ 环境配置完成！"

echo ""
echo "🎉 现在你可以启动应用："
echo ""
echo "1. 启动后端（新终端）："
echo "   cd packages/backend && npm run dev"
echo ""
echo "2. 启动前端（新终端）："
echo "   cd packages/web && npm run dev"
echo ""
echo "3. 访问应用："
echo "   前端: http://localhost:3000"
echo "   后端: http://localhost:3001/health"
echo ""
if [ "$MODE" = "demo" ]; then
    echo "📝 演示模式说明："
    echo "- 使用内存中的模拟数据"
    echo "- 不需要数据库或外部服务"
    echo "- 数据在重启后会丢失"
    echo "- 适合快速体验和测试界面"
    echo ""
    echo "🎯 其他启动选项："
    echo "- 测试环境: npm run test-env:start"
    echo "- 开发环境: npm run setup && npm run dev"
elif [ "$MODE" = "test" ]; then
    print_status "启动测试环境..."
    exec ./scripts/test-env-start.sh start
elif [ "$MODE" = "dev" ]; then
    print_status "启动开发环境..."
    exec ./scripts/dev-setup.sh
fi