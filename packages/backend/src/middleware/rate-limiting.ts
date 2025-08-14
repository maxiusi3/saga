import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Use memory store for development to avoid Redis issues
// import RedisStore from 'rate-limit-redis';
// import { Redis } from 'ioredis';
// const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * General API rate limiting
 * 100 requests per 15 minutes per IP
 */
export const generalRateLimit = rateLimit({
  // Use memory store for development
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  // }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request): string => {
    // Use IP address and user ID if authenticated
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = (req as any).user?.id;
    return userId ? `${ip}:${userId}` : ip;
  },
  skip: (req: Request): boolean => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
});

/**
 * Strict rate limiting for authentication endpoints
 * 5 attempts per 15 minutes per IP
 */
export const authRateLimit = rateLimit({
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  // }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const email = req.body?.email;
    return email ? `auth:${ip}:${email}` : `auth:${ip}`;
  },
});

/**
 * Rate limiting for file uploads
 * 10 uploads per hour per user
 */
export const uploadRateLimit = rateLimit({
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  // }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each user to 10 uploads per hour
  message: {
    error: 'Upload limit exceeded, please try again later.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const userId = (req as any).user?.id || 'anonymous';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `upload:${userId}:${ip}`;
  },
});

/**
 * Rate limiting for password reset requests
 * 3 attempts per hour per IP
 */
export const passwordResetRateLimit = rateLimit({
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  // }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    error: 'Too many password reset attempts, please try again later.',
    code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const email = req.body?.email;
    return email ? `password-reset:${ip}:${email}` : `password-reset:${ip}`;
  },
});

/**
 * Rate limiting for API key requests
 * Very strict: 1 request per 5 minutes per IP
 */
export const apiKeyRateLimit = rateLimit({
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  // }),
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1, // Limit each IP to 1 request per 5 minutes
  message: {
    error: 'API key request limit exceeded, please try again later.',
    code: 'API_KEY_RATE_LIMIT_EXCEEDED',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Custom rate limiter for WebSocket connections
 * 10 connections per minute per IP
 */
export const websocketRateLimit = rateLimit({
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  // }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 WebSocket connections per minute
  message: {
    error: 'WebSocket connection limit exceeded, please try again later.',
    code: 'WEBSOCKET_RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiting for export requests
 * 2 exports per hour per user
 */
export const exportRateLimit = rateLimit({
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  // }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 2, // Limit each user to 2 exports per hour
  message: {
    error: 'Export limit exceeded, please try again later.',
    code: 'EXPORT_RATE_LIMIT_EXCEEDED',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const userId = (req as any).user?.id || 'anonymous';
    return `export:${userId}`;
  },
});

/**
 * Cleanup function to close Redis connection
 */
export const closeRateLimitRedis = async (): Promise<void> => {
  // await redis.quit();
};