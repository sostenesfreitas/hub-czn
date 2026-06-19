import { useTranslation } from 'react-i18next'
import { getCharacterFaceUrl } from '@/lib/deck-builder-assets'
import { resolveLang, localized } from '../../guides.utils'
import type { LocalizedText } from '../../guides.types'

type Group = { title?: LocalizedText; faces: number[] }

export function TeamGridBlock({ groups }: { groups: Group[] }) {
  const { i18n } = useTranslation()
  const lang = resolveLang(i18n.language)

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-2">
          {group.title && (
            <h4 className="text-sm font-bold text-[#ffffff]">{localized(group.title, lang)}</h4>
          )}
          <div className="flex flex-wrap gap-2">
            {group.faces.map((charResId, fi) => {
              const face = getCharacterFaceUrl(charResId)
              return face ? (
                <img
                  key={`${charResId}-${fi}`}
                  src={face}
                  alt={String(charResId)}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div
                  key={`${charResId}-${fi}`}
                  className="grid h-12 w-12 place-items-center rounded-full bg-[#222] text-sm font-bold text-[#666]"
                >
                  {String(charResId).charAt(0)}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
