import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw, User, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import type { Combatant } from '@/lib/types'
import { GearSlotCard, FinalStatsPanel } from './CombatantDetail'

// ─── Attribute badge ───────────────────────────────────────────────────────

const ATTR_STYLE: Record<string, string> = {
  Passion:  'bg-[#ef4444]/15 text-[#f87171] border-[#ef4444]/30',
  Order:    'bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/30',
  Justice:  'bg-[#eab308]/15 text-[#facc15] border-[#eab308]/30',
  Void:     'bg-[#a855f7]/15 text-[#c084fc] border-[#a855f7]/30',
  Instinct: 'bg-[#22c55e]/15 text-[#4ade80] border-[#22c55e]/30',
}

function AttrBadge({ attr }: { attr: string }) {
  const cls = ATTR_STYLE[attr] ?? 'bg-[#282828] text-[#888888] border-[#333333]'
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border leading-tight shrink-0 ${cls}`}>
      {attr}
    </span>
  )
}

// ─── Collapse art (tries _02 first, falls back to _01, then placeholder) ──

function CollapseArt({ resId }: { resId: number }) {
  const [variant, setVariant] = useState<'02' | '01' | null>('02')

  if (!variant) {
    return (
      <div className="w-full h-full rounded-xl bg-[#121212] border border-[#282828] flex items-center justify-center">
        <User size={40} className="text-[#333333]" />
      </div>
    )
  }

  return (
    <img
      src={assetUrl(`/assets/game/collapse/collapse_${resId}_${variant}.png`)}
      alt=""
      className="w-full h-full object-cover object-top rounded-xl"
      onError={() => {
        if (variant === '02') setVariant('01')
        else setVariant(null)
      }}
    />
  )
}

// ─── Expanded content (lazy fetch) ────────────────────────────────────────

function ExpandedContent({ charId, resId }: { charId: string; resId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['combatants', charId, 'stats'],
    queryFn: () => api.combatantStats(charId),
    staleTime: 30_000,
  })

  return (
    <div className="flex gap-4 px-4 pb-5 pt-3 bg-[#0e0e0e] border-t border-[#1e1e1e]">
      {/* Collapse art */}
      <div className="w-44 shrink-0" style={{ minHeight: '280px' }}>
        <CollapseArt resId={resId} />
      </div>

      {/* Right side */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-[#c084fc]" />
        </div>
      ) : data ? (
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <FinalStatsPanel stats={data.final_stats} />
          <div className="grid grid-cols-3 xl:grid-cols-6 gap-2">
            {data.gear_slots.map((slot) => (
              <GearSlotCard key={slot.slot} slot={slot} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─── Combatant list row ────────────────────────────────────────────────────

function CombatantRow({
  combatant,
  rank,
  expanded,
  onToggle,
}: {
  combatant: Combatant
  rank: number
  expanded: boolean
  onToggle: () => void
}) {
  const tpUrl = assetUrl(`/assets/game/tp_skill/battle_icon_tp_skill_${combatant.res_id}.png`)

  return (
    <div
      className={`rounded-xl overflow-hidden border transition-colors ${
        expanded ? 'border-[#c084fc]/40' : 'border-[#282828]'
      } bg-[#181818]`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={expanded}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
          expanded ? 'bg-[#c084fc]/5' : 'hover:bg-[#1e1e1e]'
        }`}
      >
        {/* Rank number */}
        <span className="w-5 text-right text-[10px] text-[#444444] tabular-nums shrink-0">
          {rank}
        </span>

        {/* Rectangular battle icon */}
        <div className="w-14 h-9 shrink-0 rounded-lg overflow-hidden bg-[#121212] border border-[#252525]">
          <img
            src={tpUrl}
            alt={combatant.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }}
          />
        </div>

        {/* Name + level */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#ffffff] truncate leading-tight">{combatant.name}</p>
          <p className="text-[10px] text-[#666666] leading-tight">Lv. {combatant.level}</p>
        </div>

        {/* Attribute */}
        <AttrBadge attr={combatant.attribute} />

        {/* Class */}
        <span className="hidden sm:block text-[10px] px-2 py-0.5 rounded bg-[#232323] text-[#888888] border border-[#2e2e2e] shrink-0">
          {combatant.class}
        </span>

        {/* GS score */}
        <div className="shrink-0 text-right w-12">
          {combatant.avg_gear_score > 0 ? (
            <span className="text-sm font-bold text-[#c084fc] tabular-nums">
              {combatant.avg_gear_score.toFixed(1)}
            </span>
          ) : (
            <span className="text-sm text-[#444444]">—</span>
          )}
          <p className="text-[9px] text-[#555555]">GS</p>
        </div>

        {/* Chevron */}
        <div className={`shrink-0 transition-colors ${expanded ? 'text-[#c084fc]' : 'text-[#444444]'}`}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {expanded && <ExpandedContent charId={combatant.char_id} resId={combatant.res_id} />}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function CombatantsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: combatants = [], isLoading, error } = useQuery({
    queryKey: ['combatants'],
    queryFn: () => api.combatants(),
    staleTime: 30_000,
  })

  const handleToggle = useCallback((charId: string) => {
    setExpandedId((prev) => (prev === charId ? null : charId))
  }, [])

  if (error) {
    return (
      <div className="p-4">
        <p className="text-[#f3727f] text-sm mb-2">{t('combatants.loadError')}</p>
        <button
          type="button"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['combatants'] })}
          className="flex items-center gap-1 text-xs text-[#b3b3b3] hover:text-[#ffffff]"
        >
          <RefreshCw size={12} />
          {t('combatants.retry')}
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div role="status" aria-label={t('combatants.loading')} className="flex-1 p-4 space-y-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-[#181818] border border-[#282828] animate-pulse" />
        ))}
      </div>
    )
  }

  if (combatants.length === 0) {
    return (
      <div role="status" className="flex-1 flex flex-col items-center justify-center gap-3 text-[#b3b3b3]">
        <User size={40} className="opacity-30" />
        <p className="text-sm">{t('combatants.empty')}</p>
        <p className="text-xs">{t('combatants.emptyHint')}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
      {combatants.map((c, i) => (
        <CombatantRow
          key={c.char_id}
          combatant={c}
          rank={i + 1}
          expanded={expandedId === c.char_id}
          onToggle={() => handleToggle(c.char_id)}
        />
      ))}
    </div>
  )
}
