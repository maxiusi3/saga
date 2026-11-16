/**
 * Single language policy for every AI task.
 *
 * Output follows the language of the family's source material, because it becomes archive content
 * in the storyteller's own words. The UI locale is only the fallback when the material is too short
 * or mixed to tell.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  'zh-CN': 'Simplified Chinese (简体中文)',
  'zh-TW': 'Traditional Chinese (繁體中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  pt: 'Portuguese (Português)',
  de: 'German (Deutsch)',
}

const ALIASES: Record<string, string> = {
  zh: 'zh-CN',
  'zh-Hans': 'zh-CN',
  'zh-SG': 'zh-CN',
  'zh-Hant': 'zh-TW',
  'zh-HK': 'zh-TW',
  'pt-BR': 'pt',
  'pt-PT': 'pt',
}

export const DEFAULT_AI_LOCALE = 'en'

export function normalizeAiLocale(locale: unknown): string {
  if (typeof locale !== 'string' || !locale.trim()) return DEFAULT_AI_LOCALE
  const value = locale.trim()
  if (LANGUAGE_NAMES[value]) return value
  if (ALIASES[value]) return ALIASES[value]
  const base = value.split(/[-_]/)[0].toLowerCase()
  if (ALIASES[base]) return ALIASES[base]
  return LANGUAGE_NAMES[base] ? base : DEFAULT_AI_LOCALE
}

export function aiLanguageName(locale: unknown): string {
  return LANGUAGE_NAMES[normalizeAiLocale(locale)]
}

/** System-prompt section describing the output language. */
export function languageInstruction(locale: unknown): string {
  const fallback = aiLanguageName(locale)
  return `Language:
- Write every output string in the same language the storyteller uses in the source material, preserving the script variant (for example Simplified vs Traditional Chinese).
- If the material is empty, too short or mixed, write in ${fallback}.
- JSON keys stay exactly as specified in English.`
}
