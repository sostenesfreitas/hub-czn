import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  getCardImageUrl,
  getCharacterFaceUrl,
} from '@/lib/deck-builder-assets'
import type {
  CardCharacter,
  CardEntry,
  DeckBuilderCard as ApiDeckBuilderCard,
} from '@/lib/types'

type DeckBuilderEpiphanyVariant = {
  variant_id: string
  level: number
  name: string
  cost: number
  card_type: string
  tags: string[]
  description: string
}

type DeckBuilderCardWithVariants = ApiDeckBuilderCard & {
  variants?: DeckBuilderEpiphanyVariant[]
}

type DeckCardInstance = {
  instanceId: string
  card: CardEntry
  variants: DeckBuilderEpiphanyVariant[]
  selectedVariant: DeckBuilderEpiphanyVariant | null
}

type SquadSlot = {
  combatantId: number | null
  cards: DeckCardInstance[]
  startingCards: DeckBuilderCardWithVariants[]
  epiphanyCards: DeckBuilderCardWithVariants[]
  egoSkill: DeckBuilderCardWithVariants | null
  isLoading: boolean
  error: string | null
}

type VariantModalTarget =
  | {
      type: 'deck'
      slotIndex: number
      instanceId: string
      card: CardEntry
      variants: DeckBuilderEpiphanyVariant[]
      selectedVariant: DeckBuilderEpiphanyVariant | null
    }
  | {
      type: 'available'
      slotIndex: number
      item: DeckBuilderCardWithVariants
    }

const TYPE_COLORS: Record<string, string> = {
  DMG: 'bg-[#7f1d1d] text-[#fca5a5]',
  Draw: 'bg-[#1e3a5f] text-[#93c5fd]',
  Buff: 'bg-[#14532d] text-[#86efac]',
  Cost: 'bg-[#3b1f6e] text-[#c4b5fd]',
  Discard: 'bg-[#292524] text-[#a8a29e]',
  Exhaust: 'bg-[#292524] text-[#a8a29e]',
  Get: 'bg-[#1a2e1a] text-[#86efac]',
  Change: 'bg-[#1c2a3a] text-[#7dd3fc]',
  Copy: 'bg-[#1c2a3a] text-[#7dd3fc]',
  Use: 'bg-[#2a1c1c] text-[#fca5a5]',
  Attack: 'bg-[#7f1d1d] text-[#fca5a5]',
  Skill: 'bg-[#1e3a5f] text-[#93c5fd]',
  Upgrade: 'bg-[#14532d] text-[#86efac]',
  Haste: 'bg-[#4c1d95] text-[#d8b4fe]',
  Unique: 'bg-[#78350f] text-[#fde68a]',
  Initiation: 'bg-[#0f766e] text-[#99f6e4]',
}

function createEmptySlot(): SquadSlot {
  return {
    combatantId: null,
    cards: [],
    startingCards: [],
    epiphanyCards: [],
    egoSkill: null,
    isLoading: false,
    error: null,
  }
}

function createInitialSquad(): SquadSlot[] {
  return [
    createEmptySlot(),
    createEmptySlot(),
    createEmptySlot(),
  ]
}

function getVariants(item: DeckBuilderCardWithVariants): DeckBuilderEpiphanyVariant[] {
  return item.variants ?? []
}

function createCardInstance(
  card: CardEntry,
  variants: DeckBuilderEpiphanyVariant[] = [],
  selectedVariant: DeckBuilderEpiphanyVariant | null = null,
): DeckCardInstance {
  return {
    instanceId: `${card.card_id}-${Date.now()}-${Math.random()}`,
    card,
    variants,
    selectedVariant,
  }
}

function createCardInstanceFromDeckBuilderCard(
  item: DeckBuilderCardWithVariants,
  selectedVariant: DeckBuilderEpiphanyVariant | null = null,
): DeckCardInstance {
  return createCardInstance(item.card, getVariants(item), selectedVariant)
}

function cloneCardInstance(item: DeckCardInstance): DeckCardInstance {
  return createCardInstance(item.card, item.variants, item.selectedVariant)
}

