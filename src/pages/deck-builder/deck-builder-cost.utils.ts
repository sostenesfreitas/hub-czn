import type {
  DeckCardInstance,
  SquadSlot,
} from './deck-builder.types'

export const DECK_BUILDER_SLOT_COST_LIMIT = 180
export const DECK_BUILDER_SQUAD_COST_LIMIT = DECK_BUILDER_SLOT_COST_LIMIT * 3

export const DECK_BUILDER_COST_RULES = {
  removedStartingCard: 20,
  thirdCopy: 40,
  divineEpiphany: 20,
  neutralCard: 20,
  forbiddenCard: 20,
  monsterCommon: 20,
  monsterRare: 50,
  monsterLegendary: 80,
  refinement: 10,
  hammer: 10,
  personaCard: 20,
} as const

export type DeckBuilderSlotCostBreakdown = {
  removedStartingCards: number
  thirdCopies: number
  divineEpiphanies: number
  neutralCards: number
  forbiddenCards: number
  monsterCommonCards: number
  monsterRareCards: number
  monsterLegendaryCards: number
  total: number
  limit: number
  isOverLimit: boolean
}

function normalizeComparable(value: string) {
  return value.trim().toLowerCase()
}

function normalizeCardId(cardId: string) {
  return cardId.replace(/_epiphany_\d+$/i, '')
}

function getCardIdentityForCopyCost(item: DeckCardInstance) {
  return normalizeCardId(item.card.card_id)
}

function hasTag(item: DeckCardInstance, tag: string) {
  const normalizedTag = normalizeComparable(tag)

  return [
    ...item.tags,
    ...item.card.effect_types,
  ].some(value => normalizeComparable(value) === normalizedTag)
}

function getMonsterCardCost(item: DeckCardInstance) {
  const rarity = normalizeComparable(item.rarity ?? 'common')

  switch (rarity) {
    case 'legendary':
      return DECK_BUILDER_COST_RULES.monsterLegendary
    case 'rare':
      return DECK_BUILDER_COST_RULES.monsterRare
    case 'common':
    default:
      return DECK_BUILDER_COST_RULES.monsterCommon
  }
}

function countCurrentCardsById(cards: DeckCardInstance[]) {
  const counts = new Map<string, number>()

  for (const item of cards) {
    const cardId = normalizeCardId(item.card.card_id)
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
  }

  return counts
}

function calculateRemovedStartingCardsCost(slot: SquadSlot) {
  const currentCardsById = countCurrentCardsById(slot.cards)

  return slot.startingCards.reduce((total, item) => {
    const cardId = normalizeCardId(item.card.card_id)
    const expectedCopies = Math.max(0, item.copies)
    const currentCopies = currentCardsById.get(cardId) ?? 0
    const removedCopies = Math.max(0, expectedCopies - currentCopies)

    return total + (removedCopies * DECK_BUILDER_COST_RULES.removedStartingCard)
  }, 0)
}

function calculateThirdCopiesCost(cards: DeckCardInstance[]) {
  const counts = new Map<string, number>()

  for (const item of cards) {
    const cardId = getCardIdentityForCopyCost(item)
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
  }

  return Array.from(counts.values()).reduce((total, count) => {
    if (count >= 3) {
      return total + DECK_BUILDER_COST_RULES.thirdCopy
    }

    return total
  }, 0)
}

export function calculateDeckBuilderSlotCost(slot: SquadSlot): DeckBuilderSlotCostBreakdown {
  const removedStartingCards = calculateRemovedStartingCardsCost(slot)
  const thirdCopies = calculateThirdCopiesCost(slot.cards)

  const divineEpiphanies = slot.cards.reduce((total, item) => (
    total + (item.selectedDivineEpiphany ? DECK_BUILDER_COST_RULES.divineEpiphany : 0)
  ), 0)

  const forbiddenCards = slot.cards.reduce((total, item) => {
    if (hasTag(item, 'forbidden')) {
      return total + DECK_BUILDER_COST_RULES.forbiddenCard
    }

    return total
  }, 0)

  const neutralCards = slot.cards.reduce((total, item) => {
    if (item.group === 'neutral' && !hasTag(item, 'forbidden')) {
      return total + DECK_BUILDER_COST_RULES.neutralCard
    }

    return total
  }, 0)

  const monsterCommonCards = slot.cards.reduce((total, item) => {
    if (item.group === 'monster' && normalizeComparable(item.rarity ?? 'common') === 'common') {
      return total + getMonsterCardCost(item)
    }

    return total
  }, 0)

  const monsterRareCards = slot.cards.reduce((total, item) => {
    if (item.group === 'monster' && normalizeComparable(item.rarity ?? '') === 'rare') {
      return total + getMonsterCardCost(item)
    }

    return total
  }, 0)

  const monsterLegendaryCards = slot.cards.reduce((total, item) => {
    if (item.group === 'monster' && normalizeComparable(item.rarity ?? '') === 'legendary') {
      return total + getMonsterCardCost(item)
    }

    return total
  }, 0)

  const total =
    removedStartingCards +
    thirdCopies +
    divineEpiphanies +
    forbiddenCards +
    neutralCards +
    monsterCommonCards +
    monsterRareCards +
    monsterLegendaryCards

  return {
    removedStartingCards,
    thirdCopies,
    divineEpiphanies,
    neutralCards,
    forbiddenCards,
    monsterCommonCards,
    monsterRareCards,
    monsterLegendaryCards,
    total,
    limit: DECK_BUILDER_SLOT_COST_LIMIT,
    isOverLimit: total > DECK_BUILDER_SLOT_COST_LIMIT,
  }
}