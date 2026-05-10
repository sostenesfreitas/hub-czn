import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CardCharacter } from '@/lib/types'
import type {
  DeckBuilderCardWithVariants,
  DeckBuilderEpiphanyVariant,
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

      const startingCards = deckBuilderData.starting_cards as DeckBuilderCardWithVariants[]
      const epiphanyCards = deckBuilderData.epiphany_cards as DeckBuilderCardWithVariants[]
      const egoSkill = deckBuilderData.ego_skill as DeckBuilderCardWithVariants | null

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
  }
}
