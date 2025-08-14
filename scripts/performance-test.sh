#!/bin/bash
# Performance testing script

set -e

echo "🚀 Running Performance Tests..."

# Backend performance tests
echo "Testing API performance..."
cd packages/backend
npm test -- --testPathPattern=performance

# Load testing
echo "Running load tests..."
npm test -- --testPathPattern=load-testing

# Memory usage test
echo "Testing memory usage..."
node --expose-gc --max-old-space-size=512 -e "
const used = process.memoryUsage();
console.log('Memory usage:');
for (let key in used) {
  console.log(\`\${key}: \${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB\`);
}
"

echo "✅ Performance tests completed!"
