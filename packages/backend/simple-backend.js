const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3001;

// 基本中间件
app.use(cors());
app.use(express.json());

// 模拟用户数据库
const users = [
  {
    id: '1',
    name: 'Demo User',
    email: 'demo@saga.com',
    password: '$2a$12$YVJP5J51iDV7QwS5X/YeZul7NnLtwCiHccLpwEhPeo1KGpjPdIBYG' // 'password'
  },
  {
    id: '2',
    name: 'New User',
    email: 'newuser@example.com',
    password: '$2a$12$HzVFfaQraQmc.rOBvF5JcelZIt4PGIJwx2PQQLXim7GeSDtTyZP7e' // 'TestPassword123'
  },
  {
    id: '3',
    name: 'Another User',
    email: 'another@example.com',
    password: '$2a$12$HzVFfaQraQmc.rOBvF5JcelZIt4PGIJwx2PQQLXim7GeSDtTyZP7e' // 'TestPassword123'
  }
];

// JWT密钥
const JWT_SECRET = 'demo-jwt-secret-key';

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'saga-backend-simple'
  });
});

// 认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Access token required'
      },
      timestamp: new Date().toISOString(),
      path: req.path
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        },
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
    req.user = user;
    next();
  });
};

// 认证路由
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Debug logging
    console.log('Signin attempt:', { email, passwordLength: password?.length });
    console.log('Available users:', users.map(u => ({ id: u.id, email: u.email })));
    
    const user = users.find(u => u.email === email);
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(401).json({ 
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials'
        },
        timestamp: new Date().toISOString(),
        path: '/api/auth/signin'
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ 
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials'
        },
        timestamp: new Date().toISOString(),
        path: '/api/auth/signin'
      });
    }
    
    console.log('Successful login for user:', email);

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        accessToken: token,
        refreshToken: token, // Using same token for simplicity in demo
        expiresIn: 86400
      },
      message: 'Signed in successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error'
      },
      timestamp: new Date().toISOString(),
      path: '/api/auth/signin'
    });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // 检查用户是否已存在
    if (users.find(u => u.email === email)) {
      return res.status(409).json({ 
        error: {
          code: 'EMAIL_EXISTS',
          message: 'User with this email already exists'
        },
        timestamp: new Date().toISOString(),
        path: '/api/auth/signup'
      });
    }

    // 创建新用户
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = {
      id: String(users.length + 1),
      name,
      email,
      password: hashedPassword
    };
    
    users.push(newUser);

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, name: newUser.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email
        },
        accessToken: token,
        refreshToken: token, // Using same token for simplicity in demo
        expiresIn: 86400
      },
      message: 'Account created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error'
      },
      timestamp: new Date().toISOString(),
      path: '/api/auth/signup'
    });
  }
});

app.get('/api/auth/profile', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ 
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      },
      timestamp: new Date().toISOString(),
      path: '/api/auth/profile'
    });
  }

  res.json({
    data: {
      id: user.id,
      name: user.name,
      email: user.email
    },
    message: 'Profile retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/signout', authenticateToken, (req, res) => {
  res.json({
    data: { success: true },
    message: 'Signed out successfully',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      error: {
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required'
      },
      timestamp: new Date().toISOString(),
      path: '/api/auth/refresh'
    });
  }

  try {
    // Verify the refresh token (in demo, we use the same token)
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    
    // Generate new access token
    const newAccessToken = jwt.sign(
      { userId: payload.userId, email: payload.email, name: payload.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      data: {
        accessToken: newAccessToken,
        expiresIn: 86400
      },
      message: 'Token refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token'
      },
      timestamp: new Date().toISOString(),
      path: '/api/auth/refresh'
    });
  }
});

