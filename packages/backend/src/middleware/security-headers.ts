import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware
 * Implements OWASP security headers recommendations
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Strict Transport Security (HSTS)
  // Forces HTTPS connections for 1 year, including subdomains
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Content Security Policy (CSP)
  // Prevents XSS attacks by controlling resource loading
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' https:",
    "connect-src 'self' https://api.stripe.com https://maps.googleapis.com wss:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', cspDirectives);

  // X-Frame-Options
  // Prevents clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  // Prevents MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection
  // Enables XSS filtering in older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  // Controls referrer information sent with requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (formerly Feature Policy)
  // Controls browser features and APIs
  const permissionsPolicy = [
    'camera=(self)',
    'microphone=(self)',
    'geolocation=()',
    'payment=(self)',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    'picture-in-picture=()'
  ].join(', ');
  
  res.setHeader('Permissions-Policy', permissionsPolicy);

  // X-Permitted-Cross-Domain-Policies
  // Restricts Adobe Flash and PDF cross-domain requests
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Cross-Origin-Embedder-Policy
  // Enables cross-origin isolation
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  // Cross-Origin-Opener-Policy
  // Isolates browsing context
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // Cross-Origin-Resource-Policy
  // Protects against cross-origin attacks
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

/**
 * CORS configuration with security considerations
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://saga-app.com',
      'https://www.saga-app.com',
      'https://staging.saga-app.com'
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};