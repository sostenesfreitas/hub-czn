import { useTranslation } from 'react-i18next'
import { resolveLang, localized } from '../../guides.utils'
import type { LocalizedText } from '../../guides.types'

type Item = { label: string; text: LocalizedText }

export function RatingListBlock({ items }: { items: Item[] }) {
  const { i18n } = useTranslation()
  const lang = resolveLang(i18n.language)

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          className="flex flex-col gap-1 rounded-lg border border-[#282828] bg-[#181818] p-3 sm:flex-row sm:items-start sm:gap-3"
        >
          <span className="shrink-0 rounded bg-[#c084fc]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#c084fc]">
            {item.label}
          </span>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-[#b3b3b3]">
            {localized(item.text, lang)}
          </p>
        </div>
      ))}
    </div>
  )
}
