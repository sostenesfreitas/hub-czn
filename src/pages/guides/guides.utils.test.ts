import { describe, it, expect } from 'vitest'
import { resolveLang, localized } from './guides.utils'

describe('resolveLang', () => {
  it('returns en only for en', () => {
    expect(resolveLang('en')).toBe('en')
  })
  it('returns pt-BR for pt-BR and anything else', () => {
    expect(resolveLang('pt-BR')).toBe('pt-BR')
    expect(resolveLang('es')).toBe('pt-BR')
  })
})

describe('localized', () => {
  it('picks the string for the given language', () => {
    const t = { en: 'Hello', 'pt-BR': 'Olá' }
    expect(localized(t, 'en')).toBe('Hello')
    expect(localized(t, 'pt-BR')).toBe('Olá')
  })
})
