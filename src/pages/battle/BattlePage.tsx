import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Sword, Shield, ChevronDown, ChevronUp, TrendingUp, AlertCircle, LayoutGrid } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import type { BattleRecord, BattleAnalytics, CharAnalysis, Combatant, BattleOverview, InsightCard, CharTrend } from '@/lib/types'

// ── shared helpers ────────────────────────────────────────────────────────────

function findCombatant(resId: string | number | null | undefined, combatants: Combatant[]): Combatant | undefined {
  if (resId == null || resId === '') return undefined
  const id = typeof resId === 'string' ? parseInt(resId, 10) : resId
  return combatants.find(c => c.res_id === id)
}

function CharAvatar({ combatant, size = 24 }: { combatant?: Combatant; size?: number }) {
  const [err, setErr] = useState(false)
  if (!combatant || err || !combatant.portrait_url) {
    return (
      <div
        className="rounded bg-[#282828] shrink-0 flex items-center justify-center text-[#444] text-[8px]"
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }
  return (
    <img
      src={assetUrl(combatant.portrait_url)}
      alt=""
      className="rounded object-cover shrink-0"
      style={{ width: size, height: size }}
      onError={() => setErr(true)}
    />
  )
}

function ResultBadge({ result }: { result: string | null }) {
  const { t } = useTranslation()
  if (!result) return <span className="text-[#555] text-xs">—</span>
  const ok = result === 'CLEAR'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded ${ok ? 'bg-[#1a2a1a] text-[#a3e635]' : 'bg-[#2a1a1a] text-[#f87171]'}`}>
      {ok ? t('battle.clear') : t('battle.fail')}
    </span>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const now = Date.now()
    const diffMs = now - d.getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    if (diffMin < 1) return 'agora'
    if (diffMin < 60) return `${diffMin}m atrás`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h atrás`
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function formatLargeNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

function formatDmg(n: number): string {
  return n === 0 ? '—' : formatLargeNum(n)
}

function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <div style={{ width, height }} className="bg-[#1e1e1e] rounded" />
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - Math.max(0, Math.min(1, v)) * (height - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke="#a3e635" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const INSIGHT_STYLE: Record<string, { border: string; bg: string; text: string }> = {
  urgent:   { border: 'border-[#ef4444]', bg: 'bg-[#2a1010]', text: 'text-[#ef4444]' },
  warning:  { border: 'border-[#f59e0b]', bg: 'bg-[#2a2010]', text: 'text-[#f59e0b]' },
  positive: { border: 'border-[#84cc16]', bg: 'bg-[#1a2a0a]', text: 'text-[#84cc16]' },
}

function InsightCardComp({ card, combatants }: { card: InsightCard; combatants: Combatant[] }) {
  const { t } = useTranslation()
  const style = INSIGHT_STYLE[card.level] ?? INSIGHT_STYLE.warning
  const combatant = card.char_res_id ? findCombatant(card.char_res_id, combatants) : undefined
  const k = card.insight_key
  const title       = k ? t(`battle.insight.${k}.title`)                    : card.title
  const description = k ? t(`battle.insight.${k}.description`, card.params) : card.description
  const action      = k ? t(`battle.insight.${k}.action`)                   : card.action
  return (
    <div className={`flex gap-3 rounded-lg border-l-4 p-3 ${style.border} ${style.bg}`}>
      {combatant && <CharAvatar combatant={combatant} size={32} />}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span className={`text-xs font-bold ${style.text}`}>{title}</span>
        <span className="text-[#b3b3b3] text-[11px] leading-relaxed">{description}</span>
        <span className={`text-[10px] font-medium self-start mt-0.5 ${style.text}`}>→ {action}</span>
      </div>
    </div>
  )
}

const TREND_PRIORITY_BADGE: Record<string, string> = {
  crate:     'bg-[#1a1f2e] text-[#60a5fa]',
  crate_low: 'bg-[#2a1a1a] text-[#f87171]',
  cdmg:      'bg-[#1e1a2e] text-[#a78bfa]',
  atk:       'bg-[#2a1e10] text-[#fb923c]',
  balanced:  'bg-[#1a2a1a] text-[#a3e635]',
}

function CharTrendCard({ trend, combatants }: { trend: CharTrend; combatants: Combatant[] }) {
  const { t } = useTranslation()
  const combatant = findCombatant(trend.res_id, combatants)
  const name = combatant?.name ?? `#${trend.res_id}`
  const badgeClass = TREND_PRIORITY_BADGE[trend.priority] ?? TREND_PRIORITY_BADGE.balanced
  const trendColor = trend.dpt_trend_pct > 0 ? 'text-[#a3e635]' : trend.dpt_trend_pct < 0 ? 'text-[#f87171]' : 'text-[#888]'

  return (
    <div className="bg-[#181818] border border-[#282828] rounded-lg p-3 flex flex-col gap-2 min-w-[220px]">
      <div className="flex items-center gap-2">
        <CharAvatar combatant={combatant} size={28} />
        <div className="flex-1 min-w-0">
          <div className="text-[#e5e7eb] text-xs font-bold truncate">{name}</div>
          <div className="text-[#555] text-[10px]">{t('battle.overview.battlesCount', { count: trend.battle_count })}</div>
        </div>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>
          {t(`battle.overview.priority.${trend.priority}`)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {[
          { label: 'ATK', value: trend.latest_atk, max: 2000, color: 'bg-[#fb923c]', fmt: (v: number) => Math.round(v).toLocaleString() },
          { label: 'CRate', value: trend.latest_crate, max: 100, color: 'bg-[#60a5fa]', fmt: (v: number) => `${v.toFixed(1)}%` },
          { label: 'CDmg', value: trend.latest_cdmg, max: 300, color: 'bg-[#a78bfa]', fmt: (v: number) => `${v.toFixed(1)}%` },
        ].map(({ label, value, max, color, fmt }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="text-[#555] text-[9px] w-8">{label}</span>
            <div className="h-1 flex-1 rounded-full bg-[#2a2a2a]">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
            </div>
            <span className="text-[#888] text-[9px] w-12 text-right font-mono">{fmt(value)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-end justify-between gap-2 mt-1">
        <div className="flex flex-col">
          <span className="text-[#555] text-[9px] uppercase tracking-wide">Avg DPT</span>
          <span className="text-[#e5e7eb] text-xs font-mono font-bold">{formatDmg(trend.avg_dpt)}</span>
          {trend.dpt_trend_pct !== 0 && (
            <span className={`text-[9px] font-bold ${trendColor}`}>
              {trend.dpt_trend_pct > 0 ? '+' : ''}{trend.dpt_trend_pct.toFixed(0)}%
            </span>
          )}
        </div>
        <Sparkline data={trend.dpt_sparkline} width={80} height={24} />
      </div>
    </div>
  )
}

function OverviewTab({ combatants }: { combatants: Combatant[] }) {
  const { t } = useTranslation()

  const { data: overview, isLoading, isError } = useQuery<BattleOverview>({
    queryKey: ['battle-overview'],
    queryFn: () => api.battleOverview(),
    staleTime: 30_000,
    retry: false,
  })

  if (isLoading) return <p className="text-[#888] text-sm p-4">{t('battle.loading')}</p>

  if (isError) return (
    <div className="flex flex-col items-center justify-center gap-3 text-[#444] p-4 mt-20">
      <Sword size={40} />
      <p className="text-sm text-center">{t('battle.overview.noData')}</p>
    </div>
  )

  if (!overview) return null

  const s = overview.summary

  return (
    <div className="flex flex-col gap-4 max-w-3xl p-4">
      {/* Summary strip */}
      <div className="flex gap-2 flex-wrap">
        <StatBox label={t('battle.overview.battles')} value={s.total} />
        <StatBox
          label={t('battle.overview.winRate')}
          value={`${s.win_rate}%`}
          accent={s.win_rate >= 50 ? 'text-[#a3e635]' : 'text-[#f87171]'}
        />
        <StatBox label={t('battle.overview.avgEnemyDef')} value={Math.round(s.avg_enemy_def)} accent="text-[#fb923c]" />
        <StatBox label={t('battle.overview.avgTeamDmg')} value={formatDmg(s.avg_team_dmg)} accent="text-[#c084fc]" />
        {s.last_battle_time && (
          <StatBox label={t('battle.overview.lastBattle')} value={formatTime(s.last_battle_time)} />
        )}
      </div>

      {/* Insight cards */}
      {overview.insights.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[#555] text-[10px] uppercase tracking-wide">{t('battle.overview.insights')}</p>
          {overview.insights.map((card, i) => (
            <InsightCardComp key={i} card={card} combatants={combatants} />
          ))}
        </div>
      )}

      {/* Character trend grid */}
      {overview.chars.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[#555] text-[10px] uppercase tracking-wide">{t('battle.overview.trends')}</p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {overview.chars.map((char) => (
              <CharTrendCard key={char.res_id} trend={char} combatants={combatants} />
            ))}
          </div>
        </div>
      )}

      {/* Recent results */}
      {overview.recent.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[#555] text-[10px] uppercase tracking-wide">{t('battle.overview.recent')}</p>
          <div className="flex flex-col gap-1">
            {overview.recent.map((r, i) => {
              const mvp = r.mvp_res_id ? findCombatant(r.mvp_res_id, combatants) : undefined
              return (
                <div key={i} className="flex items-center gap-3 bg-[#181818] border border-[#282828] rounded px-3 py-2">
                  <ResultBadge result={r.battle_result} />
                  <span className="text-[#888] text-xs font-mono">DEF {Math.round(r.enemy_def)}</span>
                  <span className="text-[#c084fc] text-xs font-mono">{formatDmg(r.total_team_dmg)}</span>
                  {mvp && (
                    <div className="flex items-center gap-1">
                      <CharAvatar combatant={mvp} size={16} />
                      <span className="text-[#facc15] text-[10px]">{mvp.name}</span>
                    </div>
                  )}
                  <span className="ml-auto text-[#444] text-[10px]">{formatTime(r.capture_time)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── History tab ───────────────────────────────────────────────────────────────

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex flex-col items-center bg-[#1e1e1e] rounded px-4 py-3 min-w-[90px]">
      <span className="text-[#888] text-[10px] uppercase tracking-wide">{label}</span>
      <span className={`font-bold text-lg font-mono mt-0.5 ${accent ?? 'text-[#e5e7eb]'}`}>{value}</span>
    </div>
  )
}

function HistorySummary({ history }: { history: BattleRecord[] }) {
  const { t } = useTranslation()
  const total = history.length
  const wins = history.filter(r => r.battle_result === 'CLEAR').length
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  const avgDef = total > 0 ? Math.round(history.reduce((s, r) => s + r.enemy_def, 0) / total) : 0
  return (
    <div className="flex gap-2 flex-wrap mb-3">
      <StatBox label={t('battle.history')} value={total} />
      <StatBox
        label={t('battle.winRate')}
        value={`${winRate}%`}
        accent={winRate >= 50 ? 'text-[#a3e635]' : 'text-[#f87171]'}
      />
      <StatBox label={t('battle.avgDef')} value={avgDef} accent="text-[#fb923c]" />
    </div>
  )
}

function DptRow({
  resId, dmg, maxDmg, combatants, isMvp,
}: {
  resId: string; dmg: number; maxDmg: number; combatants: Combatant[]; isMvp: boolean
}) {
  const combatant = findCombatant(resId, combatants)
  const name = combatant?.name ?? `#${resId}`
  const pct = maxDmg > 0 ? (dmg / maxDmg) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <CharAvatar combatant={combatant} size={22} />
      <span className={`text-xs w-20 truncate ${isMvp ? 'text-[#facc15] font-bold' : 'text-[#b3b3b3]'}`}>
        {name}{isMvp ? ' ★' : ''}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-[#2a2a2a] min-w-[60px]">
        <div
          className={`h-full rounded-full transition-all ${isMvp ? 'bg-[#facc15]' : 'bg-[#c084fc]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[#e5e7eb] text-xs font-mono w-16 text-right shrink-0">
        {dmg.toLocaleString()}
      </span>
    </div>
  )
}

function BattleCard({
  record, combatants, onUseDef,
}: {
  record: BattleRecord; combatants: Combatant[]; onUseDef: (def: number) => void
}) {
  const { t } = useTranslation()
  const [showChars, setShowChars] = useState(false)
  const hasDpt = Object.keys(record.char_dpt).length > 0
  const defPct = (300 / (300 + record.enemy_def) * 100).toFixed(1)
  const mvpCombatant = findCombatant(record.mvp_res_id, combatants)
  const mvpName = mvpCombatant?.name ?? (record.mvp_res_id ? `#${record.mvp_res_id}` : null)

  const dptEntries = Object.entries(record.char_dpt).sort(([, a], [, b]) => b - a)
  const maxDmg = dptEntries[0]?.[1] ?? 0

  return (
    <div className="bg-[#181818] border border-[#282828] rounded-lg p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <StatBox label={t('battle.enemyDef')} value={Math.round(record.enemy_def)} />
          <StatBox label={t('battle.enemyAtk')} value={Math.round(record.enemy_atk)} />
          <StatBox label={t('battle.dmgDecrease')} value={`${defPct}%`} accent="text-[#fb923c]" />
        </div>
        <div className="flex flex-col gap-1.5 ml-auto items-end shrink-0">
          <ResultBadge result={record.battle_result} />
          {mvpName && (
            <div className="flex items-center gap-1">
              <span className="text-[#888] text-[10px]">{t('battle.mvp')}:</span>
              {mvpCombatant && <CharAvatar combatant={mvpCombatant} size={16} />}
              <span className="text-[#facc15] text-[10px] font-medium">{mvpName}</span>
            </div>
          )}
          <span className="text-[#444] text-[10px]">{formatTime(record.capture_time)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onUseDef(record.enemy_def)}
        className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#c084fc]/15 text-[#c084fc] text-xs font-medium hover:bg-[#c084fc]/25 transition-colors"
      >
        <Shield size={12} />
        {t('battle.useDefBtn')}
      </button>

      {/* DPT section */}
      {hasDpt ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[#888] text-[10px] uppercase tracking-wide">{t('battle.charDpt')}</p>
          {dptEntries.map(([resId, dmg]) => (
            <DptRow
              key={resId}
              resId={resId}
              dmg={dmg}
              maxDmg={maxDmg}
              combatants={combatants}
              isMvp={resId === record.mvp_res_id}
            />
          ))}
        </div>
      ) : (
        <p className="text-[#555] text-[10px] italic">{t('battle.noCharDpt')}</p>
      )}

      {/* Player chars (collapsible) */}
      {record.player_chars.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowChars(v => !v)}
            className="flex items-center gap-1 text-[#555] text-[10px] hover:text-[#888] transition-colors"
          >
            {showChars ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {t('battle.playerChars')} ({record.player_chars.length})
          </button>
          {showChars && (
            <div className="mt-2 flex flex-wrap gap-2">
              {record.player_chars.map((c, i) => {
                const cbt = findCombatant(c.res_id, combatants)
                return (
                  <div key={i} className="bg-[#1e1e1e] rounded px-2 py-1.5 flex items-center gap-2">
                    <CharAvatar combatant={cbt} size={28} />
                    <div>
                      <div className="text-[#b3b3b3] text-[11px] font-medium">
                        {cbt?.name ?? `#${c.res_id}`}
                      </div>
                      <div className="text-[#555] font-mono text-[10px]">
                        ATK {Math.round(c.atk)} · DEF {Math.round(c.def)} · CR {Number(c.cri).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  crate_low: 'text-[#f87171] bg-[#2a1a1a]',
  crate:     'text-[#60a5fa] bg-[#1a1f2e]',
  cdmg:      'text-[#a78bfa] bg-[#1e1a2e]',
  atk:       'text-[#fb923c] bg-[#2a1e10]',
  balanced:  'text-[#a3e635] bg-[#1a2a1a]',
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="h-1 rounded-full bg-[#2a2a2a] flex-1">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function GainPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex flex-col items-center rounded px-2 py-1 min-w-[70px] bg-[#1e1e1e]`}>
      <span className="text-[#555] text-[9px] uppercase tracking-wide">{label}</span>
      <span className={`font-bold text-xs font-mono ${color}`}>+{value.toFixed(1)}%</span>
    </div>
  )
}

function CharAnalyticsCard({ analysis, combatants }: { analysis: CharAnalysis; combatants: Combatant[] }) {
  const { t } = useTranslation()
  const char = combatants.find(c => c.res_id === parseInt(analysis.res_id))
  const name = char?.name ?? `#${analysis.res_id}`
  const priorityClass = PRIORITY_COLOR[analysis.priority] ?? PRIORITY_COLOR.balanced
  const priorityLabel = t(`battle.priority.${analysis.priority}`)

  return (
    <div className="bg-[#181818] border border-[#282828] rounded-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {char?.portrait_url && (
            <img
              src={assetUrl(char.portrait_url)}
              alt=""
              className="w-8 h-8 rounded object-cover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div>
            <h3 className="text-[#e5e7eb] font-bold text-sm">{name}</h3>
            <span className="text-[#555] text-[10px] font-mono">
              {t('battle.dmgPer100')}: {analysis.dmg_per_100coeff.toLocaleString()}
            </span>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded ${priorityClass}`}>
          {priorityLabel}
        </span>
      </div>

      {/* Stats with bars */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[#888] text-[10px] w-10">{analysis.scale_stat === 'def' ? 'DEF' : 'ATK'}</span>
          <MiniBar value={analysis.atk} max={2000} color="bg-[#fb923c]" />
          <span className="text-[#e5e7eb] text-xs font-mono w-16 text-right">{Math.round(analysis.atk).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#888] text-[10px] w-10">CRate</span>
          <MiniBar value={analysis.crate} max={100} color="bg-[#60a5fa]" />
          <span className="text-[#e5e7eb] text-xs font-mono w-16 text-right">{analysis.crate.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#888] text-[10px] w-10">CDmg</span>
          <MiniBar value={analysis.cdmg} max={300} color="bg-[#a78bfa]" />
          <span className="text-[#e5e7eb] text-xs font-mono w-16 text-right">{analysis.cdmg.toFixed(1)}%</span>
        </div>
      </div>

      {/* Crit factor */}
      <div className="flex items-center justify-between bg-[#1e1e1e] rounded px-3 py-2">
        <span className="text-[#888] text-[10px]">{t('battle.critFactor')}</span>
        <span className="text-[#a3e635] font-bold font-mono text-sm">×{analysis.crit_factor.toFixed(3)}</span>
      </div>

      {/* Gain pills */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[#555] text-[10px] uppercase tracking-wide">{t('battle.improvement')}</span>
        <div className="flex gap-2 flex-wrap">
          <GainPill label={t('battle.crateGain')} value={analysis.crate_gain_10pp} color="text-[#60a5fa]" />
          <GainPill label={t('battle.cdmgGain')}  value={analysis.cdmg_gain_30pct} color="text-[#a78bfa]" />
          <GainPill label={t(analysis.scale_stat === 'def' ? 'battle.defGain' : 'battle.atkGain')} value={analysis.atk_gain_10pct} color="text-[#fb923c]" />
        </div>
      </div>

      {/* Tip */}
      <div className="bg-[#1e1e1e] rounded px-3 py-2 text-[10px] text-[#b3b3b3] leading-relaxed border-l-2 border-[#c084fc]/40">
        {t(`battle.tip.${analysis.priority}`, {
          crate: analysis.crate.toFixed(0),
          cdmg: analysis.cdmg.toFixed(0),
          stat: analysis.scale_stat === 'def' ? 'DEF' : 'ATK',
        })}
      </div>
    </div>
  )
}

function AnalyticsTab({ combatants }: { combatants: Combatant[] }) {
  const { t } = useTranslation()

  const { data: analytics, isLoading, isError } = useQuery<BattleAnalytics>({
    queryKey: ['battle-analytics'],
    queryFn: () => api.battleAnalytics(),
    staleTime: 10_000,
    retry: false,
  })

  if (isLoading) return <p className="text-[#888] text-sm p-4">{t('battle.loading')}</p>

  if (isError) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-[#444] p-4">
      <AlertCircle size={36} />
      <p className="text-sm text-center">{t('battle.noAnalytics')}</p>
      <p className="text-[#555] text-xs text-center">{t('battle.noBattles')}</p>
    </div>
  )

  if (!analytics) return null

  const defPct = (analytics.def_factor * 100).toFixed(1)

  return (
    <div className="flex flex-col gap-4 max-w-3xl p-4">
      {/* Context banner */}
      <div className="bg-[#1a1a1a] border border-[#282828] rounded-lg px-4 py-3 flex flex-wrap gap-4 items-center">
        <div className="flex flex-col">
          <span className="text-[#555] text-[10px] uppercase tracking-wide">{t('battle.enemyDef')}</span>
          <span className="text-[#fb923c] font-bold font-mono text-lg">{Math.round(analytics.enemy_def)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[#555] text-[10px] uppercase tracking-wide">{t('battle.defFactor')}</span>
          <span className="text-[#fb923c] font-bold font-mono text-lg">{defPct}%</span>
        </div>
        <div className="ml-auto">
          <ResultBadge result={analytics.battle_result} />
        </div>
      </div>

      {/* Character cards */}
      {analytics.chars.map((c) => (
        <CharAnalyticsCard key={c.res_id} analysis={c} combatants={combatants} />
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BattlePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'overview' | 'history' | 'analytics'>('overview')

  const { data: history = [], isLoading: histLoading, isError: histError } = useQuery<BattleRecord[]>({
    queryKey: ['battle-history'],
    queryFn: () => api.battleHistory(30),
    staleTime: 10_000,
    retry: false,
    enabled: tab === 'history',
  })

  const { data: combatants = [] } = useQuery<Combatant[]>({
    queryKey: ['combatants'],
    queryFn: () => api.combatants(),
    staleTime: 60_000,
  })

  function handleUseDef(def: number) {
    sessionStorage.setItem('czn_battle_def', String(Math.round(def)))
    navigate('/simulator')
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-52 shrink-0 flex flex-col gap-4 p-4 bg-[#181818] border-r border-[#282828] overflow-y-auto">
        <div>
          <h2 className="text-[#ffffff] font-bold text-sm mb-3">{t('battle.title')}</h2>
          <p className="text-[#888] text-xs leading-relaxed">{t('battle.description')}</p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-col gap-0.5">
          {(['overview', 'analytics', 'history'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`text-left text-xs px-3 py-2 rounded transition-colors flex items-center gap-2 ${
                tab === k ? 'bg-[#282828] text-[#ffffff] font-bold' : 'text-[#b3b3b3] hover:text-[#ffffff]'
              }`}
            >
              {k === 'overview' ? <LayoutGrid size={12} /> : k === 'analytics' ? <TrendingUp size={12} /> : <Sword size={12} />}
              {t(`battle.tab.${k}`)}
            </button>
          ))}
        </div>

        <div className="mt-auto text-[#555] text-[10px] leading-relaxed border-t border-[#282828] pt-3">
          <p>DEF factor: 300 / (300 + DEF)</p>
          <p className="mt-1">Crit Factor = (CRate × CDmg) + (1 − CRate)</p>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && (
          <OverviewTab combatants={combatants} />
        )}

        {tab === 'analytics' && (
          <AnalyticsTab combatants={combatants} />
        )}

        {tab === 'history' && (
          <div className="p-4">
            {histLoading && <p className="text-[#888] text-sm">{t('battle.loading')}</p>}

            {histError && (
              <div className="text-[#f87171] text-sm bg-[#2a1a1a] border border-[#5a2020] rounded px-4 py-3">
                {t('battle.loadError')}
                <p className="text-[#888] text-xs mt-1">{t('battle.noBattles')}</p>
              </div>
            )}

            {!histLoading && !histError && history.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[#444] mt-20">
                <Sword size={40} />
                <p className="text-sm">{t('battle.noBattles')}</p>
              </div>
            )}

            {history.length > 0 && (
              <div className="flex flex-col gap-3 max-w-3xl">
                <HistorySummary history={history} />
                {history.map((rec, i) => (
                  <BattleCard key={i} record={rec} combatants={combatants} onUseDef={handleUseDef} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
