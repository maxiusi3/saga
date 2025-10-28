import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale } from './config';

// next-intl >= 3.22 expects `requestLocale` and requires returning a `locale` value.
export default getRequestConfig(async ({ requestLocale }) => {
  // Determine the current locale from the request (may be null), fallback to default
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as any)) {
    locale = defaultLocale;
  }

  // Load all translation namespaces for the resolved locale
  return {
    locale,
    messages: {
      ...(await import(`../../public/locales/${locale}/common.json`)).default,
      pages: (await import(`../../public/locales/${locale}/pages.json`)).default,
      auth: (await import(`../../public/locales/${locale}/auth.json`)).default,
      errors: (await import(`../../public/locales/${locale}/errors.json`)).default,
      ai: (await import(`../../public/locales/${locale}/ai.json`)).default,
      recording: (await import(`../../public/locales/${locale}/recording.json`)).default,
      projects: (await import(`../../public/locales/${locale}/projects.json`)).default,
    },
  };
});
