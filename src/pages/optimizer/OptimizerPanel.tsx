import { useQuery } from '@tanstack/react-query'
import { Play, Square } from 'lucide-react'
import { api } from '@/lib/api'
import type { OptimizerConfig, EquipmentSet } from '@/lib/types'
import type { Combatant } from '@/lib/types'
import { SetCombobox } from './SetCombobox'
import type { ComboboxOption } from './SetCombobox'
import type { OptimizeProgress } from '@/lib/types'

const SLOT_4_STATS = ['ATK%', 'DEF%', 'HP%', 'CRate', 'CDmg']
const SLOT_5_STATS = [
  'ATK%', 'DEF%', 'HP%',
  'Passion DMG%', 'Order DMG%', 'Justice DMG%', 'Void DMG%', 'Instinct DMG%',
]
const SLOT_6_STATS = ['ATK%', 'DEF%', 'HP%', 'Ego']

const MAIN_STAT_SLOTS = [
  { label: 'Main stat slot 4', key: 'main_stat_4' as const, opts: SLOT_4_STATS },
  { label: 'Main stat slot 5', key: 'main_stat_5' as const, opts: SLOT_5_STATS },
  { label: 'Main stat slot 6', key: 'main_stat_6' as const, opts: SLOT_6_STATS },
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

  const setOptions: ComboboxOption[] = sets.map((s) => ({
    id: String(s.id),
    label: s.name,
  }))

  const heroOptions: ComboboxOption[] = combatants.map((c) => ({
    id: c.char_id,
    label: c.name,
  }))

  function patch(partial: Partial<OptimizerConfig>) {
    onChange({ ...config, ...partial })
  }

  const canRun = dataLoaded && config.char_name !== '' && !isRunning

  const panelBase = 'w-64 shrink-0 bg-[#252320] border-r border-[#2e2c28] p-4'

  if (!dataLoaded) {
    return (
      <aside className={`${panelBase} flex items-start`}>
        <p className="text-sm text-[#a09d96] mt-2">
          Carregue um arquivo na tela Fragmentos para usar o otimizador.
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
        <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
          Personagem
        </label>
        <select
          value={config.char_name}
          onChange={(e) => patch({ char_name: e.target.value })}
          disabled={disabled || combatants.length === 0}
          className="w-full bg-[#2e2c28] border border-[#3a3835] rounded px-2.5 py-1.5 text-xs text-[#faf9f5] outline-none focus:border-[#cc785c] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Selecione...</option>
          {combatants.map((c) => (
            <option key={c.char_id} value={c.char_id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* 4-piece set */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
          Set 4 peças
        </label>
        <SetCombobox
          options={setOptions}
          selected={config.four_piece_sets.map(String)}
          onChange={(ids) => patch({ four_piece_sets: ids.map(Number) })}
          maxSelect={1}
          placeholder="Qualquer"
          disabled={disabled}
          isLoading={setsLoading}
        />
      </div>

      {/* 2-piece sets */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
          Sets 2 peças
        </label>
        <SetCombobox
          options={setOptions}
          selected={config.two_piece_sets.map(String)}
          onChange={(ids) => patch({ two_piece_sets: ids.map(Number) })}
          maxSelect={2}
          placeholder="Nenhum"
          disabled={disabled}
          isLoading={setsLoading}
        />
      </div>

      {/* Main stats */}
      {MAIN_STAT_SLOTS.map(({ label, key, opts }) => (
        <div key={key} className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
            {label}
          </label>
          <select
            value={config[key] ?? ''}
            onChange={(e) => patch({ [key]: e.target.value || null })}
            disabled={disabled}
            className="w-full bg-[#2e2c28] border border-[#3a3835] rounded px-2.5 py-1.5 text-xs text-[#faf9f5] outline-none focus:border-[#cc785c] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Qualquer</option>
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
          <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
            Top % do gear
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={config.top_percent}
            onChange={(e) => patch({ top_percent: Number(e.target.value) })}
            onBlur={(e) =>
              patch({ top_percent: Math.min(100, Math.max(1, Number(e.target.value))) })
            }
            disabled={disabled}
            className="w-full bg-[#2e2c28] border border-[#3a3835] rounded px-2.5 py-1.5 text-xs text-[#faf9f5] outline-none focus:border-[#cc785c] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
            Máx. resultados
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={config.max_results}
            onChange={(e) => patch({ max_results: Number(e.target.value) })}
            onBlur={(e) =>
              patch({ max_results: Math.min(50, Math.max(1, Number(e.target.value))) })
            }
            disabled={disabled}
            className="w-full bg-[#2e2c28] border border-[#3a3835] rounded px-2.5 py-1.5 text-xs text-[#faf9f5] outline-none focus:border-[#cc785c] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.include_equipped}
            onChange={(e) => patch({ include_equipped: e.target.checked })}
            disabled={disabled}
            className="accent-[#cc785c]"
          />
          <span className="text-xs text-[#faf9f5]">Incluir gear equipado</span>
        </label>
      </div>

      {/* Excluded heroes */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wider text-[#a09d96]">
          Excluir personagens
        </label>
        <SetCombobox
          options={heroOptions}
          selected={config.excluded_heroes}
          onChange={(ids) => patch({ excluded_heroes: ids })}
          maxSelect={99}
          placeholder="Nenhum"
          disabled={disabled}
        />
      </div>

      {/* Progress bar (running only) */}
      {isRunning && (
        <div className="space-y-1">
          <div className="h-1.5 bg-[#2e2c28] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#cc785c] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-[#a09d96] tabular-nums">
            {progressPct}%
          </p>
        </div>
      )}

      {/* Run error */}
      {runError && (
        <p role="alert" className="text-xs text-[#c64545]">
          {runError}
        </p>
      )}

      {/* Run / Cancel */}
      {isRunning ? (
        <button
          type="button"
          onClick={onCancel}
          className="w-full flex items-center justify-center gap-2 bg-[#2e2c28] hover:bg-[#3a3835] border border-[#3a3835] rounded py-2 text-xs text-[#faf9f5] transition-colors"
        >
          <Square size={12} />
          Cancelar
        </button>
      ) : (
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="w-full flex items-center justify-center gap-2 bg-[#cc785c] hover:bg-[#d4895e] rounded py-2 text-xs text-[#181715] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={12} />
          Otimizar
        </button>
      )}
    </aside>
  )
}
