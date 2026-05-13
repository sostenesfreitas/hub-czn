import type { CardEntry } from '@/lib/types'
import personaEngravingsData from './data/deck-builder-persona-engravings.json'
import type {
  DeckBuilderEpiphanyVariant,
  DeckBuilderPersonaCardType,
  DeckBuilderPersonaEidolon,
  DeckBuilderPersonaEngraving,
  DeckBuilderPersonaEngravingCard,
  DeckBuilderPersonaEngravingSelection,
  DeckBuilderPersonaImageKey,
} from './deck-builder.types'

export const DECK_BUILDER_PERSONA_ENGRAVING_CARDS =
  personaEngravingsData as DeckBuilderPersonaEngravingCard[]

export const DECK_BUILDER_PERSONA_CARD =
  DECK_BUILDER_PERSONA_ENGRAVING_CARDS[0] ?? null

export function createEmptyPersonaEngravingSelection(): DeckBuilderPersonaEngravingSelection {
  return {
    slot1: null,
    slot2: null,
  }
}

function normalizeComparable(value: string | number | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, '')
}

function normalizeSearchText(value: string | number | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeCardType(value: string | null | undefined): DeckBuilderPersonaCardType | null {
  const normalized = normalizeComparable(value)

  if (normalized === 'attack' || normalized === 'dmg' || normalized === 'damage') {
    return 'Attack'
  }

  if (
    normalized === 'skill' ||
    normalized === 'draw' ||
    normalized === 'get' ||
    normalized === 'buff' ||
    normalized === 'cost' ||
    normalized === 'discard' ||
    normalized === 'exhaust'
  ) {
    return 'Skill'
  }

  return null
}

export function isPersonaDeckBuilderCard(card: {
  card_id?: string | null
  name?: string | null
  effect_types?: string[] | null
}) {
  if (normalizeComparable(card.card_id) === normalizeComparable(DECK_BUILDER_PERSONA_CARD?.id)) {
    return true
  }

  if (normalizeComparable(card.name) === 'persona') {
    return true
  }

  return (card.effect_types ?? []).some(type => normalizeComparable(type) === 'persona')
}

export function resolvePersonaEngravingCardType(
  card: CardEntry,
  selectedVariant: DeckBuilderEpiphanyVariant | null,
) {
  const currentTypes = [
    selectedVariant?.card_type,
    ...(selectedVariant?.tags ?? []),
    ...(selectedVariant ? [] : card.effect_types),
  ]

  for (const type of currentTypes) {
    const normalizedType = normalizeCardType(type ?? null)

    if (normalizedType) {
      return normalizedType
    }
  }

  return null
}

export function findPersonaEngravingById(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return DECK_BUILDER_PERSONA_CARD?.engravings.find(
    item => item.engraving_id === value,
  ) ?? null
}

function matchesSearch(item: DeckBuilderPersonaEngraving, searchText: string) {
  const normalizedSearch = normalizeSearchText(searchText)

  if (!normalizedSearch) {
    return true
  }

  const searchableText = [
    item.eidolon,
    item.card_type,
    item.description,
    ...item.modifiers,
    ...item.allowed_classes,
    ...item.tags,
  ]
    .map(normalizeSearchText)
    .join(' ')

  return searchableText.includes(normalizedSearch)
}

function matchesCardType(
  item: DeckBuilderPersonaEngraving,
  cardType: DeckBuilderPersonaCardType | null,
) {
  if (!cardType) {
    return true
  }

  return normalizeComparable(item.card_type) === normalizeComparable(cardType)
}

function matchesCombatantClass(
  item: DeckBuilderPersonaEngraving,
  combatantClass: string | null | undefined,
) {
  if (!combatantClass) {
    return true
  }

  const allowedClasses = item.allowed_classes ?? []

  if (allowedClasses.length === 0) {
    return true
  }

  const normalizedCombatantClass = normalizeComparable(combatantClass)

  return allowedClasses.some(
    allowedClass => normalizeComparable(allowedClass) === normalizedCombatantClass,
  )
}

export function filterPersonaEngravings({
  cardType,
  combatantClass,
  searchText,
  matchCurrentCard,
}: {
  cardType: DeckBuilderPersonaCardType | null
  combatantClass: string | null | undefined
  searchText: string
  matchCurrentCard: boolean
}) {
  const items = DECK_BUILDER_PERSONA_CARD?.engravings ?? []

  return items.filter(item => {
    if (!matchesSearch(item, searchText)) {
      return false
    }

    if (!matchCurrentCard) {
      return true
    }

    return (
      matchesCardType(item, cardType) &&
      matchesCombatantClass(item, combatantClass)
    )
  })
}

export function getPersonaEngravingSelectionSlots(
  selection: DeckBuilderPersonaEngravingSelection,
) {
  return [selection.slot1, selection.slot2].filter(
    (item): item is DeckBuilderPersonaEngraving => item !== null,
  )
}

export function getPersonaEngravingSelectionImageKey(
  selection: DeckBuilderPersonaEngravingSelection,
): DeckBuilderPersonaImageKey | null {
  const selectedEngravings = getPersonaEngravingSelectionSlots(selection)
  const luxCount = selectedEngravings.filter(
    item => normalizeComparable(item.eidolon) === 'lux',
  ).length
  const umbraCount = selectedEngravings.filter(
    item => normalizeComparable(item.eidolon) === 'umbra',
  ).length

  if (selectedEngravings.length === 0) {
    return null
  }

  if (luxCount >= 2) {
    return 'all_lux'
  }

  if (umbraCount >= 2) {
    return 'all_umbra'
  }

  if (luxCount === 1 && umbraCount === 1) {
    return 'lux_and_umbra'
  }

  if (luxCount === 1) {
    return 'half_lux'
  }

  if (umbraCount === 1) {
    return 'half_umbra'
  }

  return null
}

export function getPersonaEngravingSelectionImagePath(
  selection: DeckBuilderPersonaEngravingSelection,
) {
  const imageKey = getPersonaEngravingSelectionImageKey(selection)

  if (!imageKey) {
    return null
  }

  return DECK_BUILDER_PERSONA_CARD?.persona_image_paths[imageKey] ?? null
}

export function getPersonaEngravingSelectionSummary(
  selection: DeckBuilderPersonaEngravingSelection,
) {
  return getPersonaEngravingSelectionSlots(selection)
    .map(item => `${item.eidolon}: ${item.description}`)
    .join(' • ')
}

export function getPersonaEngravingSelectionDescriptions(
  selection: DeckBuilderPersonaEngravingSelection,
) {
  return getPersonaEngravingSelectionSlots(selection).map(item => item.description)
}

export function getPersonaEngravingIds(
  selection: DeckBuilderPersonaEngravingSelection,
): [string | null, string | null] {
  return [
    selection.slot1?.engraving_id ?? null,
    selection.slot2?.engraving_id ?? null,
  ]
}

export function createPersonaEngravingSelectionFromIds(
  ids: readonly (string | null | undefined)[],
): DeckBuilderPersonaEngravingSelection {
  return {
    slot1: findPersonaEngravingById(ids[0]) ?? null,
    slot2: findPersonaEngravingById(ids[1]) ?? null,
  }
}

export function normalizePersonaEidolon(value: string | null | undefined): DeckBuilderPersonaEidolon | null {
  const normalizedValue = normalizeComparable(value)

  if (normalizedValue === 'lux') {
    return 'Lux'
  }

  if (normalizedValue === 'umbra') {
    return 'Umbra'
  }

  return null
}
