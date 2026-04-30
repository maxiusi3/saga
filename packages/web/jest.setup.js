require('@testing-library/jest-dom')

jest.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }) => children,
  useFormatter: () => (value) => value,
  useTranslations: () => (key) => key,
}))

if (expect.getState().testPath?.endsWith('config-gates.test.ts')) {
  jest.mock('next-intl/plugin', () => () => (config) => config)
}
