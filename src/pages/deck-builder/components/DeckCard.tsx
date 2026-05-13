import { Copy, Sparkles, X } from 'lucide-react'
import type { DeckCardInstance } from '../deck-builder.types'
import { getDisplayTypes, getInstanceCost } from '../deck-builder.utils'
import { CardImage } from './CardImage'
import { TypeBadge } from './TypeBadge'

export function DeckCard({
  item,
  onDuplicate,
  onRemove,
  onOpenVariants,
}: {
  item: DeckCardInstance
  onDuplicate: () => void
  onRemove: () => void
  onOpenVariants?: () => void
}) {
  const { card, selectedVariant } = item

  const displayName = selectedVariant?.name ?? card.name ?? 'Unnamed card'
  const displayCost = getInstanceCost(item)
  const displayDescription = selectedVariant?.description ?? item.description
  const displayTypes = getDisplayTypes(card, selectedVariant)
  const coefficient = card.eff_value > 0 ? `${card.eff_value}%` : '—'
  const hasVariants = item.variants.length > 0 || card.spark_count > 0

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-[#2d2d3a] bg-[#15151f] transition-colors hover:border-[#c084fc]">
      <div className="flex flex-1 gap-3 p-3">
        <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-[#2d2d3a] bg-[#101018]">
          <CardImage card={card} variant="cover" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-bold text-white">
                {displayName}
              </h3>

              {selectedVariant && selectedVariant.name !== card.name && (
                <p className="mt-1 text-[10px] text-[#60a5fa]">
                  Base: {card.name}
                </p>
              )}
            </div>

            <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[#0f172a] text-sm font-bold text-[#93c5fd]">
              {displayCost}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {displayTypes.length > 0 ? (
              displayTypes.map(type => (
                <TypeBadge key={type} type={type} />
              ))
            ) : (
              <span className="text-[10px] text-[#777]">
                Sem efeito mapeado
              </span>
            )}
          </div>

          {hasVariants && !selectedVariant && onOpenVariants && (
            <button
              type="button"
              onClick={onOpenVariants}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-[#075985] bg-[#082f49]/70 px-2 py-1 text-[10px] font-semibold text-[#7dd3fc] hover:bg-[#0c4a6e]"
            >
              <Sparkles size={12} />
              {item.variants.length > 0
                ? `${item.variants.length} variantes`
                : `${card.spark_count} variantes`}
            </button>
          )}

          {displayDescription && (
            <div className="mt-2 rounded-md border border-[#0ea5e9]/20 bg-[#082f49]/20 p-2">
              <p className="line-clamp-3 text-[10px] leading-relaxed text-[#dbeafe]">
                {displayDescription}
              </p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-md bg-[#0f0f14] px-2 py-2 text-center">
              <p className="text-[9px] uppercase text-[#666]">Dano</p>
              <p className="text-xs font-bold text-[#e5e7eb]">{coefficient}</p>
            </div>

            <div className="rounded-md bg-[#0f0f14] px-2 py-2 text-center">
              <p className="text-[9px] uppercase text-[#666]">Hits</p>
              <p className="text-xs font-bold text-[#e5e7eb]">
                {card.hits > 0 ? card.hits : '—'}
              </p>
            </div>

            <div className="rounded-md bg-[#0f0f14] px-2 py-2 text-center">
              <p className="text-[9px] uppercase text-[#666]">Spark</p>
              <p className="text-xs font-bold text-[#facc15]">
                {card.spark_count > 0 ? `+${card.spark_count}` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-end gap-2 border-t border-[#282838] bg-[#11111a] px-3 py-2">
        {hasVariants && onOpenVariants && (
          <button
            type="button"
            onClick={onOpenVariants}
            title="Selecionar variante"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[#075985] bg-[#082f49]/70 px-2 text-[11px] font-semibold text-[#7dd3fc] hover:bg-[#0c4a6e]"
          >
            <Sparkles size={12} />
            Variantes
          </button>
        )}

        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicar carta"
          className="grid h-8 w-8 place-items-center rounded-md border border-[#333348] bg-[#111827]/90 text-[#d8b4fe] hover:bg-[#312e81]"
        >
          <Copy size={14} />
        </button>

        <button
          type="button"
          onClick={onRemove}
          title="Remover carta"
          className="grid h-8 w-8 place-items-center rounded-md border border-[#333348] bg-[#111827]/90 text-[#fca5a5] hover:bg-[#7f1d1d]"
        >
          <X size={14} />
        </button>
      </div>
    </article>
  )
}