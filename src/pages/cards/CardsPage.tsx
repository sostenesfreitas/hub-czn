import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'
import { api } from '@/lib/api'
import type { CardEntry, CardCharacter } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  DMG:     'bg-[#7f1d1d] text-[#fca5a5]',
  Draw:    'bg-[#1e3a5f] text-[#93c5fd]',
  Buff:    'bg-[#14532d] text-[#86efac]',
  Cost:    'bg-[#3b1f6e] text-[#c4b5fd]',
  Discard: 'bg-[#292524] text-[#a8a29e]',
  Exhaust: 'bg-[#292524] text-[#a8a29e]',
  Get:     'bg-[#1a2e1a] text-[#86efac]',
  Change:  'bg-[#1c2a3a] text-[#7dd3fc]',
  Copy:    'bg-[#1c2a3a] text-[#7dd3fc]',
  Use:     'bg-[#2a1c1c] text-[#fca5a5]',
}

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? 'bg-[#222] text-[#888]'
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${cls}`}>
      {type}
    </span>
  )
}

function CardRow({ card }: { card: CardEntry }) {
  const shortId = card.card_id.replace(/^c_\d+_/, '')
  const coefficient = card.eff_value > 0 ? `${(card.eff_value / 100).toFixed(2)}× ATK` : '—'

  return (
    <tr className="border-b border-[#1e1e1e] hover:bg-[#1a1a1a] transition-colors">
      <td className="px-3 py-2">
        <div className="text-[#e5e7eb] text-xs font-medium">
          {card.name || <span className="text-[#555] italic">unnamed</span>}
        </div>
        <div className="text-[#444] text-[10px] font-mono mt-0.5">{shortId}</div>
      </td>
      <td className="px-3 py-2 text-center">
        <span className="text-[#e5e7eb] text-xs font-mono">{card.cost}</span>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {card.effect_types.length > 0
            ? card.effect_types.map(t => <TypeBadge key={t} type={t} />)
            : <span className="text-[#444] text-[10px]">—</span>
          }
        </div>
      </td>
      <td className="px-3 py-2 text-center font-mono text-xs text-[#e5e7eb]">
        {card.eff_value > 0 ? coefficient : <span className="text-[#444]">—</span>}
      </td>
      <td className="px-3 py-2 text-center text-xs text-[#e5e7eb]">
        {card.hits > 0 ? card.hits : <span className="text-[#444]">—</span>}
      </td>
      <td className="px-3 py-2 text-center">
        {card.spark_count > 0 ? (
          <span className="text-[#facc15] text-xs font-mono" title={`${card.spark_count} spark tiers`}>
            ✦{card.spark_count}
          </span>
        ) : (
          <span className="text-[#333] text-xs">—</span>
        )}
      </td>
    </tr>
  )
}

export function CardsPage() {
  const { t } = useTranslation()
  const [selectedChar, setSelectedChar] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'dmg' | 'support'>('all')

  const { data: characters = [] } = useQuery<CardCharacter[]>({
    queryKey: ['card-characters'],
    queryFn: () => api.cardCharacters(),
    staleTime: Infinity,
  })

  const { data: allCards = [], isLoading } = useQuery<CardEntry[]>({
    queryKey: ['cards', selectedChar],
    queryFn: () => api.cards(selectedChar ?? undefined),
    staleTime: Infinity,
  })

  const filtered = allCards.filter(card => {
    if (filterType === 'dmg' && card.eff_value === 0) return false
    if (filterType === 'support' && card.eff_value > 0) return false
    if (search) {
      const q = search.toLowerCase()
      if (!card.name.toLowerCase().includes(q) && !card.card_id.includes(q)) return false
    }
    return true
  })

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div className="w-52 shrink-0 flex flex-col gap-3 p-3 bg-[#181818] border-r border-[#282828] overflow-y-auto">
        <div>
          <h2 className="text-[#ffffff] font-bold text-sm mb-1">{t('cards.title')}</h2>
          <p className="text-[#666] text-[10px]">{t('cards.description')}</p>
        </div>

        <input
          type="search"
          placeholder={t('cards.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#222] border border-[#333] text-[#e5e7eb] text-xs rounded px-2 py-1.5 w-full placeholder:text-[#555]"
        />

        <div className="flex flex-col gap-0.5">
          <p className="text-[#666] text-[10px] uppercase tracking-wide mb-0.5">{t('cards.filterType')}</p>
          {(['all', 'dmg', 'support'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterType(f)}
              className={`text-left text-xs px-2 py-1 rounded transition-colors ${
                filterType === f ? 'bg-[#c084fc] text-white' : 'text-[#888] hover:text-[#e5e7eb] hover:bg-[#222]'
              }`}
            >
              {t(`cards.filter.${f}`)}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="text-[#666] text-[10px] uppercase tracking-wide mb-0.5">{t('cards.character')}</p>
          <button
            type="button"
            onClick={() => setSelectedChar(null)}
            className={`text-left text-xs px-2 py-1 rounded transition-colors ${
              selectedChar === null ? 'bg-[#c084fc] text-white' : 'text-[#888] hover:text-[#e5e7eb] hover:bg-[#222]'
            }`}
          >
            {t('cards.allChars')}
          </button>
          {characters.map(c => (
            <button
              key={c.char_res_id}
              type="button"
              onClick={() => setSelectedChar(c.char_res_id)}
              className={`text-left text-xs px-2 py-1 rounded transition-colors truncate ${
                selectedChar === c.char_res_id ? 'bg-[#c084fc] text-white' : 'text-[#888] hover:text-[#e5e7eb] hover:bg-[#222]'
              }`}
            >
              {c.name || `#${c.char_res_id}`}
            </button>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[#888] text-sm">
            {t('common.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#444]">
            <BookOpen size={36} />
            <p className="text-sm">{t('cards.empty')}</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-[#121212] z-10">
              <tr className="border-b border-[#282828] text-[#666] text-[10px] uppercase tracking-wide">
                <th className="px-3 py-2.5 text-left">{t('cards.col.card')}</th>
                <th className="px-3 py-2.5 text-center">{t('cards.col.cost')}</th>
                <th className="px-3 py-2.5 text-left">{t('cards.col.type')}</th>
                <th className="px-3 py-2.5 text-center">{t('cards.col.coefficient')}</th>
                <th className="px-3 py-2.5 text-center">{t('cards.col.hits')}</th>
                <th className="px-3 py-2.5 text-center">{t('cards.col.spark')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(card => (
                <CardRow key={card.card_id} card={card} />
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && (
          <p className="text-[#444] text-[10px] px-3 py-2">
            {t('cards.count', { count: filtered.length })}
          </p>
        )}
      </div>
    </div>
  )
}
