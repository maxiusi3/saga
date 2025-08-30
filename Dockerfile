# Multi-stage Docker build for Saga MVP
# Stage 1: Build dependencies and applications
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package*.json ./
COPY packages/web/package*.json ./packages/web/
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build shared package first
WORKDIR /app/packages/shared
RUN npm run build

# Build backend
WORKDIR /app/packages/backend
RUN npm run build

# Build frontend
WORKDIR /app/packages/web
RUN npm run build

# Stage 2: Production runtime for backend
FROM node:18-alpine AS backend

WORKDIR /app

# Install system dependencies for production
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Copy built backend application
COPY --from=builder --chown=backend:nodejs /app/packages/backend/dist ./backend/
COPY --from=builder --chown=backend:nodejs /app/packages/backend/package*.json ./backend/
COPY --from=builder --chown=backend:nodejs /app/packages/shared/dist ./shared/
COPY --from=builder --chown=backend:nodejs /app/node_modules ./node_modules/

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Switch to non-root user
USER backend

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node backend/health-check.js

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/index.js"]

# Stage 3: Production runtime for frontend
FROM node:18-alpine AS frontend

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy built Next.js application
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/public ./public

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
