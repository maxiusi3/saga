const { chromium } = require('playwright');

async function testRegistration() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🚀 Starting registration test...');
    
    // Navigate to signup page
    await page.goto('http://localhost:3000/auth/signup');
    console.log('✅ Navigated to signup page');

    // Fill out the form
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
    await page.check('input[name="acceptTerms"]');
    console.log('✅ Filled out registration form');

    // Submit the form
    await page.click('button[type="submit"]');
    console.log('✅ Submitted registration form');

    // Wait for either success redirect or error message
    try {
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('🎉 Registration successful! Redirected to dashboard');
    } catch (error) {
      // Check for error messages
      const errorElement = await page.locator('.text-red-600, .text-red-800').first();
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        console.log('❌ Registration failed with error:', errorText);
      } else {
        console.log('❌ Registration failed - no redirect to dashboard and no visible error');
      }
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: 'registration-test.png' });
    console.log('📸 Screenshot saved as registration-test.png');

  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ path: 'registration-error.png' });
  } finally {
    await browser.close();
  }
}

testRegistration();