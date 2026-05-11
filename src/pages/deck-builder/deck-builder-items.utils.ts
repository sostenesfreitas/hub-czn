import deckBuilderItemsData from './data/deck-builder-items.json'
import type {
  DeckBuilderItem,
  DeckBuilderItemSlot,
} from './deck-builder.types'

const itemImages = import.meta.glob(
  './data/itens/**/*.{webp,png,jpg,jpeg,avif}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>

export const DECK_BUILDER_ITEMS = deckBuilderItemsData as DeckBuilderItem[]

export const DECK_BUILDER_ITEM_SLOT_LABEL: Record<DeckBuilderItemSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  accessory: 'Accessory',
}

export const DECK_BUILDER_ITEM_SLOT_TITLE: Record<DeckBuilderItemSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  accessory: 'Accessory',
}

export function getDeckBuilderItemsBySlot(slot: DeckBuilderItemSlot) {
  const slotLabel = DECK_BUILDER_ITEM_SLOT_LABEL[slot]

  return DECK_BUILDER_ITEMS.filter(item => item.slot === slotLabel)
}

export function findDeckBuilderItemById(itemId: string | null | undefined) {
  if (!itemId) {
    return null
  }

  return DECK_BUILDER_ITEMS.find(item => item.id === itemId) ?? null
}

export function getDeckBuilderItemImageUrl(item: DeckBuilderItem) {
  const normalizedPath = item.image_path.replace(/\\/g, '/').toLowerCase()

  const key = Object.keys(itemImages).find(path =>
    path.replace(/\\/g, '/').toLowerCase().endsWith(`/${normalizedPath}`),
  )

  return key ? itemImages[key] : null
}

export function getItemRarityClassName(rarity: string) {
  switch (rarity.toLowerCase()) {
    case 'unique':
      return 'border-[#a855f7] text-[#c084fc] shadow-[0_0_18px_rgba(168,85,247,0.22)]'
    case 'legendary':
      return 'border-[#f59e0b] text-[#fbbf24] shadow-[0_0_18px_rgba(245,158,11,0.18)]'
    case 'rare':
    default:
      return 'border-[#3b82f6] text-[#93c5fd] shadow-[0_0_18px_rgba(59,130,246,0.16)]'
  }
}
