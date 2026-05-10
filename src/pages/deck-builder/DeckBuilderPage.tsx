import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Copy, Plus, Trash2, Users, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { CardCharacter, CardEntry } from '@/lib/types'

type DeckCardInstance = {
  instanceId: string
  card: CardEntry
}

type SquadSlot = {
  combatantId: number | null
  cards: DeckCardInstance[]
}

const INITIAL_SQUAD: SquadSlot[] = [
  { combatantId: null, cards: [] },
  { combatantId: null, cards: [] },
  { combatantId: null, cards: [] },
]

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
}

function createCardInstance(card: CardEntry): DeckCardInstance {
  return {
    instanceId: `${card.card_id}-${Date.now()}-${Math.random()}`,
    card,
  }
}

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? 'bg-[#222] text-[#888]'

  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${cls}`}>
      {type}
    </span>
  )
}

function DeckCard({
  item,
  onDuplicate,
  onRemove,
}: {
  item: DeckCardInstance
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { card } = item
  const coefficient = card.eff_value > 0 ? `${card.eff_value}%` : '—'

  return (
    <article className="group relative min-h-[160px] rounded-lg border border-[#2d2d3a] bg-gradient-to-b from-[#222033] to-[#14141b] p-3 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-[#c084fc]" />

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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

      <div className="flex items-start gap-2 pr-14">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#0f172a] text-lg font-black text-[#93c5fd]">
          {card.cost}
        </span>

        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-bold text-white">
            {card.name}
          </h3>

          <p className="mt-0.5 text-[10px] text-[#666] font-mono truncate">
            {card.card_id}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1">
        {card.effect_types.length > 0 ? (
          card.effect_types.map(type => <TypeBadge key={type} type={type} />)
        ) : (
          <span className="text-[10px] text-[#555]">Sem efeito mapeado</span>
        )}
      </div>

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
            {card.spark_count > 0 ? `✦${card.spark_count}` : '—'}
          </p>
        </div>
      </div>
    </article>
  )
}

function CombatantDeckColumn({
  slotIndex,
  slot,
  characters,
  availableCards,
  onSelectCombatant,
  onDuplicateCard,
  onRemoveCard,
  onClearDeck,
}: {
  slotIndex: number
  slot: SquadSlot
  characters: CardCharacter[]
  availableCards: CardEntry[]
  onSelectCombatant: (combatantId: number | null) => void
  onDuplicateCard: (instanceId: string) => void
  onRemoveCard: (instanceId: string) => void
  onClearDeck: () => void
}) {
  const selectedCombatant = characters.find(c => c.char_res_id === slot.combatantId)
  const totalCost = slot.cards.reduce((sum, item) => sum + item.card.cost, 0)

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
            <p className="text-[9px] uppercase text-[#666]">Base</p>
            <p className="text-sm font-bold text-[#93c5fd]">{availableCards.length}</p>
          </div>
        </div>

        {selectedCombatant && (
          <p className="mt-3 truncate text-xs text-[#b3b3b3]">
            Deck de <span className="font-semibold text-white">{selectedCombatant.name}</span>
          </p>
        )}
      </header>

      <div className="h-[calc(100vh-330px)] min-h-[420px] overflow-y-auto p-3">
        {slot.cards.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-[#333348] text-center">
            <Plus className="text-[#555]" size={32} />
            <p className="mt-3 text-sm font-medium text-[#aaa]">
              Nenhum combatente selecionado
            </p>
            <p className="mt-1 max-w-[220px] text-xs text-[#666]">
              Selecione um combatente para carregar as cartas base dele.
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
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function DeckBuilderPage() {
  const { t } = useTranslation()
  const [squad, setSquad] = useState<SquadSlot[]>(INITIAL_SQUAD)

  const { data: characters = [], isLoading: loadingCharacters } = useQuery<CardCharacter[]>({
    queryKey: ['deck-builder-card-characters'],
    queryFn: () => api.cardCharacters(),
    staleTime: Infinity,
  })

  const { data: allCards = [], isLoading: loadingCards } = useQuery<CardEntry[]>({
    queryKey: ['deck-builder-cards'],
    queryFn: () => api.cards(),
    staleTime: Infinity,
  })

  const cardsByCharacter = useMemo(() => {
    const map = new Map<number, CardEntry[]>()

    for (const card of allCards) {
      if (card.char_res_id == null) continue
      if (!card.name.trim()) continue

      const current = map.get(card.char_res_id) ?? []
      current.push(card)
      map.set(card.char_res_id, current)
    }

    return map
  }, [allCards])

  const totalCards = squad.reduce((sum, slot) => sum + slot.cards.length, 0)
  const totalCost = squad.reduce(
    (sum, slot) => sum + slot.cards.reduce((slotSum, item) => slotSum + item.card.cost, 0),
    0,
  )
  const selectedCombatants = squad.filter(slot => slot.combatantId != null).length

async function selectCombatant(slotIndex: number, combatantId: number | null) {
  if (combatantId == null) {
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        return {
          combatantId: null,
          cards: [],
        }
      }),
    )

    return
  }

  const deckBuilderData = await api.deckBuilderCombatant(combatantId)

  const cards = deckBuilderData.starting_cards.flatMap(item =>
    Array.from({ length: item.copies }, () => createCardInstance(item.card)),
  )

  setSquad(current =>
    current.map((slot, index) => {
      if (index !== slotIndex) return slot

      return {
        combatantId,
        cards,
      }
    }),
  )
}

  function duplicateCard(slotIndex: number, instanceId: string) {
    setSquad(current =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot

        const item = slot.cards.find(card => card.instanceId === instanceId)
        if (!item) return slot

        return {
          ...slot,
          cards: [...slot.cards, createCardInstance(item.card)],
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
  }

  function resetBuilder() {
    setSquad(INITIAL_SQUAD)
  }

  const isLoading = loadingCharacters || loadingCards

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
          Carregando cartas e combatentes...
        </div>
      ) : (
        <main className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-3">
          {squad.map((slot, index) => (
            <CombatantDeckColumn
              key={index}
              slotIndex={index}
              slot={slot}
              characters={characters}
              availableCards={slot.combatantId == null ? [] : cardsByCharacter.get(slot.combatantId) ?? []}
              onSelectCombatant={combatantId => selectCombatant(index, combatantId)}
              onDuplicateCard={instanceId => duplicateCard(index, instanceId)}
              onRemoveCard={instanceId => removeCard(index, instanceId)}
              onClearDeck={() => clearDeck(index)}
            />
          ))}
        </main>
      )}
    </div>
  )
}