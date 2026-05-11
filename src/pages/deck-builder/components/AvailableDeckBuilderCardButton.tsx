import { Sparkles } from 'lucide-react'
import type { DeckBuilderCardWithVariants } from '../deck-builder.types'
import { getVariants } from '../deck-builder.utils'
import { CardImage } from './CardImage'
import { TypeBadge } from './TypeBadge'

export function AvailableDeckBuilderCardButton({
  item,
  onAdd,
  onOpenVariants,
}: {
  item: DeckBuilderCardWithVariants
  onAdd: () => void
  onOpenVariants?: () => void
}) {
  const card = item.card
  const variants = getVariants(item)
  const hasVariants = variants.length > 0 || card.spark_count > 0
  const displayDescription = item.description

  return (
    <div className="overflow-hidden rounded-lg border border-[#333348] bg-[#15151f] transition-colors hover:border-[#c084fc] hover:bg-[#1f1b2e]">
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full gap-3 p-2 text-left"
      >
        <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-[#2d2d3a] bg-[#101018]">
          <CardImage card={card} variant="thumbnail" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-xs font-bold text-white">
              {card.name || 'Unnamed card'}
            </p>

            <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-[#0f172a] text-xs font-bold text-[#93c5fd]">
              {card.cost}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {card.effect_types.length > 0 ? (
              card.effect_types.slice(0, 2).map(type => (
                <TypeBadge key={type} type={type} />
              ))
            ) : (
              <span className="text-[10px] text-[#777]">
                suporte
              </span>
            )}
          </div>

          {displayDescription && (
            <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#b3b3b3]">
              {displayDescription}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
            <span className="text-[#888]">
              {card.eff_value > 0 ? `${card.eff_value}% dano` : 'suporte'}
            </span>

            <span className="font-semibold text-[#c084fc]">
              + adicionar
            </span>
          </div>
        </div>
      </button>

      {hasVariants && onOpenVariants && (
        <div className="border-t border-[#282838] px-2 pb-2 pt-2">
          <button
            type="button"
            onClick={onOpenVariants}
            className="inline-flex items-center gap-1 rounded-md border border-[#075985] bg-[#082f49]/70 px-2 py-1 text-[10px] font-semibold text-[#7dd3fc] hover:bg-[#0c4a6e]"
          >
            <Sparkles size={12} />
            {variants.length > 0
              ? `${variants.length} variantes`
              : `${card.spark_count} variantes`}
          </button>
        </div>
      )}
    </div>
  )
}