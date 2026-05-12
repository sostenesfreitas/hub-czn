import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileUp, Trash2 } from 'lucide-react'

export function DeckBuilderHeader({
  selectedCombatants,
  totalCards,
  totalCost,
  onReset,
  onImportDeck,
  onExportDeck,
}: {
  selectedCombatants: number
  totalCards: number
  totalCost: number
  onReset: () => void
  onImportDeck: (file: File) => Promise<void>
  onExportDeck: () => Promise<void>
}) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  async function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      setIsImporting(true)
      await onImportDeck(file)
    } catch (error) {
      console.error('[Deck Builder] Erro ao importar deck:', error)
      alert(
        error instanceof Error
          ? error.message
          : 'Erro ao importar deck.',
      )
    } finally {
      setIsImporting(false)
      event.target.value = ''
    }
  }

  async function handleExportDeck() {
    try {
      setIsExporting(true)
      await onExportDeck()
    } catch (error) {
      console.error('[Deck Builder] Erro ao exportar deck:', error)
      alert(
        error instanceof Error
          ? error.message
          : 'Erro ao exportar deck.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[#282838] bg-[#101018]/95 backdrop-blur">
      <div className="flex flex-col gap-3 px-5 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[#3a3a4f] px-2.5 py-0.5 text-[11px] font-medium text-[#c084fc]">
              beta
            </span>

            <h1 className="text-xl font-bold tracking-tight">
              {t('deckBuilder.title')}
            </h1>
          </div>

          <p className="mt-0.5 text-xs text-[#b3b3b3]">
            Monte uma squad com 3 combatentes e ajuste as cartas de cada deck.
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-2 sm:w-[360px] xl:w-[380px]">
          <div className="rounded-lg border border-[#282838] bg-[#15151f] px-3 py-2">
            <p className="text-[9px] uppercase tracking-wide text-[#777]">Squad</p>
            <p className="text-lg font-bold leading-tight text-white">
              {selectedCombatants}/3
            </p>
          </div>

          <div className="rounded-lg border border-[#282838] bg-[#15151f] px-3 py-2">
            <p className="text-[9px] uppercase tracking-wide text-[#777]">Cartas</p>
            <p className="text-lg font-bold leading-tight text-white">
              {totalCards}
            </p>
          </div>

          <div className="rounded-lg border border-[#282838] bg-[#15151f] px-3 py-2">
            <p className="text-[9px] uppercase tracking-wide text-[#777]">Custo</p>
            <p className="text-lg font-bold leading-tight text-[#fb923c]">
              {totalCost}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#7f1d1d] px-3 text-xs font-semibold text-[#f87171] hover:bg-[#7f1d1d]/20"
          >
            <Trash2 size={14} />
            Resetar
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportChange}
          />

          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#34344a] px-3 text-xs font-semibold text-[#d4d4d8] hover:bg-[#1b1b29] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileUp size={14} />
            {isImporting ? 'Importando...' : 'Importar Deck'}
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportDeck}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#15803d] px-3 text-xs font-semibold text-[#bbf7d0] hover:bg-[#15803d]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={14} />
            {isExporting ? 'Exportando...' : 'Exportar Deck'}
          </button>
        </div>
      </div>
    </header>
  )
}