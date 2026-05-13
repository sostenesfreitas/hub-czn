import { useTranslation } from 'react-i18next'
import type { DeckBuilderCardWithVariants } from '../deck-builder.types'
import { CardImage } from './CardImage'
import { TypeBadge } from './TypeBadge'

export function EgoSkillCard({
  egoSkill,
}: {
  egoSkill: DeckBuilderCardWithVariants
}) {
  const { t } = useTranslation()
  const displayDescription = egoSkill.description

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-[#3b2f1d] bg-[#1a1410]">
      <div className="flex gap-3 p-3">
        <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-[#3b2f1d] bg-[#101018]">
          <CardImage card={egoSkill.card} variant="cover" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-[#fbbf24]">
            Ego Skill
          </p>

          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="line-clamp-2 text-sm font-bold text-white">
              {egoSkill.card.name}
            </p>

            <span className="rounded-lg bg-[#0f0f14] px-3 py-1 text-sm font-bold text-[#fb923c]">
              {egoSkill.card.cost}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {egoSkill.card.effect_types.length > 0 ? (
              egoSkill.card.effect_types.map(type => (
                <TypeBadge key={type} type={type} />
              ))
            ) : (
              <span className="text-[10px] text-[#777]">
                {t('deckBuilder.support')}
              </span>
            )}
          </div>

          {displayDescription && (
            <div className="mt-2 rounded-md border border-[#f59e0b]/20 bg-[#78350f]/20 p-2">
              <p className="line-clamp-3 text-[10px] leading-relaxed text-[#fde68a]">
                {displayDescription}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
