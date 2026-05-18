import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DECK_BUILDER_PERSONA_ENGRAVING_CARDS } from '@/pages/deck-builder/deck-builder-persona-engraving.utils'
import type { DeckBuilderPersonaEngraving } from '@/pages/deck-builder/deck-builder.types'
import { findClarification } from '../encyclopedia-content'
import { RichDescription } from './RichDescription'
import { resolveLang } from '../encyclopedia.utils'

const ALL_ENGRAVINGS: DeckBuilderPersonaEngraving[] =
  DECK_BUILDER_PERSONA_ENGRAVING_CARDS.flatMap(card => card.engravings)

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].filter(Boolean).sort()
}

const EIDOLONS = uniqueSorted(ALL_ENGRAVINGS.map(e => e.eidolon))
const CARD_TYPES = uniqueSorted(ALL_ENGRAVINGS.map(e => e.card_type))

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded border border-[#334155] bg-[#1e293b] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#cbd5e1]">
      {children}
    </span>
  )
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string | null
  onChange: (v: string | null) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-0.5">
      <p className="mb-0.5 text-[10px] uppercase tracking-wide text-[#666]">{label}</p>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded px-2 py-1 text-left text-xs transition-colors ${
          value === null ? 'bg-[#c084fc] text-white' : 'text-[#888] hover:bg-[#222] hover:text-[#e5e7eb]'
        }`}
      >
        {t('encyclopedia.all')}
      </button>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded px-2 py-1 text-left text-xs transition-colors ${
            value === opt ? 'bg-[#c084fc] text-white' : 'text-[#888] hover:bg-[#222] hover:text-[#e5e7eb]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export function EngravingsTab() {
  const { t, i18n } = useTranslation()
  const lang = resolveLang(i18n.language)
  const [search, setSearch] = useState('')
  const [eidolon, setEidolon] = useState<string | null>(null)
  const [cardType, setCardType] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ALL_ENGRAVINGS.filter(e => {
      if (eidolon && e.eidolon !== eidolon) return false
      if (cardType && e.card_type !== cardType) return false
      if (q && !e.description.toLowerCase().includes(q)) return false
      return true
    })
  }, [search, eidolon, cardType])

  const selected = useMemo(
    () => ALL_ENGRAVINGS.find(e => e.engraving_id === selectedId) ?? null,
    [selectedId],
  )
  const clar = selected ? findClarification('engraving', selected.engraving_id) : undefined

  return (
    <div className="flex h-full overflow-hidden">
      {/* Filters */}
      <div className="flex w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r border-[#282828] bg-[#181818] p-3">
        <input
          type="search"
          placeholder={t('encyclopedia.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded border border-[#333] bg-[#222] px-2 py-1.5 text-xs text-[#e5e7eb] placeholder:text-[#555]"
        />
        <FilterRow label={t('encyclopedia.engravings.eidolon')} options={EIDOLONS} value={eidolon} onChange={setEidolon} />
        <FilterRow label={t('encyclopedia.engravings.cardType')} options={CARD_TYPES} value={cardType} onChange={setCardType} />
      </div>

      {/* List */}
      <div className="w-72 shrink-0 overflow-y-auto border-r border-[#282828]">
        {filtered.length === 0 ? (
          <p className="p-4 text-xs text-[#555]">{t('encyclopedia.empty')}</p>
        ) : (
          filtered.map(e => (
            <button
              key={e.engraving_id}
              type="button"
              onClick={() => setSelectedId(e.engraving_id)}
              className={`block w-full border-b border-[#1e1e1e] px-3 py-2 text-left transition-colors ${
                selectedId === e.engraving_id ? 'bg-[#1f1730]' : 'hover:bg-[#1a1a1a]'
              }`}
            >
              <span className="mb-0.5 flex gap-1">
                <Badge>{e.eidolon}</Badge>
                <Badge>{e.card_type}</Badge>
              </span>
              <span className="block truncate text-xs text-[#cbd5e1]">{e.description}</span>
            </button>
          ))
        )}
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-5">
        {!selected ? (
          <p className="text-sm text-[#555]">{t('encyclopedia.selectPrompt')}</p>
        ) : (
          <div className="flex max-w-xl flex-col gap-4">
            <div className="flex flex-wrap gap-1">
              <Badge>{selected.eidolon}</Badge>
              <Badge>{selected.card_type}</Badge>
              {selected.modifiers.map(m => (
                <Badge key={m}>{m}</Badge>
              ))}
            </div>

            <div className="rounded-lg border border-[#282828] bg-[#161616] p-3">
              {clar ? (
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#c084fc]">
                      {t('encyclopedia.clarification')}
                    </p>
                    <RichDescription
                      text={clar.text[lang]}
                      className="text-xs leading-relaxed text-[#e5e7eb]"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#555]">
                      {t('encyclopedia.gameText')}
                    </p>
                    <p className="text-xs leading-relaxed text-[#777]">{selected.description}</p>
                  </div>
                </div>
              ) : (
                <RichDescription
                  text={selected.description}
                  className="text-xs leading-relaxed text-[#d4d4d4]"
                />
              )}
            </div>

            {selected.allowed_classes.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#666]">
                  {t('encyclopedia.engravings.classes')}
                </p>
                <div className="flex flex-wrap gap-1">
                  {selected.allowed_classes.map(c => (
                    <Badge key={c}>{c}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
