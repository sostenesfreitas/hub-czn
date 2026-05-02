import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from 'lucide-react'
import { assetUrl } from '@/lib/api'
import type { Combatant } from '@/lib/types'

interface CombatantCardProps {
  combatant: Combatant
  selected: boolean
  onClick: () => void
}

export function CombatantCard({ combatant, selected, onClick }: CombatantCardProps) {
  const { t } = useTranslation()
  const [imgError, setImgError] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all w-full ${
        selected
          ? 'bg-[#282828] border-[#c084fc]'
          : 'bg-[#181818] border-[#282828] hover:border-[#333333]'
      }`}
    >
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#121212] border border-[#282828] shrink-0">
        {imgError || !combatant.portrait_url ? (
          <div className="w-full h-full flex items-center justify-center text-[#b3b3b3]">
            <User size={24} />
          </div>
        ) : (
          <img
            src={assetUrl(combatant.portrait_url)}
            alt={combatant.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      <p title={combatant.name} className="text-xs font-medium text-[#ffffff] text-center leading-tight truncate w-full">
        {combatant.name}
      </p>
      <p className="text-[10px] text-[#b3b3b3]">{t('combatants.level', { level: combatant.level })}</p>
      <span
        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          combatant.avg_gear_score > 0
            ? 'bg-[#c084fc]/20 text-[#c084fc]'
            : 'bg-[#282828] text-[#b3b3b3]'
        }`}
      >
        {combatant.avg_gear_score > 0 ? combatant.avg_gear_score.toFixed(1) : '—'}
      </span>
    </button>
  )
}
