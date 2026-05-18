import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const TABS = [
  { to: 'cards', key: 'encyclopedia.tabs.cards' },
  { to: 'equipments', key: 'encyclopedia.tabs.equipments' },
  { to: 'engravings', key: 'encyclopedia.tabs.engravings' },
  { to: 'glossary', key: 'encyclopedia.tabs.glossary' },
] as const

export function EncyclopediaPage() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 gap-1 border-b border-[#282828] bg-[#121212] px-3">
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors',
                isActive
                  ? 'border-[#c084fc] text-[#ffffff]'
                  : 'border-transparent text-[#888] hover:text-[#e5e7eb]',
              )
            }
          >
            {t(tab.key)}
          </NavLink>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
