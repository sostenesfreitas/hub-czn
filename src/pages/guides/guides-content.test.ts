import { describe, it, expect } from 'vitest'
import { GUIDES } from './guides-content'
import type { LocalizedText } from './guides.types'

function expectLocalized(t: LocalizedText, ctx: string) {
  expect(t.en?.trim(), `${ctx}.en`).not.toBe('')
  expect(t['pt-BR']?.trim(), `${ctx}.pt-BR`).not.toBe('')
}

describe('guides content', () => {
  it('has at least the Tenebria guide', () => {
    expect(GUIDES.some(g => g.charResId === 1069)).toBe(true)
  })

  it('every section title and every block has both languages', () => {
    for (const guide of GUIDES) {
      for (const section of guide.sections) {
        expectLocalized(section.title, `${guide.name}/${section.id}/title`)
        for (const [i, block] of section.blocks.entries()) {
          const ctx = `${guide.name}/${section.id}/block[${i}]`
          if (block.type === 'prose') expectLocalized(block.body, `${ctx}.body`)
          if (block.type === 'card-list') {
            if (block.intro) expectLocalized(block.intro, `${ctx}.intro`)
            for (const it of block.items) {
              expect(it.cardId, `${ctx}.cardId`).toMatch(/^c_\d+_/)
              expectLocalized(it.note, `${ctx}.note`)
            }
          }
        }
      }
    }
  })

  it('has unique section ids per guide', () => {
    for (const guide of GUIDES) {
      const ids = guide.sections.map(s => s.id)
      expect(new Set(ids).size, guide.name).toBe(ids.length)
    }
  })
})
