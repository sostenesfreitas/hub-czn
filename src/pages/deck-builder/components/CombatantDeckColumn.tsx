import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
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
import { getInstanceCost, getVariants } from '../deck-builder.utils'
import { AvailableDeckBuilderCardButton } from './AvailableDeckBuilderCardButton'
import { CharacterAvatar } from './CharacterAvatar'
import { DeckCard } from './DeckCard'
import { EgoSkillCard } from './EgoSkillCard'

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
  const [showStartingCards, setShowStartingCards] = useState(false)
  const [showEpiphanyCards, setShowEpiphanyCards] = useState(false)

  const startingCards = slot.startingCards
  const epiphanyCards = slot.epiphanyCards
  const egoSkill = slot.egoSkill
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

        {egoSkill && <EgoSkillCard egoSkill={egoSkill} />}
      </div>
    </section>
  )
}