function getInstanceCost(item: DeckCardInstance) {
  return item.selectedVariant?.cost ?? item.card.cost
}

function getDisplayTypes(
  card: CardEntry,
  selectedVariant?: DeckBuilderEpiphanyVariant | null,
) {
  if (!selectedVariant) {
    return card.effect_types
  }

  const types = [
    selectedVariant.card_type,
    ...(selectedVariant.tags ?? []),
  ].filter(Boolean)

  return Array.from(new Set(types))
}

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? 'bg-[#222] text-[#888]'

  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cls}`}>
      {type}
    </span>
  )
}

function CardImage({
  card,
  className = '',
  variant = 'cover',
}: {
  card: CardEntry
  className?: string
  variant?: 'cover' | 'thumbnail' | 'contain'
}) {
  const [hasError, setHasError] = useState(false)
  const imageUrl = getCardImageUrl(card)

  if (!imageUrl || hasError) {
    return (
      <div
        className={[
          'flex h-full w-full items-center justify-center bg-[#11111a] text-[10px] text-[#666]',
          className,
        ].join(' ')}
      >
        Sem imagem
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={card.name}
      loading="lazy"
      draggable={false}
      onError={() => setHasError(true)}
      className={[
        'h-full w-full',
        variant === 'contain'
          ? 'object-contain'
          : variant === 'cover'
            ? 'object-cover object-top'
            : 'object-cover',
        className,
      ].join(' ')}
    />
  )
}

function CharacterAvatar({
  character,
}: {
  character: CardCharacter | undefined
}) {
  const [hasError, setHasError] = useState(false)

  if (!character) {
    return (
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#333348] bg-[#101018] text-[#777]">
        <Plus size={16} />
      </div>
    )
  }

  const imageUrl = getCharacterFaceUrl(character.char_res_id)

  if (!imageUrl || hasError) {
    return (
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#333348] bg-[#101018] text-xs font-bold text-[#c084fc]">
        {character.name?.slice(0, 1) ?? '?'}
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={character.name ?? `Combatente ${character.char_res_id}`}
      loading="lazy"
      draggable={false}
      onError={() => setHasError(true)}
      className="h-10 w-10 shrink-0 rounded-lg border border-[#333348] object-cover"
    />
  )
}

function DeckCard({
  item,
  onDuplicate,
  onRemove,
  onOpenVariants,
}: {
  item: DeckCardInstance
  onDuplicate: () => void
  onRemove: () => void
  onOpenVariants?: () => void
}) {
  const { card, selectedVariant } = item

  const displayName = selectedVariant?.name ?? card.name ?? 'Unnamed card'
  const displayCost = getInstanceCost(item)
  const displayDescription = selectedVariant?.description
  const displayTypes = getDisplayTypes(card, selectedVariant)
  const coefficient = card.eff_value > 0 ? `${card.eff_value}%` : '—'
  const hasVariants = item.variants.length > 0 || card.spark_count > 0

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-[#2d2d3a] bg-[#15151f] transition-colors hover:border-[#c084fc]">
      <div className="flex flex-1 gap-3 p-3">
        <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-[#2d2d3a] bg-[#101018]">
          <CardImage card={card} variant="thumbnail" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-bold text-white">
                {displayName}
              </h3>

              {selectedVariant && selectedVariant.name !== card.name && (
                <p className="mt-1 text-[10px] text-[#60a5fa]">
                  Base: {card.name}
                </p>
              )}
            </div>

            <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[#0f172a] text-sm font-bold text-[#93c5fd]">
              {displayCost}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {displayTypes.length > 0 ? (
              displayTypes.map(type => (
                <TypeBadge key={type} type={type} />
              ))
            ) : (
              <span className="text-[10px] text-[#777]">
                Sem efeito mapeado
              </span>
            )}
          </div>

          {hasVariants && !selectedVariant && onOpenVariants && (
            <button
              type="button"
              onClick={onOpenVariants}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-[#075985] bg-[#082f49]/70 px-2 py-1 text-[10px] font-semibold text-[#7dd3fc] hover:bg-[#0c4a6e]"
            >
              <Sparkles size={12} />
              {item.variants.length > 0
                ? `${item.variants.length} variantes`
                : `${card.spark_count} variantes`}
            </button>
          )}

          {displayDescription && (
            <div className="mt-2 rounded-md border border-[#0ea5e9]/20 bg-[#082f49]/20 p-2">
              <p className="line-clamp-3 text-[10px] leading-relaxed text-[#dbeafe]">
                {displayDescription}
              </p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-md bg-[#0f0f14] px-2 py-2 text-center">
              <p className="text-[9px] uppercase text-[#666]">Dano</p>
              <p className="text-xs font-bold text-[#e5e7eb]">{coefficient}</p>
            </div>

            <div className="rounded-md bg-[#0f0f14] px-2 py-2 text-center">
              <p className="text-[9px] uppercase text-[#666]">Hits</p>
              <p className="text-xs font-bold text-[#e5e7eb]">
                {card.hits > 0 ? card.hits : '—'}
              </p>
            </div>

            <div className="rounded-md bg-[#0f0f14] px-2 py-2 text-center">
              <p className="text-[9px] uppercase text-[#666]">Spark</p>
              <p className="text-xs font-bold text-[#facc15]">
                {card.spark_count > 0 ? `+${card.spark_count}` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-end gap-2 border-t border-[#282838] bg-[#11111a] px-3 py-2">
        {hasVariants && onOpenVariants && (
          <button
            type="button"
            onClick={onOpenVariants}
            title="Selecionar variante"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[#075985] bg-[#082f49]/70 px-2 text-[11px] font-semibold text-[#7dd3fc] hover:bg-[#0c4a6e]"
          >
            <Sparkles size={12} />
            Variantes
          </button>
        )}

        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicar carta"
          className="grid h-8 w-8 place-items-center rounded-md border border-[#333348] bg-[#111827]/90 text-[#d8b4fe] hover:bg-[#312e81]"
        >
          <Copy size={14} />
        </button>

        <button
          type="button"
          onClick={onRemove}
          title="Remover carta"
          className="grid h-8 w-8 place-items-center rounded-md border border-[#333348] bg-[#111827]/90 text-[#fca5a5] hover:bg-[#7f1d1d]"
        >
          <X size={14} />
        </button>
      </div>
    </article>
  )
}

function AvailableDeckBuilderCardButton({
  item,
  onAdd,
  onOpenVariants,
}: {
  item: DeckBuilderCardWithVariants
  onAdd: () => void
  onOpenVariants?: () => void
}) {
  const card = item.card
  const variants = getVariants(item)
  const hasVariants = variants.length > 0 || card.spark_count > 0

  return (
    <div className="overflow-hidden rounded-lg border border-[#333348] bg-[#15151f] transition-colors hover:border-[#c084fc] hover:bg-[#1f1b2e]">
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full gap-3 p-2 text-left"
      >
        <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-[#2d2d3a] bg-[#101018]">
          <CardImage card={card} variant="thumbnail" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-xs font-bold text-white">
              {card.name || 'Unnamed card'}
            </p>

            <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-[#0f172a] text-xs font-bold text-[#93c5fd]">
              {card.cost}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {card.effect_types.length > 0 ? (
              card.effect_types.slice(0, 2).map(type => (
                <TypeBadge key={type} type={type} />
              ))
            ) : (
              <span className="text-[10px] text-[#777]">
                suporte
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
            <span className="text-[#888]">
              {card.eff_value > 0 ? `${card.eff_value}% dano` : 'suporte'}
            </span>

            <span className="font-semibold text-[#c084fc]">
              + adicionar
            </span>
          </div>
        </div>
      </button>

      {hasVariants && onOpenVariants && (
        <div className="border-t border-[#282838] px-2 pb-2 pt-2">
          <button
            type="button"
            onClick={onOpenVariants}
            className="inline-flex items-center gap-1 rounded-md border border-[#075985] bg-[#082f49]/70 px-2 py-1 text-[10px] font-semibold text-[#7dd3fc] hover:bg-[#0c4a6e]"
          >
            <Sparkles size={12} />
            {variants.length > 0
              ? `${variants.length} variantes`
              : `${card.spark_count} variantes`}
          </button>
        </div>
      )}
    </div>
  )
}

function VariantSettingsModal({
  target,
  onClose,
  onApplyVariant,
  onClearVariant,
}: {
  target: VariantModalTarget
  onClose: () => void
  onApplyVariant: (variant: DeckBuilderEpiphanyVariant) => void
  onClearVariant?: () => void
}) {
  const card = target.type === 'deck'
    ? target.card
    : target.item.card

  const variants = target.type === 'deck'
    ? target.variants
    : getVariants(target.item)

  const selectedVariant = target.type === 'deck'
    ? target.selectedVariant
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#303044] bg-[#15151f] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#282838] p-5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#7dd3fc]" />
              <h2 className="text-lg font-bold text-white">
                Epiphany Settings
              </h2>
            </div>

            <p className="mt-1 text-xs text-[#b3b3b3]">
              Selecione uma variante para <span className="font-semibold text-white">{card.name}</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#aaa] hover:bg-[#242435] hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-xl border border-[#303044] bg-[#171722] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[#777]">
              Carta atual
            </p>

            <div className="mt-3 overflow-hidden rounded-lg border border-[#333348] bg-[#101018]">
              <div className="h-48 bg-[#101018] p-2">
                <CardImage card={card} variant="contain" />
              </div>

              <div className="p-3">
                <div className="flex items-start gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#0f172a] text-lg font-black text-[#93c5fd]">
                    {selectedVariant?.cost ?? card.cost}
                  </span>

                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold text-white">
                      {selectedVariant?.name ?? card.name}
                    </p>

                    {selectedVariant ? (
                      <p className="mt-1 text-[10px] text-[#7dd3fc]">
                        Base: {card.name}
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-[#888]">
                        Nenhuma variante aplicada.
                      </p>
                    )}
                  </div>
                </div>

                {selectedVariant && (
                  <div className="mt-3 rounded-md border border-[#0ea5e9]/30 bg-[#082f49]/30 p-2">
                    <div className="mb-1 flex flex-wrap gap-1">
                      {getDisplayTypes(card, selectedVariant).map(type => (
                        <TypeBadge key={type} type={type} />
                      ))}
                    </div>

                    <p className="text-[10px] leading-relaxed text-[#dbeafe]">
                      {selectedVariant.description}
                    </p>
                  </div>
                )}

                {selectedVariant && onClearVariant && (
                  <button
                    type="button"
                    onClick={onClearVariant}
                    className="mt-3 w-full rounded-lg border border-[#333348] px-3 py-2 text-xs font-semibold text-[#aaa] hover:border-[#f87171] hover:text-[#f87171]"
                  >
                    Remover variante
                  </button>
                )}
              </div>
            </div>
          </aside>

          <section className="rounded-xl border border-[#303044] bg-[#171722] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[#777]">
              Variantes disponíveis
            </p>

            <p className="mt-2 text-sm text-[#b3b3b3]">
              {variants.length} variantes encontradas
            </p>

            {variants.length === 0 ? (
              <div className="mt-4 flex h-64 items-center justify-center rounded-xl border border-dashed border-[#333348] text-sm text-[#888]">
                Nenhuma variante mapeada para esta carta.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {variants.map(variant => {
                  const isSelected = selectedVariant?.variant_id === variant.variant_id

                  return (
                    <button
                      key={variant.variant_id}
                      type="button"
                      onClick={() => onApplyVariant(variant)}
                      className={[
                        'rounded-lg border p-3 text-left transition-colors',
                        isSelected
                          ? 'border-[#7dd3fc] bg-[#082f49]/50'
                          : 'border-[#333348] bg-[#101018] hover:border-[#c084fc] hover:bg-[#1f1b2e]',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-bold text-white">
                            {variant.name}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1">
                            {getDisplayTypes(card, variant).map(type => (
                              <TypeBadge key={type} type={type} />
                            ))}
                          </div>
                        </div>

                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-[#0f172a] text-sm font-bold text-[#93c5fd]">
                          {variant.cost}
                        </span>
                      </div>

                      <p className="mt-3 text-xs leading-relaxed text-[#dbeafe]">
                        {variant.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#282838] p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#333348] px-4 py-2 text-sm font-semibold text-[#d1d5db] hover:bg-[#242435]"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  )
}

function CombatantDeckColumn({
  slotIndex,
  slot,
  characters,
  startingCards,
  epiphanyCards,
  egoSkill,
  isLoading,
  error,
  onSelectCombatant,
  onDuplicateCard,
  onRemoveCard,
  onAddDeckBuilderCard,
  onOpenDeckCardVariants,
  onOpenAvailableCardVariants,
  onClearDeck,
}: {
  slotIndex: number
  slot: SquadSlot
  characters: CardCharacter[]
  startingCards: DeckBuilderCardWithVariants[]
  epiphanyCards: DeckBuilderCardWithVariants[]
  egoSkill: DeckBuilderCardWithVariants | null
  isLoading: boolean
  error: string | null
  onSelectCombatant: (combatantId: number | null) => void
  onDuplicateCard: (instanceId: string) => void
  onRemoveCard: (instanceId: string) => void
  onAddDeckBuilderCard: (item: DeckBuilderCardWithVariants) => void
  onOpenDeckCardVariants: (item: DeckCardInstance) => void
  onOpenAvailableCardVariants: (item: DeckBuilderCardWithVariants) => void
  onClearDeck: () => void
}) {
  const [showStartingCards, setShowStartingCards] = useState(false)
  const [showEpiphanyCards, setShowEpiphanyCards] = useState(false)

  const selectedCombatant = characters.find(c => c.char_res_id === slot.combatantId)
  const totalCost = slot.cards.reduce((sum, item) => sum + getInstanceCost(item), 0)

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[#282838] bg-[#15151f]">
      <header className="border-b border-[#282838] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-[#777]">
              Combatente {slotIndex + 1}
            </p>

            <div className="mt-2 flex items-center gap-3">
              <CharacterAvatar character={selectedCombatant} />

              <select
                value={slot.combatantId ?? ''}
                onChange={e => onSelectCombatant(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-lg border border-[#333348] bg-[#101018] px-3 py-2 text-sm text-white outline-none focus:border-[#c084fc]"
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
            disabled={slot.cards.length === 0}
            title="Limpar deck"
            className="mt-6 grid h-9 w-9 place-items-center rounded-lg border border-[#333348] text-[#888] hover:border-[#7f1d1d] hover:text-[#fca5a5] disabled:opacity-40 disabled:hover:border-[#333348] disabled:hover:text-[#888]"
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-[#101018] px-3 py-2">
            <p className="text-[9px] uppercase text-[#666]">Cartas</p>
            <p className="text-sm font-bold text-white">{slot.cards.length}</p>
          </div>

          <div className="rounded-lg bg-[#101018] px-3 py-2">
            <p className="text-[9px] uppercase text-[#666]">Custo</p>
            <p className="text-sm font-bold text-[#fb923c]">{totalCost}</p>
          </div>

          <div className="rounded-lg bg-[#101018] px-3 py-2">
            <p className="text-[9px] uppercase text-[#666]">Epiphany</p>
            <p className="text-sm font-bold text-[#93c5fd]">{epiphanyCards.length}</p>
          </div>
        </div>

        {selectedCombatant && (
          <p className="mt-3 truncate text-xs text-[#b3b3b3]">
            Deck de <span className="font-semibold text-white">{selectedCombatant.name}</span>
          </p>
        )}
      </header>

      <div className="h-[calc(100vh-330px)] min-h-[420px] overflow-y-auto p-3">
        {error && (
          <div className="mb-3 rounded-lg border border-[#7f1d1d] bg-[#7f1d1d]/10 p-3 text-xs text-[#fca5a5]">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-[#333348] text-sm text-[#888]">
            Carregando cartas do combatente...
          </div>
        ) : slot.cards.length === 0 ? (
          <div className="flex h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-[#333348] text-center">
            <Plus className="text-[#555]" size={32} />
            <p className="mt-3 text-sm font-medium text-[#aaa]">
              {selectedCombatant ? 'Nenhuma carta no deck' : 'Nenhum combatente selecionado'}
            </p>
            <p className="mt-1 max-w-[220px] text-xs text-[#666]">
              {selectedCombatant
                ? 'Adicione cartas Starting ou Epiphany para montar o deck.'
                : 'Selecione um combatente para carregar as cartas base dele.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 items-stretch gap-3">
            {slot.cards.map(item => (
              <DeckCard
                key={item.instanceId}
                item={item}
                onDuplicate={() => onDuplicateCard(item.instanceId)}
                onRemove={() => onRemoveCard(item.instanceId)}
                onOpenVariants={
                  item.variants.length > 0 || item.card.spark_count > 0
                    ? () => onOpenDeckCardVariants(item)
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {startingCards.length > 0 && (
          <section className="mt-4 rounded-xl border border-[#282838] bg-[#101018] p-3">
            <button
              type="button"
              onClick={() => setShowStartingCards(current => !current)}
              className="flex w-full items-center justify-between rounded-lg border border-[#282838] bg-[#0f0f14] px-3 py-2 text-left"
            >
              <div className="flex items-center gap-2">
                {showStartingCards ? (
                  <ChevronDown size={14} className="text-[#c084fc]" />
                ) : (
                  <ChevronRight size={14} className="text-[#c084fc]" />
                )}

                <h3 className="text-xs font-bold uppercase tracking-wide text-[#e5e7eb]">
                  Starting Cards
                </h3>
              </div>

              <span className="text-[10px] text-[#777]">
                {startingCards.length} disponíveis
              </span>
            </button>

            {showStartingCards && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {startingCards.map(item => (
                  <AvailableDeckBuilderCardButton
                    key={item.card.card_id}
                    item={item}
                    onAdd={() => onAddDeckBuilderCard(item)}
                    onOpenVariants={
                      getVariants(item).length > 0 || item.card.spark_count > 0
                        ? () => onOpenAvailableCardVariants(item)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {epiphanyCards.length > 0 && (
          <section className="mt-4 rounded-xl border border-[#282838] bg-[#101018] p-3">
            <button
              type="button"
              onClick={() => setShowEpiphanyCards(current => !current)}
              className="flex w-full items-center justify-between rounded-lg border border-[#282838] bg-[#0f0f14] px-3 py-2 text-left"
            >
              <div className="flex items-center gap-2">
                {showEpiphanyCards ? (
                  <ChevronDown size={14} className="text-[#c084fc]" />
                ) : (
                  <ChevronRight size={14} className="text-[#c084fc]" />
                )}

                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-[#c084fc]" />

                  <h3 className="text-xs font-bold uppercase tracking-wide text-[#e5e7eb]">
                    Epiphany Cards
                  </h3>
                </div>
              </div>

              <span className="text-[10px] text-[#777]">
                {epiphanyCards.length} disponíveis
              </span>
            </button>

            {showEpiphanyCards && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {epiphanyCards.map(item => (
                  <AvailableDeckBuilderCardButton
                    key={item.card.card_id}
                    item={item}
                    onAdd={() => onAddDeckBuilderCard(item)}
                    onOpenVariants={
                      getVariants(item).length > 0 || item.card.spark_count > 0
                        ? () => onOpenAvailableCardVariants(item)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {egoSkill && (
          <section className="mt-4 overflow-hidden rounded-xl border border-[#3b2f1d] bg-[#1a1410]">
            <div className="flex gap-3 p-3">
              <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-[#3b2f1d] bg-[#101018]">
                <CardImage card={egoSkill.card} variant="thumbnail" />
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
                      suporte
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </section>
  )
}

export function DeckBuilderPage() {
  const { t } = useTranslation()
  const [squad, setSquad] = useState<SquadSlot[]>(createInitialSquad)
  const [variantModalTarget, setVariantModalTarget] = useState<VariantModalTarget | null>(null)

  const { data: characters = [], isLoading: loadingCharacters } = useQuery<CardCharacter[]>({
    queryKey: ['deck-builder-card-characters'],
    queryFn: () => api.cardCharacters(),
    staleTime: Infinity,
  })

  const totalCards = squad.reduce((sum, slot) => sum + slot.cards.length, 0)

  const totalCost = squad.reduce(
    (sum, slot) => sum + slot.cards.reduce((slotSum, item) => slotSum + getInstanceCost(item), 0),
    0,
  )

  const selectedCombatants = squad.filter(slot => slot.combatantId != null).length

  async function selectCombatant(slotIndex: number, combatantId: number | null) {
    setVariantModalTarget(null)

    if (combatantId == null) {
      setSquad(current =>
        current.map((slot, index) => {
          if (index !== slotIndex) return slot

          return createEmptySlot()
        }),
      )

      return
    }

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          combatantId,
          cards: [],
          startingCards: [],
          epiphanyCards: [],
          egoSkill: null,
          isLoading: true,
          error: null,
        }
      }),
    )

    try {
      const deckBuilderData = await api.deckBuilderCombatant(combatantId)

      const startingCards = deckBuilderData.starting_cards as DeckBuilderCardWithVariants[]
      const epiphanyCards = deckBuilderData.epiphany_cards as DeckBuilderCardWithVariants[]
      const egoSkill = deckBuilderData.ego_skill as DeckBuilderCardWithVariants | null

      const cards = startingCards.flatMap(item =>
        Array.from({ length: item.copies }, () => createCardInstanceFromDeckBuilderCard(item)),
      )

      setSquad(current =>
        current.map((slot, index) => {
          if (index !== slotIndex) return slot

          return {
            ...slot,
            combatantId,
            cards,
            startingCards,
            epiphanyCards,
            egoSkill,
            isLoading: false,
            error: null,
          }
        }),
      )
    } catch (error) {
      setSquad(current =>
        current.map((slot, index) => {
          if (index !== slotIndex) return slot

          return {
            ...slot,
            combatantId,
            cards: [],
            startingCards: [],
            epiphanyCards: [],
            egoSkill: null,
            isLoading: false,
            error: error instanceof Error
              ? error.message
              : 'Erro ao carregar cartas do combatente.',
          }
        }),
      )
    }
  }

  function duplicateCard(slotIndex: number, instanceId: string) {
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        const item = slot.cards.find(card => card.instanceId === instanceId)
        if (!item) return slot

        return {
          ...slot,
          cards: [...slot.cards, cloneCardInstance(item)],
        }
      }),
    )
  }

  function removeCard(slotIndex: number, instanceId: string) {
    setVariantModalTarget(current => {
      if (current?.type === 'deck' && current.instanceId === instanceId) {
        return null
      }

      return current
    })

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: slot.cards.filter(card => card.instanceId !== instanceId),
        }
      }),
    )
  }

  function addDeckBuilderCard(
    slotIndex: number,
    item: DeckBuilderCardWithVariants,
    selectedVariant: DeckBuilderEpiphanyVariant | null = null,
  ) {
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: [
            ...slot.cards,
            createCardInstanceFromDeckBuilderCard(item, selectedVariant),
          ],
        }
      }),
    )
  }

  function clearDeck(slotIndex: number) {
    setVariantModalTarget(current => {
      if (current?.slotIndex === slotIndex) {
        return null
      }

      return current
    })

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: [],
        }
      }),
    )
  }

  function resetBuilder() {
    setVariantModalTarget(null)
    setSquad(createInitialSquad())
  }

  function openDeckCardVariants(slotIndex: number, item: DeckCardInstance) {
    setVariantModalTarget({
      type: 'deck',
      slotIndex,
      instanceId: item.instanceId,
      card: item.card,
      variants: item.variants,
      selectedVariant: item.selectedVariant,
    })
  }

  function openAvailableCardVariants(slotIndex: number, item: DeckBuilderCardWithVariants) {
    setVariantModalTarget({
      type: 'available',
      slotIndex,
      item,
    })
  }

  function applyVariant(variant: DeckBuilderEpiphanyVariant) {
    if (!variantModalTarget) return

    if (variantModalTarget.type === 'available') {
      addDeckBuilderCard(variantModalTarget.slotIndex, variantModalTarget.item, variant)
      setVariantModalTarget(null)
      return
    }

    const { slotIndex, instanceId } = variantModalTarget

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: slot.cards.map(item => {
            if (item.instanceId !== instanceId) return item

            return {
              ...item,
              selectedVariant: variant,
            }
          }),
        }
      }),
    )

    setVariantModalTarget(current => {
      if (!current || current.type !== 'deck') return current

      return {
        ...current,
        selectedVariant: variant,
      }
    })
  }

  function clearVariant() {
    if (!variantModalTarget || variantModalTarget.type !== 'deck') return

    const { slotIndex, instanceId } = variantModalTarget

    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: slot.cards.map(item => {
            if (item.instanceId !== instanceId) return item

            return {
              ...item,
              selectedVariant: null,
            }
          }),
        }
      }),
    )

    setVariantModalTarget(current => {
      if (!current || current.type !== 'deck') return current

      return {
        ...current,
        selectedVariant: null,
      }
    })
  }

  const isLoading = loadingCharacters

  return (
    <div className="min-h-full bg-[#0f0f14] text-white">
      <header className="sticky top-0 z-20 border-b border-[#282838] bg-[#101018]/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-[#3a3a4f] px-3 py-1 text-xs font-medium text-[#c084fc]">
                beta
              </span>

              <h1 className="text-2xl font-bold tracking-tight">
                {t('deckBuilder.title')}
              </h1>
            </div>

            <p className="mt-1 text-sm text-[#b3b3b3]">
              Monte uma squad com 3 combatentes e ajuste as cartas de cada deck.
            </p>
          </div>

          <button
            type="button"
            onClick={resetBuilder}
            className="inline-flex items-center gap-2 rounded-lg border border-[#7f1d1d] px-3 py-2 text-sm font-semibold text-[#f87171] hover:bg-[#7f1d1d]/20"
          >
            <Trash2 size={15} />
            Resetar
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 pb-4 md:w-[560px]">
          <div className="rounded-lg border border-[#282838] bg-[#15151f] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-[#777]">Squad</p>
            <p className="mt-1 text-xl font-bold text-white">
              {selectedCombatants}/3
            </p>
          </div>

          <div className="rounded-lg border border-[#282838] bg-[#15151f] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-[#777]">Cartas</p>
            <p className="mt-1 text-xl font-bold text-white">
              {totalCards}
            </p>
          </div>

          <div className="rounded-lg border border-[#282838] bg-[#15151f] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-[#777]">Custo</p>
            <p className="mt-1 text-xl font-bold text-[#fb923c]">
              {totalCost}
            </p>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex h-[calc(100vh-180px)] items-center justify-center text-sm text-[#888]">
          Carregando combatentes...
        </div>
      ) : (
        <main className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-3">
          {squad.map((slot, index) => (
            <CombatantDeckColumn
              key={index}
              slotIndex={index}
              slot={slot}
              characters={characters}
              startingCards={slot.startingCards}
              epiphanyCards={slot.epiphanyCards}
              egoSkill={slot.egoSkill}
              isLoading={slot.isLoading}
              error={slot.error}
              onSelectCombatant={combatantId => selectCombatant(index, combatantId)}
              onDuplicateCard={instanceId => duplicateCard(index, instanceId)}
              onRemoveCard={instanceId => removeCard(index, instanceId)}
              onAddDeckBuilderCard={item => addDeckBuilderCard(index, item)}
              onOpenDeckCardVariants={item => openDeckCardVariants(index, item)}
              onOpenAvailableCardVariants={item => openAvailableCardVariants(index, item)}
              onClearDeck={() => clearDeck(index)}
            />
          ))}
        </main>
      )}

      {variantModalTarget && (
        <VariantSettingsModal
          target={variantModalTarget}
          onClose={() => setVariantModalTarget(null)}
          onApplyVariant={applyVariant}
          onClearVariant={
            variantModalTarget.type === 'deck'
              ? clearVariant
              : undefined
          }
        />
      )}
    </div>
  )
}