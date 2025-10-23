'use client';

import { usePathname, useRouter } from 'next/navigation';
import { locales } from '@/i18n';

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value;
    const currentLocale = locales.find((locale) => pathname.startsWith(`/${locale}`)) || '';
    const newPath = `/${newLocale}${pathname.substring(currentLocale.length + 1)}`;
    router.replace(newPath);
  };

  const currentLocale = locales.find((locale) => pathname.startsWith(`/${locale}`)) || '';

  return (
    <select
      onChange={handleChange}
      defaultValue={currentLocale}
      className="bg-gray-800 text-white rounded-md p-2"
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {locale.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
