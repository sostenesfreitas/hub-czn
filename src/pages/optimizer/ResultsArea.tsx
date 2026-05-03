import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api, assetUrl } from '@/lib/api'
import type { OptimizeResult, OptimizeProgress, CombatantStats, FinalStats, Combatant } from '@/lib/types'
import { GearSlotCard } from '../combatants/CombatantDetail'

type JobState = 'idle' | 'running' | 'done' | 'cancelled' | 'error'

interface ResultsAreaProps {
  jobState: JobState
  progress: OptimizeProgress | null
  results: OptimizeResult[]
  selectedRank: number | null
  onSelectRank: (rank: number) => void
  jobError: string | null
  charId: string
}

// ─── Stats Comparison ─────────────────────────────────────────────────────────

function StatsComparison({
  current,
  build,
}: {
  current: FinalStats
  build: FinalStats
}) {
  const rows: Array<{ label: string; cur: number; next: number; pct?: boolean }> = [
    { label: 'ATK', cur: current.ATK, next: build.ATK },
    { label: 'DEF', cur: current.DEF, next: build.DEF },
    { label: 'HP', cur: current.HP, next: build.HP },
    { label: 'CRate', cur: current.CRate, next: build.CRate, pct: true },
    { label: 'CDmg', cur: current.CDmg, next: build.CDmg, pct: true },
    { label: 'EHP', cur: current.EHP, next: build.EHP },
  ]

  return (
    <div className="rounded-xl border border-[#282828] bg-[#181818] overflow-hidden">
      <div
        className="grid text-[10px] uppercase tracking-wider text-[#666666] px-3 py-1.5 border-b border-[#282828]"
        style={{ gridTemplateColumns: '4rem 1fr 1fr 1fr' }}
      >
        <span>Stat</span>
        <span className="text-right">Atual</span>
        <span className="text-right">Build</span>
        <span className="text-right">Delta</span>
      </div>
      {rows.map(({ label, cur, next, pct }) => {
        const delta = next - cur
        const sign = delta > 0 ? '+' : ''
        const deltaColor =
          delta > 0 ? 'text-[#4ade80]' : delta < 0 ? 'text-[#f3727f]' : 'text-[#555555]'
        const fmt = (v: number) => (pct ? `${v.toFixed(1)}%` : v.toLocaleString())
        const fmtDelta = (v: number) =>
          pct ? `${sign}${v.toFixed(1)}%` : `${sign}${Math.round(v).toLocaleString()}`
        return (
          <div
            key={label}
            className="grid text-xs px-3 py-1 odd:bg-[#121212]"
            style={{ gridTemplateColumns: '4rem 1fr 1fr 1fr' }}
          >
            <span className="text-[#b3b3b3]">{label}</span>
            <span className="text-right text-[#ffffff]">{fmt(cur)}</span>
            <span className="text-right text-[#c084fc]">{fmt(next)}</span>
            <span className={`text-right font-semibold ${deltaColor}`}>{fmtDelta(delta)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Expanded Build ───────────────────────────────────────────────────────────

function ExpandedBuild({
  result,
  currentStats,
  combatants,
}: {
  result: OptimizeResult
  currentStats: CombatantStats | undefined
  combatants: Combatant[]
}) {
  return (
    <div className="p-4 space-y-4">
      {currentStats && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-2">
            Comparação de Stats
          </p>
          <StatsComparison current={currentStats.final_stats} build={result.final_stats} />
        </div>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-2">Peças</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {result.gear_slots.map((slot) => {
            const owner = slot.equipped_to
              ? combatants.find((c) => c.char_id === slot.equipped_to)
              : undefined
            return (
              <GearSlotCard
                key={slot.slot}
                slot={slot}
                equippedToPortrait={owner?.portrait_url ? assetUrl(owner.portrait_url) : undefined}
                equippedToName={owner?.name}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const COLS = '2rem 3.5rem minmax(0,2fr) 1fr 1fr 1fr 1fr'

export function ResultsArea({
  jobState,
  progress,
  results,
  selectedRank,
  onSelectRank,
  jobError,
  charId,
}: ResultsAreaProps) {
  const { t } = useTranslation()

  const { data: combatants = [] } = useQuery<Combatant[]>({
    queryKey: ['combatants'],
    queryFn: () => api.combatants(),
    staleTime: 30_000,
  })

  const { data: currentStats } = useQuery<CombatantStats>({
    queryKey: ['combatants', charId, 'stats'],
    queryFn: () => api.combatantStats(charId),
    enabled: charId !== '' && results.length > 0,
    staleTime: 30_000,
  })

  if (jobState === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center text-[#333333] text-sm">
        {t('optimizer.idle')}
      </div>
    )
  }

  if (jobState === 'running') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 size={20} className="animate-spin text-[#c084fc]" />
        <p role="status" className="text-sm text-[#b3b3b3] text-center">
          {progress
            ? t('optimizer.running', {
                checked: progress.checked.toLocaleString(),
                total: progress.total.toLocaleString(),
                found: progress.found,
              })
            : t('optimizer.starting')}
        </p>
      </div>
    )
  }

  if (jobState === 'cancelled') {
    return (
      <div className="flex-1 flex items-center justify-center text-[#b3b3b3] text-sm">
        {t('optimizer.cancelled')}
      </div>
    )
  }

  if (jobState === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p role="alert" className="text-sm text-[#f3727f] text-center">
          {jobError ?? t('optimizer.error')}
        </p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#b3b3b3] text-sm">
        {t('optimizer.noBuilds')}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div
        className="grid gap-2 px-3 py-1 text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-1"
        style={{ gridTemplateColumns: COLS }}
      >
        <span>#</span>
        <span>Score</span>
        <span>Sets</span>
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
              className="bg-[#181818] border border-[#282828] rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => onSelectRank(r.rank)}
                aria-pressed={expanded}
                className={[
                  'w-full grid gap-2 px-3 py-2.5 text-xs text-left transition-colors',
                  expanded ? 'bg-[#c084fc]/10 border-b border-[#282828]' : 'hover:bg-[#282828]',
                ].join(' ')}
                style={{ gridTemplateColumns: COLS }}
              >
                <span className={`font-semibold ${expanded ? 'text-[#c084fc]' : 'text-[#b3b3b3]'}`}>
                  {r.rank}
                </span>
                <span className="text-[#ffffff] font-semibold">{r.score.toFixed(1)}</span>
                <span className="text-[#b3b3b3] truncate text-[10px]">{r.set_summary}</span>
                <span className="text-[#ffffff]">{r.final_stats.ATK.toLocaleString()}</span>
                <span className="text-[#ffffff]">{r.final_stats.CRate.toFixed(1)}%</span>
                <span className="text-[#ffffff]">{r.final_stats.CDmg.toFixed(1)}%</span>
                <span className="text-[#ffffff]">{r.final_stats.EHP.toLocaleString()}</span>
              </button>

              {expanded && (
                <ExpandedBuild
                  result={r}
                  currentStats={currentStats}
                  combatants={combatants}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
