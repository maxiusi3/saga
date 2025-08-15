#!/bin/bash

# Test CI locally to debug issues
set -e

echo "🧪 Testing CI workflow locally..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build shared package first
echo "🔨 Building shared package..."
npm run build --workspace=packages/shared

# Test each package
echo "🧪 Testing shared package..."
npm run test --workspace=packages/shared

echo "🧪 Testing backend..."
export NODE_ENV=test
export DATABASE_URL="sqlite3://./test.db"
export JWT_SECRET="test-secret"
npm run test --workspace=packages/backend

echo "🧪 Testing web..."
export NODE_ENV=test
npm run test --workspace=packages/web

echo "🧪 Testing mobile..."
export NODE_ENV=test
npm run test --workspace=packages/mobile

# Run linting
echo "🔍 Running linting..."
npm run lint

# Run type checking
echo "🔍 Running type checking..."
npm run type-check

echo "✅ All tests passed locally!"