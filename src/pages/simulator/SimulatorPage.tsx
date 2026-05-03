import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Play, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import type { Combatant, SimulateDamageResponse, SimCardResult } from '@/lib/types'
import { CharacterCombobox } from '@/components/ui/character-combobox'

const MORALE_PCT = 20

// DEF presets derived from equip_stat_define@equip_stat_define.json
const DEF_PRESETS = [
  { label: 'WL1 (DEF 10)', value: 10 },
  { label: 'Test (DEF 20)', value: 20 },
  { label: 'WL2 (DEF 17)', value: 17 },
  { label: 'WL3 (DEF 23)', value: 23 },
  { label: 'WL4 (DEF 27)', value: 27 },
  { label: 'WL5 (DEF 31)', value: 31 },
]

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center rounded px-3 py-2 min-w-[80px] ${highlight ? 'bg-[#1a2a1a]' : 'bg-[#222]'}`}>
      <span className="text-[#888] text-[10px] uppercase tracking-wide">{label}</span>
      <span className={`font-bold text-sm mt-0.5 ${highlight ? 'text-[#a3e635]' : 'text-[#e5e7eb]'}`}>{value}</span>
    </div>
  )
}

function CardRow({ card }: { card: SimCardResult }) {
  const shortId = card.card_id.replace(/^c_\d+_/, '')
  const hasSpark = !!card.spark_id
  const coefficient = (card.eff_value / 100).toFixed(2)

  return (
    <tr className="border-b border-[#2a2a2a] hover:bg-[#1e1e1e] transition-colors">
      <td className="px-3 py-2 font-mono text-xs text-[#c084fc]">
        {shortId}
        {hasSpark && (
          <span className="ml-1 text-[#facc15] text-[10px]" title={card.spark_id ?? ''}>
            ✦
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-center text-[#e5e7eb] text-xs">{card.cost}</td>
      <td className="px-3 py-2 text-center text-[#e5e7eb] text-xs font-mono">
        {coefficient}× ATK
      </td>
      <td className="px-3 py-2 text-center text-[#e5e7eb] text-xs">{card.hits}</td>
      <td className="px-3 py-2 text-right text-[#e5e7eb] text-xs font-mono">
        {card.final_damage.toLocaleString()}
      </td>
      <td className="px-3 py-2 text-right text-[#a3e635] text-xs font-mono font-bold">
        {card.effective_damage.toLocaleString()}
      </td>
    </tr>
  )
}

export function SimulatorPage() {
  const { t } = useTranslation()

  const [charName, setCharName] = useState('')
  const [morale, setMorale] = useState(0)
  const [useSparks, setUseSparks] = useState(true)
  const [monsterDef, setMonsterDef] = useState(20)
  const [result, setResult] = useState<SimulateDamageResponse | null>(null)

  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.status(),
    refetchInterval: 5_000,
  })

  const { data: combatants = [] } = useQuery<Combatant[]>({
    queryKey: ['combatants'],
    queryFn: () => api.combatants(),
    enabled: status?.data_loaded ?? false,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: () =>
      api.simulateDamage({ char_name: charName, morale, use_sparks: useSparks, monster_def: monsterDef }),
    onSuccess: (data) => setResult(data),
  })

  const canRun = charName !== '' && !mutation.isPending && (status?.data_loaded ?? false)
  const moraleMultDisplay = `×${(1 + morale * MORALE_PCT / 100).toFixed(2)}`
  const defReductionPreview = `${(300 / (300 + monsterDef) * 100).toFixed(1)}%`

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-64 shrink-0 flex flex-col gap-4 p-4 bg-[#181818] border-r border-[#282828] overflow-y-auto">
        <div>
          <h2 className="text-[#ffffff] font-bold text-sm mb-3">{t('simulator.title')}</h2>
          <p className="text-[#888] text-xs leading-relaxed">{t('simulator.description')}</p>
        </div>

        {!status?.data_loaded && (
          <div className="text-[#f87171] text-xs bg-[#2a1a1a] border border-[#5a2020] rounded px-3 py-2">
            {t('simulator.noData')}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-[#b3b3b3] text-xs">{t('simulator.character')}</label>
          <CharacterCombobox
            combatants={combatants}
            value={charName}
            onChange={setCharName}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <label className="text-[#b3b3b3] text-xs">{t('simulator.morale')}</label>
            <span className="text-[#c084fc] text-xs font-mono">{morale} {moraleMultDisplay}</span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            value={morale}
            onChange={(e) => setMorale(Number(e.target.value))}
            className="w-full accent-[#c084fc]"
          />
          <div className="flex justify-between text-[#555] text-[10px]">
            <span>0</span>
            <span>10</span>
            <span>20</span>
          </div>
        </div>

        {/* Monster DEF */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <label className="text-[#b3b3b3] text-xs">{t('simulator.monsterDef')}</label>
            <span className="text-[#fb923c] text-xs font-mono">{defReductionPreview} {t('simulator.dmgPasses')}</span>
          </div>
          <div className="flex gap-1">
            <input
              type="number"
              min={0}
              max={9999}
              value={monsterDef}
              onChange={(e) => setMonsterDef(Math.max(0, Number(e.target.value)))}
              className="flex-1 bg-[#222] border border-[#333] text-[#e5e7eb] text-xs rounded px-2 py-1 w-0 font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {DEF_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setMonsterDef(p.value)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  monsterDef === p.value
                    ? 'bg-[#fb923c] text-white'
                    : 'bg-[#2a2a2a] text-[#888] hover:text-[#e5e7eb]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="use-sparks"
            type="checkbox"
            checked={useSparks}
            onChange={(e) => setUseSparks(e.target.checked)}
            className="accent-[#c084fc]"
          />
          <label htmlFor="use-sparks" className="text-[#b3b3b3] text-xs cursor-pointer">
            {t('simulator.useSparks')}
          </label>
        </div>

        <button
          type="button"
          disabled={!canRun}
          onClick={() => mutation.mutate()}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded bg-[#c084fc] text-[#fff] text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#a855f7] transition-colors"
        >
          <Play size={14} />
          {mutation.isPending ? t('simulator.running') : t('simulator.run')}
        </button>

        {mutation.isError && (
          <div className="text-[#f87171] text-xs bg-[#2a1a1a] border border-[#5a2020] rounded px-3 py-2">
            {(mutation.error as Error)?.message ?? t('simulator.error')}
          </div>
        )}

        <div className="mt-auto text-[#555] text-[10px] leading-relaxed border-t border-[#282828] pt-3">
          <p>{t('simulator.formulaNote', { pct: MORALE_PCT })}</p>
        </div>
      </div>

      {/* Right results area */}
      <div className="flex-1 overflow-y-auto p-4">
        {!result && !mutation.isPending && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#444]">
            <Zap size={40} />
            <p className="text-sm">{t('simulator.empty')}</p>
          </div>
        )}

        {mutation.isPending && (
          <div className="flex items-center justify-center h-full text-[#888] text-sm">
            {t('simulator.running')}…
          </div>
        )}

        {result && !mutation.isPending && (
          <div className="flex flex-col gap-4">
            {/* Stats summary */}
            <div>
              <h3 className="text-[#ffffff] font-bold text-sm mb-3">{result.char_name}</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <StatPill label="ATK" value={Math.round(result.atk).toLocaleString()} />
                <StatPill label="CRate" value={`${result.crate.toFixed(1)}%`} />
                <StatPill label="CDmg" value={`${result.cdmg.toFixed(1)}%`} />
                <StatPill label={t('simulator.critFactor')} value={`×${result.crit_factor.toFixed(3)}`} />
                <StatPill label={t('simulator.morale')} value={`${result.morale_stacks} (${result.morale_mult.toFixed(2)}×)`} />
                <StatPill
                  label={`DEF ${result.monster_def}`}
                  value={`${(result.def_reduction * 100).toFixed(1)}%`}
                />
              </div>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#1e1e1e] rounded px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[#888] text-[10px] uppercase tracking-wide">{t('simulator.totalDeck')}</span>
                <span className="text-[#e5e7eb] font-bold text-lg font-mono">
                  {result.total_damage.toLocaleString()}
                </span>
              </div>
              <div className="bg-[#1a2a1a] rounded px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[#888] text-[10px] uppercase tracking-wide">{t('simulator.totalEffective')}</span>
                <span className="text-[#a3e635] font-bold text-lg font-mono">
                  {result.total_effective_damage.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Card table */}
            {result.cards.length === 0 ? (
              <div className="text-[#888] text-sm text-center py-8">{t('simulator.noDmgCards')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#333] text-[#888] text-xs uppercase tracking-wide">
                      <th className="px-3 py-2 text-left">{t('simulator.col.card')}</th>
                      <th className="px-3 py-2 text-center">{t('simulator.col.cost')}</th>
                      <th className="px-3 py-2 text-center">{t('simulator.col.coefficient')}</th>
                      <th className="px-3 py-2 text-center">{t('simulator.col.hits')}</th>
                      <th className="px-3 py-2 text-right">{t('simulator.col.finalDmg')}</th>
                      <th className="px-3 py-2 text-right">{t('simulator.col.effectiveDmg')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.cards
                      .sort((a, b) => b.effective_damage - a.effective_damage)
                      .map((card) => (
                        <CardRow key={`${card.card_id}-${card.spark_id}`} card={card} />
                      ))}
                  </tbody>
                </table>
                <p className="text-[#555] text-[10px] mt-2 px-1">
                  ✦ = {t('simulator.sparkNote')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
