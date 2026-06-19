import type { Lang, LocalizedText } from './guides.types'

/** Maps an i18next language code to one of the two supported content languages. */
export function resolveLang(lng: string): Lang {
  return lng === 'en' ? 'en' : 'pt-BR'
}

/** Picks the localized string for the given language. */
export function localized(text: LocalizedText, lang: Lang): string {
  return text[lang]
}
