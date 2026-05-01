import { useState, useRef, useEffect } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STAT_GROUPS = [
  { label: 'Ofensivo', stats: ['Flat ATK', 'ATK%', 'CRate', 'CDmg', 'Extra DMG%', 'DoT%'] },
  { label: 'Defensivo', stats: ['Flat DEF', 'DEF%', 'Flat HP', 'HP%'] },
  {
    label: 'Elemental',
    stats: ['Passion DMG%', 'Order DMG%', 'Justice DMG%', 'Void DMG%', 'Instinct DMG%'],
  },
  { label: 'Outros', stats: ['Ego'] },
] as const

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

export type Preset = 'dps' | 'tank' | 'custom'

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
}

function WeightInput({
  stat,
  value,
  onChange,
}: {
  stat: string
  value: number
  onChange: (stat: string, v: number) => void
}) {
  const id = `weight-${stat.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs text-[#a09d96] truncate flex-1">{stat}</label>
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
        className="w-14 text-right text-sm bg-[#2e2c28] border border-[#3a3835] rounded px-2 py-0.5 text-[#faf9f5] focus:outline-none focus:border-[#cc785c]"
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
}: ScoringPanelProps) {
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
                ? 'bg-[#cc785c] text-[#faf9f5]'
                : 'bg-[#2e2c28] text-[#a09d96] hover:text-[#faf9f5]'
            }`}
          >
            {p === 'dps' ? 'DPS' : 'Tank'}
          </button>
        ))}
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1 text-xs rounded font-medium bg-[#2e2c28] text-[#a09d96] hover:text-[#faf9f5] transition-colors"
        >
          Reset
        </button>
        {activePreset === 'custom' && (
          <span className="px-3 py-1 text-xs rounded font-medium bg-[#252320] text-[#cc785c] border border-[#cc785c]/30">
            Custom
          </span>
        )}
      </div>

      {/* Weight inputs */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {STAT_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-[10px] uppercase tracking-wider text-[#a09d96] mb-2">
              {group.label}
            </p>
            <div className="space-y-2">
              {group.stats.map(stat =>
                stat in weights ? (
                  <WeightInput
                    key={stat}
                    stat={stat}
                    value={weights[stat] ?? 0}
                    onChange={onWeightChange}
                  />
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="space-y-2 shrink-0">
        {saveError && <p role="alert" className="text-xs text-[#c64545]">{saveError}</p>}
        <Button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="w-full bg-[#cc785c] hover:bg-[#b8674d] text-[#faf9f5] disabled:opacity-40"
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}

export function ScoringPanel(props: ScoringPanelProps) {
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
      <aside className="hidden sm:flex flex-col w-64 shrink-0 bg-[#252320] border border-[#2e2c28] rounded-xl p-4 h-full overflow-hidden">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#a09d96] mb-3">
          Pontuação
        </p>
        <PanelContent {...props} />
      </aside>

      {/* Mobile: icon button */}
      <div className="sm:hidden shrink-0">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg bg-[#252320] border border-[#2e2c28] text-[#a09d96]"
          aria-label="Abrir painel de pontuação"
        >
          <SlidersHorizontal size={20} />
        </button>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <button
              type="button"
              tabIndex={-1}
              className="absolute inset-0 bg-black/60 cursor-default"
              aria-label="Fechar painel"
              onClick={() => setDrawerOpen(false)}
            />
            <div
              ref={dialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Painel de pontuação"
              className="relative ml-auto w-72 h-full bg-[#252320] border-l border-[#2e2c28] p-4 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3 shrink-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#a09d96]">
                  Pontuação
                </p>
                <button
                  type="button"
                  aria-label="Fechar painel"
                  onClick={() => setDrawerOpen(false)}
                  className="text-[#a09d96]"
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