// 项目相关的模拟端点
app.get('/api/projects', authenticateToken, (req, res) => {
  res.json({
    data: [
      {
        id: '1',
        name: 'My Family Story',
        description: 'A collection of family memories',
        facilitatorId: req.user.userId,
        status: 'active',
        storyCount: 3,
        memberCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    message: 'Projects retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/projects', authenticateToken, (req, res) => {
  const { title, description } = req.body;
  const project = {
    id: String(Date.now()),
    name: title, // Map title to name for consistency
    description,
    facilitatorId: req.user.userId,
    status: 'active',
    storyCount: 0,
    memberCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  res.status(201).json({
    data: project,
    message: 'Project created successfully',
    timestamp: new Date().toISOString()
  });
});

// 故事相关的模拟端点
app.get('/api/stories', authenticateToken, (req, res) => {
  res.json({
    data: {
      stories: [
        {
          id: '1',
          title: 'Childhood Memories',
          content: 'This is a sample story about childhood...',
          createdAt: new Date().toISOString(),
          userId: req.user.userId
        }
      ]
    },
    message: 'Stories retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// 项目统计端点
app.get('/api/projects/:id/stats', authenticateToken, (req, res) => {
  res.json({
    data: {
      totalStories: 3,
      totalDuration: 1800, // 30 minutes in seconds
      lastStoryDate: new Date().toISOString(),
      completedChapters: 2
    },
    message: 'Project stats retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// 获取单个项目
app.get('/api/projects/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  res.json({
    data: {
      id,
      name: 'My Family Story',
      description: 'A collection of family memories',
      facilitatorId: req.user.userId,
      status: 'active',
      storyCount: 3,
      memberCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    message: 'Project retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// 获取项目的故事列表
app.get('/api/projects/:id/stories', authenticateToken, (req, res) => {
  const { id } = req.params;
  res.json({
    data: {
      stories: [
        {
          id: '1',
          title: 'Childhood Memories',
          content: 'This is a sample story about childhood...',
          projectId: id,
          userId: req.user.userId,
          status: 'completed',
          duration: 180, // 3 minutes
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          updatedAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '2',
          title: 'School Days',
          content: 'Stories from my school years...',
          projectId: id,
          userId: req.user.userId,
          status: 'completed',
          duration: 240, // 4 minutes
          createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          updatedAt: new Date(Date.now() - 172800000).toISOString()
        },
        {
          id: '3',
          title: 'Family Traditions',
          content: 'Our family traditions and celebrations...',
          projectId: id,
          userId: req.user.userId,
          status: 'processing',
          duration: 300, // 5 minutes
          createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          updatedAt: new Date(Date.now() - 259200000).toISOString()
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1
      }
    },
    message: 'Stories retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// 项目邀请端点
app.post('/api/projects/:id/invitation', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { email, message } = req.body;
  
  res.json({
    data: {
      invitationId: `inv_${Date.now()}`,
      projectId: id,
      email,
      message: message || 'You have been invited to join a family story project',
      status: 'sent',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
      createdAt: new Date().toISOString()
    },
    message: 'Invitation sent successfully (demo mode - no actual email sent)',
    timestamp: new Date().toISOString()
  });
});

// 获取项目邀请列表
app.get('/api/projects/:id/invitations', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  res.json({
    data: [
      {
        id: 'inv_demo_1',
        projectId: id,
        email: 'parent@example.com',
        message: 'Join our family story project',
        status: 'pending',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    message: 'Invitations retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// OAuth端点 (占位符)
app.post('/api/auth/oauth/google', (req, res) => {
  res.status(501).json({ 
    error: 'Google OAuth not implemented in demo version',
    message: 'Please use email/password registration or demo account'
  });
});

app.post('/api/auth/oauth/apple', (req, res) => {
  res.status(501).json({ 
    error: 'Apple OAuth not implemented in demo version',
    message: 'Please use email/password registration or demo account'
  });
});

// 订阅相关端点 (演示版本占位符)
app.get('/api/subscriptions/status', authenticateToken, (req, res) => {
  res.json({
    data: {
      status: 'inactive',
      plan: null,
      expiresAt: null
    },
    message: 'Subscription status retrieved',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/subscriptions/checkout', authenticateToken, (req, res) => {
  res.status(501).json({
    error: {
      code: 'PAYMENT_NOT_IMPLEMENTED',
      message: 'Payment processing not implemented in demo version'
    },
    timestamp: new Date().toISOString(),
    path: '/api/subscriptions/checkout'
  });
});

app.post('/api/subscriptions/payment-success', authenticateToken, (req, res) => {
  res.status(501).json({
    error: {
      code: 'PAYMENT_NOT_IMPLEMENTED',
      message: 'Payment processing not implemented in demo version'
    },
    timestamp: new Date().toISOString(),
    path: '/api/subscriptions/payment-success'
  });
});

app.post('/api/subscriptions/cancel', authenticateToken, (req, res) => {
  res.status(501).json({
    error: {
      code: 'PAYMENT_NOT_IMPLEMENTED',
      message: 'Payment processing not implemented in demo version'
    },
    timestamp: new Date().toISOString(),
    path: '/api/subscriptions/cancel'
  });
});

// 获取单个故事详情
app.get('/api/stories/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  // 模拟故事数据
  const stories = {
    '1': {
      id: '1',
      title: 'Childhood Memories',
      content: 'This is a sample story about childhood memories. I remember playing in the backyard with my siblings, building sandcastles, and the smell of my grandmother\'s cookies baking in the kitchen. Those were simpler times filled with laughter and wonder.',
      projectId: '1',
      userId: req.user.userId,
      status: 'completed',
      duration: 180, // 3 minutes
      audioUrl: null, // 演示模式下没有真实音频文件
      transcript: 'This is a sample transcript of the childhood memories story...',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      interactions: [
        {
          id: 'int_1',
          type: 'comment',
          content: 'What a beautiful memory! I remember similar times.',
          userId: req.user.userId,
          createdAt: new Date(Date.now() - 3600000).toISOString()
        }
      ]
    },
    '2': {
      id: '2',
      title: 'School Days',
      content: 'Stories from my school years, the friends I made, the teachers who inspired me, and the lessons learned both in and out of the classroom.',
      projectId: '1',
      userId: req.user.userId,
      status: 'completed',
      duration: 240,
      audioUrl: null,
      transcript: 'This is a sample transcript of the school days story...',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
      interactions: []
    },
    '3': {
      id: '3',
      title: 'Family Traditions',
      content: 'Our family traditions and celebrations that brought us together year after year, creating lasting bonds and cherished memories.',
      projectId: '1',
      userId: req.user.userId,
      status: 'processing',
      duration: 300,
      audioUrl: null,
      transcript: 'This story is still being processed...',
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 259200000).toISOString(),
      interactions: []
    }
  };

  const story = stories[id];
  if (!story) {
    return res.status(404).json({
      error: {
        code: 'STORY_NOT_FOUND',
        message: 'Story not found'
      },
      timestamp: new Date().toISOString(),
      path: `/api/stories/${id}`
    });
  }

  res.json({
    data: story,
    message: 'Story retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// 添加故事交互
app.post('/api/stories/:id/interactions', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { type, content } = req.body;
  
  const newInteraction = {
    id: `int_${Date.now()}`,
    storyId: id,
    type,
    content,
    userId: req.user.userId,
    userName: req.user.name,
    createdAt: new Date().toISOString()
  };

  res.json({
    data: newInteraction,
    message: 'Interaction added successfully',
    timestamp: new Date().toISOString()
  });
});

// 更新故事
app.put('/api/stories/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { title, transcript } = req.body;
  
  res.json({
    data: {
      id,
      title: title || 'Updated Story',
      transcript: transcript || 'Updated transcript...',
      updatedAt: new Date().toISOString()
    },
    message: 'Story updated successfully',
    timestamp: new Date().toISOString()
  });
});

// 基本API测试端点
app.get('/api/test', (req, res) => {
  res.json({ message: 'Simple backend API is working!' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Simple backend running on port ${PORT}`);
  console.log(`📈 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔗 Test API: http://localhost:${PORT}/api/test`);
  console.log(`🔐 Auth endpoints available at /api/auth/*`);
  console.log(`📊 Demo credentials: demo@saga.com / password`);
});