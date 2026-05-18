import { describe, it, expect } from 'vitest'
import {
  GLOSSARY,
  CLARIFICATIONS,
  glossaryById,
  matcher,
  findClarification,
} from './encyclopedia-content'
import { linkDescription } from './encyclopedia.utils'
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

  it('matcher resolves at least one known alias', () => {
    const segs = linkDescription('Agony', matcher)
    expect(segs).toContainEqual({ kind: 'term', value: 'Agony', termId: 'agony' })
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
      // kind === 'card' is intentionally not validated: card ids come from the
      // API at runtime, so there is no offline registry to check against.
    }
  })

  it('findClarification returns the entry for a known key and undefined otherwise', () => {
    expect(findClarification('equipment', 'item_0003')).toBeDefined()
    expect(findClarification('equipment', 'no-such-id')).toBeUndefined()
  })
})
