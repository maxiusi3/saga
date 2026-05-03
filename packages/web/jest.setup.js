require('@testing-library/jest-dom')

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/en/dashboard',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'test-project-id', locale: 'en' }),
}))

jest.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }) => children,
  useFormatter: () => (value) => value,
  useLocale: () => 'en',
  useTranslations: () => (key) => key,
}))

jest.mock('next-intl/plugin', () => () => (config) => config)

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    writable: true,
    value: {
      getUserMedia: jest.fn(),
    },
  })
}
