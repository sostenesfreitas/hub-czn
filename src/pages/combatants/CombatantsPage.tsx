import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw, User, Loader2, ChevronDown, ChevronRight, Download } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import { downloadJson } from '@/lib/download'
import type { Combatant } from '@/lib/types'
import { GearSlotCard, FinalStatsPanel } from './CombatantDetail'
import { Button } from '@/components/ui/button'

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

// ─── Collapse art — absolute, fills container height, natural width ────────

function CollapseBackground({ resId }: { resId: number }) {
  const [variant, setVariant] = useState<'02' | '01' | null>('02')
  if (!variant) return null
  return (
    <img
      src={assetUrl(`/assets/game/collapse/collapse_${resId}_${variant}.png`)}
      alt=""
      className="absolute left-0 top-0 pointer-events-none select-none"
      style={{ height: '100%', width: 'auto' }}
      onError={() => {
        if (variant === '02') setVariant('01')
        else setVariant(null)
      }}
    />
  )
}

// ─── Partner badge ─────────────────────────────────────────────────────────

function PartnerBadge({
  partnerResId,
  partnerName,
}: {
  partnerResId: number | null | undefined
  partnerName: string | null | undefined
}) {
  const [imgOk, setImgOk] = useState(true)
  if (!partnerResId && !partnerName) return null
  return (
    <div className="flex items-center gap-2 bg-[#141414]/90 border border-[#2a2a2a] rounded-lg px-2 py-1.5">
      {partnerResId && imgOk ? (
        <img
          src={assetUrl(`/assets/game/tp_skill/battle_icon_tp_skill_${partnerResId}.png`)}
          alt={partnerName ?? ''}
          className="w-10 h-[26px] rounded object-cover shrink-0"
          onError={() => setImgOk(false)}
        />
      ) : (
        <div className="w-10 h-[26px] rounded bg-[#282828] shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-[#555555] leading-tight">Partner</p>
        <p className="text-[11px] text-[#b3b3b3] truncate leading-tight">{partnerName ?? '—'}</p>
      </div>
    </div>
  )
}

// ─── Expanded content ──────────────────────────────────────────────────────

function ExpandedContent({
  charId,
  resId,
  partnerResId,
  partnerName,
}: {
  charId: string
  resId: number
  partnerResId: number | null | undefined
  partnerName: string | null | undefined
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['combatants', charId, 'stats'],
    queryFn: () => api.combatantStats(charId),
    staleTime: 30_000,
  })

  return (
    <div className="relative overflow-hidden border-t border-[#1e1e1e] bg-[#0e0e0e]">
      {/* Character art: left-anchored, fills full panel height */}
      <CollapseBackground resId={resId} />

      {/* Gradient: image fades right into background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to right, transparent 12%, rgba(14,14,14,0.55) 26%, rgba(14,14,14,0.82) 42%, #0e0e0e 58%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col pt-3 pb-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="animate-spin text-[#c084fc]" />
          </div>
        ) : data ? (
          <>
            {/* Top: partner + compact stats — right-aligned, spanning right 3 of 6 cols */}
            <div className="px-4 mb-3 flex flex-col items-end gap-2">
              <PartnerBadge partnerResId={partnerResId} partnerName={partnerName} />
              <div style={{ width: 'calc(50% - 4px)', opacity: 0.72 }}>
                <FinalStatsPanel stats={data.final_stats} compact />
              </div>
            </div>

            {/* Bottom: gear cards — full width */}
            <div className="grid grid-cols-3 xl:grid-cols-6 gap-2 px-4">
              {data.gear_slots.map((slot, i) => {
                const opacity = i === 0 ? 0.72 : i === 1 ? 0.86 : 1
                return (
                  <div key={slot.slot} style={{ opacity }}>
                    <GearSlotCard slot={slot} />
                  </div>
                )
              })}
            </div>
          </>
        ) : null}
      </div>
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
        {/* Rank */}
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

        {/* Ego Manifestation */}
        {combatant.ego != null && (
          <span className={`text-[10px] font-bold shrink-0 tabular-nums ${
            combatant.ego === 6 ? 'text-[#ffd700]' : 'text-[#888888]'
          }`}>
            E{combatant.ego}
          </span>
        )}

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

      {expanded && (
        <ExpandedContent
          charId={combatant.char_id}
          resId={combatant.res_id}
          partnerResId={combatant.partner_res_id}
          partnerName={combatant.partner_name}
        />
      )}
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

  const [exporting, setExporting] = useState(false)

  const exportCombatants = useCallback(async () => {
    setExporting(true)
    try {
      const data = await api.combatantsExport()
      downloadJson('combatants.json', data)
    } finally {
      setExporting(false)
    }
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
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-end px-4 pt-3 pb-1 shrink-0">
        <Button
          size="sm"
          variant="outline"
          disabled={exporting}
          onClick={exportCombatants}
          className="border-[#282828] text-[#b3b3b3] hover:text-[#ffffff] disabled:opacity-40"
        >
          {exporting
            ? <Loader2 size={13} className="mr-1 animate-spin" />
            : <Download size={13} className="mr-1" />
          }
          {t('combatants.exportJson')}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
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
    </div>
  )
}
