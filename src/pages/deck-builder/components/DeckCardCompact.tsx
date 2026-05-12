import { Copy, Sparkles, X } from 'lucide-react'
import type { DeckCardInstance } from '../deck-builder.types'
import { getDisplayTypes, getInstanceCost } from '../deck-builder.utils'
import { CardImage } from './CardImage'

export function DeckCardCompact({
  item,
  quantity = 1,
  onDuplicate,
  onRemove,
  onOpenVariants,
}: {
  item: DeckCardInstance
  quantity?: number
  onDuplicate: () => void
  onRemove: () => void
  onOpenVariants?: () => void
}) {
  const { card, selectedVariant } = item

  const displayName = selectedVariant?.name ?? card.name ?? 'Unnamed card'
  const displayCost = getInstanceCost(item)
  const displayDescription = selectedVariant?.description ?? item.description
  const displayTypes = getDisplayTypes(card, selectedVariant)
  const mainType = displayTypes[0]
  const secondaryType = displayTypes[1]
  const hasVariants = item.variants.length > 0 || card.spark_count > 0

  return (
    <article
      title={displayDescription ?? displayName}
      className="group relative h-[232px] overflow-hidden rounded-xl border border-[#2d2d3a] bg-[#101018] shadow-lg transition-colors hover:border-[#f97316]"
    >
      <div className="absolute inset-0">
        <CardImage
          card={card}
          variant="cover"
          className="opacity-95 transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/90" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black via-black/80 to-transparent" />

      <div className="absolute left-2 top-2 z-10 rounded-md border border-[#facc15]/50 bg-black/80 px-2 py-1 text-xs font-black text-[#facc15] shadow-lg">
        {quantity}x
      </div>

      <div className="absolute right-2 top-2 z-10 grid h-7 min-w-7 place-items-center rounded-md border border-[#1d4ed8]/30 bg-[#071225]/90 px-2 text-sm font-black text-[#93c5fd] shadow-lg">
        {displayCost}
      </div>

      <div className="absolute left-2 right-2 top-12 z-10 flex flex-wrap gap-1">
        {mainType && (
          <span className="rounded bg-[#ef4444]/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow">
            {mainType}
          </span>
        )}

        {secondaryType && (
          <span className="rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#e5e7eb] shadow">
            {secondaryType}
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-9 z-10 p-2 text-center">
        <h3 className="line-clamp-2 text-base font-black leading-tight text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
          {displayName}
        </h3>

        {displayDescription && (
          <p className="mx-auto mt-1 line-clamp-4 max-w-[95%] text-[10px] font-bold leading-snug text-[#f8fafc] drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]">
            {displayDescription}
          </p>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex h-9 items-center justify-end gap-1 border-t border-white/10 bg-black/90 px-2">
        {hasVariants && onOpenVariants && (
          <button
            type="button"
            onClick={onOpenVariants}
            title="Selecionar variante"
            className="inline-flex h-6 items-center gap-1 rounded-md border border-[#075985] bg-[#082f49]/90 px-2 text-[9px] font-bold text-[#7dd3fc] hover:bg-[#0c4a6e]"
          >
            <Sparkles size={11} />
            Var.
          </button>
        )}

        <button
          type="button"
          onClick={onDuplicate}
          title="Adicionar mais uma cópia"
          className="grid h-6 w-6 place-items-center rounded-md border border-[#333348] bg-[#111827]/90 text-[#d8b4fe] hover:bg-[#312e81]"
        >
          <Copy size={12} />
        </button>

        <button
          type="button"
          onClick={onRemove}
          title="Remover uma cópia"
          className="grid h-6 w-6 place-items-center rounded-md border border-[#333348] bg-[#111827]/90 text-[#fca5a5] hover:bg-[#7f1d1d]"
        >
          <X size={12} />
        </button>
      </div>
    </article>
  )
}