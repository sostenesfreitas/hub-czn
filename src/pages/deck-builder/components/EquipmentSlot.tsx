import {
  Gem,
  Shield,
  Swords,
  X,
} from 'lucide-react'
import type {
  DeckBuilderItem,
  DeckBuilderItemSlot,
} from '../deck-builder.types'
import {
  DECK_BUILDER_ITEM_SLOT_TITLE,
  getDeckBuilderItemImageUrl,
  getItemRarityClassName,
} from '../deck-builder-items.utils'

const SLOT_ICON = {
  weapon: Swords,
  armor: Shield,
  accessory: Gem,
} satisfies Record<DeckBuilderItemSlot, typeof Swords>

export function EquipmentSlot({
  slot,
  item,
  onOpen,
  onClear,
}: {
  slot: DeckBuilderItemSlot
  item: DeckBuilderItem | null
  onOpen: () => void
  onClear: () => void
}) {
  const Icon = SLOT_ICON[slot]
  const title = DECK_BUILDER_ITEM_SLOT_TITLE[slot]
  const imageUrl = item ? getDeckBuilderItemImageUrl(item) : null

  return (
    <div className="group relative min-w-0">
      <button
        type="button"
        onClick={onOpen}
        title={item ? `${title}: ${item.name}` : `Selecionar ${title}`}
        className={[
          'relative flex h-[44px] w-full overflow-hidden rounded-lg border bg-[#101018] text-left transition',
          item
            ? getItemRarityClassName(item.rarity)
            : 'border-dashed border-[#333348] text-[#777] hover:border-[#c084fc] hover:text-[#e9d5ff]',
        ].join(' ')}
      >
        {item && imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={item.name}
              className="h-full w-[38px] shrink-0 object-cover"
            />

            <div className="min-w-0 flex-1 px-1.5 py-1">
              <p className="truncate text-[8px] font-black uppercase leading-none tracking-wide">
                {title}
              </p>

              <p className="mt-0.5 line-clamp-2 text-[10px] font-bold leading-tight text-white">
                {item.name}
              </p>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-0.5">
            <Icon size={14} />
            <span className="text-[8.5px] font-bold uppercase tracking-wide">
              {title}
            </span>
          </div>
        )}
      </button>

      {item && (
        <button
          type="button"
          onClick={event => {
            event.stopPropagation()
            onClear()
          }}
          title={`Remover ${title}`}
          className="absolute right-1 top-1 grid h-[15px] w-[15px] place-items-center rounded border border-[#333348] bg-black/80 text-[#fca5a5] opacity-0 transition hover:bg-[#7f1d1d] group-hover:opacity-100"
        >
          <X size={9} />
        </button>
      )}
    </div>
  )
}