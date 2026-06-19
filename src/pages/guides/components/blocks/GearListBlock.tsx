import { useTranslation } from 'react-i18next'
import { resolveLang, localized } from '../../guides.utils'
import type { LocalizedText } from '../../guides.types'

type Item = { image?: string; name: string; note?: LocalizedText }

export function GearListBlock({ intro, items }: { intro?: LocalizedText; items: Item[] }) {
  const { i18n } = useTranslation()
  const lang = resolveLang(i18n.language)

  return (
    <div className="flex flex-col gap-3">
      {intro && (
        <p className="text-sm leading-relaxed text-[#cbd5e1]">{localized(intro, lang)}</p>
      )}
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <article
            key={`${item.name}-${i}`}
            className="flex items-start gap-3 rounded-lg border border-[#282828] bg-[#181818] p-3"
          >
            {item.image && (
              <img
                src={item.image}
                alt={item.name}
                className="h-10 w-10 shrink-0 rounded object-contain"
              />
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-[#ffffff]">{item.name}</h4>
              {item.note && (
                <p className="mt-1 text-xs leading-relaxed text-[#b3b3b3]">
                  {localized(item.note, lang)}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
