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
