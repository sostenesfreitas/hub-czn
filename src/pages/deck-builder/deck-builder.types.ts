import type {
  CardEntry,
  DeckBuilderCard as ApiDeckBuilderCard,
} from '@/lib/types'

export type DeckBuilderEpiphanyVariant = {
  variant_id: string
  level: number
  name: string
  cost: number
  card_type: string
  tags: string[]
  description: string
}

export type DeckBuilderCardWithVariants = ApiDeckBuilderCard & {
  variants?: DeckBuilderEpiphanyVariant[]
}

export type DeckCardInstance = {
  instanceId: string
  card: CardEntry
  variants: DeckBuilderEpiphanyVariant[]
  selectedVariant: DeckBuilderEpiphanyVariant | null
}

export type SquadSlot = {
  combatantId: number | null
  cards: DeckCardInstance[]
  startingCards: DeckBuilderCardWithVariants[]
  epiphanyCards: DeckBuilderCardWithVariants[]
  egoSkill: DeckBuilderCardWithVariants | null
  isLoading: boolean
  error: string | null
}

export type VariantModalTarget =
  | {
      type: 'deck'
      slotIndex: number
      instanceId: string
      card: CardEntry
      variants: DeckBuilderEpiphanyVariant[]
      selectedVariant: DeckBuilderEpiphanyVariant | null
    }
  | {
      type: 'available'
      slotIndex: number
      item: DeckBuilderCardWithVariants
    }

export type DeckBuilderImportedCard = {
  card_id: string
  selected_variant_id: string | null
}

export type DeckBuilderExportSlot = {
  combatant_id: number | null
  cards: DeckBuilderImportedCard[]
}

export type DeckBuilderExportPayload = {
  version: number
  exported_at: string
  slots: DeckBuilderExportSlot[]
}