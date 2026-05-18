import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DECK_BUILDER_ITEMS,
  getDeckBuilderItemImageUrl,
  getItemRarityClassName,
} from '@/pages/deck-builder/deck-builder-items.utils'
import type { DeckBuilderItem } from '@/pages/deck-builder/deck-builder.types'
import { findClarification } from '../encyclopedia-content'
import { resolveLang } from '../encyclopedia.utils'
import { RichDescription } from './RichDescription'

const SLOTS = ['Weapon', 'Armor', 'Accessory']
const RARITIES = ['Rare', 'Legendary', 'Unique']

function ClarifiedDescription({ item }: { item: DeckBuilderItem }) {
  const { t, i18n } = useTranslation()
  const lang = resolveLang(i18n.language)
  const clar = findClarification('equipment', item.id)

  if (!clar) {
    return <RichDescription text={item.description} className="text-xs leading-relaxed text-[#d4d4d4]" />
  }
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#c084fc]">
          {t('encyclopedia.clarification')}
        </p>
        <RichDescription text={clar.text[lang]} className="text-xs leading-relaxed text-[#e5e7eb]" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#555]">
          {t('encyclopedia.gameText')}
        </p>
        <p className="text-xs leading-relaxed text-[#777]">{item.description}</p>
      </div>
    </div>
  )
}

function Filter({
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

export function EquipmentsTab() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [slot, setSlot] = useState<string | null>(null)
  const [rarity, setRarity] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return DECK_BUILDER_ITEMS.filter(item => {
      if (slot && item.slot !== slot) return false
      if (rarity && item.rarity !== rarity) return false
      if (q && !item.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [search, slot, rarity])

  const selected = useMemo(
    () => DECK_BUILDER_ITEMS.find(i => i.id === selectedId) ?? null,
    [selectedId],
  )
  const imageUrl = selected ? getDeckBuilderItemImageUrl(selected) : null

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
        <Filter label={t('encyclopedia.equipments.slot')} options={SLOTS} value={slot} onChange={setSlot} />
        <Filter label={t('encyclopedia.equipments.rarity')} options={RARITIES} value={rarity} onChange={setRarity} />
      </div>

      {/* List */}
      <div className="w-72 shrink-0 overflow-y-auto border-r border-[#282828]">
        {filtered.length === 0 ? (
          <p className="p-4 text-xs text-[#555]">{t('encyclopedia.empty')}</p>
        ) : (
          filtered.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`flex w-full items-center gap-2 border-b border-[#1e1e1e] px-3 py-2 text-left transition-colors ${
                selectedId === item.id ? 'bg-[#1f1730]' : 'hover:bg-[#1a1a1a]'
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full border ${getItemRarityClassName(item.rarity)}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-[#e5e7eb]">{item.name}</span>
                <span className="block text-[10px] text-[#555]">{item.slot} · {item.rarity}</span>
              </span>
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
            <div className="flex items-center gap-3">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={selected.name}
                  className={`h-14 w-14 rounded-lg border object-cover ${getItemRarityClassName(selected.rarity)}`}
                />
              )}
              <div>
                <h3 className="text-base font-bold text-white">{selected.name}</h3>
                <p className="text-xs text-[#888]">
                  {selected.slot} · {selected.rarity}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[#282828] bg-[#161616] p-3">
              <ClarifiedDescription item={selected} />
            </div>

            {selected.stat_type && selected.stat_values.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#666]">
                  {t('encyclopedia.equipments.stat')} · {selected.stat_type}
                </p>
                <div className="flex gap-2">
                  {selected.stat_values.map((v, i) => (
                    <span
                      key={i}
                      className="rounded bg-[#222] px-2 py-1 text-xs font-mono text-[#e5e7eb]"
                      title={`Lv ${i + 1}`}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-[#666]">
              {t('encyclopedia.equipments.source')}: {selected.source}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
