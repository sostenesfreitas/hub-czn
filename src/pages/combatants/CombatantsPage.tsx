import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, User } from 'lucide-react'
import { api } from '@/lib/api'
import { ScoringPanel, DPS_WEIGHTS, TANK_WEIGHTS } from './ScoringPanel'
import type { Preset } from './ScoringPanel'
import { CombatantCard } from './CombatantCard'
import { CombatantDetail } from './CombatantDetail'

export function CombatantsPage() {
  const queryClient = useQueryClient()
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)
  const [localWeights, setLocalWeights] = useState<Record<string, number> | null>(null)
  const [activePreset, setActivePreset] = useState<Preset>('custom')
  const [saveError, setSaveError] = useState<string | null>(null)

  const {
    data: combatants = [],
    isLoading: combatantsLoading,
    error: combatantsError,
  } = useQuery({
    queryKey: ['combatants'],
    queryFn: () => api.combatants(),
    staleTime: 30_000,
  })

  const { data: serverWeights = {}, isLoading: prioritiesLoading } = useQuery({
    queryKey: ['scoring/priorities'],
    queryFn: () => api.scoringPriorities(),
    staleTime: 60_000,
    select: (d) => d.weights,
  })

  const saveMutation = useMutation({
    mutationFn: (weights: Record<string, number>) => api.saveScoringPriorities(weights),
    onSuccess: () => {
      setSaveError(null)
      queryClient.invalidateQueries({ queryKey: ['combatants'] })
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  const displayWeights = localWeights ?? serverWeights

  const isDirty = useMemo(
    () =>
      Object.keys(displayWeights).some((k) => displayWeights[k] !== serverWeights[k]) ||
      Object.keys(serverWeights).some((k) => serverWeights[k] !== displayWeights[k]),
    [displayWeights, serverWeights]
  )

  const handleWeightChange = useCallback(
    (stat: string, value: number) => {
      setLocalWeights((prev) => ({ ...(prev ?? serverWeights), [stat]: value }))
      setActivePreset('custom')
    },
    [serverWeights]
  )

  const handlePresetApply = useCallback((preset: 'dps' | 'tank') => {
    setLocalWeights(preset === 'dps' ? { ...DPS_WEIGHTS } : { ...TANK_WEIGHTS })
    setActivePreset(preset)
  }, [])

  const handleReset = useCallback(() => {
    setLocalWeights(Object.fromEntries(Object.keys(serverWeights).map((k) => [k, 1])))
    setActivePreset('custom')
  }, [serverWeights])

  const handleSave = useCallback(() => {
    if (prioritiesLoading) return
    saveMutation.mutate(displayWeights)
  }, [saveMutation, displayWeights, prioritiesLoading])

  const handleCardClick = useCallback((charId: string) => {
    setSelectedCharId((prev) => (prev === charId ? null : charId))
  }, [])

  return (
    <div className="flex gap-4 h-full p-4 overflow-hidden">
      {/* Scoring panel — hidden while priorities are loading */}
      {!prioritiesLoading && (
        <ScoringPanel
          weights={displayWeights}
          activePreset={activePreset}
          isDirty={isDirty}
          isSaving={saveMutation.isPending}
          saveError={saveError}
          onWeightChange={handleWeightChange}
          onPresetApply={handlePresetApply}
          onReset={handleReset}
          onSave={handleSave}
        />
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {combatantsError ? (
          <div className="p-4">
            <p className="text-[#c64545] text-sm mb-2">Erro ao carregar combatentes.</p>
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['combatants'] })}
              className="flex items-center gap-1 text-xs text-[#a09d96] hover:text-[#faf9f5]"
            >
              <RefreshCw size={12} />
              Tentar novamente
            </button>
          </div>
        ) : combatantsLoading ? (
          <div role="status" aria-label="Carregando combatentes">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-36 rounded-xl bg-[#252320] border border-[#2e2c28] animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : combatants.length === 0 ? (
          <div role="status" className="flex flex-col items-center justify-center h-64 text-[#a09d96]">
            <User size={40} className="mb-3 opacity-40" />
            <p className="text-sm">Nenhum combatente encontrado.</p>
            <p className="text-xs mt-1 text-center">
              Carregue um arquivo de captura na tela Fragmentos.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {combatants.map((c) => (
                <CombatantCard
                  key={c.char_id}
                  combatant={c}
                  selected={selectedCharId === c.char_id}
                  onClick={() => handleCardClick(c.char_id)}
                />
              ))}
            </div>
            {selectedCharId && <CombatantDetail charId={selectedCharId} />}
          </>
        )}
      </div>
    </div>
  )
}
