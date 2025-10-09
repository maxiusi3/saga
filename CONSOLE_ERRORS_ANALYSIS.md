# Console Errors Analysis and Solutions

## Errors Identified

### 1. Multiple GoTrueClient Instances Warning
**Error:**
```
Multiple GoTrueClient instances detected in the same browser context.
```

**Cause:** Multiple Supabase client instances are being created, likely due to:
- Multiple imports of Supabase client in different files
- Client being recreated on every render
- Different authentication helpers being used simultaneously

**Impact:** Low - This is a warning, not an error. May cause undefined behavior with concurrent operations.

**Solution:** Consolidate Supabase client creation to use a singleton pattern.

---

### 2. 401 Unauthorized - Invitations API
**Error:**
```
GET https://saga-web-livid.vercel.app/api/projects/.../invitations 401 (Unauthorized)
```

**Cause:** The API route authentication is failing. Even though we added `credentials: 'include'`, the issue is that:
1. The `createRouteHandlerClient({ cookies })` might not be properly reading the session
2. The cookies might not be set correctly
3. There might be a CORS issue preventing cookies from being sent

**Current Status:** Partially fixed (added credentials: 'include'), but still failing

**Additional Solutions Needed:**
1. Verify that the Supabase session is properly established
2. Check if cookies are being set with correct domain/path
3. Ensure the API route is properly handling the authentication

---

### 3. 406 Not Acceptable - User Settings
**Error:**
```
GET https://encdblxyxztvfxotfuyh.supabase.co/rest/v1/user_settings?... 406 (Not Acceptable)
```

**Cause:** The Supabase REST API is returning 406, which typically means:
- The `Accept` header doesn't match what the server can provide
- The requested format is not supported
- RLS policies might be blocking the request

**Impact:** Medium - User settings cannot be loaded

**Solution:** 
1. Check if the `user_settings` table exists
2. Verify RLS policies allow the user to read their own settings
3. Ensure the query includes proper headers

---

### 4. WebSocket Connection Failed - Realtime
**Error:**
```
WebSocket connection to 'wss://encdblxyxztvfxotfuyh.supabase.co/realtime/v1/websocket...' failed
Realtime subscription issue, falling back to polling: TIMED_OUT
Realtime subscription issue, falling back to polling: CHANNEL_ERROR
```

**Cause:** Supabase Realtime WebSocket connection is failing, likely due to:
- Network/firewall blocking WebSocket connections
- Supabase project configuration
- Invalid API key or authentication

**Impact:** Low - The app falls back to polling, so functionality is maintained but with higher latency

**Solution:**
1. Verify Supabase project has Realtime enabled
2. Check if WebSocket connections are blocked by network/firewall
3. The fallback to polling is working, so this is not critical

---

## Priority Fixes

### High Priority
1. **Fix 401 Unauthorized for Invitations API**
   - This is blocking core functionality
   - Users cannot manage project invitations

### Medium Priority
2. **Fix 406 Not Acceptable for User Settings**
   - Affects user experience
   - Settings cannot be loaded/saved

### Low Priority
3. **Multiple GoTrueClient Instances**
   - Warning only, not breaking functionality
   - Should be fixed for code quality

4. **WebSocket Connection Issues**
   - Already has fallback mechanism
   - Functionality is maintained through polling

---

## Recommended Actions

### Immediate (Fix 401 Error)

The issue is that the authentication is not working properly. The API route needs to be debugged to see why the session is not being recognized. 

**Debug Steps:**
1. Check if the session cookie is being sent in the request
2. Verify the cookie name and domain match
3. Check if the Supabase client is properly initialized
4. Verify the API route is reading cookies correctly

**Temporary Workaround:**
Since this is a production deployment issue, the quickest fix might be to:
1. Use a different authentication method (e.g., pass token in Authorization header)
2. Or ensure the frontend is properly setting up the Supabase client with the session

### Short Term (Fix 406 Error)

Check the `user_settings` table:
```sql
-- Verify table exists
SELECT * FROM information_schema.tables WHERE table_name = 'user_settings';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'user_settings';

-- Add policy if missing
CREATE POLICY "Users can read own settings"
  ON user_settings
  FOR SELECT
  USING (auth.uid() = user_id);
```

### Long Term (Code Quality)

1. Create a singleton Supabase client
2. Implement proper error handling for all API calls
3. Add retry logic for failed requests
4. Improve WebSocket connection handling

---

## Notes

The main blocker is the 401 error. The other errors are either warnings or have fallback mechanisms. Focus on fixing the authentication issue first.
