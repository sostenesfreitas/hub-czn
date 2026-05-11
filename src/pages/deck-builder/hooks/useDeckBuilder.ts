import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CardCharacter } from '@/lib/types'
import type {
  DeckBuilderCardWithVariants,
  DeckBuilderEpiphanyVariant,
  DeckBuilderExportPayload,
  DeckBuilderExportSlot,
  DeckBuilderImportedCard,
  DeckCardInstance,
  SquadSlot,
  VariantModalTarget,
} from '../deck-builder.types'
import {
  cloneCardInstance,
  createCardInstanceFromDeckBuilderCard,
  createEmptySlot,
  createInitialSquad,
  getInstanceCost,
} from '../deck-builder.utils'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

const DECK_BUILDER_EXPORT_VERSION = 1
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
    variants: (item.variants ?? []).map(variant =>
      normalizeVariant(variant as DeckBuilderEpiphanyVariant),
    ),
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

function normalizeImportedCard(value: unknown): DeckBuilderImportedCard | null {
  if (!isRecord(value)) {
    return null
  }

  const cardId = value.card_id

  if (typeof cardId !== 'string' || !cardId.trim()) {
    return null
  }

  const selectedVariantId = value.selected_variant_id

  return {
    card_id: cardId,
    selected_variant_id: typeof selectedVariantId === 'string'
      ? selectedVariantId
      : null,
  }
}

function normalizeImportedSlot(value: unknown): DeckBuilderExportSlot {
  if (!isRecord(value)) {
    return {
      combatant_id: null,
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

export function useDeckBuilder() {
  const [squad, setSquad] = useState<SquadSlot[]>(createInitialSquad)
  const [variantModalTarget, setVariantModalTarget] = useState<VariantModalTarget | null>(null)

  const { data: characters = [], isLoading: loadingCharacters } = useQuery<CardCharacter[]>({
    queryKey: ['deck-builder-card-characters'],
    queryFn: () => api.cardCharacters(),
    staleTime: Infinity,
  })

  const totalCards = squad.reduce((sum, slot) => sum + slot.cards.length, 0)

  const totalCost = squad.reduce(
    (sum, slot) => sum + slot.cards.reduce((slotSum, item) => slotSum + getInstanceCost(item), 0),
    0,
  )

  const selectedCombatants = squad.filter(slot => slot.combatantId != null).length

  async function selectCombatant(slotIndex: number, combatantId: number | null) {
    setVariantModalTarget(null)

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
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        const item = slot.cards.find(card => card.instanceId === instanceId)
        if (!item) return slot

        return {
          ...slot,
          cards: [...slot.cards, cloneCardInstance(item)],
        }
      }),
    )
  }

  function removeCard(slotIndex: number, instanceId: string) {
    setVariantModalTarget(current => {
      if (current?.type === 'deck' && current.instanceId === instanceId) {
        return null
      }

      return current
    })

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: slot.cards.filter(card => card.instanceId !== instanceId),
        }
      }),
    )
  }

  function addDeckBuilderCard(
    slotIndex: number,
    item: DeckBuilderCardWithVariants,
    selectedVariant: DeckBuilderEpiphanyVariant | null = null,
  ) {
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: [
            ...slot.cards,
            createCardInstanceFromDeckBuilderCard(item, selectedVariant),
          ],
        }
      }),
    )
  }

  function clearDeck(slotIndex: number) {
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
        }
      }),
    )
  }

  function resetBuilder() {
    setVariantModalTarget(null)
    setSquad(createInitialSquad())
  }

  function openDeckCardVariants(slotIndex: number, item: DeckCardInstance) {
    setVariantModalTarget({
      type: 'deck',
      slotIndex,
      instanceId: item.instanceId,
      card: item.card,
      variants: item.variants,
      selectedVariant: item.selectedVariant,
    })
  }

  function openAvailableCardVariants(slotIndex: number, item: DeckBuilderCardWithVariants) {
    setVariantModalTarget({
      type: 'available',
      slotIndex,
      item,
    })
  }

  function applyVariant(variant: DeckBuilderEpiphanyVariant) {
    if (!variantModalTarget) return

    if (variantModalTarget.type === 'available') {
      addDeckBuilderCard(variantModalTarget.slotIndex, variantModalTarget.item, variant)
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
              selectedVariant: variant,
            }
          }),
        }
      }),
    )

    setVariantModalTarget(current => {
      if (!current || current.type !== 'deck') return current

      return {
        ...current,
        selectedVariant: variant,
      }
    })
  }

  function clearVariant() {
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
      }
    })
  }

  function closeVariantModal() {
    setVariantModalTarget(null)
  }

  async function exportDeck() {
    const payload: DeckBuilderExportPayload = {
      version: DECK_BUILDER_EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      slots: squad.map(slot => ({
        combatant_id: slot.combatantId,
        cards: slot.cards.map(item => ({
          card_id: item.card.card_id,
          selected_variant_id: item.selectedVariant?.variant_id ?? null,
        })),
      })),
    }

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
    const payload = normalizeImportedPayload(parsed)

    setVariantModalTarget(null)

    const importedSlots = payload.slots.slice(0, DECK_BUILDER_MAX_SLOTS)

    const nextSquad = await Promise.all(
      Array.from({ length: DECK_BUILDER_MAX_SLOTS }, async (_, slotIndex): Promise<SquadSlot> => {
        const importedSlot = importedSlots[slotIndex]

        if (!importedSlot?.combatant_id) {
          return createEmptySlot()
        }

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

              const selectedVariant = findVariantById(
                source.variants ?? [],
                importedCard.selected_variant_id,
              )

              return createCardInstanceFromDeckBuilderCard(
                source,
                selectedVariant,
              )
            })
            .filter((card): card is DeckCardInstance => card !== null)

          return {
            combatantId: importedSlot.combatant_id,
            cards,
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

  return {
    squad,
    characters,
    isLoading: loadingCharacters,
    totalCards,
    totalCost,
    selectedCombatants,
    variantModalTarget,
    selectCombatant,
    duplicateCard,
    removeCard,
    addDeckBuilderCard,
    clearDeck,
    resetBuilder,
    openDeckCardVariants,
    openAvailableCardVariants,
    applyVariant,
    clearVariant,
    closeVariantModal,
    exportDeck,
    importDeck,
  }
}