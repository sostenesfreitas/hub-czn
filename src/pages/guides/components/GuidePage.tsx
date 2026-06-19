import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import type { CardEntry } from '@/lib/types'
import { cn } from '@/lib/utils'
import { resolveLang, localized } from '../guides.utils'
import type { Guide } from '../guides.types'
import { ProseBlock } from './blocks/ProseBlock'
import { CardListBlock } from './blocks/CardListBlock'
import { PartnerListBlock } from './blocks/PartnerListBlock'
import { GearListBlock } from './blocks/GearListBlock'
import { RatingListBlock } from './blocks/RatingListBlock'
import { TeamGridBlock } from './blocks/TeamGridBlock'

export function GuidePage({ guide }: { guide: Guide }) {
  const { t, i18n } = useTranslation()
  const lang = resolveLang(i18n.language)
  const [activeId, setActiveId] = useState(guide.sections[0]?.id)

  const { data: cards = [] } = useQuery<CardEntry[]>({
    queryKey: ['cards', guide.charResId],
    queryFn: () => api.cards(guide.charResId),
    staleTime: Infinity,
  })

  const cardsById = useMemo(
    () => Object.fromEntries(cards.map(c => [c.card_id, c])) as Record<string, CardEntry>,
    [cards],
  )

  const active = guide.sections.find(s => s.id === activeId) ?? guide.sections[0]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Section nav */}
      <div className="w-56 shrink-0 overflow-y-auto border-r border-[#282828] bg-[#181818] p-2">
        {guide.sections.map(section => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveId(section.id)}
            className={cn(
              'block w-full truncate rounded px-3 py-2 text-left text-xs transition-colors',
              section.id === active?.id
                ? 'bg-[#282828] font-bold text-[#ffffff]'
                : 'text-[#b3b3b3] hover:bg-[#282828] hover:text-[#ffffff]',
            )}
          >
            {localized(section.title, lang)}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {active && (
          <>
            <h2 className="mb-4 text-xl font-bold text-[#ffffff]">
              {localized(active.title, lang)}
            </h2>
            {active.blocks.length === 0 ? (
              <p className="text-sm text-[#666] italic">{t('guides.sectionComingSoon')}</p>
            ) : (
              <div className="flex max-w-3xl flex-col gap-6">
                {active.blocks.map((block, i) => {
                  if (block.type === 'prose') return <ProseBlock key={i} body={block.body} />
                  if (block.type === 'card-list')
                    return (
                      <CardListBlock
                        key={i}
                        intro={block.intro}
                        items={block.items}
                        cardsById={cardsById}
                      />
                    )
                  if (block.type === 'partner-list')
                    return <PartnerListBlock key={i} items={block.items} />
                  if (block.type === 'gear-list')
                    return <GearListBlock key={i} intro={block.intro} items={block.items} />
                  if (block.type === 'rating-list')
                    return <RatingListBlock key={i} items={block.items} />
                  if (block.type === 'team-grid')
                    return <TeamGridBlock key={i} groups={block.groups} />
                  return null
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
