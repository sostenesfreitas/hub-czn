import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Play, Square } from 'lucide-react'
import { api } from '@/lib/api'
import type { OptimizerConfig, EquipmentSet, Combatant, OptimizeProgress } from '@/lib/types'
import { SetCombobox } from './SetCombobox'
import type { ComboboxOption } from './SetCombobox'

const SLOT_4_STATS = ['ATK%', 'DEF%', 'HP%', 'CRate', 'CDmg']
const SLOT_5_STATS = [
  'ATK%', 'DEF%', 'HP%',
  'Passion DMG%', 'Order DMG%', 'Justice DMG%', 'Void DMG%', 'Instinct DMG%',
]
const SLOT_6_STATS = ['ATK%', 'DEF%', 'HP%', 'Ego']

const MAIN_STAT_SLOTS = [
  { labelKey: 'optimizer.mainStatSlot4' as const, key: 'main_stat_4' as const, opts: SLOT_4_STATS },
  { labelKey: 'optimizer.mainStatSlot5' as const, key: 'main_stat_5' as const, opts: SLOT_5_STATS },
  { labelKey: 'optimizer.mainStatSlot6' as const, key: 'main_stat_6' as const, opts: SLOT_6_STATS },
]

interface OptimizerPanelProps {
  config: OptimizerConfig
  onChange: (config: OptimizerConfig) => void
  onRun: () => void
  onCancel: () => void
  isRunning: boolean
  progress: OptimizeProgress | null
  runError: string | null
}

