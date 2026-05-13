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

export type DeckBuilderDivineGodId =
  | 'Nihilum'
  | 'Secred'
  | 'Vitor'
  | 'Caligo'
  | 'Circen'
  | 'Diallos'

export type DeckBuilderDivineGod = {
  id: DeckBuilderDivineGodId
  name: string
  displayName: string
}

export type DeckBuilderDivineEpiphany = {
  id: string
  god: string
  display_god: string
  description: string
  rarity: string
  card_types: string[]
  allowed_classes: string[]
  levels: string[]
  tags: string[]
  source_key: string
  raw_text: string
}

export type DeckBuilderCommonEpiphany = {
  id: string
  section: string
  display_section: string
  description: string
  rarity: string
  card_types: string[]
  allowed_classes: string[]
  levels: string[]
  tags: string[]
  source_key: string
  raw_text: string
}

export type DeckBuilderPersonaEidolon = 'Lux' | 'Umbra'

export type DeckBuilderPersonaCardType = 'Attack' | 'Skill'

export type DeckBuilderPersonaImageKey =
  | 'lux'
  | 'umbra'
  | 'half_lux'
  | 'half_umbra'
  | 'all_lux'
  | 'lux_and_umbra'
  | 'all_umbra'

export type DeckBuilderPersonaEngraving = {
  engraving_id: string
  eidolon: DeckBuilderPersonaEidolon | string
  card_type: DeckBuilderPersonaCardType | string
  modifiers: string[]
  allowed_classes: string[]
  tags: string[]
  description: string
}

export type DeckBuilderPersonaEngravingCard = {
  id: string
  image_id: string
  name: string
  category?: string
  image_type?: string
  image_path?: string
  persona_image_paths: Partial<Record<DeckBuilderPersonaImageKey, string>>
  engravings: DeckBuilderPersonaEngraving[]
}

export type DeckBuilderPersonaEngravingSelection = {
  slot1: DeckBuilderPersonaEngraving | null
  slot2: DeckBuilderPersonaEngraving | null
}

export type DeckCardEpiphanySettings = {
  selectedVariant: DeckBuilderEpiphanyVariant | null
  selectedDivineGod: DeckBuilderDivineGod | null
  selectedDivineEpiphany: DeckBuilderDivineEpiphany | null
  selectedCommonEpiphany: DeckBuilderCommonEpiphany | null
  selectedPersonaEngravings: DeckBuilderPersonaEngravingSelection
}

export type DeckBuilderCardGroup =
  | ApiDeckBuilderCard['group']
  | 'neutral'
  | 'monster'

export type DeckBuilderCardWithVariants = Omit<ApiDeckBuilderCard, 'variants' | 'group'> & {
  group: DeckBuilderCardGroup
  description?: string | null
  variants?: DeckBuilderEpiphanyVariant[]
  rarity?: string | null
  tags?: string[]
  restrictions?: string | null
  allowed_classes?: string[]
}

export type DeckCardInstance = {
  instanceId: string
  card: CardEntry
  description: string | null
  variants: DeckBuilderEpiphanyVariant[]
  selectedVariant: DeckBuilderEpiphanyVariant | null
  selectedDivineGod: DeckBuilderDivineGod | null
  selectedDivineEpiphany: DeckBuilderDivineEpiphany | null
  selectedCommonEpiphany: DeckBuilderCommonEpiphany | null
  selectedPersonaEngravings: DeckBuilderPersonaEngravingSelection
  group: DeckBuilderCardGroup
  rarity: string | null
  tags: string[]
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
      selectedDivineGod: DeckBuilderDivineGod | null
      selectedDivineEpiphany: DeckBuilderDivineEpiphany | null
      selectedCommonEpiphany: DeckBuilderCommonEpiphany | null
      selectedPersonaEngravings: DeckBuilderPersonaEngravingSelection
    }
  | {
      type: 'available'
      slotIndex: number
      item: DeckBuilderCardWithVariants
    }

export type DeckBuilderImportedPersonaEngravingIds = [string | null, string | null]

export type DeckBuilderImportedCard = {
  card_id: string
  selected_variant_id: string | null
  selected_divine_god: string | null
  selected_divine_epiphany_id: string | null
  selected_common_epiphany_id: string | null
  selected_persona_engraving_ids: DeckBuilderImportedPersonaEngravingIds
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
