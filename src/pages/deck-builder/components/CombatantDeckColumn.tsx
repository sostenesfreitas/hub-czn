import { useMemo, useState } from 'react'
import {
  ChevronRight,
  Copy,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import type { CardCharacter } from '@/lib/types'
import type {
  DeckBuilderCardWithVariants,
  DeckBuilderItem,
  DeckBuilderItemSlot,
  DeckCardInstance,
  SquadSlot,
} from '../deck-builder.types'
import {
  canUseDeckBuilderEpiphanies,
  getDeckCardEpiphanySummary,
  getDeckCardIdentityKey,
  getDisplayTypes,
  getInstanceCost,
  getVariants,
} from '../deck-builder.utils'
import { SHARED_DECK_BUILDER_CARDS } from '../deck-builder-card-pool.utils'
import { AvailableDeckBuilderCardButton } from './AvailableDeckBuilderCardButton'
import { CardImage } from './CardImage'
import { CharacterAvatar } from './CharacterAvatar'
import { EgoSkillCard } from './EgoSkillCard'
import { EquipmentSelectionModal } from './EquipmentSelectionModal'
import { EquipmentSlot } from './EquipmentSlot'

type CardSelectionKind = 'starting' | 'epiphany' | 'shared'
type VariantModalInitialSection = 'description' | 'epiphany'

const CARD_SELECTION_PAGE_SIZE = 12

function getCardSelectionTitle(kind: CardSelectionKind) {
  switch (kind) {
    case 'starting':
      return 'Starting Cards'
    case 'epiphany':
      return 'Epiphany Cards'
    case 'shared':
      return 'Neutral & Monster Cards'
    default:
      return 'Cards'
  }
}

function getCardSelectionDescription(kind: CardSelectionKind) {
  switch (kind) {
    case 'starting':
      return 'Busque cartas iniciais do combatente selecionado.'
    case 'epiphany':
      return 'Busque cartas Epiphany e selecione variações.'
    case 'shared':
      return 'Busque cartas neutras e de monstro.'
    default:
      return 'Busque cartas disponíveis.'
  }
}

function getCardSectionDescription(kind: CardSelectionKind) {
  switch (kind) {
    case 'starting':
      return 'Clique para buscar e adicionar cartas iniciais.'
    case 'epiphany':
      return 'Clique para buscar variantes e cartas Epiphany.'
    case 'shared':
      return 'Clique para buscar cartas neutras e de monstro.'
    default:
      return 'Clique para buscar cartas.'
  }
}

function getCardGroupKey(item: DeckCardInstance) {
  return getDeckCardIdentityKey(item)
}

function groupDeckCards(cards: DeckCardInstance[]) {
  const groups = new Map<string, { item: DeckCardInstance; count: number }>()

  for (const item of cards) {
    const key = getCardGroupKey(item)
    const current = groups.get(key)

    if (current) {
      current.count += 1
      continue
    }

    groups.set(key, {
      item,
      count: 1,
    })
  }

  return Array.from(groups.values())
}

function getCompactTypeClassName(type: string) {
  const normalizedType = type.toLowerCase()

  if (normalizedType.includes('attack') || normalizedType.includes('dmg')) {
    return 'bg-[#7f1d1d]/95 text-[#fecaca] border-[#ef4444]/40'
  }

  if (normalizedType.includes('skill')) {
    return 'bg-[#075985]/95 text-[#bae6fd] border-[#38bdf8]/40'
  }

  if (normalizedType.includes('upgrade') || normalizedType.includes('get')) {
    return 'bg-[#064e3b]/95 text-[#bbf7d0] border-[#22c55e]/40'
  }

  if (normalizedType.includes('unique')) {
    return 'bg-[#713f12]/95 text-[#fef3c7] border-[#facc15]/40'
  }

  if (normalizedType.includes('linked')) {
    return 'bg-[#312e81]/95 text-[#ddd6fe] border-[#a78bfa]/40'
  }

  return 'bg-black/70 text-[#e5e7eb] border-white/10'
}

function CompactTypeBadge({ type }: { type: string }) {
  return (
    <span
      title={type}
      className={[
        'max-w-[58px] truncate rounded border px-1.5 py-[1px] text-[8px] font-black uppercase leading-none tracking-wide shadow',
        getCompactTypeClassName(type),
      ].join(' ')}
    >
      {type}
    </span>
  )
}

function CompactDeckCard({
  item,
  count,
  onDuplicate,
  onRemove,
  onOpenDetails,
  onOpenVariants,
}: {
  item: DeckCardInstance
  count: number
  onDuplicate: () => void
  onRemove: () => void
  onOpenDetails: () => void
  onOpenVariants?: () => void
}) {
  const displayName = item.selectedVariant?.name ?? item.card.name ?? 'Unnamed card'
  const displayCost = getInstanceCost(item)
  const displayDescription = item.selectedVariant?.description ?? item.description
  const displayTypes = getDisplayTypes(item.card, item.selectedVariant)
  const hasEpiphanySettings = item.variants.length > 0 || canUseDeckBuilderEpiphanies(item.card)
  const epiphanySummary = getDeckCardEpiphanySummary(item)

  const isLongTitle = displayName.length > 16
  const isVeryLongTitle = displayName.length > 24
  const isLongDescription = Boolean(displayDescription && displayDescription.length > 80)

  const hasCombatStats =
    item.card.eff_value > 0 ||
    item.card.hits > 0 ||
    item.card.spark_count > 0

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpenDetails}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenDetails()
        }
      }}
      className="group relative flex h-[210px] cursor-pointer flex-col overflow-hidden rounded-xl border border-[#2d2d3a] bg-[#101018] shadow-lg transition hover:border-[#60a5fa] focus:outline-none focus:ring-2 focus:ring-[#60a5fa]/45"
    >
      <div className="absolute inset-0">
        <CardImage
          card={item.card}
          variant="cover"
          className="opacity-95 transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/15 to-black/95" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black via-black/90 to-transparent" />

      <div className="absolute left-2 right-2 top-2 z-20 flex items-start justify-between gap-2">
        <span className="rounded-md border border-[#facc15]/80 bg-black/85 px-2 py-0.5 text-xs font-black text-[#facc15] shadow">
          {count}x
        </span>

        <span className="grid h-8 min-w-8 place-items-center rounded-md border border-[#075985] bg-[#082f49]/95 px-2 text-sm font-black text-[#93c5fd] shadow">
          {displayCost}
        </span>
      </div>

      <div className="relative z-10 mt-auto flex min-h-[112px] flex-col justify-end px-3 pb-2.5 pt-9">
        {displayTypes.length > 0 && (
          <div className="mb-1 flex min-h-[13px] flex-wrap gap-1">
            {displayTypes.slice(0, 2).map(type => (
              <CompactTypeBadge key={type} type={type} />
            ))}
          </div>
        )}

        <h3
          className={[
            'line-clamp-2 font-black text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]',
            isVeryLongTitle
              ? 'text-[13px] leading-[1.06]'
              : isLongTitle
                ? 'text-[14px] leading-[1.08]'
                : 'text-[15px] leading-[1.1]',
          ].join(' ')}
        >
          {displayName}
        </h3>

        {displayDescription && (
          <p
            className={[
              'mt-1 font-bold text-white/95 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]',
              isLongDescription
                ? 'line-clamp-3 text-[10px] leading-[1.1]'
                : 'line-clamp-3 text-[10.5px] leading-[1.14]',
            ].join(' ')}
          >
            {displayDescription}
          </p>
        )}

        {epiphanySummary && (
          <p className="mt-1 line-clamp-1 text-[9px] font-black leading-tight text-[#c4b5fd] drop-shadow">
            {epiphanySummary}
          </p>
        )}

        {hasCombatStats && (
          <div className="mt-1.5 flex min-h-[14px] flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] font-bold">
            {item.card.eff_value > 0 && (
              <span>
                Dano <span className="text-[#93c5fd]">{item.card.eff_value}%</span>
              </span>
            )}

            {item.card.hits > 0 && (
              <span>
                Hits <span className="text-white">{item.card.hits}</span>
              </span>
            )}

            {item.card.spark_count > 0 && (
              <span>
                Spark <span className="text-[#facc15]">+{item.card.spark_count}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 flex h-8 shrink-0 items-center justify-end gap-1.5 border-t border-white/10 bg-black/80 px-2">
        {hasEpiphanySettings && onOpenVariants && (
          <button
            type="button"
            onClick={event => {
              event.stopPropagation()
              onOpenVariants()
            }}
            title="Configurar epifanias"
            className="inline-flex h-6 items-center gap-1 rounded-md border border-[#075985] bg-[#082f49]/90 px-2 text-[9px] font-black text-[#7dd3fc] hover:bg-[#0c4a6e]"
          >
            <Sparkles size={11} />
            Epi.
          </button>
        )}

        <button
          type="button"
          onClick={event => {
            event.stopPropagation()
            onDuplicate()
          }}
          title="Duplicar carta"
          className="grid h-6 w-6 place-items-center rounded-md border border-[#333348] bg-[#111827]/90 text-[#d8b4fe] hover:bg-[#312e81]"
        >
          <Copy size={12} />
        </button>

        <button
          type="button"
          onClick={event => {
            event.stopPropagation()
            onRemove()
          }}
          title="Remover carta"
          className="grid h-6 w-6 place-items-center rounded-md border border-[#333348] bg-[#111827]/90 text-[#fca5a5] hover:bg-[#7f1d1d]"
        >
          <X size={12} />
        </button>
      </div>
    </article>
  )
}

function CardSectionButton({
  kind,
  count,
  onClick,
}: {
  kind: CardSelectionKind
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex w-full items-center justify-between rounded-lg border border-[#282838] bg-[#101018] px-3 py-2 text-left transition hover:border-[#60a5fa] hover:bg-[#151522]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <ChevronRight size={13} className="text-[#c084fc]" />

          <h3 className="text-[11px] font-black uppercase tracking-wide text-white">
            {getCardSelectionTitle(kind)}
          </h3>
        </div>

        <p className="mt-0.5 text-[10px] text-[#777]">
          {getCardSectionDescription(kind)}
        </p>
      </div>

      <span className="shrink-0 rounded-md bg-[#0f172a] px-2 py-1 text-[10px] font-black text-[#93c5fd]">
        {count} disponíveis
      </span>
    </button>
  )
}

function CardSelectionModal({
  kind,
  items,
  onClose,
  onAdd,
  onOpenVariants,
}: {
  kind: CardSelectionKind
  items: DeckBuilderCardWithVariants[]
  onClose: () => void
  onAdd: (item: DeckBuilderCardWithVariants) => void
  onOpenVariants: (item: DeckBuilderCardWithVariants) => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) {
      return items
    }

    return items.filter(item => {
      const name = item.card.name?.toLowerCase() ?? ''
      const description = item.description?.toLowerCase() ?? ''
      const types = item.card.effect_types.join(' ').toLowerCase()
      const variants = (item.variants ?? [])
        .map(variant => `${variant.name} ${variant.description} ${variant.tags.join(' ')}`)
        .join(' ')
        .toLowerCase()

      return (
        name.includes(normalizedSearch) ||
        description.includes(normalizedSearch) ||
        types.includes(normalizedSearch) ||
        variants.includes(normalizedSearch)
      )
    })
  }, [items, search])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / CARD_SELECTION_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const pagedItems = filteredItems.slice(
    (currentPage - 1) * CARD_SELECTION_PAGE_SIZE,
    currentPage * CARD_SELECTION_PAGE_SIZE,
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
              {getCardSelectionTitle(kind)}
            </h2>

            <p className="mt-1 text-xs text-[#888]">
              {getCardSelectionDescription(kind)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
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
              placeholder="Buscar por nome, descrição, efeito ou variante..."
              className="w-full rounded-lg border border-[#333348] bg-[#0f0f14] py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#666] focus:border-[#60a5fa]"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {pagedItems.length === 0 ? (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-[#333348] text-sm text-[#888]">
              Nenhuma carta encontrada.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pagedItems.map(item => (
                <AvailableDeckBuilderCardButton
                  key={item.card.card_id}
                  item={item}
                  onAdd={() => onAdd(item)}
                  onOpenVariants={
                    getVariants(item).length > 0 || canUseDeckBuilderEpiphanies(item.card)
                      ? () => onOpenVariants(item)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-[#282838] px-4 py-3">
          <p className="text-xs text-[#777]">
            {filteredItems.length} carta(s) encontrada(s)
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(value => Math.max(1, value - 1))}
              className="rounded-lg border border-[#333348] px-3 py-2 text-xs font-bold text-[#ddd] disabled:opacity-40"
            >
              Anterior
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
              Próxima
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export function CombatantDeckColumn({
  slotIndex,
  slot,
  characters,
  onSelectCombatant,
  onDuplicateCard,
  onRemoveCard,
  onAddDeckBuilderCard,
  onOpenDeckCardVariants,
  onOpenAvailableCardVariants,
  onSelectEquipment,
  onClearEquipment,
  onClearDeck,
}: {
  slotIndex: number
  slot: SquadSlot
  characters: CardCharacter[]
  onSelectCombatant: (combatantId: number | null) => void
  onDuplicateCard: (instanceId: string) => void
  onRemoveCard: (instanceId: string) => void
  onAddDeckBuilderCard: (item: DeckBuilderCardWithVariants) => void
  onOpenDeckCardVariants: (
    item: DeckCardInstance,
    initialSection?: VariantModalInitialSection,
  ) => void
  onOpenAvailableCardVariants: (item: DeckBuilderCardWithVariants) => void
  onSelectEquipment: (equipmentSlot: DeckBuilderItemSlot, item: DeckBuilderItem) => void
  onClearEquipment: (equipmentSlot: DeckBuilderItemSlot) => void
  onClearDeck: () => void
}) {
  const [cardSelectionKind, setCardSelectionKind] = useState<CardSelectionKind | null>(null)
  const [equipmentModalSlot, setEquipmentModalSlot] = useState<DeckBuilderItemSlot | null>(null)

  const startingCards = slot.startingCards
  const epiphanyCards = slot.epiphanyCards
  const sharedCards = SHARED_DECK_BUILDER_CARDS
  const egoSkill = slot.egoSkill
  const selectedCombatant = characters.find(c => c.char_res_id === slot.combatantId)
  const totalCost = slot.cards.reduce((sum, item) => sum + getInstanceCost(item), 0)
  const groupedCards = groupDeckCards(slot.cards)

  const selectedModalItems = useMemo(() => {
    switch (cardSelectionKind) {
      case 'starting':
        return startingCards
      case 'epiphany':
        return epiphanyCards
      case 'shared':
        return sharedCards
      default:
        return []
    }
  }, [cardSelectionKind, epiphanyCards, sharedCards, startingCards])

  const hasEquipment =
    Boolean(slot.equipment.weapon) ||
    Boolean(slot.equipment.armor) ||
    Boolean(slot.equipment.accessory)

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[#282838] bg-[#15151f]">
      <header className="border-b border-[#282838] p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-wide text-[#777]">
              Combatente {slotIndex + 1}
            </p>

            <div className="mt-1.5 flex items-center gap-2">
              <CharacterAvatar character={selectedCombatant} />

              <select
                value={slot.combatantId ?? ''}
                onChange={e => onSelectCombatant(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-[#333348] bg-[#101018] px-3 py-1.5 text-xs text-white outline-none focus:border-[#60a5fa]"
              >
                <option value="">Selecionar combatente...</option>
                {characters.map(character => (
                  <option key={character.char_res_id} value={character.char_res_id}>
                    {character.name || `#${character.char_res_id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={onClearDeck}
            disabled={slot.cards.length === 0 && !hasEquipment}
            title="Limpar deck"
            className="mt-5 grid h-8 w-8 place-items-center rounded-lg border border-[#333348] text-[#888] hover:border-[#7f1d1d] hover:text-[#fca5a5] disabled:opacity-40 disabled:hover:border-[#333348] disabled:hover:text-[#888]"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {selectedCombatant && (
          <div className="mt-2 rounded-lg border border-[#282838] bg-[#101018] p-1.5">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#777]">
                Equipamentos
              </p>

              <span className="text-[9px] text-[#666]">
                Weapon / Armor / Accessory
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <EquipmentSlot
                slot="weapon"
                item={slot.equipment.weapon}
                onOpen={() => setEquipmentModalSlot('weapon')}
                onClear={() => onClearEquipment('weapon')}
              />

              <EquipmentSlot
                slot="armor"
                item={slot.equipment.armor}
                onOpen={() => setEquipmentModalSlot('armor')}
                onClear={() => onClearEquipment('armor')}
              />

              <EquipmentSlot
                slot="accessory"
                item={slot.equipment.accessory}
                onOpen={() => setEquipmentModalSlot('accessory')}
                onClear={() => onClearEquipment('accessory')}
              />
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-[#101018] px-2 py-1.5">
            <p className="text-[8.5px] uppercase text-[#666]">Cartas</p>
            <p className="text-xs font-bold text-white">{slot.cards.length}</p>
          </div>

          <div className="rounded-lg bg-[#101018] px-2 py-1.5">
            <p className="text-[8.5px] uppercase text-[#666]">Custo</p>
            <p className="text-xs font-bold text-[#fb923c]">{totalCost}</p>
          </div>

          <div className="rounded-lg bg-[#101018] px-2 py-1.5">
            <p className="text-[8.5px] uppercase text-[#666]">Epiphany</p>
            <p className="text-xs font-bold text-[#93c5fd]">{epiphanyCards.length}</p>
          </div>
        </div>

        {selectedCombatant && (
          <p className="mt-2 truncate text-[11px] text-[#b3b3b3]">
            Deck de <span className="font-semibold text-white">{selectedCombatant.name}</span>
          </p>
        )}
      </header>

      <div className="h-[calc(100vh-345px)] min-h-[360px] overflow-y-auto p-2.5">
        {slot.error && (
          <div className="mb-2.5 rounded-lg border border-[#7f1d1d] bg-[#7f1d1d]/10 p-2.5 text-xs text-[#fca5a5]">
            {slot.error}
          </div>
        )}

        {slot.isLoading ? (
          <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-[#333348] text-sm text-[#888]">
            Carregando cartas do combatente...
          </div>
        ) : slot.cards.length === 0 ? (
          <div className="flex h-[210px] flex-col items-center justify-center rounded-xl border border-dashed border-[#333348] text-center">
            <Plus className="text-[#555]" size={28} />
            <p className="mt-2 text-sm font-medium text-[#aaa]">
              {selectedCombatant ? 'Nenhuma carta no deck' : 'Nenhum combatente selecionado'}
            </p>
            <p className="mt-1 max-w-[240px] text-xs text-[#666]">
              {selectedCombatant
                ? 'Use as seções abaixo para adicionar cartas ao deck.'
                : 'Selecione um combatente para carregar as cartas base dele.'}
            </p>
          </div>
        ) : (
          <section className="rounded-xl border border-[#282838] bg-[#101018] p-2.5">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-wide text-white">
                  Cartas adicionadas
                </h3>

                <p className="mt-0.5 text-[10px] text-[#777]">
                  {groupedCards.length} grupos no deck montado.
                </p>
              </div>

              <span className="rounded-md bg-[#0f172a] px-2 py-1 text-[10px] font-black text-[#93c5fd]">
                {slot.cards.length} cartas
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 2xl:grid-cols-3">
              {groupedCards.map(group => (
                <CompactDeckCard
                  key={getCardGroupKey(group.item)}
                  item={group.item}
                  count={group.count}
                  onDuplicate={() => onDuplicateCard(group.item.instanceId)}
                  onRemove={() => onRemoveCard(group.item.instanceId)}
                  onOpenDetails={() => onOpenDeckCardVariants(group.item, 'description')}
                  onOpenVariants={
                    group.item.variants.length > 0 || canUseDeckBuilderEpiphanies(group.item.card)
                      ? () => onOpenDeckCardVariants(group.item, 'epiphany')
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        )}

        {startingCards.length > 0 && (
          <CardSectionButton
            kind="starting"
            count={startingCards.length}
            onClick={() => setCardSelectionKind('starting')}
          />
        )}

        {epiphanyCards.length > 0 && (
          <CardSectionButton
            kind="epiphany"
            count={epiphanyCards.length}
            onClick={() => setCardSelectionKind('epiphany')}
          />
        )}

        {selectedCombatant && (
          <CardSectionButton
            kind="shared"
            count={sharedCards.length}
            onClick={() => setCardSelectionKind('shared')}
          />
        )}

        {egoSkill && <EgoSkillCard egoSkill={egoSkill} />}
      </div>

      {cardSelectionKind && (
        <CardSelectionModal
          kind={cardSelectionKind}
          items={selectedModalItems}
          onClose={() => setCardSelectionKind(null)}
          onAdd={item => {
            onAddDeckBuilderCard(item)
          }}
          onOpenVariants={item => {
            onOpenAvailableCardVariants(item)
            setCardSelectionKind(null)
          }}
        />
      )}

      {equipmentModalSlot && (
        <EquipmentSelectionModal
          slot={equipmentModalSlot}
          selectedItem={slot.equipment[equipmentModalSlot]}
          onClose={() => setEquipmentModalSlot(null)}
          onSelect={item => {
            onSelectEquipment(equipmentModalSlot, item)
            setEquipmentModalSlot(null)
          }}
        />
      )}
    </section>
  )
}