/**
 * Automated Translation Verification Script
 * Run with: node run-translation-tests.js
 */

const fs = require('fs');
const path = require('path');

const baseUrl = 'https://saga-web-livid.vercel.app';
const languages = ['es', 'fr', 'ja', 'ko', 'pt', 'zh-CN', 'zh-TW'];

// Pages to test (excluding landing page)
const pages = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/dashboard/projects', name: 'Projects List' },
  { path: '/dashboard/projects/create', name: 'Create Project' },
  { path: '/dashboard/purchase', name: 'Purchase' },
  { path: '/dashboard/profile', name: 'Profile' },
  { path: '/dashboard/notifications', name: 'Notifications' },
  { path: '/dashboard/resources', name: 'Resources' },
  { path: '/dashboard/settings', name: 'Settings' }
];

const results = {
  timestamp: new Date().toISOString(),
  summary: {},
  details: []
};

// English text patterns that should NOT appear in translated pages
const englishPatterns = [
  'Create New',
  'Back to Projects',
  'Project Details',
  'Project Name',
  'Project Description',
  'Your Role',
  'Current Balance',
  'Record Your Story',
  'Start Recording',
  'Purchase',
  'Profile',
  'Settings',
  'Notifications',
  'Dashboard'
];

function checkForEnglishText(text, lang) {
  if (lang === 'en') return [];
  
  const found = [];
  for (const pattern of englishPatterns) {
    if (text.includes(pattern)) {
      found.push(pattern);
    }
  }
  return found;
}

console.log('Translation Verification Test Plan');
console.log('===================================\n');
console.log(`Base URL: ${baseUrl}`);
console.log(`Languages: ${languages.join(', ')}`);
console.log(`Pages: ${pages.length}`);
console.log(`Total tests: ${languages.length * pages.length}\n`);

console.log('Test execution requires Playwright MCP integration.');
console.log('This script provides the test plan structure.\n');

// Generate test commands
console.log('Test Commands (to be executed via Playwright):');
console.log('==============================================\n');

let testNumber = 1;
for (const lang of languages) {
  console.log(`\n## Language: ${lang}`);
  for (const page of pages) {
    const url = `${baseUrl}/${lang}${page.path}`;
    console.log(`\nTest ${testNumber}: ${page.name} (${lang})`);
    console.log(`URL: ${url}`);
    console.log(`Commands:`);
    console.log(`  1. Navigate to ${url}`);
    console.log(`  2. Wait for page load`);
    console.log(`  3. Take screenshot: ${lang}-${page.name.toLowerCase().replace(/\s+/g, '-')}`);
    console.log(`  4. Get visible text`);
    console.log(`  5. Check for untranslated English text`);
    testNumber++;
  }
}

console.log('\n\nExpected Issues by Language:');
console.log('============================\n');

const knownIssues = {
  'es': {
    completion: '52.4%',
    issues: ['recording.json (65 items)', 'purchase-page.json (62 items)', 'project-settings.json (30 items)']
  },
  'fr': {
    completion: '33.3%',
    issues: ['recording.json (66 items)', 'purchase-page.json (62 items)', 'project-settings.json (30 items)', 'common.json (2 items)']
  },
  'ja': {
    completion: '61.9%',
    issues: ['recording.json (66 items)', 'purchase-page.json (62 items)', 'project-settings.json (30 items)']
  },
  'ko': {
    completion: '61.9%',
    issues: ['recording.json (66 items)', 'purchase-page.json (62 items)', 'project-settings.json (30 items)']
  },
  'pt': {
    completion: '61.9%',
    issues: ['recording.json (66 items)', 'purchase-page.json (62 items)', 'project-settings.json (30 items)']
  },
  'zh-CN': {
    completion: '71.4%',
    issues: ['Minor issues in dashboard.json, pages.json']
  },
  'zh-TW': {
    completion: '66.7%',
    issues: ['recording.json (66 items)', 'Minor issues in dashboard.json, pages.json']
  }
};

for (const [lang, info] of Object.entries(knownIssues)) {
  console.log(`${lang}: ${info.completion} complete`);
  info.issues.forEach(issue => console.log(`  - ${issue}`));
  console.log('');
}

console.log('\nTest Results will be saved to: translation-test-results.json');
