import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/config';
import type { ReactNode } from 'react';
import SetLang from '@/components/i18n/set-lang';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.home' });

  return {
    title: t('navigation.brandName') + ' - Family Biography Platform',
    description: t('hero.subtitle'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Props) {
  const { locale } = await params;
  // Debug log to confirm the layout is reached and locale is parsed
  console.log('[LocaleLayout] Rendering with locale:', locale)

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as any)) {
    console.warn('[LocaleLayout] Invalid locale, triggering notFound:', locale)
    notFound();
  }

  // 直接根据当前路由参数加载对应语言的文案，避免在开发模式下因 middleware 未参与而回退到默认英文
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SetLang />
      {children}
    </NextIntlClientProvider>
  );
}
