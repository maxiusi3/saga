// Vercel Serverless Function Entry Point
const express = require('express');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Saga Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Basic API routes
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend API is working!',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Auth endpoints (simplified)
app.post('/api/auth/signin', (req, res) => {
  res.json({ 
    message: 'Sign in endpoint - integration with Supabase needed',
    status: 'placeholder'
  });
});

app.post('/api/auth/signup', (req, res) => {
  res.json({ 
    message: 'Sign up endpoint - integration with Supabase needed',
    status: 'placeholder'
  });
});

// Catch all other routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Export for Vercel
module.exports = app;