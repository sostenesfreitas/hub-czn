import type { CardEntry } from '@/lib/types'
import commonEpiphaniesData from './data/deck-builder-common-epiphanies.json'
import divineEpiphaniesData from './data/deck-builder-divine-epiphanies.json'
import {
  createEmptyPersonaEngravingSelection,
  getPersonaEngravingSelectionImagePath,
  getPersonaEngravingSelectionSlots,
  getPersonaEngravingSelectionSummary,
} from './deck-builder-persona-engraving.utils'
import type {
  DeckBuilderCardGroup,
  DeckBuilderCardWithVariants,
  DeckBuilderCommonEpiphany,
  DeckBuilderDivineEpiphany,
  DeckBuilderDivineGod,
  DeckBuilderDivineGodId,
  DeckBuilderEpiphanyVariant,
  DeckBuilderEquipment,
  DeckBuilderPersonaEngravingSelection,
  DeckCardEpiphanySettings,
  DeckCardInstance,
  SquadSlot,
} from './deck-builder.types'


export const DECK_BUILDER_PERSONA_IMAGE_OVERRIDE_FIELD = '__deckBuilderPersonaImagePath'

type CardEntryWithPersonaImageOverride = CardEntry & {
  [DECK_BUILDER_PERSONA_IMAGE_OVERRIDE_FIELD]?: string | null
}

export function applyPersonaEngravingImageOverride(
  card: CardEntry,
  selectedPersonaEngravings: DeckBuilderPersonaEngravingSelection,
): CardEntry {
  const imagePath = getPersonaEngravingSelectionImagePath(selectedPersonaEngravings)
  const nextCard = { ...card } as CardEntryWithPersonaImageOverride

  if (imagePath) {
    nextCard[DECK_BUILDER_PERSONA_IMAGE_OVERRIDE_FIELD] = imagePath
  } else {
    delete nextCard[DECK_BUILDER_PERSONA_IMAGE_OVERRIDE_FIELD]
  }

  return nextCard
}

export const DECK_BUILDER_DIVINE_GODS: DeckBuilderDivineGod[] = [
  {
    id: 'Nihilum',
    name: 'Nihilum',
    displayName: 'Nihilum',
  },
  {
    id: 'Secred',
    name: 'Secred',
    displayName: 'Secred',
  },
  {
    id: 'Vitor',
    name: 'Vitor',
    displayName: 'Vitor',
  },
  {
    id: 'Caligo',
    name: 'Caligo',
    displayName: 'Caligo',
  },
  {
    id: 'Circen',
    name: 'Circen',
    displayName: 'Circen',
  },
  {
    id: 'Diallos',
    name: 'Diallos',
    displayName: 'Diallos',
  },
]

export const DECK_BUILDER_DIVINE_EPIPHANIES =
  divineEpiphaniesData as DeckBuilderDivineEpiphany[]

export const DECK_BUILDER_COMMON_EPIPHANIES =
  commonEpiphaniesData as DeckBuilderCommonEpiphany[]

export function createEmptyEquipment(): DeckBuilderEquipment {
  return {
    weapon: null,
    armor: null,
    accessory: null,
  }
}

