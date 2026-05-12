import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { api } from '@/lib/api'
import type { CardCharacter } from '@/lib/types'
import type {
  DeckBuilderCardWithVariants,
  DeckBuilderEpiphanyVariant,
  DeckBuilderExportPayload,
  DeckBuilderExportSlot,
  DeckBuilderImportedCard,
  DeckBuilderImportedEquipment,
  DeckBuilderItem,
  DeckBuilderItemSlot,
  DeckCardEpiphanySettings,
  DeckCardInstance,
  SquadSlot,
  VariantModalTarget,
} from '../deck-builder.types'
import { SHARED_DECK_BUILDER_CARDS } from '../deck-builder-card-pool.utils'
import { calculateDeckBuilderSlotCost } from '../deck-builder-cost.utils'
import { findDeckBuilderItemById } from '../deck-builder-items.utils'
import {
  createSavedDeck,
  loadSavedDecks,
  persistSavedDecks,
  type SavedDeck,
} from '../deck-builder-saved-decks.utils'
import {
  cloneCardInstance,
  createCardInstanceFromDeckBuilderCard,
  createEmptyEquipment,
  createEmptySlot,
  createInitialSquad,
  findCommonEpiphanyById,
  findDivineEpiphanyById,
  findDivineGodById,
  getDeckCardIdentityKey,
} from '../deck-builder.utils'

const DECK_BUILDER_EXPORT_VERSION = 3
const DECK_BUILDER_MAX_SLOTS = 3

function getDeckBuilderExportFileName() {
  const date = new Date().toISOString().slice(0, 10)

  return `hub-czn-deck-${date}.json`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeVariant(
  variant: DeckBuilderEpiphanyVariant,
): DeckBuilderEpiphanyVariant {
  return {
    variant_id: variant.variant_id,
    level: variant.level,
    name: variant.name,
    cost: variant.cost,
    card_type: variant.card_type ?? '',
    tags: variant.tags ?? [],
    description: variant.description ?? '',
  }
}

function normalizeDeckBuilderCard(
  item: DeckBuilderCardWithVariants,
): DeckBuilderCardWithVariants {
  return {
    ...item,
    description: typeof item.description === 'string'
      ? item.description
      : null,
    variants: (item.variants ?? []).map(variant =>
      normalizeVariant(variant as DeckBuilderEpiphanyVariant),
    ),
    rarity: item.rarity ?? null,
    tags: item.tags ?? [],
  }
}

function getAllDeckBuilderCards(
  startingCards: DeckBuilderCardWithVariants[],
  epiphanyCards: DeckBuilderCardWithVariants[],
  egoSkill: DeckBuilderCardWithVariants | null,
) {
  return [
    ...startingCards,
    ...epiphanyCards,
    ...(egoSkill ? [egoSkill] : []),
    ...SHARED_DECK_BUILDER_CARDS,
  ]
}

function getBaseCardId(cardId: string) {
  return cardId.replace(/_epiphany_\d+$/i, '')
}

function findDeckBuilderCardById(
  cards: DeckBuilderCardWithVariants[],
  cardId: string,
) {
  const baseCardId = getBaseCardId(cardId)

  return cards.find(item =>
    item.card.card_id === cardId ||
    item.card.card_id === baseCardId
  ) ?? null
}

function findVariantById(
  variants: DeckBuilderEpiphanyVariant[],
  variantId: string | null,
) {
  if (!variantId) {
    return null
  }

  return variants.find(variant => variant.variant_id === variantId) ?? null
}

function getLastDeckCardGroupIndex(
  cards: DeckCardInstance[],
  item: DeckCardInstance,
) {
  const itemKey = getDeckCardIdentityKey(item)

  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index]

    if (card && getDeckCardIdentityKey(card) === itemKey) {
      return index
    }
  }

  return -1
}

function insertDeckCardNearGroup(
  cards: DeckCardInstance[],
  item: DeckCardInstance,
) {
  const lastSameGroupIndex = getLastDeckCardGroupIndex(cards, item)

  if (lastSameGroupIndex < 0) {
    return [...cards, item]
  }

  const nextCards = [...cards]
  nextCards.splice(lastSameGroupIndex + 1, 0, item)

  return nextCards
}

function getLastDeckCardGroupInstanceId(
  cards: DeckCardInstance[],
  instanceId: string,
) {
  const target = cards.find(card => card.instanceId === instanceId)

  if (!target) {
    return instanceId
  }

  const targetKey = getDeckCardIdentityKey(target)

  for (let index = cards.length - 1; index >= 0; index -= 1) {
    const card = cards[index]

    if (card && getDeckCardIdentityKey(card) === targetKey) {
      return card.instanceId
    }
  }

  return instanceId
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value
    : null
}

