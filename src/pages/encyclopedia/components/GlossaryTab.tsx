import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GLOSSARY, glossaryById } from '../encyclopedia-content'
import { localized, resolveLang } from '../encyclopedia.utils'
import type { GlossaryCategory } from '../encyclopedia.types'

const CATEGORY_ORDER: GlossaryCategory[] = ['status', 'card-type', 'mechanic']

export function GlossaryTab() {
  const { t, i18n } = useTranslation()
  const lang = resolveLang(i18n.language)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return GLOSSARY
    return GLOSSARY.filter(
      e =>
        localized(e.term, lang).toLowerCase().includes(q) ||
        localized(e.definition, lang).toLowerCase().includes(q),
    )
  }, [search, lang])

  const filteredIds = useMemo(() => new Set(filtered.map(e => e.id)), [filtered])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
        <div>
          <h2 className="text-base font-bold text-white">{t('encyclopedia.glossary.title')}</h2>
          <p className="text-xs text-[#888]">{t('encyclopedia.glossary.description')}</p>
        </div>

        <input
          type="search"
          placeholder={t('encyclopedia.search')}
          aria-label={t('encyclopedia.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded border border-[#333] bg-[#222] px-2 py-1.5 text-xs text-[#e5e7eb] placeholder:text-[#555]"
        />

        {filtered.length === 0 && (
          <p className="text-xs text-[#555]">{t('encyclopedia.empty')}</p>
        )}

        {CATEGORY_ORDER.map(category => {
          const entries = filtered.filter(e => e.category === category)
          if (entries.length === 0) return null
          return (
            <section key={category} className="flex flex-col gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c084fc]">
                {t(`encyclopedia.glossary.category.${category}`)}
              </h3>
              {entries.map(entry => (
                <div
                  key={entry.id}
                  id={`glossary-${entry.id}`}
                  className="rounded-lg border border-[#282828] bg-[#161616] p-3"
                >
                  <p className="text-sm font-bold text-[#e9d5ff]">{localized(entry.term, lang)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#d4d4d4]">
                    {localized(entry.definition, lang)}
                  </p>
                  {(() => {
                    const visibleRefs = entry.seeAlso.filter(ref => filteredIds.has(ref))
                    if (visibleRefs.length === 0) return null
                    return (
                      <p className="mt-2 text-[10px] text-[#666]">
                        {t('encyclopedia.glossary.seeAlso')}:{' '}
                        {visibleRefs.map((ref, i) => {
                          const target = glossaryById.get(ref)
                          if (!target) return null
                          return (
                            <span key={ref}>
                              {i > 0 && ', '}
                              <button
                                type="button"
                                onClick={() =>
                                  document
                                    .getElementById(`glossary-${ref}`)
                                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                }
                                className="cursor-pointer border-none bg-transparent p-0 text-[#c084fc] underline decoration-dotted hover:text-[#d8b4fe]"
                              >
                                {localized(target.term, lang)}
                              </button>
                            </span>
                          )
                        })}
                      </p>
                    )
                  })()}
                </div>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
