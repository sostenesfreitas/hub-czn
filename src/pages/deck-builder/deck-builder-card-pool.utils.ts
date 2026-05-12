import neutralAndMonsterCardsData from './data/deck-builder-neutral-cards.json'
import type { DeckBuilderCardWithVariants } from './deck-builder.types'

type GeneratedDeckBuilderCard = {
  id: string
  name: string
  cost: number | null
  card_type: string
  category: 'neutral' | 'monster' | string
  rarity?: string | null
  tags?: string[]
  effect_tags?: string[]
  description?: string | null
}

function normalizeEffectTypes(item: GeneratedDeckBuilderCard) {
  return Array.from(new Set([
    item.card_type,
    ...(item.effect_tags ?? []),
  ].filter(Boolean)))
}

function normalizeGeneratedCard(item: GeneratedDeckBuilderCard): DeckBuilderCardWithVariants {
  return {
    card: {
      card_id: item.id,
      char_res_id: null,
      name: item.name,
      cost: typeof item.cost === 'number' ? item.cost : 0,
      eff_value: 0,
      hits: 0,
      spark_count: 0,
      effect_types: normalizeEffectTypes(item),
    },
    copies: 0,
    group: item.category === 'monster' ? 'monster' : 'neutral',
    description: item.description ?? null,
    variants: [],
    rarity: item.rarity ?? null,
    tags: item.tags ?? [],
  }
}

export const SHARED_DECK_BUILDER_CARDS: DeckBuilderCardWithVariants[] =
  (neutralAndMonsterCardsData as GeneratedDeckBuilderCard[]).map(normalizeGeneratedCard)