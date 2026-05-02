import { Loader2 } from 'lucide-react'
import type { OptimizeResult, OptimizeProgress } from '@/lib/types'
import { GearSlotCard, FinalStatsPanel } from '@/pages/combatants/CombatantDetail'

type JobState = 'idle' | 'running' | 'done' | 'cancelled' | 'error'

interface ResultsAreaProps {
  jobState: JobState
  progress: OptimizeProgress | null
  results: OptimizeResult[]
  selectedRank: number | null
  onSelectRank: (rank: number) => void
  jobError: string | null
}

export function ResultsArea({
  jobState,
  progress,
  results,
  selectedRank,
  onSelectRank,
  jobError,
}: ResultsAreaProps) {
  if (jobState === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center text-[#3a3835] text-sm">
        Configure os parâmetros e clique em Otimizar.
      </div>
    )
  }

  if (jobState === 'running') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 size={20} className="animate-spin text-[#cc785c]" />
        <p role="status" className="text-sm text-[#a09d96] text-center">
          {progress
            ? `Verificando ${progress.checked.toLocaleString()} / ${progress.total.toLocaleString()} combinações · ${progress.found} builds encontradas`
            : 'Iniciando otimização...'}
        </p>
      </div>
    )
  }

  if (jobState === 'cancelled') {
    return (
      <div className="flex-1 flex items-center justify-center text-[#a09d96] text-sm">
        Otimização cancelada.
      </div>
    )
  }

  if (jobState === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p role="alert" className="text-sm text-[#c64545] text-center">
          {jobError ?? 'Erro durante a otimização.'}
        </p>
      </div>
    )
  }

  // jobState === 'done'
  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#a09d96] text-sm">
        Nenhuma build encontrada. Tente relaxar os filtros.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div
        className="grid gap-2 px-3 py-1 text-[10px] uppercase tracking-wider text-[#a09d96] mb-1"
        style={{ gridTemplateColumns: '2rem 1fr 1fr 1fr 1fr 1fr' }}
      >
        <span>#</span>
        <span>Score</span>
        <span>ATK</span>
        <span>CRate</span>
        <span>CDmg</span>
        <span>EHP</span>
      </div>

      <div className="space-y-1">
        {results.map((r) => {
          const expanded = selectedRank === r.rank
          return (
            <div
              key={r.rank}
              className="bg-[#252320] border border-[#2e2c28] rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => onSelectRank(r.rank)}
                aria-pressed={expanded}
                className={[
                  'w-full grid gap-2 px-3 py-2.5 text-xs text-left transition-colors',
                  expanded
                    ? 'bg-[#cc785c]/10 border-b border-[#2e2c28]'
                    : 'hover:bg-[#2e2c28]',
                ].join(' ')}
                style={{ gridTemplateColumns: '2rem 1fr 1fr 1fr 1fr 1fr' }}
              >
                <span
                  className={`font-semibold ${expanded ? 'text-[#cc785c]' : 'text-[#a09d96]'}`}
                >
                  {r.rank}
                </span>
                <span className="text-[#faf9f5] font-semibold">
                  {r.score.toFixed(1)}
                </span>
                <span className="text-[#faf9f5]">
                  {r.final_stats.ATK.toLocaleString()}
                </span>
                <span className="text-[#faf9f5]">
                  {r.final_stats.CRate.toFixed(1)}%
                </span>
                <span className="text-[#faf9f5]">
                  {r.final_stats.CDmg.toFixed(1)}%
                </span>
                <span className="text-[#faf9f5]">
                  {r.final_stats.EHP.toLocaleString()}
                </span>
              </button>

              {expanded && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {r.gear_slots.map((slot) => (
                      <GearSlotCard key={slot.slot} slot={slot} />
                    ))}
                  </div>
                  <FinalStatsPanel stats={r.final_stats} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
