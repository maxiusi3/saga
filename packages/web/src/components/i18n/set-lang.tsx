"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

/**
 * Sets the <html lang> attribute dynamically based on current locale.
 * This avoids hydration warnings when SSR default differs and improves accessibility.
 */
export default function SetLang() {
  const locale = useLocale();

  useEffect(() => {
    try {
      const html = document.documentElement;
      // Update lang if changed
      if (html.lang !== locale) {
        html.lang = locale;
      }
      // Optional: set text direction for RTL languages (not used in current locales)
      // const rtlLocales = new Set(["ar", "he", "fa", "ur"]);
      // html.dir = rtlLocales.has(locale) ? "rtl" : "ltr";
    } catch (err) {
      // No-op in SSR or if document is unavailable
    }
  }, [locale]);

  return null;
}