#!/bin/bash

echo "🧪 Testing Saga Backend API..."
echo ""

API_URL="http://localhost:3001"

# Check if AUTH_TOKEN is set
if [ -z "$AUTH_TOKEN" ]; then
  echo "⚠️  No AUTH_TOKEN environment variable set"
  echo ""
  echo "To get your auth token:"
  echo "1. Open browser console at http://localhost:3000"
  echo "2. Login to the app"
  echo "3. Run in console: JSON.parse(localStorage.getItem('sb-localhost-auth-token')).access_token"
  echo "4. Copy the token and run: export AUTH_TOKEN='your-token-here'"
  echo "5. Run this script again"
  echo ""
fi

# Test health endpoint
echo "1️⃣  Testing health endpoint..."
curl -s "$API_URL/health" | jq '.' || echo "❌ Health check failed"
echo ""

if [ -n "$AUTH_TOKEN" ]; then
  # Test settings endpoints
  echo "2️⃣  Testing settings/profile..."
  curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/settings/profile" | jq '.'
  echo ""
  
  echo "3️⃣  Testing settings/notifications..."
  curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/settings/notifications" | jq '.'
  echo ""
  
  echo "4️⃣  Testing settings/accessibility..."
  curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/settings/accessibility" | jq '.'
  echo ""
  
  echo "5️⃣  Testing settings/wallet..."
  curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/settings/wallet" | jq '.'
  echo ""
  
  echo "6️⃣  Testing dashboard/wallet..."
  curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/dashboard/wallet" | jq '.'
  echo ""
  
  echo "7️⃣  Testing dashboard/overview..."
  curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/dashboard/overview" | jq '.'
  echo ""
else
  echo "2️⃣  Skipping authenticated tests (no AUTH_TOKEN)"
  echo ""
fi

echo "✅ API test complete!"
