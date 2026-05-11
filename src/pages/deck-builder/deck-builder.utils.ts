import type { CardEntry } from '@/lib/types'
import neutralAndMonsterCardsData from './data/deck-builder-neutral-cards.json'
import type {
  DeckBuilderCardWithVariants,
  DeckBuilderEpiphanyVariant,
  DeckCardInstance,
  SquadSlot,
} from './deck-builder.types'

type NeutralMonsterCardData = {
  id: string
  image_id?: string
  name: string
  cost: number | null
  card_type: string
  raw_type?: string
  category: string
  tags?: string[]
  effect_tags?: string[]
  description?: string
  restrictions?: string
  allowed_classes?: string[]
  image_type?: string
  type_icon_path?: string
  image_path?: string
}

const EXTRA_CARD_CATEGORIES = new Set(['neutral', 'monster'])

export function createEmptySlot(): SquadSlot {
  return {
    combatantId: null,
    cards: [],
    startingCards: [],
    epiphanyCards: [],
    egoSkill: null,
    isLoading: false,
    error: null,
  }
}

export function createInitialSquad(): SquadSlot[] {
  return [
    createEmptySlot(),
    createEmptySlot(),
    createEmptySlot(),
  ]
}

export function getVariants(item: DeckBuilderCardWithVariants): DeckBuilderEpiphanyVariant[] {
  return item.variants ?? []
}

export function createCardInstance(
  card: CardEntry,
  variants: DeckBuilderEpiphanyVariant[] = [],
  selectedVariant: DeckBuilderEpiphanyVariant | null = null,
  description: string | null = null,
): DeckCardInstance {
  return {
    instanceId: `${card.card_id}-${Date.now()}-${Math.random()}`,
    card,
    description,
    variants,
    selectedVariant,
  }
}

export function createCardInstanceFromDeckBuilderCard(
  item: DeckBuilderCardWithVariants,
  selectedVariant: DeckBuilderEpiphanyVariant | null = null,
): DeckCardInstance {
  return createCardInstance(
    item.card,
    getVariants(item),
    selectedVariant,
    item.description ?? null,
  )
}

export function cloneCardInstance(item: DeckCardInstance): DeckCardInstance {
  return createCardInstance(
    item.card,
    item.variants,
    item.selectedVariant,
    item.description,
  )
}

export function getInstanceCost(item: DeckCardInstance) {
  return item.selectedVariant?.cost ?? item.card.cost
}

export function getDisplayTypes(
  card: CardEntry,
  selectedVariant?: DeckBuilderEpiphanyVariant | null,
) {
  if (!selectedVariant) {
    return card.effect_types
  }

  const types = [
    selectedVariant.card_type,
    ...(selectedVariant.tags ?? []),
  ].filter(Boolean)

  return Array.from(new Set(types))
}

function getExtraCardEffectTypes(card: NeutralMonsterCardData) {
  const types = [
    card.card_type,
    ...(card.effect_tags ?? []),
  ].filter(Boolean)

  return Array.from(new Set(types))
}

function normalizeExtraCardCategory(category: string): 'neutral' | 'monster' {
  return category.toLowerCase() === 'monster'
    ? 'monster'
    : 'neutral'
}

function createExtraDeckBuilderCard(card: NeutralMonsterCardData): DeckBuilderCardWithVariants {
  const category = normalizeExtraCardCategory(card.category)

  return {
    card: {
      card_id: card.image_id || card.id,
      char_res_id: null,
      name: card.name,
      cost: card.cost ?? 0,
      eff_value: 0,
      hits: 0,
      spark_count: 0,
      effect_types: getExtraCardEffectTypes(card),
    },
    copies: 1,
    group: category,
    description: card.description ?? null,
    variants: [],
  }
}

export function getNeutralAndMonsterDeckBuilderCards(): DeckBuilderCardWithVariants[] {
  return (neutralAndMonsterCardsData as NeutralMonsterCardData[])
    .filter(card => EXTRA_CARD_CATEGORIES.has(card.category.toLowerCase()))
    .map(createExtraDeckBuilderCard)
}