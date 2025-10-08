# Invitation API Authentication Fix

## Issue

The project management page was showing a 401 Unauthorized error when trying to fetch invitations:

```
GET https://saga-web-livid.vercel.app/api/projects/93d1575c-b172-4cd4-bd83-06a4cd715145/invitations 401 (Unauthorized)
Error fetching invitations: Error: Failed to fetch invitations
```

## Root Cause

The `InvitationManager` component was making API calls without including authentication credentials. The fetch requests were missing the `credentials: 'include'` option, which is required to send cookies (including the authentication session cookie) with the request.

## Solution

Added `credentials: 'include'` to both fetch calls in the `InvitationManager` component:

### 1. Fetch Invitations (GET)

**Before:**
```typescript
const response = await fetch(`/api/projects/${projectId}/invitations`)
```

**After:**
```typescript
const response = await fetch(`/api/projects/${projectId}/invitations`, {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  }
})
```

### 2. Send Invitation (POST)

**Before:**
```typescript
const response = await fetch(`/api/projects/${projectId}/invitations`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: newInviteEmail.trim(),
    role: newInviteRole
  })
})
```

**After:**
```typescript
const response = await fetch(`/api/projects/${projectId}/invitations`, {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: newInviteEmail.trim(),
    role: newInviteRole
  })
})
```

## Why This Works

The `credentials: 'include'` option tells the browser to include credentials (cookies, HTTP authentication, and client-side SSL certificates) in the request, even for cross-origin requests. This is necessary because:

1. The authentication system uses HTTP-only cookies to store the session token
2. Without `credentials: 'include'`, the browser won't send these cookies
3. The API endpoint requires authentication to verify the user has permission to access/modify project invitations

## Testing

After this fix:
- ✅ The invitations list should load without 401 errors
- ✅ Users can send new invitations
- ✅ The console should be free of authentication errors
- ✅ All invitation management features should work correctly

## Files Modified

- `packages/web/src/components/invitations/invitation-manager.tsx`
  - Added `credentials: 'include'` to `fetchInvitations()` function
  - Added `credentials: 'include'` to `sendInvitation()` function

## Related Issues

This same pattern should be applied to any other API calls that are experiencing 401 errors. Always include `credentials: 'include'` when making authenticated API requests from the frontend.
