import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Home, Swords, Layers, Users, BarChart2,
  Radio, Settings, Gift, Info, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import i18n from '@/i18n'
import { useUpdateCheck } from '@/hooks/useUpdateCheck'

const NAV = [
  { to: '/',           key: 'nav.home',        icon: Home },
  { to: '/optimizer',  key: 'nav.optimizer',   icon: Swords },
  { to: '/fragments',  key: 'nav.fragments',   icon: Layers },
  { to: '/combatants', key: 'nav.combatants',  icon: Users },
  { to: '/scoring',    key: 'nav.scoring',     icon: BarChart2 },
  { to: '/simulator',  key: 'nav.simulator',   icon: Zap,  beta: true },
  { to: '/capture',    key: 'nav.capture',     icon: Radio },
  { to: '/rescue',     key: 'nav.rescue',      icon: Gift },
  { to: '/setup',      key: 'nav.setup',       icon: Settings },
  { to: '/about',      key: 'nav.about',       icon: Info },
] as const

export function Sidebar() {
  const { t, i18n: i18nInstance } = useTranslation()
  const { hasUpdate } = useUpdateCheck()

  return (
    <nav className="w-52 shrink-0 h-full flex flex-col bg-[#181818] py-4 gap-0.5">
      <div className="px-4 mb-5">
        <span className="text-[#ffffff] font-bold text-base tracking-wide">Hub CZN</span>
      </div>
      {NAV.map(({ to, key, icon: Icon, ...rest }) => {
        const beta = 'beta' in rest && rest.beta
        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-none',
                isActive
                  ? 'text-[#ffffff] bg-[#282828] font-bold'
                  : 'text-[#b3b3b3] hover:text-[#ffffff] hover:bg-[#282828]',
              )
            }
          >
            <Icon size={15} />
            <span className="flex-1">{t(key)}</span>
            {beta && (
              <span className="text-[8px] font-bold px-1 py-px rounded bg-[#c084fc]/20 text-[#c084fc] uppercase tracking-wide shrink-0">
                beta
              </span>
            )}
            {key === 'nav.about' && hasUpdate && (
              <span className="w-2 h-2 rounded-full bg-[#c084fc] shrink-0" />
            )}
          </NavLink>
        )
      })}
      <div className="mt-auto pt-4 px-4 border-t border-[#282828] flex gap-2">
        {(['pt-BR', 'en'] as const).map((lng) => (
          <button
            key={lng}
            type="button"
            onClick={() => i18n.changeLanguage(lng)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              i18nInstance.language === lng
                ? 'bg-[#c084fc] text-[#ffffff]'
                : 'text-[#b3b3b3] hover:text-[#ffffff]'
            }`}
          >
            {lng === 'pt-BR' ? 'PT' : 'EN'}
          </button>
        ))}
      </div>
    </nav>
  )
}
