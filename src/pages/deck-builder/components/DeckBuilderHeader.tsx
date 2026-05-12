import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Download,
  FileUp,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import type { SavedDeck } from '../deck-builder-saved-decks.utils'

type SaveDeckModalMode = 'save' | 'save-as'

function SaveDeckModal({
  mode,
  initialName,
  isSaving,
  onClose,
  onSave,
}: {
  mode: SaveDeckModalMode
  initialName: string
  isSaving: boolean
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(initialName)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedName = name.trim()

    if (!normalizedName) {
      return
    }

    onSave(normalizedName)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#282838] bg-[#101018] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[#282838] px-4 py-3">
          <div>
            <h2 className="text-sm font-black text-white">
              {mode === 'save' ? 'Salvar deck' : 'Salvar como novo'}
            </h2>

            <p className="mt-1 text-xs text-[#888]">
              Informe um nome para encontrar esse deck depois.
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

        <div className="p-4">
          <label className="text-[10px] font-black uppercase tracking-wide text-[#777]">
            Nome do deck
          </label>

          <input
            value={name}
            onChange={event => setName(event.target.value)}
            autoFocus
            placeholder="Ex: Heidemarie Burn"
            className="mt-2 w-full rounded-lg border border-[#333348] bg-[#0f0f14] px-3 py-2 text-sm text-white outline-none placeholder:text-[#666] focus:border-[#60a5fa]"
          />

          <p className="mt-2 text-xs text-[#777]">
            O deck será salvo localmente neste dispositivo. Use exportar para compartilhar com outra pessoa.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#282838] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-[#333348] px-3 py-2 text-xs font-bold text-[#ddd] hover:bg-[#1b1b29] disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={isSaving || !name.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#15803d] bg-[#15803d]/10 px-3 py-2 text-xs font-black text-[#bbf7d0] hover:bg-[#15803d]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={14} />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export function DeckBuilderHeader({
  selectedCombatants,
  totalCards,
  totalCost,
  savedDecks,
  selectedSavedDeckId,
  onReset,
  onImportDeck,
  onExportDeck,
  onLoadSavedDeck,
  onSaveCurrentDeck,
  onSaveCurrentDeckAs,
  onDeleteSavedDeck,
}: {
  selectedCombatants: number
  totalCards: number
  totalCost: number
  savedDecks: SavedDeck[]
  selectedSavedDeckId: string | null
  onReset: () => void
  onImportDeck: (file: File) => Promise<void>
  onExportDeck: () => Promise<void>
  onLoadSavedDeck: (deckId: string) => Promise<void>
  onSaveCurrentDeck: () => Promise<void>
  onSaveCurrentDeckAs: (name: string) => Promise<void>
  onDeleteSavedDeck: (deckId: string) => void
}) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isLoadingSavedDeck, setIsLoadingSavedDeck] = useState(false)
  const [isSavingDeck, setIsSavingDeck] = useState(false)
  const [saveDeckModalMode, setSaveDeckModalMode] = useState<SaveDeckModalMode | null>(null)

  const selectedSavedDeck = savedDecks.find(deck => deck.id === selectedSavedDeckId) ?? null

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

  async function handleLoadSavedDeck(deckId: string) {
    if (!deckId) {
      return
    }

    try {
      setIsLoadingSavedDeck(true)
      await onLoadSavedDeck(deckId)
    } catch (error) {
      console.error('[Deck Builder] Erro ao carregar deck salvo:', error)
      alert(
        error instanceof Error
          ? error.message
          : 'Erro ao carregar deck salvo.',
      )
    } finally {
      setIsLoadingSavedDeck(false)
    }
  }

  async function handleSaveCurrentDeck() {
    if (!selectedSavedDeckId) {
      setSaveDeckModalMode('save')
      return
    }

    try {
      setIsSavingDeck(true)
      await onSaveCurrentDeck()
    } catch (error) {
      console.error('[Deck Builder] Erro ao salvar deck:', error)
      alert(
        error instanceof Error
          ? error.message
          : 'Erro ao salvar deck.',
      )
    } finally {
      setIsSavingDeck(false)
    }
  }

  async function handleSaveDeckWithName(name: string) {
    try {
      setIsSavingDeck(true)
      await onSaveCurrentDeckAs(name)
      setSaveDeckModalMode(null)
    } catch (error) {
      console.error('[Deck Builder] Erro ao salvar deck:', error)
      alert(
        error instanceof Error
          ? error.message
          : 'Erro ao salvar deck.',
      )
    } finally {
      setIsSavingDeck(false)
    }
  }

  function handleDeleteSavedDeck() {
    if (!selectedSavedDeck) {
      return
    }

    const confirmed = window.confirm(
      `Excluir o deck "${selectedSavedDeck.name}" dos decks salvos?`,
    )

    if (!confirmed) {
      return
    }

    onDeleteSavedDeck(selectedSavedDeck.id)
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[#282838] bg-[#101018]/95 backdrop-blur">
        <div className="flex flex-col gap-3 px-5 py-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
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

          <div className="w-full rounded-lg border border-[#282838] bg-[#15151f] px-3 py-2 2xl:w-[455px]">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-[#777]">
                Meus decks
              </p>

              <span className="text-[9px] text-[#666]">
                {savedDecks.length} salvo(s) localmente
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedSavedDeckId ?? ''}
                disabled={isLoadingSavedDeck}
                onChange={event => handleLoadSavedDeck(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-[#333348] bg-[#101018] px-3 py-2 text-xs text-white outline-none focus:border-[#60a5fa] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {isLoadingSavedDeck ? 'Carregando...' : 'Meus decks salvos...'}
                </option>

                {savedDecks.map(deck => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={isSavingDeck}
                onClick={handleSaveCurrentDeck}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#15803d] px-3 text-xs font-semibold text-[#bbf7d0] hover:bg-[#15803d]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={14} />
                {isSavingDeck ? 'Salvando...' : 'Salvar'}
              </button>

              <button
                type="button"
                disabled={isSavingDeck}
                onClick={() => setSaveDeckModalMode('save-as')}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#34344a] px-3 text-xs font-semibold text-[#d4d4d8] hover:bg-[#1b1b29] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={14} />
                Novo
              </button>

              <button
                type="button"
                disabled={!selectedSavedDeck || isSavingDeck || isLoadingSavedDeck}
                onClick={handleDeleteSavedDeck}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#7f1d1d] px-3 text-xs font-semibold text-[#f87171] hover:bg-[#7f1d1d]/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 2xl:justify-end">
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

      {saveDeckModalMode && (
        <SaveDeckModal
          mode={saveDeckModalMode}
          initialName={
            saveDeckModalMode === 'save-as' && selectedSavedDeck
              ? `${selectedSavedDeck.name} copy`
              : ''
          }
          isSaving={isSavingDeck}
          onClose={() => setSaveDeckModalMode(null)}
          onSave={handleSaveDeckWithName}
        />
      )}
    </>
  )
}