function normalizeImportedCard(value: unknown): DeckBuilderImportedCard | null {
  if (!isRecord(value)) {
    return null
  }

  const cardId = value.card_id

  if (typeof cardId !== 'string' || !cardId.trim()) {
    return null
  }

  return {
    card_id: cardId,
    selected_variant_id: normalizeOptionalString(value.selected_variant_id),
    selected_divine_god: normalizeOptionalString(value.selected_divine_god),
    selected_divine_epiphany_id: normalizeOptionalString(value.selected_divine_epiphany_id),
    selected_common_epiphany_id: normalizeOptionalString(value.selected_common_epiphany_id),
  }
}

function normalizeImportedEquipment(value: unknown): DeckBuilderImportedEquipment {
  if (!isRecord(value)) {
    return {
      weapon_id: null,
      armor_id: null,
      accessory_id: null,
    }
  }

  return {
    weapon_id: typeof value.weapon_id === 'string' ? value.weapon_id : null,
    armor_id: typeof value.armor_id === 'string' ? value.armor_id : null,
    accessory_id: typeof value.accessory_id === 'string' ? value.accessory_id : null,
  }
}

function resolveImportedEquipment(equipment: DeckBuilderImportedEquipment) {
  return {
    weapon: findDeckBuilderItemById(equipment.weapon_id),
    armor: findDeckBuilderItemById(equipment.armor_id),
    accessory: findDeckBuilderItemById(equipment.accessory_id),
  }
}

function normalizeImportedSlot(value: unknown): DeckBuilderExportSlot {
  if (!isRecord(value)) {
    return {
      combatant_id: null,
      equipment: {
        weapon_id: null,
        armor_id: null,
        accessory_id: null,
      },
      cards: [],
    }
  }

  const rawCombatantId = value.combatant_id ?? value.combatantId
  const combatantId = typeof rawCombatantId === 'number'
    ? rawCombatantId
    : null

  const rawCards = Array.isArray(value.cards) ? value.cards : []

  return {
    combatant_id: combatantId,
    equipment: normalizeImportedEquipment(value.equipment),
    cards: rawCards
      .map(normalizeImportedCard)
      .filter((card): card is DeckBuilderImportedCard => card !== null),
  }
}

function normalizeImportedPayload(value: unknown): DeckBuilderExportPayload {
  if (!isRecord(value) || !Array.isArray(value.slots)) {
    throw new Error('Arquivo de deck inválido.')
  }

  return {
    version: typeof value.version === 'number'
      ? value.version
      : DECK_BUILDER_EXPORT_VERSION,
    exported_at: typeof value.exported_at === 'string'
      ? value.exported_at
      : new Date().toISOString(),
    slots: value.slots
      .slice(0, DECK_BUILDER_MAX_SLOTS)
      .map(normalizeImportedSlot),
  }
}

function resolveImportedCardSettings(
  source: DeckBuilderCardWithVariants,
  importedCard: DeckBuilderImportedCard,
): DeckCardEpiphanySettings {
  const selectedVariant = findVariantById(
    source.variants ?? [],
    importedCard.selected_variant_id,
  )

  const selectedDivineEpiphany = findDivineEpiphanyById(
    importedCard.selected_divine_epiphany_id,
  )

  const selectedDivineGod =
    findDivineGodById(importedCard.selected_divine_god) ??
    findDivineGodById(selectedDivineEpiphany?.god)

  const selectedCommonEpiphany = findCommonEpiphanyById(
    importedCard.selected_common_epiphany_id,
  )

  return {
    selectedVariant,
    selectedDivineGod,
    selectedDivineEpiphany,
    selectedCommonEpiphany,
  }
}

