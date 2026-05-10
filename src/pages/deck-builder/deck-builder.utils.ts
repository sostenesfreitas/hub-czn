import type { CardEntry } from '@/lib/types'
import type {
  DeckBuilderCardWithVariants,
  DeckBuilderEpiphanyVariant,
  DeckCardInstance,
  SquadSlot,
} from './deck-builder.types'

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
): DeckCardInstance {
  return {
    instanceId: `${card.card_id}-${Date.now()}-${Math.random()}`,
    card,
    variants,
    selectedVariant,
  }
}

export function createCardInstanceFromDeckBuilderCard(
  item: DeckBuilderCardWithVariants,
  selectedVariant: DeckBuilderEpiphanyVariant | null = null,
): DeckCardInstance {
  return createCardInstance(item.card, getVariants(item), selectedVariant)
}

export function cloneCardInstance(item: DeckCardInstance): DeckCardInstance {
  return createCardInstance(item.card, item.variants, item.selectedVariant)
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
