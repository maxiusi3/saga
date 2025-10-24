import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './src/i18n';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();

  // Handle i18n
  const handleI18nRouting = createIntlMiddleware({
    locales,
    defaultLocale,
  });
  const i18nResponse = handleI18nRouting(request);
  if (i18nResponse) {
    return i18nResponse;
  }

  // Handle the case where the path looks like a domain name with query params
  // This happens when Supabase generates malformed redirect URLs
  const pathname = url.pathname;

  // Check if pathname looks like "saga-web-livid.vercel.app" (our domain in the path)
  if (pathname.includes('saga-web-livid.vercel.app')) {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const error_description = url.searchParams.get('error_description');

    if (code || error) {
      // Build the correct redirect URL
      const redirectUrl = new URL('/auth/callback', url.origin);

      if (code) {
        redirectUrl.searchParams.set('code', code);
      }
      if (error) {
        redirectUrl.searchParams.set('error', error);
      }
      if (error_description) {
        redirectUrl.searchParams.set('error_description', error_description);
      }

      return NextResponse.redirect(redirectUrl.toString());
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
