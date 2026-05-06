import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { InfoPopover } from '@/components/ui/info-popover'
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
  const { t } = useTranslation()
  const rows: Array<{ label: string; cur: number; next: number; pct?: boolean; tip?: string }> = [
    { label: 'ATK', cur: current.ATK, next: build.ATK },
    { label: 'DEF', cur: current.DEF, next: build.DEF },
    { label: 'HP', cur: current.HP, next: build.HP },
    { label: 'CRate', cur: current.CRate, next: build.CRate, pct: true },
    { label: 'CDmg', cur: current.CDmg, next: build.CDmg, pct: true },
    { label: 'EHP', cur: current.EHP, next: build.EHP, tip: t('combatants.detail.ehpTip') },
    ...((build.ExtraDMG ?? 0) > 0 || (current.ExtraDMG ?? 0) > 0
      ? [{ label: 'Extra DMG%', cur: current.ExtraDMG ?? 0, next: build.ExtraDMG ?? 0, pct: true }]
      : []),
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
      {rows.map(({ label, cur, next, pct, tip }) => {
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
            <span className="flex items-center gap-1 text-[#b3b3b3]">
              {label}
              {tip && <InfoPopover content={tip} />}
            </span>
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

// ─── Current build pinned row ─────────────────────────────────────────────────

function CurrentBuildRow({
  currentStats,
  activeCols,
  hasExtraDmg,
}: {
  currentStats: CombatantStats
  activeCols: string
  hasExtraDmg: boolean
}) {
  const score = currentStats.gear_slots.reduce(
    (sum, s) => sum + ((s.priority_score != null && s.priority_score > 0 ? s.priority_score : s.score) ?? 0),
    0,
  )
  const setCounts: Record<string, number> = {}
  for (const s of currentStats.gear_slots) {
    if (s.set_name) setCounts[s.set_name] = (setCounts[s.set_name] ?? 0) + 1
  }
  const setSummary = Object.entries(setCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => `${c}×${n}`)
    .join(' + ')
  const fs = currentStats.final_stats

  return (
    <div className="bg-[#1a1a2e] border border-[#c084fc]/40 rounded-lg overflow-hidden mb-2">
      <div
        className="grid gap-2 px-3 py-2.5 text-xs"
        style={{ gridTemplateColumns: activeCols }}
      >
        <span className="text-[#c084fc] font-bold text-[10px]">NOW</span>
        <span className="text-[#c084fc] font-semibold">{score.toFixed(1)}</span>
        <span className="text-[#888888] truncate text-[10px]">{setSummary || '—'}</span>
        <span className="text-[#b3b3b3]">{fs.ATK.toLocaleString()}</span>
        <span className="text-[#b3b3b3]">{fs.CRate.toFixed(1)}%</span>
        <span className="text-[#b3b3b3]">{fs.CDmg.toFixed(1)}%</span>
        <span className="text-[#b3b3b3]">{fs.EHP.toLocaleString()}</span>
        <span className="text-[#b3b3b3]">{fs.AvgDMG.toLocaleString()}</span>
        {hasExtraDmg && (
          <span className="text-[#b3b3b3]">
            {(fs.ExtraDMG ?? 0) > 0 ? `+${fs.ExtraDMG!.toFixed(1)}%` : '—'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = 'rank' | 'score' | 'atk' | 'crate' | 'cdmg' | 'ehp' | 'avgdmg' | 'extradmg'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ChevronsUpDown size={10} className="text-[#555555] inline ml-0.5" />
  return sortDir === 'asc'
    ? <ChevronUp size={10} className="text-[#c084fc] inline ml-0.5" />
    : <ChevronDown size={10} className="text-[#c084fc] inline ml-0.5" />
}

// ─── Main Component ───────────────────────────────────────────────────────────

const COLS      = '2rem 3rem minmax(0,1.5fr) 1fr 1fr 1fr 1fr 1fr'
const COLS_XDMG = '2rem 3rem minmax(0,1.5fr) 1fr 1fr 1fr 1fr 1fr 1fr'

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
  const [sortKey, setSortKey] = useState<SortKey>('avgdmg')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const startTimeRef = useRef<number | null>(null)
  const [eta, setEta] = useState<string | null>(null)

  useEffect(() => {
    if (jobState === 'running') {
      if (startTimeRef.current === null) startTimeRef.current = Date.now()
      if (progress && progress.checked > 0 && progress.total > 0) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        const rate = progress.checked / elapsed
        const remaining = (progress.total - progress.checked) / rate
        setEta(remaining > 1 ? `~${Math.ceil(remaining)}s` : null)
      }
    } else {
      startTimeRef.current = null
      setEta(null)
    }
  }, [jobState, progress])

  function handleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(col)
      setSortDir(col === 'rank' ? 'asc' : 'desc')
    }
  }

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
        {eta && (
          <p className="text-xs text-[#666666]">{eta} {t('optimizer.remaining')}</p>
        )}
        {progress && progress.total > 0 && (
          <div className="w-48 bg-[#282828] rounded-full h-1">
            <div
              className="bg-[#c084fc] h-1 rounded-full transition-all"
              style={{ width: `${Math.round(progress.checked / progress.total * 100)}%` }}
            />
          </div>
        )}
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

  const hasExtraDmg = results.some(r => (r.final_stats.ExtraDMG ?? 0) > 0)
  const activeCols = hasExtraDmg ? COLS_XDMG : COLS

  const getValue = (r: OptimizeResult, k: SortKey) => {
    if (k === 'rank')     return r.rank
    if (k === 'score')    return r.score
    if (k === 'atk')      return r.final_stats.ATK
    if (k === 'crate')    return r.final_stats.CRate
    if (k === 'cdmg')     return r.final_stats.CDmg
    if (k === 'avgdmg')   return r.final_stats.AvgDMG
    if (k === 'extradmg') return r.final_stats.ExtraDMG ?? 0
    return r.final_stats.EHP
  }
  const sorted = [...results].sort((a, b) => {
    const diff = getValue(a, sortKey) - getValue(b, sortKey)
    return sortDir === 'asc' ? diff : -diff
  })

  const topScore = results.reduce((max, r) => Math.max(max, r.score), 1)

  const colBtn = (col: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => handleSort(col)}
      className="flex items-center gap-0.5 hover:text-[#ffffff] transition-colors cursor-pointer select-none"
    >
      {label}<SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </button>
  )

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div
        className="grid gap-2 px-3 py-1 text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-1"
        style={{ gridTemplateColumns: activeCols }}
      >
        {colBtn('rank', '#')}
        {colBtn('score', 'Score')}
        <span>Sets</span>
        {colBtn('atk', 'ATK')}
        {colBtn('crate', 'CRate')}
        {colBtn('cdmg', 'CDmg')}
        {colBtn('ehp', 'EHP')}
        {colBtn('avgdmg', 'AvgDMG')}
        {hasExtraDmg && colBtn('extradmg', 'xDMG%')}
      </div>

      {currentStats && (
        <CurrentBuildRow
          currentStats={currentStats}
          activeCols={activeCols}
          hasExtraDmg={hasExtraDmg}
        />
      )}

      <div className="space-y-1">
        {sorted.map((r) => {
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
                style={{ gridTemplateColumns: activeCols }}
              >
                <span className={`font-semibold ${expanded ? 'text-[#c084fc]' : 'text-[#b3b3b3]'}`}>
                  {r.rank}
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-[#ffffff] font-semibold">{r.score.toFixed(1)}</span>
                  <span className="text-[9px] text-[#666666]">{Math.round(r.score / topScore * 100)}%</span>
                </div>
                <span className="text-[#b3b3b3] truncate text-[10px]">{r.set_summary}</span>
                <span className="text-[#ffffff]">{r.final_stats.ATK.toLocaleString()}</span>
                <span className="text-[#ffffff]">{r.final_stats.CRate.toFixed(1)}%</span>
                <span className="text-[#ffffff]">{r.final_stats.CDmg.toFixed(1)}%</span>
                <span className="text-[#ffffff]">{r.final_stats.EHP.toLocaleString()}</span>
                <span className="text-[#a3e635] font-semibold">{r.final_stats.AvgDMG.toLocaleString()}</span>
                {hasExtraDmg && (
                  <span className="text-[#ffffff]">
                    {(r.final_stats.ExtraDMG ?? 0) > 0 ? `+${r.final_stats.ExtraDMG!.toFixed(1)}%` : '—'}
                  </span>
                )}
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
