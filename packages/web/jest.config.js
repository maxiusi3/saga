const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  transformIgnorePatterns: [
    '/node_modules/(?!next-intl|use-intl|intl-messageformat|@formatjs)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^../app/dashboard/page$': '<rootDir>/src/app/[locale]/dashboard/page',
    '^../app/dashboard/projects/new/page$': '<rootDir>/src/app/[locale]/dashboard/projects/create/page',
    '^../app/dashboard/projects/\\[id\\]/page$': '<rootDir>/src/app/[locale]/dashboard/projects/[id]/page',
  },
}

module.exports = createJestConfig(customJestConfig)
