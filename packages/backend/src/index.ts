import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'

import { errorHandler } from './middleware/error-handler'
import { notFoundHandler } from './middleware/not-found'
import { securityHeaders, corsOptions } from './middleware/security-headers'
import { 
  generalRateLimit, 
  authRateLimit, 
  uploadRateLimit, 
  passwordResetRateLimit,
  exportRateLimit,
  closeRateLimitRedis 
} from './middleware/rate-limiting'
import { 
  requestIdMiddleware,
  requestLoggingMiddleware,
  userContextMiddleware,
  errorTrackingMiddleware,
  performanceMonitoringMiddleware,
  rateLimitMonitoringMiddleware,
  securityMonitoringMiddleware,
  businessMetricsMiddleware,
  healthCheckMiddleware,
} from './middleware/monitoring'
import { SentryService, createSentryConfig, validateSentryConfig } from './config/sentry'
import { LoggingService } from './services/logging-service'
import { MetricsService } from './services/metrics-service'
import { AnalyticsService } from './services/analytics-service'
import { APMService } from './services/apm-service'
import { AlertingService } from './services/alerting-service'
import { authRoutes } from './routes/auth'
import { projectRoutes } from './routes/projects'
import { storyRoutes } from './routes/stories'
import { exportRoutes } from './routes/exports'
import { invitationRoutes } from './routes/invitations'
import { userRoutes } from './routes/users'
import { uploadRoutes } from './routes/uploads'
import { sttRoutes } from './routes/stt'
import { subscriptionRoutes } from './routes/subscriptions'
import { websocketRoutes } from './routes/websocket'
import { notificationRoutes } from './routes/notifications'
import { promptRoutes } from './routes/prompts'
import projectMembersRoutes from './routes/project-members'
import projectAnalyticsRoutes from './routes/project-analytics'
import { deviceTokenRoutes } from './routes/device-tokens'
import chapterSummaryRoutes from './routes/chapter-summaries'
import searchRoutes from './routes/search'
import recommendationRoutes from './routes/recommendations'
import bookmarkRoutes from './routes/bookmarks'
import storySharingRoutes from './routes/story-sharing'
import storyStatisticsRoutes from './routes/story-statistics'
import healthRoutes from './routes/health'
import monitoringRoutes from './routes/monitoring'
import { setupWebSocket } from './websocket'
import { attachWebSocket } from './middleware/websocket'
import { NotificationProcessor } from './jobs/notification-processor'
import { schedulerService } from './services/scheduler-service'
import { connectDatabase } from './config/database'
import { connectRedis } from './config/redis'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.WEB_APP_URL 
      : ['http://localhost:3000', 'http://localhost:19006'],
    methods: ['GET', 'POST'],
  },
})

const PORT = process.env.PORT || 3001

// Initialize error tracking and monitoring
if (validateSentryConfig()) {
  SentryService.init(app, createSentryConfig());
}

// Monitoring middleware (must be early)
app.use(requestIdMiddleware)
app.use(healthCheckMiddleware)
app.use(requestLoggingMiddleware)
app.use(userContextMiddleware)
app.use(performanceMonitoringMiddleware)
app.use(securityMonitoringMiddleware)
app.use(businessMetricsMiddleware)

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // We handle CSP in our custom middleware
  crossOriginEmbedderPolicy: false, // We handle COEP in our custom middleware
}))
app.use(securityHeaders)
app.use(cors(corsOptions))

// Rate limiting with monitoring
app.use('/api/', generalRateLimit)
app.use(rateLimitMonitoringMiddleware)

// General middleware
app.use(compression())

// Custom logging instead of morgan for better integration
app.use((req, res, next) => {
  // Skip logging for health checks and static assets
  if (!req.path.includes('/health') && !req.path.includes('/static')) {
    LoggingService.debug(`${req.method} ${req.path}`, {
      requestId: (req as any).requestId,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
  }
  next();
})

// Special handling for Stripe webhooks (needs raw body)
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }))

// Regular JSON parsing for other routes
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check and monitoring endpoints
app.use('/health', healthRoutes)
app.use('/api/monitoring', monitoringRoutes)

