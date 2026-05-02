import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { GearSlot, FinalStats } from '@/lib/types'

export function GearSlotCard({ slot }: { slot: GearSlot }) {
  return (
    <div className="bg-[#181715] border border-[#2e2c28] rounded-lg p-3 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-[#a09d96]">{slot.slot}</p>
      {slot.main_stat === null ? (
        <p className="text-xs text-[#3a3835] italic">Vazio</p>
      ) : (
        <>
          <p className="text-xs font-semibold text-[#faf9f5]">{slot.main_stat}</p>
          <div className="space-y-0.5">
            {slot.substats.map((s) => (
              <p key={s} className="text-[11px] text-[#a09d96]">
                {s}
              </p>
            ))}
          </div>
          {slot.score !== null && (
            <div className="pt-1">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-[#a09d96]">Score</span>
                <span className="text-[#cc785c] font-semibold">{slot.score.toFixed(1)}</span>
              </div>
              <div className="h-1 bg-[#2e2c28] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#cc785c] rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, slot.score))}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function FinalStatsPanel({ stats }: { stats: FinalStats }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'ATK', value: stats.ATK.toLocaleString() },
    { label: 'DEF', value: stats.DEF.toLocaleString() },
    { label: 'HP', value: stats.HP.toLocaleString() },
    { label: 'CRate', value: `${stats.CRate.toFixed(1)}%` },
    { label: 'CDmg', value: `${stats.CDmg.toFixed(1)}%` },
    { label: 'EHP', value: stats.EHP.toLocaleString() },
    { label: 'Avg DMG', value: stats.AvgDMG.toLocaleString() },
  ]
  return (
    <div className="bg-[#252320] border border-[#2e2c28] rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wider text-[#a09d96] mb-3">Stats Finais</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between text-sm">
            <span className="text-[#a09d96]">{r.label}</span>
            <span className="text-[#cc785c] font-semibold">{r.value}</span>
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
  const { data, isLoading, error } = useQuery({
    queryKey: ['combatants', charId, 'stats'],
    queryFn: () => api.combatantStats(charId),
    enabled: !!charId,
  })

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando dados do combatente" className="flex items-center p-6 text-[#a09d96]">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-sm">Carregando...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="p-4 text-sm text-[#c64545]">
        Erro ao carregar dados do combatente.
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
