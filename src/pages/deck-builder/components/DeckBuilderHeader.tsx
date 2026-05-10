import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'

export function DeckBuilderHeader({
  selectedCombatants,
  totalCards,
  totalCost,
  onReset,
}: {
  selectedCombatants: number
  totalCards: number
  totalCost: number
  onReset: () => void
}) {
  const { t } = useTranslation()

  return (
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
          onClick={onReset}
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
  )
}
