/**
 * Translation Verification Test Plan
 * Tests all dashboard pages in 8 languages (excluding landing page)
 */

const testPlan = {
  baseUrl: 'https://saga-web-livid.vercel.app',
  languages: ['es', 'fr', 'ja', 'ko', 'pt', 'zh-CN', 'zh-TW', 'en'],
  
  // Pages to test (excluding landing page)
  pages: [
    {
      path: '/dashboard',
      name: 'Dashboard Home',
      translationFile: 'dashboard.json',
      checkElements: [
        { selector: 'h1, h2', description: 'Page title' },
        { selector: 'button', description: 'Action buttons' }
      ]
    },
    {
      path: '/dashboard/projects',
      name: 'Projects List',
      translationFile: 'projects.json',
      checkElements: [
        { selector: 'h1', description: 'Page title' },
        { selector: '[data-testid="create-project-btn"], button:has-text("Create")', description: 'Create button' }
      ]
    },
    {
      path: '/dashboard/projects/create',
      name: 'Create Project',
      translationFile: 'create-project.json',
      checkElements: [
        { selector: 'h1', description: 'Page title' },
        { selector: 'label', description: 'Form labels' },
        { selector: 'button[type="submit"]', description: 'Submit button' }
      ]
    },
    {
      path: '/dashboard/purchase',
      name: 'Purchase Page',
      translationFile: 'purchase-page.json',
      checkElements: [
        { selector: 'h1, h2', description: 'Page titles' },
        { selector: 'button', description: 'Purchase buttons' }
      ]
    },
    {
      path: '/dashboard/profile',
      name: 'Profile Page',
      translationFile: 'profile.json',
      checkElements: [
        { selector: 'h1', description: 'Page title' },
        { selector: 'label', description: 'Form labels' }
      ]
    },
    {
      path: '/dashboard/notifications',
      name: 'Notifications Page',
      translationFile: 'notifications-page.json',
      checkElements: [
        { selector: 'h1', description: 'Page title' }
      ]
    },
    {
      path: '/dashboard/resources',
      name: 'Resources Page',
      translationFile: 'resources.json',
      checkElements: [
        { selector: 'h1', description: 'Page title' }
      ]
    },
    {
      path: '/dashboard/settings',
      name: 'Settings Page',
      translationFile: 'settings.json',
      checkElements: [
        { selector: 'h1', description: 'Page title' }
      ]
    }
  ],
  
  // Expected issues based on translation report
  knownIssues: {
    'es': ['recording.json', 'purchase-page.json', 'project-settings.json'],
    'fr': ['recording.json', 'purchase-page.json', 'project-settings.json', 'common.json'],
    'ja': ['recording.json', 'purchase-page.json', 'project-settings.json'],
    'ko': ['recording.json', 'purchase-page.json', 'project-settings.json'],
    'pt': ['recording.json', 'purchase-page.json', 'project-settings.json']
  }
};

module.exports = testPlan;
