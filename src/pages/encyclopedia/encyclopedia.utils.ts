import type {
  DescriptionSegment,
  GlossaryEntry,
  Lang,
  LocalizedText,
  Matcher,
} from './encyclopedia.types'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Builds a matcher from the glossary. Only explicit `aliases` are linkable. */
export function buildMatcher(glossary: GlossaryEntry[]): Matcher {
  const aliasToTermId = new Map<string, string>()
  const aliases: string[] = []

  for (const entry of glossary) {
    for (const alias of entry.aliases) {
      const key = alias.toLowerCase()
      if (!aliasToTermId.has(key)) {
        aliasToTermId.set(key, entry.id)
        aliases.push(alias)
      }
    }
  }

  // Longest first so regex alternation prefers multi-word aliases.
  aliases.sort((a, b) => b.length - a.length)

  // `(?!)` never matches — used when there is nothing to link.
  const regex =
    aliases.length === 0
      ? /(?!)/g
      : new RegExp(`(?<![\\w])(${aliases.map(escapeRegExp).join('|')})(?![\\w])`, 'gi')

  return { regex, aliasToTermId }
}

/** Splits `text` into plain-text and glossary-term segments. */
export function linkDescription(text: string, matcher: Matcher): DescriptionSegment[] {
  if (!text) return []

  const segments: DescriptionSegment[] = []
  let last = 0
  matcher.regex.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = matcher.regex.exec(text)) !== null) {
    const value = match[0]
    if (value.length === 0) {
      matcher.regex.lastIndex++
      continue
    }
    if (match.index > last) {
      segments.push({ kind: 'text', value: text.slice(last, match.index) })
    }
    const termId = matcher.aliasToTermId.get(value.toLowerCase())
    segments.push(termId ? { kind: 'term', value, termId } : { kind: 'text', value })
    last = match.index + value.length
  }

  if (last < text.length) {
    segments.push({ kind: 'text', value: text.slice(last) })
  }
  return segments
}

/** Maps an i18next language code to one of the two supported content languages. */
export function resolveLang(lng: string): Lang {
  return lng === 'en' ? 'en' : 'pt-BR'
}

/** Picks the localized string for the given language. */
export function localized(text: LocalizedText, lang: Lang): string {
  return text[lang]
}
