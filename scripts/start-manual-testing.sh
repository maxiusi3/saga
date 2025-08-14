#!/bin/bash

# 智能启动脚本 - 专为手动测试设计
# 包含超时保护、自动重试和错误恢复机制

set -e

echo "🚀 启动Saga手动测试环境..."
echo "⏰ 包含3分钟超时保护，防止卡住"

# 清理函数
cleanup() {
    echo ""
    echo "🛑 正在停止所有服务器..."
    
    # 强制终止所有相关进程
    pkill -f "nodemon" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "ts-node" 2>/dev/null || true
    
    # 等待进程完全终止
    sleep 2
    
    echo "✅ 所有服务器已停止"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 超时函数
timeout_command() {
    local timeout=$1
    local command=$2
    local description=$3
    
    echo "⏳ $description (超时: ${timeout}秒)"
    
    # 使用timeout命令（如果可用）或者后台进程+sleep
    if command -v timeout >/dev/null 2>&1; then
        timeout $timeout bash -c "$command" &
    else
        # macOS兼容方案
        bash -c "$command" &
    fi
    
    local pid=$!
    local count=0
    
    # 监控进程状态
    while [ $count -lt $timeout ]; do
        if ! kill -0 $pid 2>/dev/null; then
            wait $pid
            return $?
        fi
        
        sleep 1
        count=$((count + 1))
        
        # 每30秒显示进度
        if [ $((count % 30)) -eq 0 ]; then
            echo "⏳ 仍在启动中... (${count}/${timeout}秒)"
        fi
    done
    
    # 超时处理
    echo "⚠️  $description 超时，正在终止..."
    kill -9 $pid 2>/dev/null || true
    return 124  # timeout exit code
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  端口 $port 已被占用，正在清理..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# 测试服务器连通性
test_server() {
    local url=$1
    local name=$2
    local max_attempts=10
    local attempt=1
    
    echo "🔍 测试 $name 连通性..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s --max-time 5 "$url" >/dev/null 2>&1; then
            echo "✅ $name 响应正常"
            return 0
        fi
        
        echo "⏳ 等待 $name 启动... (尝试 $attempt/$max_attempts)"
        sleep 3
        attempt=$((attempt + 1))
    done
    
    echo "❌ $name 启动失败或无响应"
    return 1
}

# 主启动流程
main() {
    echo "🧹 清理现有进程..."
    cleanup >/dev/null 2>&1 || true
    
    echo "🔍 检查端口占用..."
    check_port 3001
    check_port 3000
    
    echo ""
    echo "📡 启动后端服务器..."
    echo "使用简化的测试服务器，避免TypeScript编译问题"
    
    # 启动后端（使用测试服务器）
    cd packages/backend
    
    # 尝试启动测试服务器
    if timeout_command 180 "npm run dev-test" "后端测试服务器启动"; then
        echo "✅ 后端服务器启动成功"
    else
        echo "⚠️  测试服务器启动超时，尝试简单服务器..."
        
        # 创建并启动超简单的服务器
        cat > simple-test-server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors({ origin: ['http://localhost:3000'], credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Simple test server running' });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body;
  res.status(201).json({
    success: true,
    data: {
      user: { id: 'test-id', name, email },
      tokens: { accessToken: 'test-token', refreshToken: 'test-refresh' }
    },
    message: 'Account created successfully'
  });
});

app.post('/api/auth/signin', (req, res) => {
  const { identifier, password } = req.body;
  res.json({
    success: true,
    data: {
      user: { id: 'test-id', name: 'Test User', email: identifier },
      tokens: { accessToken: 'test-token', refreshToken: 'test-refresh' }
    },
    message: 'Signed in successfully'
  });
});

app.get('/api/auth/profile', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  res.json({
    success: true,
    data: { id: 'test-id', name: 'Test User', email: 'test@example.com' }
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`✅ Simple test server running on port ${PORT}`);
  console.log(`🌐 Health: http://localhost:${PORT}/health`);
  console.log(`🧪 Ready for testing!`);
});
EOF
        
        node simple-test-server.js &
        BACKEND_PID=$!
        sleep 5
    fi
    
    # 测试后端连通性
    if ! test_server "http://localhost:3001/health" "后端服务器"; then
        echo "❌ 后端服务器启动失败"
        exit 1
    fi
    
    echo ""
    echo "🌐 启动前端服务器..."
    cd ../web
    
    # 启动前端
    if timeout_command 180 "npm run dev" "前端服务器启动"; then
        echo "✅ 前端服务器启动成功"
    else
        echo "❌ 前端服务器启动超时"
        exit 1
    fi
    
    # 等待前端完全启动
    sleep 10
    
    # 测试前端连通性
    if ! test_server "http://localhost:3000" "前端服务器"; then
        echo "❌ 前端服务器启动失败"
        exit 1
    fi
    
    echo ""
    echo "🎉 手动测试环境启动成功！"
    echo ""
    echo "📋 服务器信息:"
    echo "   🌐 前端: http://localhost:3000"
    echo "   📡 后端: http://localhost:3001"
    echo "   💚 健康检查: http://localhost:3001/health"
    echo ""
    echo "🧪 可用的测试端点:"
    echo "   POST /api/auth/signup   - 用户注册"
    echo "   POST /api/auth/signin   - 用户登录"
    echo "   GET  /api/auth/profile  - 用户资料 (需要认证)"
    echo ""
    echo "📝 测试建议:"
    echo "   1. 打开 http://localhost:3000 测试前端"
    echo "   2. 尝试注册新用户"
    echo "   3. 尝试登录"
    echo "   4. 检查认证流程"
    echo ""
    echo "⚠️  注意: 这是简化的测试环境，使用模拟数据"
    echo "🛑 按 Ctrl+C 停止所有服务器"
    echo ""
    
    # 保持脚本运行，等待用户中断
    while true; do
        sleep 30
        
        # 定期检查服务器状态
        if ! curl -s --max-time 3 http://localhost:3001/health >/dev/null 2>&1; then
            echo "⚠️  后端服务器似乎已停止"
        fi
        
        if ! curl -s --max-time 3 http://localhost:3000 >/dev/null 2>&1; then
            echo "⚠️  前端服务器似乎已停止"
        fi
    done
}

# 运行主函数
main "$@"