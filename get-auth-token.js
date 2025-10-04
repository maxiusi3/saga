// Run this in browser console to get your auth token
// Copy and paste this entire script into the browser console at http://localhost:3000

(function() {
  try {
    // Try to get Supabase auth token
    const authToken = localStorage.getItem('sb-localhost-auth-token');
    
    if (!authToken) {
      console.error('❌ No auth token found. Please login first.');
      return;
    }
    
    const parsed = JSON.parse(authToken);
    const token = parsed.access_token;
    
    if (!token) {
      console.error('❌ No access_token found in auth data');
      return;
    }
    
    console.log('✅ Auth token found!');
    console.log('');
    console.log('Copy this command to your terminal:');
    console.log('');
    console.log(`export AUTH_TOKEN='${token}'`);
    console.log('');
    console.log('Then run: ./test-api.sh');
    console.log('');
    
    // Also copy to clipboard if available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`export AUTH_TOKEN='${token}'`);
      console.log('✅ Command copied to clipboard!');
    }
    
  } catch (error) {
    console.error('❌ Error getting auth token:', error);
    console.log('');
    console.log('Make sure you are logged in to the app first.');
  }
})();
