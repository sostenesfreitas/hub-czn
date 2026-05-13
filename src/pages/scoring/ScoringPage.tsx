import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import type { Combatant, CharPreset, GameData } from '@/lib/types'
import { ScoringPanel, DPS_WEIGHTS, TANK_WEIGHTS } from '../combatants/ScoringPanel'
import type { Preset } from '../combatants/ScoringPanel'

const GS_SECTION_KEYS = ['calc', 'formula', 'example', 'maxRolls', 'weighted', 'potential'] as const

// ─── Gear Score Explanation ────────────────────────────────────────────────

function GsExplanation() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-[#282828] bg-[#181818] overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#b3b3b3] hover:text-[#ffffff] transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="font-medium text-[#c084fc]">{t('scoring.howGSWorks')}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 font-mono text-xs text-[#b3b3b3] leading-relaxed space-y-4">
          {GS_SECTION_KEYS.map((key) => (
            <div key={key}>
              <p className="text-[#ffffff] font-semibold mb-1">{t(`scoring.gs.${key}.heading`)}</p>
              <pre className="whitespace-pre-wrap font-mono text-[#b3b3b3]">{t(`scoring.gs.${key}.body`)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Character Preset Info Card (read-only) ────────────────────────────────

interface SetInfo { name: string; icon_path?: string }

function CharPresetCard({
  preset,
  setMap,
}: {
  preset: CharPreset
  setMap: Record<number, SetInfo>
}) {
  const { t } = useTranslation()

  const slotRows = [
    { slot: 4, stats: preset.main_stat_4 },
    { slot: 5, stats: preset.main_stat_5 },
    { slot: 6, stats: preset.main_stat_6 },
  ]

  return (
    <div className="rounded-xl border border-[#282828] bg-[#181818] p-4 space-y-4">
      {/* Recommended sets */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-2">
          {t('scoring.preset.recommendedSets')}
        </p>
        <div className="flex flex-wrap gap-2">
          {preset.recommended_sets.map((id) => {
            const s = setMap[id]
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#282828] text-xs text-[#ffffff]"
              >
                {s?.icon_path && (
                  <img src={assetUrl(s.icon_path)} alt="" className="w-4 h-4 object-contain" />
                )}
                <span>{s?.name ?? `Set ${id}`}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main stats per slot */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-2">
          {t('scoring.preset.mainStats')}
        </p>
        <div className="space-y-1">
          {slotRows.map(({ slot, stats }) =>
            stats.length > 0 ? (
              <div key={slot} className="flex items-baseline gap-2 text-xs">
                <span className="text-[#b3b3b3] shrink-0">
                  {t('scoring.preset.slot', { slot })}
                </span>
                <span className="text-[#ffffff]">{stats.join(' / ')}</span>
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* Recommended substats */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-2">
          {t('scoring.preset.substats')}
        </p>
        <div className="flex flex-wrap gap-1">
          {preset.substats.map((s, i) => (
            <span
              key={s}
              className={`text-xs px-2 py-0.5 rounded-full ${
                i === 0
                  ? 'bg-[#c084fc]/20 text-[#c084fc] border border-[#c084fc]/30'
                  : 'bg-[#282828] text-[#b3b3b3]'
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export function ScoringPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [localWeights, setLocalWeights] = useState<Record<string, number> | null>(null)
  const [activePreset, setActivePreset] = useState<Preset>('custom')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedCharId, setSelectedCharId] = useState<string>('')
  const [selectedResId, setSelectedResId] = useState<number | null>(null)

  // ── global weights ──────────────────────────────────────────────────────
  const { data: serverWeights = {}, isLoading: prioritiesLoading } = useQuery({
    queryKey: ['scoring/priorities'],
    queryFn: () => api.scoringPriorities(),
    staleTime: 60_000,
    select: (d) => d.weights,
  })

  // ── combatants list for selector ────────────────────────────────────────
  const { data: combatants = [] } = useQuery<Combatant[]>({
    queryKey: ['combatants'],
    queryFn: () => api.combatants(),
    staleTime: 30_000,
  })

  // ── game data for set icons ─────────────────────────────────────────────
  const { data: gameData } = useQuery<GameData>({
    queryKey: ['game-data'],
    queryFn: () => api.gameData(),
    staleTime: Infinity,
  })
  const setMap: Record<number, SetInfo> = {}
  if (gameData?.sets) {
    for (const [id, s] of Object.entries(gameData.sets)) {
      setMap[Number(id)] = s as SetInfo
    }
  }

  // ── game preset for selected character (sets/substats info + system rec) ─
  const { data: charPreset } = useQuery<CharPreset>({
    queryKey: ['scoring/char-preset', selectedResId],
    queryFn: () => api.charPreset(selectedResId!),
    enabled: selectedResId != null,
    retry: false,
  })

  // ── per-character weight override (404 → undefined, not an error for UX) ─
  const { data: charServerWeights, isSuccess: charWeightsLoaded } = useQuery({
    queryKey: ['scoring/char-weights', selectedCharId],
    queryFn: () => api.charWeights(selectedCharId),
    enabled: selectedCharId !== '',
    retry: false,
    select: (d) => d.weights,
  })

  const hasCharOverride = selectedCharId !== '' && charWeightsLoaded && charServerWeights !== undefined

  // Reset local edits when character changes
  useEffect(() => {
    setLocalWeights(null)
    setActivePreset('custom')
    setSaveError(null)
  }, [selectedCharId])

  // ── mutations ───────────────────────────────────────────────────────────
  const saveGlobalMutation = useMutation({
    mutationFn: (weights: Record<string, number>) => api.saveScoringPriorities(weights),
    onSuccess: () => {
      setSaveError(null)
      setLocalWeights(null)
      queryClient.invalidateQueries({ queryKey: ['scoring/priorities'] })
      queryClient.invalidateQueries({ queryKey: ['combatants'] })
      queryClient.invalidateQueries({ queryKey: ['fragments'] })
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  const saveCharMutation = useMutation({
    mutationFn: (weights: Record<string, number>) => api.saveCharWeights(selectedCharId, weights),
    onSuccess: () => {
      setSaveError(null)
      setLocalWeights(null)
      queryClient.invalidateQueries({ queryKey: ['scoring/char-weights', selectedCharId] })
      queryClient.invalidateQueries({ queryKey: ['combatants'] })
      queryClient.invalidateQueries({ queryKey: ['fragments'] })
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  const deleteCharMutation = useMutation({
    mutationFn: () => api.deleteCharWeights(selectedCharId),
    onSuccess: () => {
      setSaveError(null)
      setLocalWeights(null)
      queryClient.invalidateQueries({ queryKey: ['scoring/char-weights', selectedCharId] })
      queryClient.invalidateQueries({ queryKey: ['combatants'] })
      queryClient.invalidateQueries({ queryKey: ['fragments'] })
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  // base = char override if exists, else global
  const baseWeights = selectedCharId !== ''
    ? (charServerWeights ?? serverWeights)
    : serverWeights

  const displayWeights = localWeights ?? baseWeights

  const isDirty = useMemo(
    () =>
      Object.keys(displayWeights).some((k) => displayWeights[k] !== baseWeights[k]) ||
      Object.keys(baseWeights).some((k) => baseWeights[k] !== displayWeights[k]),
    [displayWeights, baseWeights]
  )

  const activeMutation = selectedCharId !== '' ? saveCharMutation : saveGlobalMutation

  const handleWeightChange = useCallback(
    (stat: string, value: number) => {
      setLocalWeights((prev) => ({ ...(prev ?? baseWeights), [stat]: value }))
      setActivePreset('custom')
    },
    [baseWeights]
  )

  const handlePresetApply = useCallback((preset: 'dps' | 'tank') => {
    setLocalWeights(preset === 'dps' ? { ...DPS_WEIGHTS } : { ...TANK_WEIGHTS })
    setActivePreset(preset)
  }, [])

  const handleSystemPreset = useCallback(() => {
    if (charPreset) {
      setLocalWeights({ ...charPreset.weights })
      setActivePreset('system')
    }
  }, [charPreset])

  const handleReset = useCallback(() => {
    setLocalWeights(Object.fromEntries(Object.keys(serverWeights).map((k) => [k, 1])))
    setActivePreset('custom')
  }, [serverWeights])

  const handleSave = useCallback(() => {
    if (prioritiesLoading) return
    activeMutation.mutate(displayWeights)
  }, [activeMutation, displayWeights, prioritiesLoading])

  const handleResetToGlobal = useCallback(() => {
    deleteCharMutation.mutate()
  }, [deleteCharMutation])

  return (
    <div className="flex gap-4 h-full p-4 overflow-hidden">
      {/* Weight panel */}
      {!prioritiesLoading && (
        <ScoringPanel
          weights={displayWeights}
          activePreset={activePreset}
          isDirty={isDirty}
          isSaving={activeMutation.isPending}
          saveError={saveError}
          onWeightChange={handleWeightChange}
          onPresetApply={handlePresetApply}
          onReset={handleReset}
          onSave={handleSave}
          onSystemPreset={charPreset ? handleSystemPreset : undefined}
          hasCharOverride={hasCharOverride}
          onResetToGlobal={handleResetToGlobal}
        />
      )}

      {/* Right: selector + preset info + GS explanation */}
      <div className="flex-1 overflow-y-auto space-y-4">
        <h1 className="text-xl font-bold text-[#ffffff]">{t('scoring.title')}</h1>

        {/* Unified character selector */}
        <div className="rounded-xl border border-[#282828] bg-[#181818] p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#b3b3b3]">
            {t('scoring.preset.title')}
          </p>
          <select
            value={selectedCharId}
            onChange={(e) => {
              const charId = e.target.value
              setSelectedCharId(charId)
              const found = combatants.find((c) => c.char_id === charId)
              setSelectedResId(found?.res_id ?? null)
            }}
            className="w-full bg-[#282828] border border-[#333333] rounded px-2.5 py-1.5 text-sm text-[#ffffff] outline-none focus:border-[#c084fc]"
          >
            <option value="">{t('scoring.globalMode')} — {t('scoring.preset.selectChar')}</option>
            {combatants.map((c) => (
              <option key={c.char_id} value={c.char_id}>
                {c.name}
              </option>
            ))}
          </select>

          {selectedCharId && !charPreset && (
            <p className="text-xs text-[#b3b3b3]">{t('scoring.preset.noPreset')}</p>
          )}

          {charPreset && (
            <CharPresetCard preset={charPreset} setMap={setMap} />
          )}
        </div>

        {!selectedCharId && <GsExplanation />}
      </div>
    </div>
  )
}
