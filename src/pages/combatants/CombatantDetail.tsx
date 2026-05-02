import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import type { GearSlot, FinalStats } from '@/lib/types'

// ─── Grade helpers ─────────────────────────────────────────────────────────

function scoreGrade(score: number): { label: string; color: string } {
  if (score >= 41) return { label: 'SSS', color: 'text-[#ffd700]' }
  if (score >= 38) return { label: 'SS+', color: 'text-[#ff9d00]' }
  if (score >= 35) return { label: 'SS', color: 'text-[#ff6b6b]' }
  if (score >= 30) return { label: 'S', color: 'text-[#c084fc]' }
  if (score >= 25) return { label: 'A', color: 'text-[#60a5fa]' }
  if (score >= 20) return { label: 'B', color: 'text-[#4ade80]' }
  return { label: 'C', color: 'text-[#94a3b8]' }
}

function RollArrows({ count }: { count: number }) {
  if (count <= 1) return null
  const arrows = count === 2 ? '›' : count === 3 ? '››' : '›››'
  return <span className="text-[#c084fc] text-[9px] mr-0.5 leading-none">{arrows}</span>
}

function pieceImageUrl(setId: number, slotNum: number): string {
  return assetUrl(`/assets/game/pieces/item_piece_set_${String(setId).padStart(3, '0')}_${slotNum}.png`)
}

// ─── GearSlotCard ──────────────────────────────────────────────────────────

export function GearSlotCard({ slot }: { slot: GearSlot }) {
  const { t } = useTranslation()

  if (slot.main_stat === null) {
    return (
      <div className="bg-[#121212] border border-[#282828] rounded-xl p-3 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-[#555555]">{slot.slot}</p>
        <p className="text-xs text-[#333333] italic">{t('combatants.detail.empty')}</p>
      </div>
    )
  }

  const grade = slot.score != null ? scoreGrade(slot.score) : null
  const hasPieceImg = slot.set_id != null && slot.slot_num != null

  return (
    <div className="bg-[#181818] border border-[#282828] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2.5 border-b border-[#1e1e1e]">
        <div className="relative shrink-0">
          {hasPieceImg ? (
            <img
              src={pieceImageUrl(slot.set_id!, slot.slot_num!)}
              alt={slot.set_name ?? slot.slot}
              className="w-10 h-10 object-contain rounded-lg"
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement
                el.style.display = 'none'
                const fb = el.nextElementSibling as HTMLElement | null
                if (fb) fb.style.display = 'flex'
              }}
            />
          ) : null}
          <div
            className="w-10 h-10 bg-[#282828] rounded-lg items-center justify-center"
            style={{ display: hasPieceImg ? 'none' : 'flex' }}
          >
            <span className="text-[9px] text-[#444]">{slot.slot_num ?? '?'}</span>
          </div>
          {slot.level != null && slot.level > 0 && (
            <span className="absolute -bottom-1 -right-1 bg-[#c084fc] text-[#121212] text-[8px] font-bold px-1 py-px rounded leading-tight">
              +{slot.level}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-wider text-[#555555] truncate">
            {slot.set_name ?? slot.slot}
          </p>
          <p className="text-xs font-semibold text-[#ffffff] truncate">{slot.main_stat}</p>
        </div>
      </div>

      {/* Substats */}
      <div className="px-3 py-2 space-y-1">
        {slot.substats.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center text-[#b3b3b3]">
              <RollArrows count={s.roll_count} />
              <span>{s.name}</span>
            </div>
            <span className="text-[#ffffff] font-medium tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Score */}
      {slot.score != null && (
        <div className="px-3 pb-3 pt-1 border-t border-[#1e1e1e] mt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#555555]">Score</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[#c084fc] font-bold">{slot.score.toFixed(1)}</span>
              {grade && (
                <span className={`text-[10px] font-bold ${grade.color}`}>({grade.label})</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function FinalStatsPanel({ stats, compact = false }: { stats: FinalStats; compact?: boolean }) {
  const { t } = useTranslation()

  const rows: Array<{ label: string; value: string }> = [
    { label: 'ATK', value: stats.ATK.toLocaleString() },
    { label: 'DEF', value: stats.DEF.toLocaleString() },
    { label: 'HP', value: stats.HP.toLocaleString() },
    { label: 'CRate', value: `${stats.CRate.toFixed(1)}%` },
    { label: 'CDmg', value: `${stats.CDmg.toFixed(1)}%` },
    { label: 'EHP', value: stats.EHP.toLocaleString() },
    { label: 'Avg DMG', value: stats.AvgDMG.toLocaleString() },
    ...(stats.Ego && stats.Ego > 0 ? [{ label: 'Ego', value: stats.Ego.toLocaleString() }] : []),
  ]
  return (
    <div className={`bg-[#181818] border border-[#282828] rounded-xl ${compact ? 'p-2.5' : 'p-4'}`}>
      <p className={`uppercase tracking-wider text-[#b3b3b3] ${compact ? 'text-[9px] mb-1.5' : 'text-[10px] mb-3'}`}>
        {t('combatants.detail.finalStats')}
      </p>
      <div className={`grid grid-cols-2 ${compact ? 'gap-x-4 gap-y-0.5' : 'gap-x-6 gap-y-2'}`}>
        {rows.map(r => (
          <div key={r.label} className={`flex justify-between ${compact ? 'text-[11px]' : 'text-sm'}`}>
            <span className="text-[#b3b3b3]">{r.label}</span>
            <span className="text-[#c084fc] font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface CombatantDetailProps {
  charId: string
}

export function CombatantDetail({ charId }: CombatantDetailProps) {
  const { t } = useTranslation()

  const { data, isLoading, error } = useQuery({
    queryKey: ['combatants', charId, 'stats'],
    queryFn: () => api.combatantStats(charId),
    enabled: !!charId,
  })

  if (isLoading) {
    return (
      <div role="status" aria-label={t('combatants.detail.loading')} className="flex items-center p-6 text-[#b3b3b3]">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-sm">{t('combatants.detail.loadingText')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="p-4 text-sm text-[#f3727f]">
        {t('combatants.detail.error')}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {data.gear_slots.map((slot) => (
          <GearSlotCard key={slot.slot} slot={slot} />
        ))}
      </div>
      <FinalStatsPanel stats={data.final_stats} />
    </div>
  )
}
