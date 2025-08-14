/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'e2e/test-results',
      outputName: 'results.xml',
    }],
  ],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};