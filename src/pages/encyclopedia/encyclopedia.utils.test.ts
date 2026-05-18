import { describe, it, expect } from 'vitest'
import { buildMatcher, linkDescription, resolveLang, localized } from './encyclopedia.utils'
import type { GlossaryEntry } from './encyclopedia.types'

function entry(id: string, aliases: string[]): GlossaryEntry {
  return {
    id,
    term: { en: id, 'pt-BR': id },
    aliases,
    category: 'mechanic',
    definition: { en: 'def', 'pt-BR': 'def' },
    seeAlso: [],
  }
}

describe('buildMatcher / linkDescription', () => {
  it('returns the whole text as one segment when the glossary is empty', () => {
    const segs = linkDescription('Inflict Agony on the target.', buildMatcher([]))
    expect(segs).toEqual([{ kind: 'text', value: 'Inflict Agony on the target.' }])
  })

  it('returns an empty array for empty text', () => {
    expect(linkDescription('', buildMatcher([entry('agony', ['Agony'])]))).toEqual([])
  })

  it('matches a single alias case-insensitively', () => {
    const segs = linkDescription('inflict agony now', buildMatcher([entry('agony', ['Agony'])]))
    expect(segs).toEqual([
      { kind: 'text', value: 'inflict ' },
      { kind: 'term', value: 'agony', termId: 'agony' },
      { kind: 'text', value: ' now' },
    ])
  })

  it('respects word boundaries', () => {
    const m = buildMatcher([entry('agony', ['Agony'])])
    expect(linkDescription('Agonyx', m)).toEqual([{ kind: 'text', value: 'Agonyx' }])
    const trailing = linkDescription('Agony.', m)
    expect(trailing[0]).toEqual({ kind: 'term', value: 'Agony', termId: 'agony' })
    expect(trailing[1]).toEqual({ kind: 'text', value: '.' })
  })

  it('prefers the longest alias on overlap', () => {
    const m = buildMatcher([entry('count', ['Count']), entry('action-count', ['Action Count'])])
    const segs = linkDescription('an Action Count of 1', m)
    expect(segs).toContainEqual({ kind: 'term', value: 'Action Count', termId: 'action-count' })
    expect(segs.some(s => s.kind === 'term' && s.termId === 'count')).toBe(false)
  })

  it('links every occurrence of a term', () => {
    const m = buildMatcher([entry('agony', ['Agony'])])
    const terms = linkDescription('Agony then Agony', m).filter(s => s.kind === 'term')
    expect(terms).toHaveLength(2)
  })

  it('does not auto-link term.en — only explicit aliases', () => {
    const m = buildMatcher([entry('order', [])])
    expect(linkDescription('Order DMG up', m)).toEqual([{ kind: 'text', value: 'Order DMG up' }])
  })
})

describe('resolveLang / localized', () => {
  it('resolveLang maps en to en and everything else to pt-BR', () => {
    expect(resolveLang('en')).toBe('en')
    expect(resolveLang('pt-BR')).toBe('pt-BR')
    expect(resolveLang('xx')).toBe('pt-BR')
  })

  it('localized picks the requested language', () => {
    expect(localized({ en: 'Hello', 'pt-BR': 'Olá' }, 'pt-BR')).toBe('Olá')
  })
})
