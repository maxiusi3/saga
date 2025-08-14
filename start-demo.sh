#!/bin/bash

echo "🚀 Starting Saga Demo Environment..."

# 检查端口是否被占用
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use"
        return 1
    fi
    return 0
}

# 停止现有进程
stop_existing() {
    echo "🛑 Stopping existing processes..."
    pkill -f "simple-backend.js" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
    sleep 2
}

# 启动后端
start_backend() {
    echo "🔧 Starting backend server..."
    cd packages/backend
    node simple-backend.js &
    BACKEND_PID=$!
    cd ../..
    
    # 等待后端启动
    for i in {1..10}; do
        if curl -s http://localhost:3001/health >/dev/null 2>&1; then
            echo "✅ Backend started successfully (PID: $BACKEND_PID)"
            return 0
        fi
        sleep 1
    done
    
    echo "❌ Backend failed to start"
    return 1
}

# 启动前端
start_frontend() {
    echo "🎨 Starting frontend server..."
    cd packages/web
    npm run dev &
    FRONTEND_PID=$!
    cd ../..
    
    # 等待前端启动
    for i in {1..30}; do
        if curl -s http://localhost:3000 >/dev/null 2>&1; then
            echo "✅ Frontend started successfully (PID: $FRONTEND_PID)"
            return 0
        fi
        sleep 2
    done
    
    echo "❌ Frontend failed to start"
    return 1
}

# 主流程
main() {
    stop_existing
    
    if ! check_port 3001 || ! check_port 3000; then
        echo "❌ Required ports are not available"
        exit 1
    fi
    
    if start_backend && start_frontend; then
        echo ""
        echo "🎉 Saga Demo Environment is ready!"
        echo ""
        echo "📱 Access the application:"
        echo "   • Website: http://localhost:3000"
        echo "   • API: http://localhost:3001"
        echo ""
        echo "🧑‍💻 Demo credentials:"
        echo "   • Email: demo@saga.com"
        echo "   • Password: password"
        echo ""
        echo "🧪 Run tests:"
        echo "   node test-system.js"
        echo ""
        echo "🛑 To stop:"
        echo "   pkill -f 'simple-backend.js'"
        echo "   pkill -f 'next-server'"
        echo ""
        
        # 运行测试
        echo "🧪 Running system tests..."
        sleep 5
        node test-system.js
    else
        echo "❌ Failed to start demo environment"
        exit 1
    fi
}

main "$@"