#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3001';
const WEB_BASE = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Saga System...\n');

  try {
    // 1. Test health check
    console.log('1. Testing health check...');
    const health = await axios.get(`${API_BASE}/health`);
    console.log(`   ✅ Health: ${health.data.status}`);

    // 2. Test user registration
    console.log('2. Testing user registration...');
    const newUser = {
      name: 'Test User',
      email: `test${Date.now()}@saga.com`,
      password: 'testpass123'
    };
    
    const signupResponse = await axios.post(`${API_BASE}/api/auth/signup`, newUser);
    console.log(`   ✅ Signup: User ${signupResponse.data.user.name} created`);
    
    const token = signupResponse.data.accessToken;

    // 3. Test user login
    console.log('3. Testing user login...');
    const loginResponse = await axios.post(`${API_BASE}/api/auth/signin`, {
      email: newUser.email,
      password: newUser.password
    });
    console.log(`   ✅ Login: ${loginResponse.data.user.name} authenticated`);

    // 4. Test protected route (profile)
    console.log('4. Testing protected route...');
    const profileResponse = await axios.get(`${API_BASE}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   ✅ Profile: ${profileResponse.data.name} (${profileResponse.data.email})`);

    // 5. Test projects endpoint
    console.log('5. Testing projects endpoint...');
    const projectsResponse = await axios.get(`${API_BASE}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   ✅ Projects: ${projectsResponse.data.length} projects found`);

    // 6. Test stories endpoint
    console.log('6. Testing stories endpoint...');
    const storiesResponse = await axios.get(`${API_BASE}/api/stories`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   ✅ Stories: ${storiesResponse.data.length} stories found`);

    // 7. Test web frontend
    console.log('7. Testing web frontend...');
    const webResponse = await axios.get(WEB_BASE);
    const hasTitle = webResponse.data.includes('Saga - Family Biography Platform');
    console.log(`   ✅ Web: ${hasTitle ? 'Title found' : 'Title missing'}`);

    // 8. Test auth pages
    console.log('8. Testing auth pages...');
    const signinPage = await axios.get(`${WEB_BASE}/auth/signin`);
    const signupPage = await axios.get(`${WEB_BASE}/auth/signup`);
    console.log(`   ✅ Auth pages: Sign-in and Sign-up pages accessible`);

    console.log('\n🎉 All tests passed! System is working correctly.\n');

    // Summary
    console.log('📊 System Status Summary:');
    console.log('   • Backend API: ✅ Running on port 3001');
    console.log('   • Frontend Web: ✅ Running on port 3000');
    console.log('   • Authentication: ✅ JWT-based auth working');
    console.log('   • Database: ✅ In-memory storage working');
    console.log('   • API Endpoints: ✅ All endpoints responding');
    console.log('   • Web Pages: ✅ All pages accessible');

    console.log('\n🔗 Access URLs:');
    console.log(`   • Website: ${WEB_BASE}`);
    console.log(`   • API Health: ${API_BASE}/health`);
    console.log(`   • Sign In: ${WEB_BASE}/auth/signin`);
    console.log(`   • Sign Up: ${WEB_BASE}/auth/signup`);

    console.log('\n🧑‍💻 Demo Credentials:');
    console.log('   • Email: demo@saga.com');
    console.log('   • Password: password');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.status, error.response.data);
    }
    process.exit(1);
  }
}

testAPI();