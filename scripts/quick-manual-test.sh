#!/bin/bash

# 超简单的手动测试启动脚本
# 专门解决卡住问题

echo "🚀 快速启动手动测试环境"

# 清理所有进程
echo "🧹 清理现有进程..."
pkill -f "nodemon\|next\|ts-node" 2>/dev/null || true
sleep 2

# 清理端口
echo "🔍 清理端口..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# 创建超简单的后端服务器
echo "📡 创建简单后端服务器..."
cd packages/backend

cat > quick-server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Quick server running' });
});

// 认证端点
app.post('/api/auth/signup', (req, res) => {
  console.log('Signup:', req.body);
  res.status(201).json({
    success: true,
    data: {
      user: { id: 'test-user', name: req.body.name, email: req.body.email },
      tokens: { accessToken: 'mock-token', refreshToken: 'mock-refresh' }
    },
    message: 'Account created successfully'
  });
});

app.post('/api/auth/signin', (req, res) => {
  console.log('Signin:', req.body);
  res.json({
    success: true,
    data: {
      user: { id: 'test-user', name: 'Test User', email: req.body.identifier },
      tokens: { accessToken: 'mock-token', refreshToken: 'mock-refresh' }
    },
    message: 'Signed in successfully'
  });
});

app.get('/api/auth/profile', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  res.json({
    success: true,
    data: { id: 'test-user', name: 'Test User', email: 'test@example.com' }
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Quick server running on http://localhost:${PORT}`);
  console.log(`🧪 Ready for manual testing!`);
});
EOF

# 启动后端
echo "🚀 启动后端服务器..."
node quick-server.js &
BACKEND_PID=$!

# 等待后端启动
sleep 5

# 测试后端
echo "🔍 测试后端连接..."
if curl -s http://localhost:3001/health >/dev/null; then
    echo "✅ 后端服务器运行正常"
else
    echo "❌ 后端服务器启动失败"
    exit 1
fi

# 启动前端
echo "🌐 启动前端服务器..."
cd ../web

# 使用后台进程启动前端，避免卡住
npm run dev &
WEB_PID=$!

# 等待前端启动
echo "⏳ 等待前端启动 (最多60秒)..."
for i in {1..20}; do
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo "✅ 前端服务器运行正常"
        break
    fi
    echo "⏳ 等待中... ($i/20)"
    sleep 3
done

# 最终检查
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo ""
    echo "🎉 手动测试环境启动成功！"
    echo ""
    echo "📋 访问地址:"
    echo "   前端: http://localhost:3000"
    echo "   后端: http://localhost:3001"
    echo "   健康检查: http://localhost:3001/health"
    echo ""
    echo "🧪 测试端点:"
    echo "   POST /api/auth/signup"
    echo "   POST /api/auth/signin"
    echo "   GET  /api/auth/profile"
    echo ""
    echo "🛑 按 Ctrl+C 停止服务器"
    
    # 等待用户中断
    wait
else
    echo "❌ 前端服务器启动失败"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi
EOF