export function createEmptySlot(): SquadSlot {
  return {
    combatantId: null,
    cards: [],
    equipment: createEmptyEquipment(),
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

export function createEmptyEpiphanySettings(): DeckCardEpiphanySettings {
  return {
    selectedVariant: null,
    selectedDivineGod: null,
    selectedDivineEpiphany: null,
    selectedCommonEpiphany: null,
    selectedPersonaEngravings: createEmptyPersonaEngravingSelection(),
  }
}

export function createCardInstance(
  card: CardEntry,
  variants: DeckBuilderEpiphanyVariant[] = [],
  selectedVariant: DeckBuilderEpiphanyVariant | null = null,
  description: string | null = null,
  selectedDivineGod: DeckBuilderDivineGod | null = null,
  selectedDivineEpiphany: DeckBuilderDivineEpiphany | null = null,
  selectedCommonEpiphany: DeckBuilderCommonEpiphany | null = null,
  group: DeckBuilderCardGroup = 'starting',
  rarity: string | null = null,
  tags: string[] = [],
  selectedPersonaEngravings: DeckBuilderPersonaEngravingSelection = createEmptyPersonaEngravingSelection(),
): DeckCardInstance {
  return {
    instanceId: `${card.card_id}-${Date.now()}-${Math.random()}`,
    card: applyPersonaEngravingImageOverride(card, selectedPersonaEngravings),
    description,
    variants,
    selectedVariant,
    selectedDivineGod,
    selectedDivineEpiphany,
    selectedCommonEpiphany,
    selectedPersonaEngravings,
    group,
    rarity,
    tags,
  }
}

export function createCardInstanceFromDeckBuilderCard(
  item: DeckBuilderCardWithVariants,
  settings: Partial<DeckCardEpiphanySettings> = {},
): DeckCardInstance {
  return createCardInstance(
    item.card,
    getVariants(item),
    settings.selectedVariant ?? null,
    item.description ?? null,
    settings.selectedDivineGod ?? null,
    settings.selectedDivineEpiphany ?? null,
    settings.selectedCommonEpiphany ?? null,
    item.group,
    item.rarity ?? null,
    item.tags ?? [],
    settings.selectedPersonaEngravings ?? createEmptyPersonaEngravingSelection(),
  )
}

export function cloneCardInstance(item: DeckCardInstance): DeckCardInstance {
  return createCardInstance(
    item.card,
    item.variants,
    item.selectedVariant,
    item.description,
    item.selectedDivineGod,
    item.selectedDivineEpiphany,
    item.selectedCommonEpiphany,
    item.group,
    item.rarity,
    item.tags,
    item.selectedPersonaEngravings,
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

export function canUseDeckBuilderEpiphanies(card: CardEntry) {
  return card.spark_count > 0
}

function normalizeComparable(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, '')
}

function hasAnyMatch(source: string[], target: string[]) {
  if (source.length === 0) {
    return true
  }

  if (target.length === 0) {
    return true
  }

  const normalizedTarget = new Set(target.map(normalizeComparable))

  return source.some(value => normalizedTarget.has(normalizeComparable(value)))
}

function getCostLevel(cost: number) {
  if (cost >= 4) {
    return '4+'
  }

  return String(Math.max(0, cost))
}

function matchesEpiphanyLevels(levels: string[], cost: number) {
  if (levels.length === 0) {
    return true
  }

  const costLevel = getCostLevel(cost)
  const normalizedCostLevel = normalizeComparable(costLevel)

  return levels.some(level => normalizeComparable(level) === normalizedCostLevel)
}

function matchesCardTypes(card: CardEntry, epiphanyCardTypes: string[]) {
  if (epiphanyCardTypes.length === 0) {
    return true
  }

  return hasAnyMatch(epiphanyCardTypes, card.effect_types)
}

function sortEpiphaniesByDescription<T extends { description: string; rarity: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const rarityComparison = left.rarity.localeCompare(right.rarity)

    if (rarityComparison !== 0) {
      return rarityComparison
    }

    return left.description.localeCompare(right.description)
  })
}

export function findDivineGodById(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const normalizedValue = normalizeComparable(value)

  return DECK_BUILDER_DIVINE_GODS.find(god =>
    normalizeComparable(god.id) === normalizedValue ||
    normalizeComparable(god.name) === normalizedValue ||
    normalizeComparable(god.displayName) === normalizedValue
  ) ?? null
}

export function findDivineEpiphanyById(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return DECK_BUILDER_DIVINE_EPIPHANIES.find(item => item.id === value) ?? null
}

export function findCommonEpiphanyById(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return DECK_BUILDER_COMMON_EPIPHANIES.find(item => item.id === value) ?? null
}

export function filterDivineEpiphanies(
  card: CardEntry,
  selectedGod: DeckBuilderDivineGod | null,
  cost: number,
) {
  const selectedGodKey = selectedGod ? normalizeComparable(selectedGod.id) : null

  const filtered = DECK_BUILDER_DIVINE_EPIPHANIES.filter(item => {
    const matchesGod = selectedGodKey
      ? normalizeComparable(item.god) === selectedGodKey ||
        normalizeComparable(item.display_god) === selectedGodKey
      : true

    return (
      matchesGod &&
      matchesCardTypes(card, item.card_types) &&
      matchesEpiphanyLevels(item.levels, cost)
    )
  })

  return sortEpiphaniesByDescription(filtered)
}

export function filterCommonEpiphanies(
  card: CardEntry,
  cost: number,
) {
  const filtered = DECK_BUILDER_COMMON_EPIPHANIES.filter(item =>
    matchesCardTypes(card, item.card_types) &&
    matchesEpiphanyLevels(item.levels, cost)
  )

  return sortEpiphaniesByDescription(filtered)
}

export function getDeckCardIdentityKey(item: DeckCardInstance) {
  return [
    item.card.card_id,
    item.selectedVariant?.variant_id ?? 'base',
    item.selectedDivineGod?.id ?? 'no-god',
    item.selectedDivineEpiphany?.id ?? 'no-divine',
    item.selectedCommonEpiphany?.id ?? 'no-common',
    item.selectedPersonaEngravings.slot1?.engraving_id ?? 'no-persona-slot-1',
    item.selectedPersonaEngravings.slot2?.engraving_id ?? 'no-persona-slot-2',
  ].join('::')
}

export function getDeckCardAppliedEpiphanyCount(item: DeckCardInstance) {
  return [
    item.selectedVariant,
    item.selectedDivineEpiphany,
    item.selectedCommonEpiphany,
    ...getPersonaEngravingSelectionSlots(item.selectedPersonaEngravings),
  ].filter(Boolean).length
}

export function getDeckCardEpiphanySummary(item: DeckCardInstance) {
  const labels = [
    item.selectedDivineGod?.displayName,
    item.selectedDivineEpiphany?.description,
    item.selectedCommonEpiphany?.description,
    getPersonaEngravingSelectionSummary(item.selectedPersonaEngravings),
  ].filter(Boolean)

  return labels.join(' • ')
}

export function normalizeDivineGodId(value: string | null): DeckBuilderDivineGodId | null {
  return findDivineGodById(value)?.id ?? null
}
