const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// 基本中间件
app.use(cors());
app.use(express.json());

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'saga-backend-test'
  });
});

// 基本API端点
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test API is working!' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📈 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔗 Test API: http://localhost:${PORT}/api/test`);
});