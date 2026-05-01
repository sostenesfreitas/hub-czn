import { useState } from 'react'
import { User } from 'lucide-react'
import type { Combatant } from '@/lib/types'

interface CombatantCardProps {
  combatant: Combatant
  selected: boolean
  onClick: () => void
}

export function CombatantCard({ combatant, selected, onClick }: CombatantCardProps) {
  const [imgError, setImgError] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all w-full ${
        selected
          ? 'bg-[#2e2c28] border-[#cc785c]'
          : 'bg-[#252320] border-[#2e2c28] hover:border-[#3a3835]'
      }`}
    >
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#181715] border border-[#2e2c28] shrink-0">
        {imgError || !combatant.portrait_url ? (
          <div className="w-full h-full flex items-center justify-center text-[#a09d96]">
            <User size={24} />
          </div>
        ) : (
          <img
            src={combatant.portrait_url}
            alt={combatant.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      <p title={combatant.name} className="text-xs font-medium text-[#faf9f5] text-center leading-tight truncate w-full">
        {combatant.name}
      </p>
      <p className="text-[10px] text-[#a09d96]">Nv. {combatant.level}</p>
      <span
        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          combatant.avg_gear_score > 0
            ? 'bg-[#cc785c]/20 text-[#cc785c]'
            : 'bg-[#2e2c28] text-[#a09d96]'
        }`}
      >
        {combatant.avg_gear_score > 0 ? combatant.avg_gear_score.toFixed(1) : '—'}
      </span>
    </button>
  )
}
