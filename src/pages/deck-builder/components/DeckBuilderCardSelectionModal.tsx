import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react'
import type { DeckBuilderCardWithVariants } from '../deck-builder.types'
import { getVariants } from '../deck-builder.utils'
import { AvailableDeckBuilderCardButton } from './AvailableDeckBuilderCardButton'

const PAGE_SIZE = 12

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function cardMatchesQuery(item: DeckBuilderCardWithVariants, query: string) {
  if (!query) {
    return true
  }

  const card = item.card

  const searchableText = [
    card.name,
    card.card_id,
    card.cost.toString(),
    item.description,
    card.effect_types.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return searchableText.includes(query)
}

export function DeckBuilderCardSelectionModal({
  title,
  subtitle,
  cards,
  onClose,
  onAddCard,
  onOpenVariants,
}: {
  title: string
  subtitle: string
  cards: DeckBuilderCardWithVariants[]
  onClose: () => void
  onAddCard: (item: DeckBuilderCardWithVariants) => void
  onOpenVariants?: (item: DeckBuilderCardWithVariants) => void
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const normalizedQuery = normalizeText(query)

  const filteredCards = useMemo(
    () => cards.filter(item => cardMatchesQuery(item, normalizedQuery)),
    [cards, normalizedQuery],
  )

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE))

  const visibleCards = filteredCards.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  )

  useEffect(() => {
    setPage(1)
  }, [normalizedQuery, cards])

  useEffect(() => {
    setPage(current => Math.min(current, totalPages))
  }, [totalPages])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[#303044] bg-[#15151f] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#282838] p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">
              {title}
            </h2>

            <p className="mt-1 text-xs text-[#b3b3b3]">
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#aaa] hover:bg-[#242435] hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="border-b border-[#282838] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="relative block w-full md:max-w-md">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#777]"
              />

              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Buscar por nome, descrição, tipo ou custo..."
                className="w-full rounded-lg border border-[#333348] bg-[#101018] py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#666] focus:border-[#c084fc]"
              />
            </label>

            <div className="flex items-center justify-between gap-3 text-xs text-[#888]">
              <span>
                {filteredCards.length} de {cards.length} cartas
              </span>

              <span>
                Página {page} de {totalPages}
              </span>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {visibleCards.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[#333348] text-sm text-[#888]">
              Nenhuma carta encontrada.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleCards.map(item => {
                const hasVariants = getVariants(item).length > 0 || item.card.spark_count > 0

                return (
                  <AvailableDeckBuilderCardButton
                    key={item.card.card_id}
                    item={item}
                    onAdd={() => onAddCard(item)}
                    onOpenVariants={
                      hasVariants && onOpenVariants
                        ? () => onOpenVariants(item)
                        : undefined
                    }
                  />
                )
              })}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[#282838] p-5">
          <button
            type="button"
            onClick={() => setPage(current => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-2 rounded-lg border border-[#333348] px-4 py-2 text-sm font-semibold text-[#d1d5db] hover:bg-[#242435] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={16} />
            Anterior
          </button>

          <span className="text-xs text-[#888]">
            Mostrando {visibleCards.length} cartas
          </span>

          <button
            type="button"
            onClick={() => setPage(current => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-2 rounded-lg border border-[#333348] px-4 py-2 text-sm font-semibold text-[#d1d5db] hover:bg-[#242435] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Próxima
            <ChevronRight size={16} />
          </button>
        </footer>
      </div>
    </div>
  )
}