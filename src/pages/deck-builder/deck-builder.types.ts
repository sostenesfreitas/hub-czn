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

export type DeckBuilderCardGroup =
  | ApiDeckBuilderCard['group']
  | 'neutral'
  | 'monster'

export type DeckBuilderCardWithVariants = Omit<ApiDeckBuilderCard, 'variants' | 'group'> & {
  group: DeckBuilderCardGroup
  description?: string | null
  variants?: DeckBuilderEpiphanyVariant[]
}

export type DeckCardInstance = {
  instanceId: string
  card: CardEntry
  description: string | null
  variants: DeckBuilderEpiphanyVariant[]
  selectedVariant: DeckBuilderEpiphanyVariant | null
}

export type DeckBuilderItemSlot = 'weapon' | 'armor' | 'accessory'

export type DeckBuilderItem = {
  id: string
  image_id: string
  slug: string
  name: string
  rarity: string
  slot: 'Weapon' | 'Armor' | 'Accessory' | string
  raw_slot?: string
  original_slot?: string
  tags: string[]
  description: string
  stat_type: string | null
  stat_values: number[]
  source: string
  sources: string[]
  image_path: string
}

export type DeckBuilderEquipment = Record<DeckBuilderItemSlot, DeckBuilderItem | null>

export type DeckBuilderImportedEquipment = Record<`${DeckBuilderItemSlot}_id`, string | null>

export type SquadSlot = {
  combatantId: number | null
  cards: DeckCardInstance[]
  equipment: DeckBuilderEquipment
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
      description: string | null
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
  equipment: DeckBuilderImportedEquipment
  cards: DeckBuilderImportedCard[]
}

export type DeckBuilderExportPayload = {
  version: number
  exported_at: string
  slots: DeckBuilderExportSlot[]
}
