import { useTranslation } from 'react-i18next'
import { getCharacterFaceUrl } from '@/lib/deck-builder-assets'
import { resolveLang, localized } from '../../guides.utils'
import type { LocalizedText } from '../../guides.types'

type Item = { charResId: number; name: string; rating: string; note: LocalizedText }

export function PartnerListBlock({ items }: { items: Item[] }) {
  const { i18n } = useTranslation()
  const lang = resolveLang(i18n.language)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item, i) => {
        const face = getCharacterFaceUrl(item.charResId)
        return (
          <article
            key={`${item.charResId}-${i}`}
            className="flex gap-3 rounded-lg border border-[#282828] bg-[#181818] p-3"
          >
            {face ? (
              <img
                src={face}
                alt={item.name}
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#222] text-lg font-bold text-[#666]">
                {item.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="truncate text-sm font-bold text-[#ffffff]">{item.name}</h4>
                <span className="shrink-0 rounded bg-[#c084fc]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#c084fc]">
                  {item.rating}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#b3b3b3]">
                {localized(item.note, lang)}
              </p>
            </div>
          </article>
        )
      })}
    </div>
  )
}
