import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Copy, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'
import type {
  CardCharacter,
  CardEntry,
  DeckBuilderCard as ApiDeckBuilderCard,
  DeckBuilderEpiphanyVariant,
} from '@/lib/types'

type DeckCardInstance = {
  instanceId: string
  card: CardEntry
  variants: DeckBuilderEpiphanyVariant[]
  selectedVariant: DeckBuilderEpiphanyVariant | null
}

type SquadSlot = {
  combatantId: number | null
  cards: DeckCardInstance[]
  startingCards: ApiDeckBuilderCard[]
  epiphanyCards: ApiDeckBuilderCard[]
  egoSkill: ApiDeckBuilderCard | null
  showStartingCards: boolean
  showEpiphanyCards: boolean
  isLoading: boolean
  error: string | null
}

type VariantModalState = {
  slotIndex: number
  instanceId: string
} | null

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
  Upgrade: 'bg-[#3b1f6e] text-[#c4b5fd]',
}

function createEmptySlot(): SquadSlot {
  return {
    combatantId: null,
    cards: [],
    startingCards: [],
    epiphanyCards: [],
    egoSkill: null,
    showStartingCards: true,
    showEpiphanyCards: true,
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

function getEffectiveCardCost(item: DeckCardInstance) {
  return item.selectedVariant?.cost ?? item.card.cost
}

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? 'bg-[#222] text-[#888]'

  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${cls}`}>
      {type}
    </span>
  )
}

function VariantTag({ tag }: { tag: string }) {
  return (
    <span className="rounded bg-[#2e1f4d] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#d8b4fe]">
      {tag}
    </span>
  )
}

function SectionToggleButton({
  title,
  count,
  isOpen,
  onToggle,
}: {
  title: string
  count: number
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#282838] bg-[#101018] px-3 py-2 text-left hover:border-[#3b3b52]"
    >
      <div className="flex items-center gap-2">
        <ChevronDown
          size={14}
          className={`text-[#c084fc] transition-transform ${isOpen ? '' : '-rotate-90'}`}
        />

        <span className="text-xs font-bold uppercase tracking-wide text-[#e5e7eb]">
          {title}
        </span>
      </div>

      <span className="text-[10px] text-[#777]">
        {count} disponíveis
      </span>
    </button>
  )
}

function AvailableDeckBuilderCardButton({
  item,
  onAdd,
}: {
  item: ApiDeckBuilderCard
  onAdd: () => void
}) {
  const card = item.card
  const variantsCount = item.variants?.length ?? 0

  return (
    <button
      type="button"
      onClick={onAdd}
      className="rounded-lg border border-[#333348] bg-[#15151f] p-2 text-left transition-colors hover:border-[#c084fc] hover:bg-[#1f1b2e]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-white">
            {card.name}
          </p>

          <p className="mt-0.5 truncate text-[10px] font-mono text-[#666]">
            {card.card_id}
          </p>
        </div>

        <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-[#0f172a] text-xs font-bold text-[#93c5fd]">
          {card.cost}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="text-[#888]">
          {card.eff_value > 0 ? `${card.eff_value}% dano` : 'suporte'}
        </span>

        <span className="font-semibold text-[#c084fc]">
          + adicionar
        </span>
      </div>

      {variantsCount > 0 && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#082f49]/50 px-1.5 py-0.5 text-[9px] font-semibold text-[#7dd3fc]">
          <Sparkles size={10} />
          {variantsCount} variantes
        </div>
      )}
    </button>
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
  onOpenVariants: () => void
}) {
  const { card, selectedVariant } = item
  const coefficient = card.eff_value > 0 ? `${card.eff_value}%` : '—'
  const effectiveCost = getEffectiveCardCost(item)
  const hasVariants = item.variants.length > 0

  return (
    <article className="group relative min-h-[170px] rounded-lg border border-[#2d2d3a] bg-gradient-to-b from-[#222033] to-[#14141b] p-3 overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-1 ${selectedVariant ? 'bg-[#38bdf8]' : 'bg-[#c084fc]'}`} />

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {hasVariants && (
          <button
            type="button"
            onClick={onOpenVariants}
            title="Selecionar variante Epiphany"
            className="grid h-7 w-7 place-items-center rounded-md bg-[#111827]/90 text-[#7dd3fc] hover:bg-[#0c4a6e]"
          >
            <Sparkles size={14} />
          </button>
        )}

        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicar carta"
          className="grid h-7 w-7 place-items-center rounded-md bg-[#111827]/90 text-[#d8b4fe] hover:bg-[#312e81]"
        >
          <Copy size={14} />
        </button>

        <button
          type="button"
          onClick={onRemove}
          title="Remover carta"
          className="grid h-7 w-7 place-items-center rounded-md bg-[#111827]/90 text-[#fca5a5] hover:bg-[#7f1d1d]"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-start gap-2 pr-20">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#0f172a] text-lg font-black text-[#93c5fd]">
          {effectiveCost}
        </span>

        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-bold text-white">
            {selectedVariant?.name || card.name || 'Unnamed card'}
          </h3>

          <p className="mt-0.5 text-[10px] text-[#666] font-mono truncate">
            {card.card_id}
          </p>

          {selectedVariant && (
            <p className="mt-1 text-[10px] text-[#7dd3fc]">
              Base: {card.name}
            </p>
          )}
        </div>
      </div>

      {selectedVariant && (
        <div className="mt-3 rounded-md border border-[#164e63] bg-[#082f49]/40 p-2">
          <div className="mb-1 flex flex-wrap items-center gap-1">
            {selectedVariant.card_type && <TypeBadge type={selectedVariant.card_type} />}

            {selectedVariant.tags.map(tag => (
              <VariantTag key={tag} tag={tag} />
            ))}
          </div>

          <p className="line-clamp-3 text-[10px] leading-relaxed text-[#bae6fd]">
            {selectedVariant.description}
          </p>
        </div>
      )}

      {!selectedVariant && (
        <>
          <div className="mt-4 flex flex-wrap gap-1">
            {card.effect_types.length > 0 ? (
              card.effect_types.map(type => <TypeBadge key={type} type={type} />)
            ) : (
              <span className="text-[10px] text-[#555]">Sem efeito mapeado</span>
            )}
          </div>

          {hasVariants && (
            <button
              type="button"
              onClick={onOpenVariants}
              className="mt-3 inline-flex items-center gap-1 rounded-md border border-[#164e63] bg-[#082f49]/40 px-2 py-1 text-[10px] font-semibold text-[#7dd3fc] hover:bg-[#0c4a6e]/60"
            >
              <Sparkles size={12} />
              {item.variants.length} variantes
            </button>
          )}
        </>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-[#0f0f14] px-2 py-2">
          <p className="text-[9px] uppercase text-[#666]">Dano</p>
          <p className="text-xs font-bold text-[#e5e7eb]">{coefficient}</p>
        </div>

        <div className="rounded-md bg-[#0f0f14] px-2 py-2">
          <p className="text-[9px] uppercase text-[#666]">Hits</p>
          <p className="text-xs font-bold text-[#e5e7eb]">
            {card.hits > 0 ? card.hits : '—'}
          </p>
        </div>

        <div className="rounded-md bg-[#0f0f14] px-2 py-2">
          <p className="text-[9px] uppercase text-[#666]">Spark</p>
          <p className="text-xs font-bold text-[#facc15]">
            {card.spark_count > 0 ? `+${card.spark_count}` : '—'}
          </p>
        </div>
      </div>
    </article>
  )
}

function EpiphanyVariantModal({
  item,
  onClose,
  onApplyVariant,
  onClearVariant,
}: {
  item: DeckCardInstance
  onClose: () => void
  onApplyVariant: (variant: DeckBuilderEpiphanyVariant) => void
  onClearVariant: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-[#282838] bg-[#11111a] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#282838] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#7dd3fc]" />

              <h2 className="text-lg font-bold text-white">
                Epiphany Settings
              </h2>
            </div>

            <p className="mt-1 text-xs text-[#999]">
              Selecione uma variante para <span className="font-semibold text-white">{item.card.name}</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#aaa] hover:bg-[#222233] hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-xl border border-[#282838] bg-[#15151f] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[#777]">
              Carta atual
            </p>

            <div className="mt-3 rounded-lg border border-[#333348] bg-[#101018] p-3">
              <div className="flex items-start gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#0f172a] text-lg font-black text-[#93c5fd]">
                  {item.selectedVariant?.cost ?? item.card.cost}
                </span>

                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">
                    {item.selectedVariant?.name ?? item.card.name}
                  </p>

                  <p className="mt-0.5 truncate text-[10px] font-mono text-[#666]">
                    {item.card.card_id}
                  </p>
                </div>
              </div>

              {item.selectedVariant ? (
                <div className="mt-3 rounded-md border border-[#164e63] bg-[#082f49]/40 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7dd3fc]">
                    Variante selecionada
                  </p>

                  <p className="mt-1 text-xs font-bold text-white">
                    {item.selectedVariant.name}
                  </p>

                  <p className="mt-2 text-[11px] leading-relaxed text-[#bae6fd]">
                    {item.selectedVariant.description}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-[#777]">
                  Nenhuma variante aplicada.
                </p>
              )}
            </div>

            {item.selectedVariant && (
              <button
                type="button"
                onClick={onClearVariant}
                className="mt-3 w-full rounded-lg border border-[#7f1d1d] px-3 py-2 text-xs font-semibold text-[#f87171] hover:bg-[#7f1d1d]/20"
              >
                Remover variante
              </button>
            )}
          </aside>

          <section className="rounded-xl border border-[#282838] bg-[#15151f] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#777]">
                  Variantes disponíveis
                </p>

                <p className="mt-1 text-sm text-[#b3b3b3]">
                  {item.variants.length} variantes encontradas
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {item.variants.map(variant => {
                const isSelected = item.selectedVariant?.variant_id === variant.variant_id

                return (
                  <button
                    key={variant.variant_id}
                    type="button"
                    onClick={() => onApplyVariant(variant)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-[#38bdf8] bg-[#082f49]/60'
                        : 'border-[#333348] bg-[#101018] hover:border-[#38bdf8] hover:bg-[#0c1f2b]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">
                          {variant.name}
                        </p>

                        <p className="mt-0.5 text-[10px] font-mono text-[#666]">
                          {variant.variant_id}
                        </p>
                      </div>

                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-[#0f172a] text-xs font-bold text-[#93c5fd]">
                        {variant.cost}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {variant.card_type && <TypeBadge type={variant.card_type} />}

                      {variant.tags.map(tag => (
                        <VariantTag key={tag} tag={tag} />
                      ))}
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-[#cbd5e1]">
                      {variant.description}
                    </p>

                    {isSelected && (
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[#7dd3fc]">
                        Selecionada
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <footer className="flex justify-end border-t border-[#282838] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#333348] px-4 py-2 text-sm font-semibold text-[#ddd] hover:bg-[#222233]"
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
  onOpenVariants,
  onAddStartingCard,
  onAddEpiphanyCard,
  onClearDeck,
  onToggleStartingCards,
  onToggleEpiphanyCards,
}: {
  slotIndex: number
  slot: SquadSlot
  characters: CardCharacter[]
  startingCards: ApiDeckBuilderCard[]
  epiphanyCards: ApiDeckBuilderCard[]
  egoSkill: ApiDeckBuilderCard | null
  isLoading: boolean
  error: string | null
  onSelectCombatant: (combatantId: number | null) => void
  onDuplicateCard: (instanceId: string) => void
  onRemoveCard: (instanceId: string) => void
  onOpenVariants: (instanceId: string) => void
  onAddStartingCard: (item: ApiDeckBuilderCard) => void
  onAddEpiphanyCard: (item: ApiDeckBuilderCard) => void
  onClearDeck: () => void
  onToggleStartingCards: () => void
  onToggleEpiphanyCards: () => void
}) {
  const selectedCombatant = characters.find(c => c.char_res_id === slot.combatantId)
  const totalCost = slot.cards.reduce((sum, item) => sum + getEffectiveCardCost(item), 0)

  return (
    <section className="min-w-0 rounded-xl border border-[#282838] bg-[#15151f] overflow-hidden">
      <header className="border-b border-[#282838] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-[#777]">
              Combatente {slotIndex + 1}
            </p>

            <select
              value={slot.combatantId ?? ''}
              onChange={e => onSelectCombatant(e.target.value ? Number(e.target.value) : null)}
              className="mt-2 w-full rounded-lg border border-[#333348] bg-[#101018] px-3 py-2 text-sm text-white outline-none focus:border-[#c084fc]"
            >
              <option value="">Selecionar combatente...</option>
              {characters.map(character => (
                <option key={character.char_res_id} value={character.char_res_id}>
                  {character.name || `#${character.char_res_id}`}
                </option>
              ))}
            </select>
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
                ? 'Adicione cartas Starting/Epiphany ou selecione outro combatente para recarregar o deck inicial.'
                : 'Selecione um combatente para carregar as cartas base dele.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {slot.cards.map(item => (
              <DeckCard
                key={item.instanceId}
                item={item}
                onDuplicate={() => onDuplicateCard(item.instanceId)}
                onRemove={() => onRemoveCard(item.instanceId)}
                onOpenVariants={() => onOpenVariants(item.instanceId)}
              />
            ))}
          </div>
        )}

        {startingCards.length > 0 && (
          <section className="mt-4 rounded-xl border border-[#282838] bg-[#101018] p-3">
            <SectionToggleButton
              title="Starting Cards"
              count={startingCards.length}
              isOpen={slot.showStartingCards}
              onToggle={onToggleStartingCards}
            />

            {slot.showStartingCards && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {startingCards.map((item, index) => (
                  <AvailableDeckBuilderCardButton
                    key={`${item.card.card_id}-${index}`}
                    item={item}
                    onAdd={() => onAddStartingCard(item)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {epiphanyCards.length > 0 && (
          <section className="mt-4 rounded-xl border border-[#282838] bg-[#101018] p-3">
            <SectionToggleButton
              title="Epiphany Cards"
              count={epiphanyCards.length}
              isOpen={slot.showEpiphanyCards}
              onToggle={onToggleEpiphanyCards}
            />

            {slot.showEpiphanyCards && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {epiphanyCards.map(item => (
                  <AvailableDeckBuilderCardButton
                    key={item.card.card_id}
                    item={item}
                    onAdd={() => onAddEpiphanyCard(item)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {egoSkill && (
          <section className="mt-4 rounded-xl border border-[#3b2f1d] bg-[#1a1410] p-3">
            <p className="text-[10px] uppercase tracking-wide text-[#fbbf24]">
              Ego Skill
            </p>

            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">
                  {egoSkill.card.name}
                </p>

                <p className="text-[10px] font-mono text-[#777]">
                  {egoSkill.card.card_id}
                </p>
              </div>

              <span className="rounded-lg bg-[#0f0f14] px-3 py-1 text-sm font-bold text-[#fb923c]">
                {egoSkill.card.cost}
              </span>
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
  const [variantModal, setVariantModal] = useState<VariantModalState>(null)

  const { data: characters = [], isLoading: loadingCharacters } = useQuery<CardCharacter[]>({
    queryKey: ['deck-builder-card-characters'],
    queryFn: () => api.cardCharacters(),
    staleTime: Infinity,
  })

  const totalCards = squad.reduce((sum, slot) => sum + slot.cards.length, 0)

  const totalCost = squad.reduce(
    (sum, slot) => sum + slot.cards.reduce((slotSum, item) => slotSum + getEffectiveCardCost(item), 0),
    0,
  )

  const selectedCombatants = squad.filter(slot => slot.combatantId != null).length

  const selectedModalItem = variantModal
    ? squad[variantModal.slotIndex]?.cards.find(card => card.instanceId === variantModal.instanceId) ?? null
    : null

  async function selectCombatant(slotIndex: number, combatantId: number | null) {
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
          showStartingCards: true,
          showEpiphanyCards: true,
          isLoading: true,
          error: null,
        }
      }),
    )

    try {
      const deckBuilderData = await api.deckBuilderCombatant(combatantId)

      const cards = deckBuilderData.starting_cards.flatMap(item =>
        Array.from(
          { length: item.copies },
          () => createCardInstance(item.card, item.variants ?? []),
        ),
      )

      setSquad(current =>
        current.map((slot, index) => {
          if (index !== slotIndex) return slot

          return {
            ...slot,
            combatantId,
            cards,
            startingCards: deckBuilderData.starting_cards,
            epiphanyCards: deckBuilderData.epiphany_cards,
            egoSkill: deckBuilderData.ego_skill,
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
          cards: [
            ...slot.cards,
            createCardInstance(item.card, item.variants, item.selectedVariant),
          ],
        }
      }),
    )
  }

  function removeCard(slotIndex: number, instanceId: string) {
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: slot.cards.filter(card => card.instanceId !== instanceId),
        }
      }),
    )

    if (variantModal?.slotIndex === slotIndex && variantModal.instanceId === instanceId) {
      setVariantModal(null)
    }
  }

  function addStartingCard(slotIndex: number, item: ApiDeckBuilderCard) {
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: [
            ...slot.cards,
            createCardInstance(item.card, item.variants ?? []),
          ],
        }
      }),
    )
  }

  function addEpiphanyCard(slotIndex: number, item: ApiDeckBuilderCard) {
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: [
            ...slot.cards,
            createCardInstance(item.card, item.variants ?? []),
          ],
        }
      }),
    )
  }

  function applyVariant(
    slotIndex: number,
    instanceId: string,
    variant: DeckBuilderEpiphanyVariant,
  ) {
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
  }

  function clearVariant(slotIndex: number, instanceId: string) {
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
  }

  function clearDeck(slotIndex: number) {
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          cards: [],
        }
      }),
    )

    if (variantModal?.slotIndex === slotIndex) {
      setVariantModal(null)
    }
  }

  function toggleStartingCards(slotIndex: number) {
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          showStartingCards: !slot.showStartingCards,
        }
      }),
    )
  }

  function toggleEpiphanyCards(slotIndex: number) {
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          ...slot,
          showEpiphanyCards: !slot.showEpiphanyCards,
        }
      }),
    )
  }

  function resetBuilder() {
    setSquad(createInitialSquad())
    setVariantModal(null)
  }

  const isLoading = loadingCharacters

  return (
    <div className="min-h-full bg-[#0f0f14] text-[#ffffff]">
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
              onOpenVariants={instanceId => setVariantModal({ slotIndex: index, instanceId })}
              onAddStartingCard={item => addStartingCard(index, item)}
              onAddEpiphanyCard={item => addEpiphanyCard(index, item)}
              onClearDeck={() => clearDeck(index)}
              onToggleStartingCards={() => toggleStartingCards(index)}
              onToggleEpiphanyCards={() => toggleEpiphanyCards(index)}
            />
          ))}
        </main>
      )}

      {variantModal && selectedModalItem && (
        <EpiphanyVariantModal
          item={selectedModalItem}
          onClose={() => setVariantModal(null)}
          onApplyVariant={variant => applyVariant(
            variantModal.slotIndex,
            variantModal.instanceId,
            variant,
          )}
          onClearVariant={() => clearVariant(
            variantModal.slotIndex,
            variantModal.instanceId,
          )}
        />
      )}
    </div>
  )
}