export function useDeckBuilder() {
  const [squad, setSquad] = useState<SquadSlot[]>(createInitialSquad)
  const [variantModalTarget, setVariantModalTarget] = useState<VariantModalTarget | null>(null)
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(() => loadSavedDecks())
  const [selectedSavedDeckId, setSelectedSavedDeckId] = useState<string | null>(null)

  const { data: characters = [], isLoading: loadingCharacters } = useQuery<CardCharacter[]>({
    queryKey: ['deck-builder-card-characters'],
    queryFn: () => api.cardCharacters(),
    staleTime: Infinity,
  })

  const slotBuildCosts = squad.map(calculateDeckBuilderSlotCost)

  const totalCards = squad.reduce((sum, slot) => sum + slot.cards.length, 0)

  const totalCost = slotBuildCosts.reduce((sum, item) => sum + item.total, 0)

  const selectedCombatants = squad.filter(slot => slot.combatantId != null).length

  function persistNextSavedDecks(nextSavedDecks: SavedDeck[]) {
    const sortedDecks = [...nextSavedDecks].sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at),
    )

    persistSavedDecks(sortedDecks)
    setSavedDecks(sortedDecks)
  }

  function createDeckBuilderExportPayload(): DeckBuilderExportPayload {
    return {
      version: DECK_BUILDER_EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      slots: squad.map(slot => ({
        combatant_id: slot.combatantId,
        equipment: {
          weapon_id: slot.equipment.weapon?.id ?? null,
          armor_id: slot.equipment.armor?.id ?? null,
          accessory_id: slot.equipment.accessory?.id ?? null,
        },
        cards: slot.cards.map(item => ({
          card_id: item.card.card_id,
          selected_variant_id: item.selectedVariant?.variant_id ?? null,
          selected_divine_god: item.selectedDivineGod?.id ?? null,
          selected_divine_epiphany_id: item.selectedDivineEpiphany?.id ?? null,
          selected_common_epiphany_id: item.selectedCommonEpiphany?.id ?? null,
        })),
      })),
    }
  }

  async function loadDeckFromPayload(value: unknown) {
    const payload = normalizeImportedPayload(value)

    setVariantModalTarget(null)

    const importedSlots = payload.slots.slice(0, DECK_BUILDER_MAX_SLOTS)

    const nextSquad = await Promise.all(
      Array.from({ length: DECK_BUILDER_MAX_SLOTS }, async (_, slotIndex): Promise<SquadSlot> => {
        const importedSlot = importedSlots[slotIndex]

        if (!importedSlot?.combatant_id) {
          return createEmptySlot()
        }

        const importedEquipment = resolveImportedEquipment(importedSlot.equipment)

        try {
          const deckBuilderData = await api.deckBuilderCombatant(importedSlot.combatant_id)

          const startingCards = (deckBuilderData.starting_cards ?? [])
            .map(item => normalizeDeckBuilderCard(item as DeckBuilderCardWithVariants))

          const epiphanyCards = (deckBuilderData.epiphany_cards ?? [])
            .map(item => normalizeDeckBuilderCard(item as DeckBuilderCardWithVariants))

          const egoSkill = deckBuilderData.ego_skill
            ? normalizeDeckBuilderCard(deckBuilderData.ego_skill as DeckBuilderCardWithVariants)
            : null

          const availableCards = getAllDeckBuilderCards(
            startingCards,
            epiphanyCards,
            egoSkill,
          )

          const cards = importedSlot.cards
            .map(importedCard => {
              const source = findDeckBuilderCardById(
                availableCards,
                importedCard.card_id,
              )

              if (!source) {
                return null
              }

              return createCardInstanceFromDeckBuilderCard(
                source,
                resolveImportedCardSettings(source, importedCard),
              )
            })
            .filter((card): card is DeckCardInstance => card !== null)

          return {
            combatantId: importedSlot.combatant_id,
            cards,
            equipment: importedEquipment,
            startingCards,
            epiphanyCards,
            egoSkill,
            isLoading: false,
            error: null,
          }
        } catch (error) {
          return {
            ...createEmptySlot(),
            combatantId: importedSlot.combatant_id,
            equipment: importedEquipment,
            isLoading: false,
            error: error instanceof Error
              ? error.message
              : 'Erro ao importar deck do combatente.',
          }
        }
      }),
    )

    setSquad(nextSquad)
  }

  async function selectCombatant(slotIndex: number, combatantId: number | null) {
    setVariantModalTarget(null)
    setSelectedSavedDeckId(null)

    if (combatantId == null) {
      setSquad(current =>
        current.map((slot, index) => {
          if (index !== slotIndex) return slot

          return createEmptySlot()
        }),
      )

      return
    }

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          combatantId,
          cards: [],
          equipment: createEmptyEquipment(),
          startingCards: [],
          epiphanyCards: [],
          egoSkill: null,
          isLoading: true,
          error: null,
        }
      }),
    )

    try {
      const deckBuilderData = await api.deckBuilderCombatant(combatantId)

      const startingCards = (deckBuilderData.starting_cards ?? [])
        .map(item => normalizeDeckBuilderCard(item as DeckBuilderCardWithVariants))

      const epiphanyCards = (deckBuilderData.epiphany_cards ?? [])
        .map(item => normalizeDeckBuilderCard(item as DeckBuilderCardWithVariants))

      const egoSkill = deckBuilderData.ego_skill
        ? normalizeDeckBuilderCard(deckBuilderData.ego_skill as DeckBuilderCardWithVariants)
        : null

      const cards = startingCards.flatMap(item =>
        Array.from({ length: item.copies }, () => createCardInstanceFromDeckBuilderCard(item)),
      )

      setSquad(current =>
        current.map((slot, index) => {
          if (index !== slotIndex) return slot

          return {
            ...slot,
            combatantId,
            cards,
            equipment: createEmptyEquipment(),
            startingCards,
            epiphanyCards,
            egoSkill,
            isLoading: false,
            error: null,
          }
        }),
      )
    } catch (error) {
      setSquad(current =>
        current.map((slot, index) => {
          if (index !== slotIndex) return slot

          return {
            ...slot,
            combatantId,
            cards: [],
            equipment: createEmptyEquipment(),
            startingCards: [],
            epiphanyCards: [],
            egoSkill: null,
            isLoading: false,
            error: error instanceof Error
              ? error.message
              : 'Erro ao carregar cartas do combatente.',
          }
        }),
      )
    }
  }

  function duplicateCard(slotIndex: number, instanceId: string) {
    setSelectedSavedDeckId(null)

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        const item = slot.cards.find(card => card.instanceId === instanceId)
        if (!item) return slot

        return {
          ...slot,
          cards: insertDeckCardNearGroup(slot.cards, cloneCardInstance(item)),
        }
      }),
    )
  }

  function removeCard(slotIndex: number, instanceId: string) {
    setSelectedSavedDeckId(null)

    const removeInstanceId = getLastDeckCardGroupInstanceId(
      squad[slotIndex]?.cards ?? [],
      instanceId,
    )

    setVariantModalTarget(current => {
      if (current?.type === 'deck' && current.instanceId === removeInstanceId) {
        return null
      }

      return current
    })

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: slot.cards.filter(card => card.instanceId !== removeInstanceId),
        }
      }),
    )
  }

  function addDeckBuilderCard(
    slotIndex: number,
    item: DeckBuilderCardWithVariants,
    settings: Partial<DeckCardEpiphanySettings> = {},
  ) {
    setSelectedSavedDeckId(null)

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        const nextCard = createCardInstanceFromDeckBuilderCard(item, settings)

        return {
          ...slot,
          cards: insertDeckCardNearGroup(slot.cards, nextCard),
        }
      }),
    )
  }

  function selectEquipment(
    slotIndex: number,
    equipmentSlot: DeckBuilderItemSlot,
    item: DeckBuilderItem,
  ) {
    setSelectedSavedDeckId(null)

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          equipment: {
            ...slot.equipment,
            [equipmentSlot]: item,
          },
        }
      }),
    )
  }

  function clearEquipment(
    slotIndex: number,
    equipmentSlot: DeckBuilderItemSlot,
  ) {
    setSelectedSavedDeckId(null)

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          equipment: {
            ...slot.equipment,
            [equipmentSlot]: null,
          },
        }
      }),
    )
  }

  function clearDeck(slotIndex: number) {
    setSelectedSavedDeckId(null)

    setVariantModalTarget(current => {
      if (current?.slotIndex === slotIndex) {
        return null
      }

      return current
    })

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: [],
          equipment: createEmptyEquipment(),
        }
      }),
    )
  }

  function resetBuilder() {
    setVariantModalTarget(null)
    setSelectedSavedDeckId(null)
    setSquad(createInitialSquad())
  }

  function openDeckCardVariants(slotIndex: number, item: DeckCardInstance) {
    setVariantModalTarget({
      type: 'deck',
      slotIndex,
      instanceId: item.instanceId,
      card: item.card,
      description: item.description,
      variants: item.variants,
      selectedVariant: item.selectedVariant,
      selectedDivineGod: item.selectedDivineGod,
      selectedDivineEpiphany: item.selectedDivineEpiphany,
      selectedCommonEpiphany: item.selectedCommonEpiphany,
    })
  }

  function openAvailableCardVariants(slotIndex: number, item: DeckBuilderCardWithVariants) {
    setVariantModalTarget({
      type: 'available',
      slotIndex,
      item,
    })
  }

  function applyEpiphanySettings(settings: DeckCardEpiphanySettings) {
    setSelectedSavedDeckId(null)

    if (!variantModalTarget) return

    if (variantModalTarget.type === 'available') {
      addDeckBuilderCard(variantModalTarget.slotIndex, variantModalTarget.item, settings)
      setVariantModalTarget(null)
      return
    }

    const { slotIndex, instanceId } = variantModalTarget

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: slot.cards.map(item => {
            if (item.instanceId !== instanceId) return item

            return {
              ...item,
              selectedVariant: settings.selectedVariant,
              selectedDivineGod: settings.selectedDivineGod,
              selectedDivineEpiphany: settings.selectedDivineEpiphany,
              selectedCommonEpiphany: settings.selectedCommonEpiphany,
            }
          }),
        }
      }),
    )

    setVariantModalTarget(current => {
      if (!current || current.type !== 'deck') return current

      return {
        ...current,
        selectedVariant: settings.selectedVariant,
        selectedDivineGod: settings.selectedDivineGod,
        selectedDivineEpiphany: settings.selectedDivineEpiphany,
        selectedCommonEpiphany: settings.selectedCommonEpiphany,
      }
    })
  }

  function clearEpiphanySettings() {
    setSelectedSavedDeckId(null)

    if (!variantModalTarget || variantModalTarget.type !== 'deck') return

    const { slotIndex, instanceId } = variantModalTarget

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: slot.cards.map(item => {
            if (item.instanceId !== instanceId) return item

            return {
              ...item,
              selectedVariant: null,
              selectedDivineGod: null,
              selectedDivineEpiphany: null,
              selectedCommonEpiphany: null,
            }
          }),
        }
      }),
    )

    setVariantModalTarget(current => {
      if (!current || current.type !== 'deck') return current

      return {
        ...current,
        selectedVariant: null,
        selectedDivineGod: null,
        selectedDivineEpiphany: null,
        selectedCommonEpiphany: null,
      }
    })
  }

  function closeVariantModal() {
    setVariantModalTarget(null)
  }

  async function exportDeck() {
    const payload = createDeckBuilderExportPayload()

    const filePath = await save({
      defaultPath: getDeckBuilderExportFileName(),
      filters: [
        {
          name: 'JSON',
          extensions: ['json'],
        },
      ],
    })

    if (!filePath) {
      return
    }

    await writeTextFile(filePath, JSON.stringify(payload, null, 2))
  }

  async function importDeck(file: File) {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown

    await loadDeckFromPayload(parsed)
    setSelectedSavedDeckId(null)
  }

  async function loadSavedDeck(deckId: string) {
    const savedDeck = savedDecks.find(deck => deck.id === deckId)

    if (!savedDeck) {
      throw new Error('Deck salvo não encontrado.')
    }

    await loadDeckFromPayload(savedDeck.payload)
    setSelectedSavedDeckId(deckId)
  }

  async function saveCurrentDeck() {
    if (!selectedSavedDeckId) {
      throw new Error('Nenhum deck salvo selecionado.')
    }

    const deckExists = savedDecks.some(deck => deck.id === selectedSavedDeckId)

    if (!deckExists) {
      throw new Error('Deck salvo não encontrado.')
    }

    const payload = createDeckBuilderExportPayload()
    const updatedAt = new Date().toISOString()

    const nextSavedDecks = savedDecks.map(deck => {
      if (deck.id !== selectedSavedDeckId) {
        return deck
      }

      return {
        ...deck,
        updated_at: updatedAt,
        payload,
      }
    })

    persistNextSavedDecks(nextSavedDecks)
  }

  async function saveCurrentDeckAs(name: string) {
    const normalizedName = name.trim()

    if (!normalizedName) {
      throw new Error('Informe um nome para salvar o deck.')
    }

    const payload = createDeckBuilderExportPayload()
    const savedDeck = createSavedDeck(normalizedName, payload)

    persistNextSavedDecks([savedDeck, ...savedDecks])
    setSelectedSavedDeckId(savedDeck.id)
  }

  function deleteSavedDeck(deckId: string) {
    const nextSavedDecks = savedDecks.filter(deck => deck.id !== deckId)

    persistNextSavedDecks(nextSavedDecks)

    if (selectedSavedDeckId === deckId) {
      setSelectedSavedDeckId(null)
    }
  }

  return {
    squad,
    characters,
    isLoading: loadingCharacters,
    totalCards,
    totalCost,
    selectedCombatants,
    slotBuildCosts,
    variantModalTarget,
    savedDecks,
    selectedSavedDeckId,
    selectCombatant,
    duplicateCard,
    removeCard,
    addDeckBuilderCard,
    selectEquipment,
    clearEquipment,
    clearDeck,
    resetBuilder,
    openDeckCardVariants,
    openAvailableCardVariants,
    applyEpiphanySettings,
    clearEpiphanySettings,
    closeVariantModal,
    exportDeck,
    importDeck,
    loadSavedDeck,
    saveCurrentDeck,
    saveCurrentDeckAs,
    deleteSavedDeck,
  }
}
