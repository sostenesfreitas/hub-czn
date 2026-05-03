import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InfoPopover } from '@/components/ui/info-popover'

export const DPS_WEIGHTS: Record<string, number> = {
  'Flat ATK': 7, 'ATK%': 10, 'Extra DMG%': 6,
  'Flat DEF': 1, 'DEF%': 1, 'Flat HP': 1, 'HP%': 1,
  'CRate': 8, 'CDmg': 8, 'Ego': 1, 'DoT%': 3,
  'Passion DMG%': 1, 'Order DMG%': 1, 'Justice DMG%': 1, 'Void DMG%': 1, 'Instinct DMG%': 1,
}

export const TANK_WEIGHTS: Record<string, number> = {
  'Flat ATK': 1, 'ATK%': 1, 'Extra DMG%': 1,
  'Flat DEF': 8, 'DEF%': 10, 'Flat HP': 8, 'HP%': 10,
  'CRate': 1, 'CDmg': 1, 'Ego': 1, 'DoT%': 1,
  'Passion DMG%': 1, 'Order DMG%': 1, 'Justice DMG%': 1, 'Void DMG%': 1, 'Instinct DMG%': 1,
}

export type Preset = 'dps' | 'tank' | 'custom' | 'system'

interface ScoringPanelProps {
  weights: Record<string, number>
  activePreset: Preset
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  onWeightChange: (stat: string, value: number) => void
  onPresetApply: (preset: 'dps' | 'tank') => void
  onReset: () => void
  onSave: () => void
  onSystemPreset?: () => void
  hasCharOverride?: boolean
  onResetToGlobal?: () => void
}

function WeightInput({
  stat,
  value,
  onChange,
  tip,
}: {
  stat: string
  value: number
  onChange: (stat: string, v: number) => void
  tip?: string
}) {
  const id = `weight-${stat.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs text-[#b3b3b3] flex-1 flex items-center gap-1 min-w-0">
        <span className="truncate">{stat}</span>
        {tip && <InfoPopover content={tip} />}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        max={10}
        value={value}
        onChange={e => {
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onChange(stat, n)
        }}
        onBlur={e => {
          const clamped = Math.max(0, Math.min(10, Number(e.target.value)))
          if (clamped !== value) onChange(stat, clamped)
        }}
        className="w-14 text-right text-sm bg-[#282828] border border-[#333333] rounded px-2 py-0.5 text-[#ffffff] focus:outline-none focus:border-[#c084fc]"
      />
    </div>
  )
}

function PanelContent({
  weights,
  activePreset,
  isDirty,
  isSaving,
  saveError,
  onWeightChange,
  onPresetApply,
  onReset,
  onSave,
  onSystemPreset,
  hasCharOverride,
  onResetToGlobal,
}: ScoringPanelProps) {
  const { t } = useTranslation()

  const STAT_TIPS: Record<string, string> = {
    CRate: t('tips.crate'),
    CDmg: t('tips.cdmg'),
    'DoT%': t('tips.dot'),
    Ego: t('tips.ego'),
  }

  const STAT_GROUPS = [
    { labelKey: 'scoring.group.offensive', stats: ['Flat ATK', 'ATK%', 'CRate', 'CDmg', 'Extra DMG%', 'DoT%'] },
    { labelKey: 'scoring.group.defensive', stats: ['Flat DEF', 'DEF%', 'Flat HP', 'HP%'] },
    {
      labelKey: 'scoring.group.elemental',
      stats: ['Passion DMG%', 'Order DMG%', 'Justice DMG%', 'Void DMG%', 'Instinct DMG%'],
    },
    { labelKey: 'scoring.group.other', stats: ['Ego'] },
  ] as const

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Presets */}
      <div className="flex gap-1 flex-wrap shrink-0">
        {(['dps', 'tank'] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onPresetApply(p)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              activePreset === p
                ? 'bg-[#c084fc] text-[#ffffff]'
                : 'bg-[#282828] text-[#b3b3b3] hover:text-[#ffffff]'
            }`}
          >
            {p === 'dps' ? 'DPS' : 'Tank'}
          </button>
        ))}
        {onSystemPreset && (
          <button
            type="button"
            onClick={onSystemPreset}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              activePreset === 'system'
                ? 'bg-[#c084fc] text-[#ffffff]'
                : 'bg-[#282828] text-[#b3b3b3] hover:text-[#ffffff]'
            }`}
          >
            {t('scoring.systemRec')}
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1 text-xs rounded font-medium bg-[#282828] text-[#b3b3b3] hover:text-[#ffffff] transition-colors"
        >
          {t('scoring.reset')}
        </button>
        {activePreset === 'custom' && (
          <span className="px-3 py-1 text-xs rounded font-medium bg-[#181818] text-[#c084fc] border border-[#c084fc]/30">
            {t('scoring.custom')}
          </span>
        )}
      </div>

      {/* Weight inputs */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {STAT_GROUPS.map(group => (
          <div key={group.labelKey}>
            <p className="text-[10px] uppercase tracking-wider text-[#b3b3b3] mb-2">
              {t(group.labelKey)}
            </p>
            <div className="space-y-2">
              {group.stats.map(stat =>
                stat in weights ? (
                  <WeightInput
                    key={stat}
                    stat={stat}
                    value={weights[stat] ?? 0}
                    onChange={onWeightChange}
                    tip={STAT_TIPS[stat]}
                  />
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="space-y-2 shrink-0">
        {saveError && <p role="alert" className="text-xs text-[#f3727f]">{saveError}</p>}
        <Button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="w-full bg-[#c084fc] hover:bg-[#9333ea] text-[#ffffff] disabled:opacity-40"
        >
          {isSaving ? t('scoring.saving') : t('scoring.save')}
        </Button>
        {hasCharOverride && onResetToGlobal && (
          <button
            type="button"
            onClick={onResetToGlobal}
            className="w-full text-xs text-[#b3b3b3] hover:text-[#ffffff] transition-colors py-1"
          >
            {t('scoring.resetToGlobal')}
          </button>
        )}
      </div>
    </div>
  )
}

export function ScoringPanel(props: ScoringPanelProps) {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (drawerOpen) {
      dialogRef.current?.focus()
    }
  }, [drawerOpen])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col w-64 shrink-0 bg-[#181818] border border-[#282828] rounded-xl p-4 h-full overflow-hidden">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#b3b3b3] mb-3">
          {t('scoring.title')}
        </p>
        <PanelContent {...props} />
      </aside>

      {/* Mobile: icon button */}
      <div className="sm:hidden shrink-0">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg bg-[#181818] border border-[#282828] text-[#b3b3b3]"
          aria-label={t('scoring.openPanel')}
        >
          <SlidersHorizontal size={20} />
        </button>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <button
              type="button"
              tabIndex={-1}
              className="absolute inset-0 bg-black/60 cursor-default"
              aria-label={t('scoring.closePanel')}
              onClick={() => setDrawerOpen(false)}
            />
            <div
              ref={dialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={t('scoring.title')}
              className="relative ml-auto w-72 h-full bg-[#181818] border-l border-[#282828] p-4 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3 shrink-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#b3b3b3]">
                  {t('scoring.title')}
                </p>
                <button
                  type="button"
                  aria-label={t('scoring.closePanel')}
                  onClick={() => setDrawerOpen(false)}
                  className="text-[#b3b3b3]"
                >
                  <X size={16} />
                </button>
              </div>
              <PanelContent {...props} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
