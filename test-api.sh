#!/bin/bash

echo "🧪 Testing Saga Backend API..."
echo ""

API_URL="http://localhost:3001"

# Test health endpoint
echo "1️⃣  Testing health endpoint..."
curl -s "$API_URL/health" | jq '.' || echo "❌ Health check failed"
echo ""

# Test dashboard wallet endpoint (requires auth)
echo "2️⃣  Testing dashboard wallet endpoint..."
echo "Note: This will fail without authentication token"
curl -s "$API_URL/api/dashboard/wallet" | jq '.' || echo "⚠️  Expected - requires authentication"
echo ""

# Test dashboard overview endpoint (requires auth)
echo "3️⃣  Testing dashboard overview endpoint..."
curl -s "$API_URL/api/dashboard/overview" | jq '.' || echo "⚠️  Expected - requires authentication"
echo ""

echo "✅ API test complete!"
echo ""
echo "To test authenticated endpoints, you need to:"
echo "1. Login through the frontend (http://localhost:3000)"
echo "2. Get the auth token from localStorage"
echo "3. Use: curl -H 'Authorization: Bearer YOUR_TOKEN' $API_URL/api/dashboard/wallet"
