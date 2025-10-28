'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { locales, localeNames, localeFlags } from '@/i18n/config'

export default function LocaleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const currentLocale = useLocale()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value as (typeof locales)[number]
    if (nextLocale === currentLocale) return

    const segments = pathname.split('/')
    // Replace the locale segment (second segment) if it exists; otherwise insert it
    if (segments.length > 1) {
      segments[1] = nextLocale
    } else {
      segments.push(nextLocale)
    }
    const newPath = segments.join('/') || `/${nextLocale}`
    router.push(newPath)
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={currentLocale}
        onChange={handleChange}
        className="rounded-md border border-gray-300 bg-white/80 px-2 py-1 text-gray-800 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#2D5A3D]/40"
      >
        {locales.map((loc) => (
          <option key={loc} value={loc}>
            {localeFlags[loc]} {localeNames[loc]}
          </option>
        ))}
      </select>
    </label>
  )
}