import { useMemo, useState } from 'react'
import {
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type { CardCharacter } from '@/lib/types'
import type {
  DeckBuilderCardWithVariants,
  DeckCardInstance,
  SquadSlot,
} from '../deck-builder.types'
import {
  getInstanceCost,
  getNeutralAndMonsterDeckBuilderCards,
} from '../deck-builder.utils'
import { CharacterAvatar } from './CharacterAvatar'
import { DeckBuilderCardSelectionModal } from './DeckBuilderCardSelectionModal'
import { DeckCardCompact } from './DeckCardCompact'
import { EgoSkillCard } from './EgoSkillCard'

type CardSelectionModalType =
  | 'starting'
  | 'epiphany'
  | 'neutral-monster'

type GroupedDeckCard = {
  key: string
  item: DeckCardInstance
  quantity: number
}

const NEUTRAL_AND_MONSTER_CARDS = getNeutralAndMonsterDeckBuilderCards()

function getGroupedDeckCards(cards: DeckCardInstance[]): GroupedDeckCard[] {
  const map = new Map<string, GroupedDeckCard>()

  for (const item of cards) {
    const variantId = item.selectedVariant?.variant_id ?? 'base'
    const key = `${item.card.card_id}::${variantId}`

    const existing = map.get(key)

    if (existing) {
      existing.quantity += 1
      continue
    }

    map.set(key, {
      key,
      item,
      quantity: 1,
    })
  }

  return Array.from(map.values())
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
  onClearDeck,
}: {
  slotIndex: number
  slot: SquadSlot
  characters: CardCharacter[]
  onSelectCombatant: (combatantId: number | null) => void
  onDuplicateCard: (instanceId: string) => void
  onRemoveCard: (instanceId: string) => void
  onAddDeckBuilderCard: (item: DeckBuilderCardWithVariants) => void
  onOpenDeckCardVariants: (item: DeckCardInstance) => void
  onOpenAvailableCardVariants: (item: DeckBuilderCardWithVariants) => void
  onClearDeck: () => void
}) {
  const [selectionModalType, setSelectionModalType] = useState<CardSelectionModalType | null>(null)

  const startingCards = slot.startingCards
  const epiphanyCards = slot.epiphanyCards
  const neutralAndMonsterCards = NEUTRAL_AND_MONSTER_CARDS
  const egoSkill = slot.egoSkill
  const selectedCombatant = characters.find(c => c.char_res_id === slot.combatantId)
  const totalCost = slot.cards.reduce((sum, item) => sum + getInstanceCost(item), 0)
  const canShowNeutralAndMonsterCards = selectedCombatant != null && neutralAndMonsterCards.length > 0

  const groupedDeckCards = useMemo(
    () => getGroupedDeckCards(slot.cards),
    [slot.cards],
  )

  const selectionModalConfig = (() => {
    if (selectionModalType === 'starting') {
      return {
        title: 'Starting Cards',
        subtitle: `${startingCards.length} cartas disponíveis para ${selectedCombatant?.name ?? 'este combatente'}.`,
        cards: startingCards,
        allowVariants: true,
      }
    }

    if (selectionModalType === 'epiphany') {
      return {
        title: 'Epiphany Cards',
        subtitle: `${epiphanyCards.length} cartas Epiphany disponíveis para ${selectedCombatant?.name ?? 'este combatente'}.`,
        cards: epiphanyCards,
        allowVariants: true,
      }
    }

    if (selectionModalType === 'neutral-monster') {
      return {
        title: 'Neutral & Monster Cards',
        subtitle: `${neutralAndMonsterCards.length} cartas neutras e de monstro disponíveis.`,
        cards: neutralAndMonsterCards,
        allowVariants: false,
      }
    }

    return null
  })()

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
        {slot.error && (
          <div className="mb-3 rounded-lg border border-[#7f1d1d] bg-[#7f1d1d]/10 p-3 text-xs text-[#fca5a5]">
            {slot.error}
          </div>
        )}

        {slot.isLoading ? (
          <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-[#333348] text-sm text-[#888]">
            Carregando cartas do combatente...
          </div>
        ) : slot.cards.length === 0 ? (
          <div className="flex h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-[#333348] text-center">
            <Plus className="text-[#555]" size={32} />

            <p className="mt-3 text-sm font-medium text-[#aaa]">
              {selectedCombatant ? 'Nenhuma carta no deck' : 'Nenhum combatente selecionado'}
            </p>

            <p className="mt-1 max-w-[240px] text-xs text-[#666]">
              {selectedCombatant
                ? 'Use as seções abaixo para adicionar cartas ao deck.'
                : 'Selecione um combatente para carregar as cartas base dele.'}
            </p>
          </div>
        ) : (
          <section className="rounded-xl border border-[#282838] bg-[#101018] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#e5e7eb]">
                  Cartas adicionadas
                </h3>

                <p className="mt-1 text-[10px] text-[#777]">
                  {groupedDeckCards.length} grupos no deck montado.
                </p>
              </div>

              <span className="rounded-lg bg-[#0f172a] px-3 py-1 text-xs font-bold text-[#93c5fd]">
                {slot.cards.length} cartas
              </span>
            </div>

            <div
              className="mt-3 grid gap-3"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(142px, 1fr))',
              }}
            >
              {groupedDeckCards.map(group => (
                <DeckCardCompact
                  key={group.key}
                  item={group.item}
                  quantity={group.quantity}
                  onDuplicate={() => onDuplicateCard(group.item.instanceId)}
                  onRemove={() => onRemoveCard(group.item.instanceId)}
                  onOpenVariants={
                    group.item.variants.length > 0 || group.item.card.spark_count > 0
                      ? () => onOpenDeckCardVariants(group.item)
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        )}

        <div className="mt-4 space-y-3">
          {startingCards.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectionModalType('starting')}
              className="flex w-full items-center justify-between rounded-xl border border-[#282838] bg-[#101018] px-4 py-3 text-left transition-colors hover:border-[#c084fc] hover:bg-[#171722]"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#e5e7eb]">
                  Starting Cards
                </p>

                <p className="mt-1 text-[10px] text-[#777]">
                  Clique para buscar e adicionar cartas iniciais.
                </p>
              </div>

              <span className="rounded-lg bg-[#0f172a] px-3 py-1 text-xs font-bold text-[#93c5fd]">
                {startingCards.length} disponíveis
              </span>
            </button>
          )}

          {epiphanyCards.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectionModalType('epiphany')}
              className="flex w-full items-center justify-between rounded-xl border border-[#282838] bg-[#101018] px-4 py-3 text-left transition-colors hover:border-[#c084fc] hover:bg-[#171722]"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-[#c084fc]" />

                  <p className="text-xs font-bold uppercase tracking-wide text-[#e5e7eb]">
                    Epiphany Cards
                  </p>
                </div>

                <p className="mt-1 text-[10px] text-[#777]">
                  Clique para buscar variantes e cartas Epiphany.
                </p>
              </div>

              <span className="rounded-lg bg-[#0f172a] px-3 py-1 text-xs font-bold text-[#93c5fd]">
                {epiphanyCards.length} disponíveis
              </span>
            </button>
          )}

          {canShowNeutralAndMonsterCards && (
            <button
              type="button"
              onClick={() => setSelectionModalType('neutral-monster')}
              className="flex w-full items-center justify-between rounded-xl border border-[#282838] bg-[#101018] px-4 py-3 text-left transition-colors hover:border-[#c084fc] hover:bg-[#171722]"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#e5e7eb]">
                  Neutral & Monster Cards
                </p>

                <p className="mt-1 text-[10px] text-[#777]">
                  Clique para buscar cartas neutras e de monstro.
                </p>
              </div>

              <span className="rounded-lg bg-[#0f172a] px-3 py-1 text-xs font-bold text-[#93c5fd]">
                {neutralAndMonsterCards.length} disponíveis
              </span>
            </button>
          )}
        </div>

        {egoSkill && <EgoSkillCard egoSkill={egoSkill} />}
      </div>

      {selectionModalConfig && (
        <DeckBuilderCardSelectionModal
          title={selectionModalConfig.title}
          subtitle={selectionModalConfig.subtitle}
          cards={selectionModalConfig.cards}
          onClose={() => setSelectionModalType(null)}
          onAddCard={onAddDeckBuilderCard}
          onOpenVariants={
            selectionModalConfig.allowVariants
              ? onOpenAvailableCardVariants
              : undefined
          }
        />
      )}
    </section>
  )
}