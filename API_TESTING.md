# API Testing Guide

## Quick Start

### 1. Get Your Auth Token

Open browser console at `http://localhost:3000` and run:

```javascript
// Copy and paste this into browser console
const authToken = localStorage.getItem('sb-localhost-auth-token');
if (authToken) {
  const parsed = JSON.parse(authToken);
  console.log(`export AUTH_TOKEN='${parsed.access_token}'`);
} else {
  console.log('Please login first!');
}
```

Or use the helper script:
```bash
# In browser console at http://localhost:3000
# Copy and paste the contents of get-auth-token.js
```

### 2. Set Environment Variable

Copy the output from step 1 and run in your terminal:

```bash
export AUTH_TOKEN='your-token-here'
```

### 3. Run Tests

```bash
./test-api.sh
```

## Manual Testing

### Test Settings Endpoints

```bash
# Profile
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  http://localhost:3001/api/settings/profile

# Notifications
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  http://localhost:3001/api/settings/notifications

# Accessibility
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  http://localhost:3001/api/settings/accessibility

# Resource Wallet
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  http://localhost:3001/api/settings/wallet
```

### Update Settings

```bash
# Update notifications
curl -X PUT \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"emailNotifications": false}' \
  http://localhost:3001/api/settings/notifications

# Update accessibility
curl -X PUT \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fontSize": "large", "highContrast": true}' \
  http://localhost:3001/api/settings/accessibility
```

## Troubleshooting

### "No auth token found"
- Make sure you're logged in at http://localhost:3000
- Check that Supabase is running
- Verify localStorage has `sb-localhost-auth-token`

### "API Error: 401"
- Token may have expired - login again
- Check that backend is running on port 3001
- Verify auth middleware is working

### "API Error: 500"
- Check backend logs for errors
- Verify database is running
- Check that all migrations have run

## Frontend Token Usage

The frontend automatically gets tokens from Supabase:

```typescript
// In settings-service.ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const { data: { session } } = await supabase.auth.getSession();
if (session?.access_token) {
  headers['Authorization'] = `Bearer ${session.access_token}`;
}
```

No manual token management needed in the frontend!
