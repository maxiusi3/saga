import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale } from './config';

// next-intl >= 3.22 expects `requestLocale` and requires returning a `locale` value.
export default getRequestConfig(async ({ requestLocale }) => {
  // Determine the current locale from the request (may be null), fallback to default
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as any)) {
    locale = defaultLocale;
  }

  // Helper to safely load a JSON namespace for a given locale
  const loadJson = async (loc: string, file: string) => {
    try {
      const mod = await import(`../../public/locales/${loc}/${file}`);
      return mod.default as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  };

  // Merge English defaults first, then overlay target locale.
  const merge = (base: Record<string, unknown>, overlay: Record<string, unknown>) => ({
    ...base,
    ...overlay,
  });

  return {
    locale,
    messages: {
      // Root-level namespaces from common.json
      ...merge(await loadJson('en', 'common.json'), await loadJson(locale, 'common.json')),

      // Dedicated namespaces
      pages: merge(await loadJson('en', 'pages.json'), await loadJson(locale, 'pages.json')),
      auth: merge(await loadJson('en', 'auth.json'), await loadJson(locale, 'auth.json')),
      errors: merge(await loadJson('en', 'errors.json'), await loadJson(locale, 'errors.json')),
      ai: merge(await loadJson('en', 'ai.json'), await loadJson(locale, 'ai.json')),
      recording: merge(await loadJson('en', 'recording.json'), await loadJson(locale, 'recording.json')),
      projects: merge(await loadJson('en', 'projects.json'), await loadJson(locale, 'projects.json')),

      // Optional namespaces (loaded if present). Fallback to English when available.
      dashboard: merge(await loadJson('en', 'dashboard.json'), await loadJson(locale, 'dashboard.json')),
      resources: merge(await loadJson('en', 'resources.json'), await loadJson(locale, 'resources.json')),
      wallet: merge(await loadJson('en', 'wallet.json'), await loadJson(locale, 'wallet.json')),
      settings: merge(await loadJson('en', 'settings.json'), await loadJson(locale, 'settings.json')),
      invitations: merge(await loadJson('en', 'invitations.json'), await loadJson(locale, 'invitations.json')),
      subscription: merge(await loadJson('en', 'subscription.json'), await loadJson(locale, 'subscription.json')),
      billing: merge(await loadJson('en', 'billing.json'), await loadJson(locale, 'billing.json')),
      toasts: merge(await loadJson('en', 'toasts.json'), await loadJson(locale, 'toasts.json')),
    },
  };
});
