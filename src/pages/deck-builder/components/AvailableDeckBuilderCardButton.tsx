import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import type { DeckBuilderCardWithVariants } from '../deck-builder.types'
import {
  formatCardDisplayDescription,
  mergeCardDisplayTags,
} from '../deck-builder-card-display.utils'
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
  const { t } = useTranslation()
  const card = item.card
  const variants = getVariants(item)
  const hasVariants = variants.length > 0 || card.spark_count > 0
  const formattedDescription = formatCardDisplayDescription(item.description)
  const displayDescription = formattedDescription.text
  const displayTypes = mergeCardDisplayTags(card.effect_types, formattedDescription.tags)
  const visibleTypes = displayTypes.slice(0, 4)
  const hiddenTypesCount = Math.max(0, displayTypes.length - visibleTypes.length)
  const hasDamage = card.eff_value > 0

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
              {card.name || t('deckBuilder.card.unnamed')}
            </p>

            <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-[#0f172a] text-xs font-bold text-[#93c5fd]">
              {card.cost}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {visibleTypes.length > 0 ? (
              <>
                {visibleTypes.map(type => (
                  <TypeBadge key={type} type={type} />
                ))}

                {hiddenTypesCount > 0 && (
                  <span className="rounded bg-[#1f1b2e] px-1.5 py-0.5 text-[9px] font-black text-[#c4b5fd]">
                    +{hiddenTypesCount}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[10px] text-[#777]">
                {t('deckBuilder.support')}
              </span>
            )}
          </div>

          {displayDescription && (
            <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#b3b3b3]">
              {displayDescription}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
            {hasDamage ? (
              <span className="text-[#888]">
                {card.eff_value}% {t('deckBuilder.damage').toLowerCase()}
              </span>
            ) : (
              <span />
            )}

            <span className="font-semibold text-[#c084fc]">
              + {t('deckBuilder.add')}
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
              ? `${variants.length} ${t('deckBuilder.variants')}`
              : `${card.spark_count} ${t('deckBuilder.variants')}`}
          </button>
        </div>
      )}
    </div>
  )
}
