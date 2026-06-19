import { useTranslation } from 'react-i18next'
import { CardImage } from '@/pages/deck-builder/components/CardImage'
import type { CardEntry } from '@/lib/types'
import { resolveLang, localized } from '../../guides.utils'
import type { LocalizedText } from '../../guides.types'

type Item = { cardId: string; rating?: string; note: LocalizedText }

export function CardListBlock({
  intro,
  items,
  cardsById,
}: {
  intro?: LocalizedText
  items: Item[]
  cardsById: Record<string, CardEntry>
}) {
  const { i18n } = useTranslation()
  const lang = resolveLang(i18n.language)

  return (
    <div className="flex flex-col gap-3">
      {intro && (
        <p className="text-sm leading-relaxed text-[#cbd5e1]">{localized(intro, lang)}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map(item => {
          const card =
            cardsById[item.cardId] ??
            ({
              card_id: item.cardId,
              char_res_id: null,
              name: item.cardId,
              cost: 0,
              eff_value: 0,
              hits: 0,
              spark_count: 0,
              effect_types: [],
            } satisfies CardEntry)
          return (
            <article
              key={item.cardId}
              className="flex gap-3 rounded-lg border border-[#282828] bg-[#181818] p-3"
            >
              <CardImage card={card} className="h-24 w-16 shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-sm font-bold text-[#ffffff]">{card.name}</h4>
                  {item.rating && (
                    <span className="shrink-0 rounded bg-[#c084fc]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#c084fc]">
                      {item.rating}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#b3b3b3]">
                  {localized(item.note, lang)}
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