export function OptimizerPanel({
  config,
  onChange,
  onRun,
  onCancel,
  isRunning,
  progress,
  runError,
}: OptimizerPanelProps) {
  const { t } = useTranslation()

  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.status(),
    refetchInterval: 5_000,
  })

  const { data: combatants = [] } = useQuery<Combatant[]>({
    queryKey: ['combatants'],
    queryFn: () => api.combatants(),
    enabled: status?.data_loaded ?? false,
    staleTime: 30_000,
  })

  const { data: sets = [], isLoading: setsLoading } = useQuery<EquipmentSet[]>({
    queryKey: ['optimize/sets'],
    queryFn: () => api.optimizeSets(),
  })

  const dataLoaded = status?.data_loaded ?? false
  const disabled = isRunning

  const fourPieceOptions: ComboboxOption[] = sets
    .filter((s) => s.pieces === 4)
    .map((s) => ({ id: String(s.id), label: s.name }))

  const twoPieceOptions: ComboboxOption[] = sets
    .filter((s) => s.pieces === 2)
    .map((s) => ({ id: String(s.id), label: s.name }))

  const heroOptions: ComboboxOption[] = combatants.map((c) => ({
    id: c.char_id,
    label: c.name,
  }))

  function patch(partial: Partial<OptimizerConfig>) {
    onChange({ ...config, ...partial })
  }

  const canRun = dataLoaded && config.char_name !== '' && !isRunning

  const panelBase = 'w-64 shrink-0 bg-[#181818] border-r border-[#282828] p-4'

  if (!dataLoaded) {
    return (
      <aside className={`${panelBase} flex items-start`}>
        <p className="text-sm text-[#b3b3b3] mt-2">
          {t('optimizer.noData')}
        </p>
      </aside>
    )
  }

  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.checked / progress.total) * 100)
      : 0

  return (
    <aside className={`${panelBase} overflow-y-auto space-y-4`}>
      {/* Character */}
      <div className="space-y-1">
        <label htmlFor="optimizer-char" className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
          {t('optimizer.character')}
        </label>
        <select
          id="optimizer-char"
          value={config.char_name}
          onChange={(e) => patch({ char_name: e.target.value })}
          disabled={disabled || combatants.length === 0}
          className="w-full bg-[#282828] border border-[#333333] rounded px-2.5 py-1.5 text-xs text-[#ffffff] outline-none focus:border-[#c084fc] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">{t('optimizer.selectChar')}</option>
          {combatants.map((c) => (
            <option key={c.char_id} value={c.char_id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* 4-piece set */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
          {t('optimizer.fourPieceSet')}
        </label>
        <SetCombobox
          options={fourPieceOptions}
          selected={config.four_piece_sets.map(String)}
          onChange={(ids) => patch({ four_piece_sets: ids.map(Number) })}
          maxSelect={1}
          placeholder={t('optimizer.anyOption')}
          disabled={disabled}
          isLoading={setsLoading}
        />
      </div>

      {/* 2-piece sets */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
          {t('optimizer.twoPieceSets')}
        </label>
        <SetCombobox
          options={twoPieceOptions}
          selected={config.two_piece_sets.map(String)}
          onChange={(ids) => patch({ two_piece_sets: ids.map(Number) })}
          maxSelect={2}
          placeholder={t('optimizer.noneOption')}
          disabled={disabled}
          isLoading={setsLoading}
        />
      </div>

      {/* Main stats */}
      {MAIN_STAT_SLOTS.map(({ labelKey, key, opts }) => (
        <div key={key} className="space-y-1">
          <label htmlFor={key} className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
            {t(labelKey)}
          </label>
          <select
            id={key}
            value={config[key] ?? ''}
            onChange={(e) => patch({ [key]: e.target.value || null })}
            disabled={disabled}
            className="w-full bg-[#282828] border border-[#333333] rounded px-2.5 py-1.5 text-xs text-[#ffffff] outline-none focus:border-[#c084fc] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{t('optimizer.anyOption')}</option>
            {opts.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Filters */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="optimizer-top-pct" className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
            {t('optimizer.topPercent')}
          </label>
          <input
            id="optimizer-top-pct"
            type="number"
            min={1}
            max={100}
            value={config.top_percent}
            onChange={(e) => patch({ top_percent: Number(e.target.value) })}
            onBlur={(e) =>
              patch({ top_percent: Math.min(100, Math.max(1, Number(e.target.value))) })
            }
            disabled={disabled}
            className="w-full bg-[#282828] border border-[#333333] rounded px-2.5 py-1.5 text-xs text-[#ffffff] outline-none focus:border-[#c084fc] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="optimizer-max-results" className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
            {t('optimizer.maxResults')}
          </label>
          <input
            id="optimizer-max-results"
            type="number"
            min={1}
            max={50}
            value={config.max_results}
            onChange={(e) => patch({ max_results: Number(e.target.value) })}
            onBlur={(e) =>
              patch({ max_results: Math.min(50, Math.max(1, Number(e.target.value))) })
            }
            disabled={disabled}
            className="w-full bg-[#282828] border border-[#333333] rounded px-2.5 py-1.5 text-xs text-[#ffffff] outline-none focus:border-[#c084fc] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.include_equipped}
            onChange={(e) => patch({ include_equipped: e.target.checked })}
            disabled={disabled}
            className="accent-[#c084fc]"
          />
          <span className="text-xs text-[#ffffff]">{t('optimizer.includeEquipped')}</span>
        </label>
      </div>

      {/* Excluded heroes */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
          {t('optimizer.excludeChars')}
        </label>
        <SetCombobox
          options={heroOptions}
          selected={config.excluded_heroes}
          onChange={(ids) => patch({ excluded_heroes: ids })}
          maxSelect={99}
          placeholder={t('optimizer.noneOption')}
          disabled={disabled}
        />
      </div>

      {/* Progress bar (running only) */}
      {isRunning && (
        <div className="space-y-1">
          <div className="h-1.5 bg-[#282828] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#c084fc] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-[#b3b3b3] tabular-nums">
            {progressPct}%
          </p>
        </div>
      )}

      {/* Run error */}
      {runError && (
        <p role="alert" className="text-xs text-[#f3727f]">
          {runError}
        </p>
      )}

      {/* Run / Cancel */}
      {isRunning ? (
        <button
          type="button"
          onClick={onCancel}
          className="w-full flex items-center justify-center gap-2 bg-[#282828] hover:bg-[#333333] border border-[#333333] rounded py-2 text-xs text-[#ffffff] transition-colors"
        >
          <Square size={12} />
          {t('optimizer.cancel')}
        </button>
      ) : (
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="w-full flex items-center justify-center gap-2 bg-[#c084fc] hover:bg-[#d4895e] rounded py-2 text-xs text-[#121212] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={12} />
          {t('optimizer.run')}
        </button>
      )}
    </aside>
  )
}
