import { describe, it, expect } from 'vitest'
import { GLOSSARY, CLARIFICATIONS, glossaryById } from './encyclopedia-content'
import { DECK_BUILDER_ITEMS } from '@/pages/deck-builder/deck-builder-items.utils'
import { DECK_BUILDER_PERSONA_ENGRAVING_CARDS } from '@/pages/deck-builder/deck-builder-persona-engraving.utils'

const engravingIds = new Set(
  DECK_BUILDER_PERSONA_ENGRAVING_CARDS.flatMap(card =>
    card.engravings.map(e => e.engraving_id),
  ),
)
const equipmentIds = new Set(DECK_BUILDER_ITEMS.map(i => i.id))

describe('glossary content', () => {
  it('has unique ids', () => {
    expect(new Set(GLOSSARY.map(e => e.id)).size).toBe(GLOSSARY.length)
  })

  it('has non-empty en and pt-BR text for every entry', () => {
    for (const e of GLOSSARY) {
      expect(e.term.en.trim(), e.id).not.toBe('')
      expect(e.term['pt-BR'].trim(), e.id).not.toBe('')
      expect(e.definition.en.trim(), e.id).not.toBe('')
      expect(e.definition['pt-BR'].trim(), e.id).not.toBe('')
    }
  })

  it('has seeAlso ids that all resolve', () => {
    for (const e of GLOSSARY) {
      for (const ref of e.seeAlso) {
        expect(glossaryById.has(ref), `${e.id} -> ${ref}`).toBe(true)
      }
    }
  })
})

describe('clarification content', () => {
  it('has non-empty en and pt-BR text for every entry', () => {
    for (const c of CLARIFICATIONS) {
      expect(c.text.en.trim(), c.refId).not.toBe('')
      expect(c.text['pt-BR'].trim(), c.refId).not.toBe('')
    }
  })

  it('has refIds that resolve to a real entry of the declared kind', () => {
    for (const c of CLARIFICATIONS) {
      if (c.kind === 'equipment') {
        expect(equipmentIds.has(c.refId), c.refId).toBe(true)
      } else if (c.kind === 'engraving') {
        expect(engravingIds.has(c.refId), c.refId).toBe(true)
      }
    }
  })
})