// API routes with specific rate limiting
app.use('/api/auth', authRateLimit, authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/stories', storyRoutes)
app.use('/api/exports', exportRateLimit, exportRoutes)
app.use('/api/invitations', invitationRoutes)
app.use('/api/users', userRoutes)
app.use('/api/uploads', uploadRateLimit, uploadRoutes)
app.use('/api/stt', sttRoutes)
app.use('/api/subscriptions', subscriptionRoutes)

// Subscription plan routes
import subscriptionPlanRoutes from './routes/subscription-plans'
app.use('/api/subscription-plans', subscriptionPlanRoutes)
app.use('/api/websocket', websocketRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/prompts', promptRoutes)
app.use('/api/device-tokens', deviceTokenRoutes)
app.use('/api', chapterSummaryRoutes)
app.use('/api', searchRoutes)
app.use('/api', recommendationRoutes)
app.use('/api/bookmarks', bookmarkRoutes)
app.use('/api', storySharingRoutes)
app.use('/api', storyStatisticsRoutes)

// Analytics routes
import analyticsRoutes from './routes/analytics'
app.use('/api/analytics', analyticsRoutes)

// Archival analytics routes
import archivalAnalyticsRoutes from './routes/archival-analytics'
app.use('/api/archival-analytics', archivalAnalyticsRoutes)

// Data retention routes
import dataRetentionRoutes from './routes/data-retention'
app.use('/api/data-retention', dataRetentionRoutes)

// Archival export routes
import archivalExportRoutes from './routes/archival-exports'
app.use('/api/archival-exports', archivalExportRoutes)

// Receipt routes
import receiptRoutes from './routes/receipts'
app.use('/api/receipts', receiptRoutes)

// Payment method routes
import paymentMethodRoutes from './routes/payment-methods'
app.use('/api/payment-methods', paymentMethodRoutes)

// Payment analytics routes
import paymentAnalyticsRoutes from './routes/payment-analytics'
app.use('/api/payment-analytics', paymentAnalyticsRoutes)

// Project management routes
app.use('/api/projects', projectMembersRoutes)
app.use('/api/projects', projectAnalyticsRoutes)

// WebSocket setup
setupWebSocket(io)

// Attach WebSocket to requests
app.use(attachWebSocket(io))

// Error handling middleware (must be last)
app.use(notFoundHandler)
app.use(errorTrackingMiddleware)
app.use(SentryService.getErrorHandler())
app.use(errorHandler)

// Start server
const startServer = async () => {
  try {
    LoggingService.info('Starting Saga backend server...');

    // Connect to database and Redis
    await connectDatabase()
    await connectRedis()
    LoggingService.info('Database and Redis connections established');
    
    // Validate AWS configuration
    const { AWSConfig } = await import('./config/aws')
    AWSConfig.validateConfig()
    LoggingService.info('AWS configuration validated');
    
    // Validate Google Cloud Speech configuration
    try {
      const { SpeechConfigManager } = await import('./config/speech')
      SpeechConfigManager.validateConfig()
      LoggingService.info('Google Cloud Speech configuration validated');
    } catch (error) {
      LoggingService.warn('Google Cloud Speech configuration warning', { error: error as Error });
    }

    // Validate notification service configurations
    try {
      const { validateFirebaseConfig } = await import('./config/firebase')
      validateFirebaseConfig()
      LoggingService.info('Firebase configuration validated');
    } catch (error) {
      LoggingService.warn('Firebase configuration warning', { error: error as Error });
    }

    try {
      const { validateSendGridConfig } = await import('./config/sendgrid')
      validateSendGridConfig()
      LoggingService.info('SendGrid configuration validated');
    } catch (error) {
      LoggingService.warn('SendGrid configuration warning', { error: error as Error });
    }

    // Start background services
    NotificationProcessor.start()
    LoggingService.info('Notification processor started');

    // Start scheduler service for archival and other background tasks
    schedulerService.start()
    LoggingService.info('Scheduler service started');

    // Initialize monitoring services
    LoggingService.info('Monitoring and analytics services initialized');
    
    // Start server
    server.listen(PORT, () => {
      LoggingService.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV,
        apiUrl: `http://localhost:${PORT}`,
        s3Bucket: process.env.AWS_S3_BUCKET,
        cdnDomain: process.env.AWS_CLOUDFRONT_DOMAIN || 'Default S3 domain',
      });

      // Log startup metrics
      MetricsService.recordCounter('server.startup', 1, {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
      });

      // Track server startup
      AnalyticsService.track('server_started', {
        port: PORT,
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version,
      });

      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📊 Environment: ${process.env.NODE_ENV}`)
      console.log(`🔗 API URL: http://localhost:${PORT}`)
      console.log(`📈 Health Check: http://localhost:${PORT}/health`)
      console.log(`📊 Metrics: http://localhost:${PORT}/health/metrics`)
      console.log(`☁️ AWS S3 Bucket: ${process.env.AWS_S3_BUCKET}`)
      console.log(`🌐 CDN Domain: ${process.env.AWS_CLOUDFRONT_DOMAIN || 'Default S3 domain'}`)
      console.log(`🔍 Monitoring: ${validateSentryConfig() ? 'Enabled' : 'Disabled'}`)
    })
  } catch (error) {
    LoggingService.error('Failed to start server', { error: error as Error });
    
    // Send critical alert
    AlertingService.createAlert(
      'system_health',
      'critical',
      'Server Startup Failed',
      `Failed to start Saga backend server: ${(error as Error).message}`,
      { error: error as Error }
    );

    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  LoggingService.info('SIGTERM received, shutting down gracefully');
  
  // Stop scheduler service
  schedulerService.stop();
  
  // Close rate limiting Redis connection
  await closeRateLimitRedis();
  
  server.close(() => {
    LoggingService.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  LoggingService.info('SIGINT received, shutting down gracefully');
  
  // Stop scheduler service
  schedulerService.stop();
  
  // Close rate limiting Redis connection
  await closeRateLimitRedis();
  
  server.close(() => {
    LoggingService.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  LoggingService.error('Uncaught exception', { error });
  
  AlertingService.createAlert(
    'system_health',
    'critical',
    'Uncaught Exception',
    `Uncaught exception in server: ${error.message}`,
    { error, stack: error.stack }
  );

  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  LoggingService.error('Unhandled promise rejection', { 
    reason, 
    promise: promise.toString() 
  });
  
  AlertingService.createAlert(
    'system_health',
    'high',
    'Unhandled Promise Rejection',
    `Unhandled promise rejection: ${reason}`,
    { reason, promise: promise.toString() }
  );
});

startServer()

export { app, server, io }