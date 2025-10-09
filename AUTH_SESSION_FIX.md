# Authentication Session Fix

## Problem Identified

From the Vercel logs, we found the root cause of the 401 error:

```
GET invitations - Cookie auth result: { 
  hasUser: false, 
  userId: undefined, 
  error: 'Auth session missing!' 
}
```

**Root Cause:** The authentication session cookies are not being properly transmitted from the frontend to the API routes in the production environment. This is a common issue with Next.js App Router + Supabase when deployed to Vercel.

## Why This Happens

1. **Cookie Domain Issues**: Cookies might be set with a domain that doesn't match the API route
2. **SameSite Policy**: Browser security policies may block cookies in certain scenarios
3. **Next.js App Router**: The new App Router handles cookies differently than Pages Router
4. **Vercel Deployment**: Production environment has different cookie handling than local development

## Solution Implemented

Added **Authorization header with Bearer token** as a fallback authentication method. This ensures authentication works even when cookies fail.

### Changes Made

#### 1. Frontend - InvitationManager Component

**Before:**
```typescript
const response = await fetch(`/api/projects/${projectId}/invitations`, {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  }
})
```

**After:**
```typescript
// Get the session token
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const { data: { session } } = await supabase.auth.getSession()

const headers: HeadersInit = {
  'Content-Type': 'application/json',
}

// Add Authorization header if we have a session
if (session?.access_token) {
  headers['Authorization'] = `Bearer ${session.access_token}`
}

const response = await fetch(`/api/projects/${projectId}/invitations`, {
  credentials: 'include',
  headers
})
```

#### 2. Backend - API Route

The API route already had fallback logic to check the Authorization header:

```typescript
// First try cookies
const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()

if (cookieUser && !cookieError) {
  user = cookieUser
} else if (token) {
  // Fallback to token authentication
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: tokenData, error: tokenError } = await adminSupabase.auth.getUser(token)
  if (tokenData.user && !tokenError) {
    user = tokenData.user
  }
}
```

## How It Works

1. **Primary Method (Cookies)**: Still tries to use cookies first (best practice)
2. **Fallback Method (Bearer Token)**: If cookies fail, uses Authorization header
3. **Dual Authentication**: Both methods are supported, ensuring reliability

## Benefits

✅ **Works in Production**: Solves the Vercel deployment cookie issue
✅ **Maintains Security**: Uses proper authentication tokens
✅ **Backward Compatible**: Still supports cookie-based auth
✅ **Reliable**: Has fallback mechanism if one method fails

## Testing

After deploying these changes:

1. ✅ Invitations should load without 401 errors
2. ✅ Users can send new invitations
3. ✅ Console should show successful authentication
4. ✅ Vercel logs should show: `hasToken: true` and successful auth

## Files Modified

1. `packages/web/src/components/invitations/invitation-manager.tsx`
   - Added session token retrieval
   - Added Authorization header to both GET and POST requests

2. `packages/web/src/app/api/projects/[id]/invitations/route.ts`
   - Already had token fallback logic
   - Added detailed logging for debugging

## Next Steps

1. Deploy these changes to Vercel
2. Test the invitation functionality
3. Verify in Vercel logs that authentication is successful
4. The 401 errors should be resolved

## Additional Notes

This same pattern should be applied to other API routes that are experiencing authentication issues. The key is to:
1. Get the session on the frontend
2. Pass the access token in the Authorization header
3. Have the API route check both cookies and Authorization header
