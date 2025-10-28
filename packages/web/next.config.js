const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@saga/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Enable detailed hydration error reporting
  reactStrictMode: true,
  compiler: {
    removeConsole: false,
  },
  images: {
    domains: [
      'localhost',
      process.env.AWS_CLOUDFRONT_DOMAIN,
      process.env.AWS_S3_BUCKET + '.s3.amazonaws.com',
    ].filter(Boolean),
  },
  env: {
    // Removed NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL - using Supabase directly
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), autoplay=(), encrypted-media=(), fullscreen=(self), picture-in-picture=()',
          },
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
          // Removed strict CORS policies that can cause module loading issues
        ],
      },
    ];
  },
  // Content Security Policy
  async rewrites() {
    return [];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
    }
    return config
  },
}

module.exports = withNextIntl(nextConfig);