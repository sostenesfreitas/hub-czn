import { NavLink } from 'react-router-dom'
import {
  Swords, Layers, Users, BarChart2,
  Radio, Settings, Gift, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/optimizer',  label: 'Optimizer',        icon: Swords },
  { to: '/fragments',  label: 'Memory Fragments',  icon: Layers },
  { to: '/combatants', label: 'Combatants',        icon: Users },
  { to: '/scoring',    label: 'Scoring',           icon: BarChart2 },
  { to: '/capture',    label: 'Capture',           icon: Radio },
  { to: '/setup',      label: 'Setup',             icon: Settings },
  { to: '/rescue',     label: 'Rescue Records',    icon: Gift },
  { to: '/about',      label: 'About',             icon: Info },
]

export function Sidebar() {
  return (
    <nav className="w-52 shrink-0 h-full flex flex-col bg-[#252320] py-4 gap-0.5">
      <div className="px-4 mb-5">
        <span className="text-[#faf9f5] font-bold text-base tracking-wide">Hub CZN</span>
      </div>
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-none',
              isActive
                ? 'text-[#cc785c] bg-[#181715] font-semibold'
                : 'text-[#a09d96] hover:text-[#faf9f5] hover:bg-[#2e2c28]',
            )
          }
        >
          <Icon size={15} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
