import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { getCharacterFaceUrl } from '@/lib/deck-builder-assets'
import { GUIDE_LIST } from './guides-registry'
import { getGuide } from './guides-content'
import { GuidePage } from './components/GuidePage'

export function GuidesPage() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<number | null>(null)
  const guide = selected != null ? getGuide(selected) : undefined

  if (guide) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-b border-[#282828] px-3 py-2">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#b3b3b3] hover:bg-[#282828] hover:text-[#ffffff]"
          >
            <ChevronLeft size={14} />
            {t('guides.backToList')}
          </button>
          <span className="text-sm font-bold text-[#ffffff]">{guide.name}</span>
        </div>
        <div className="min-h-0 flex-1">
          <GuidePage guide={guide} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[#282828] p-6">
        <h1 className="text-xl font-bold text-[#ffffff]">{t('guides.title')}</h1>
        <p className="mt-2 text-sm text-[#b3b3b3]">{t('guides.description')}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {GUIDE_LIST.map(entry => {
            const face = getCharacterFaceUrl(entry.charResId)
            return (
              <button
                key={entry.charResId}
                type="button"
                onClick={() => setSelected(entry.charResId)}
                className="flex flex-col items-center gap-2 rounded-lg border border-[#282828] bg-[#181818] p-4 transition-colors hover:border-[#c084fc44] hover:bg-[#282828]"
              >
                {face ? (
                  <img src={face} alt={entry.name} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-[#222] text-lg font-bold text-[#666]">
                    {entry.name.charAt(0)}
                  </div>
                )}
                <span className="text-sm font-medium text-[#ffffff]">{entry.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
