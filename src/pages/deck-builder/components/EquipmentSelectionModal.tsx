import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Filter,
  Search,
  X,
} from 'lucide-react'
import type {
  DeckBuilderItem,
  DeckBuilderItemSlot,
} from '../deck-builder.types'
import {
  getDeckBuilderItemImageUrl,
  getDeckBuilderItemsBySlot,
  getItemRarityClassName,
} from '../deck-builder-items.utils'

const RARITIES = ['All', 'Rare', 'Legendary', 'Unique'] as const
const PAGE_SIZE = 12

function getStatText(item: DeckBuilderItem) {
  if (!item.stat_type || !item.stat_values || item.stat_values.length === 0) {
    return null
  }

  return `${item.stat_type}: ${item.stat_values.join('/')}`
}

function EquipmentCard({
  item,
  selected,
  onSelect,
}: {
  item: DeckBuilderItem
  selected: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const imageUrl = getDeckBuilderItemImageUrl(item)
  const statText = getStatText(item)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'relative flex min-h-[132px] gap-3 rounded-xl border bg-[#15151f] p-3 text-left transition hover:border-[#c084fc]',
        selected ? 'border-[#f97316]' : 'border-[#282838]',
      ].join(' ')}
    >
      <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-lg border border-[#333348] bg-[#0f0f14]">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="line-clamp-2 text-sm font-black leading-tight text-white">
            {item.name}
          </h3>

          <span
            className={[
              'rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase',
              getItemRarityClassName(item.rarity),
            ].join(' ')}
          >
            {item.rarity}
          </span>

          {selected && (
            <span className="rounded-md bg-[#f97316]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#fdba74]">
              {t('deckBuilder.selected')}
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-[#c7c7d1]">
          {item.description}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
          {statText && (
            <span className="font-black text-[#facc15]">
              {statText}
            </span>
          )}

          <span className="text-[#888]">
            {t('deckBuilder.source')}: <span className="text-[#ddd]">{item.source}</span>
          </span>
        </div>
      </div>
    </button>
  )
}

export function EquipmentSelectionModal({
  slot,
  selectedItem,
  onClose,
  onSelect,
}: {
  slot: DeckBuilderItemSlot
  selectedItem: DeckBuilderItem | null
  onClose: () => void
  onSelect: (item: DeckBuilderItem) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState<(typeof RARITIES)[number]>('All')
  const [source, setSource] = useState('All')
  const [page, setPage] = useState(1)

  const slotTitle = t(`deckBuilder.equipment.${slot}`)
  const items = getDeckBuilderItemsBySlot(slot)

  const sources = useMemo(() => {
    const values = items.flatMap(item => item.sources?.length ? item.sources : [item.source])

    return ['All', ...Array.from(new Set(values)).sort()]
  }, [items])

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return items.filter(item => {
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch) ||
        item.source.toLowerCase().includes(normalizedSearch)

      const matchesRarity = rarity === 'All' || item.rarity === rarity

      const matchesSource =
        source === 'All' ||
        item.source === source ||
        (item.sources ?? []).includes(source)

      return matchesSearch && matchesRarity && matchesSource
    })
  }, [items, rarity, search, source])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const pagedItems = filteredItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#282838] bg-[#101018] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#282838] px-4 py-3">
          <div>
            <h2 className="text-sm font-black text-white">
              {t('deckBuilder.equipment.modalTitle', { slot: slotTitle })}
            </h2>

            <p className="mt-1 text-xs text-[#888]">
              {t('deckBuilder.equipment.availableCount', {
                filtered: filteredItems.length,
                total: items.length,
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('deckBuilder.close')}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[#333348] text-[#aaa] hover:border-[#7f1d1d] hover:text-[#fca5a5]"
          >
            <X size={16} />
          </button>
        </header>

        <div className="border-b border-[#282838] p-4">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]"
            />

            <input
              value={search}
              onChange={event => handleSearch(event.target.value)}
              placeholder={t('deckBuilder.equipment.searchPlaceholder')}
              className="w-full rounded-lg border border-[#333348] bg-[#0f0f14] py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#666] focus:border-[#c084fc]"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#333348] bg-[#0f0f14] px-3 py-2 text-xs text-[#aaa]">
              <Filter size={14} />
              {t('deckBuilder.filter')}
            </div>

            <select
              value={rarity}
              onChange={event => {
                setRarity(event.target.value as typeof rarity)
                setPage(1)
              }}
              className="rounded-lg border border-[#333348] bg-[#0f0f14] px-3 py-2 text-xs text-white outline-none focus:border-[#c084fc]"
            >
              {RARITIES.map(item => (
                <option key={item} value={item}>
                  {item === 'All' ? t('deckBuilder.allRarities') : item}
                </option>
              ))}
            </select>

            <select
              value={source}
              onChange={event => {
                setSource(event.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-[#333348] bg-[#0f0f14] px-3 py-2 text-xs text-white outline-none focus:border-[#c084fc]"
            >
              {sources.map(item => (
                <option key={item} value={item}>
                  {item === 'All' ? t('deckBuilder.allSources') : item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {pagedItems.length === 0 ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-[#333348] text-sm text-[#888]">
              {t('deckBuilder.noItemsFound')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pagedItems.map(item => (
                <EquipmentCard
                  key={item.id}
                  item={item}
                  selected={selectedItem?.id === item.id}
                  onSelect={() => onSelect(item)}
                />
              ))}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-[#282838] px-4 py-3">
          <p className="text-xs text-[#777]">
            {t('deckBuilder.itemsFound', { count: filteredItems.length })}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(value => Math.max(1, value - 1))}
              className="rounded-lg border border-[#333348] px-3 py-2 text-xs font-bold text-[#ddd] disabled:opacity-40"
            >
              {t('deckBuilder.previous')}
            </button>

            <span className="text-xs text-[#888]">
              {currentPage}/{totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(value => Math.min(totalPages, value + 1))}
              className="rounded-lg border border-[#333348] px-3 py-2 text-xs font-bold text-[#ddd] disabled:opacity-40"
            >
              {t('deckBuilder.next')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
