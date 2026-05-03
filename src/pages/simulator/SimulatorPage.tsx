import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Play, Zap } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import type { Combatant, SimulateDamageResponse, SimCardResult, DeckInfo } from '@/lib/types'
import { CharacterCombobox } from '@/components/ui/character-combobox'

const MORALE_PCT = 20

// DEF values: WL = s_def from equip_stat_define; Tower = s_def × boss_powerstep/205 (WL5 ref).
// F30-F120 share boss_powerstep=323 (→36/49); F150 escalates to 391 (Soul Collector).
const DEF_PRESET_GROUPS = [
  {
    label: 'simulator.presetGroupWorld',
    presets: [
      { label: 'WL1', value: 10 },
      { label: 'WL2', value: 17 },
      { label: 'WL3', value: 23 },
      { label: 'WL4', value: 27 },
      { label: 'WL5', value: 31 },
    ],
  },
  {
    label: 'simulator.presetGroupTower',
    presets: [
      { label: 'F30', value: 36 },
      { label: 'F60', value: 49 },
      { label: 'F90', value: 49 },
      { label: 'F120', value: 49 },
      { label: 'F150', value: 59 },
    ],
  },
  {
    label: 'simulator.presetGroupBoss',
    presets: [
      { label: 'Soul Collector (F150)', value: 59 },
    ],
  },
]

const STORAGE_KEY = 'czn_simulator_state'

interface PersistedState {
  charName: string
  deckId: number | null
  morale: number
  useSparks: boolean
  monsterDef: number
  weaken: boolean
  vulnerableStacks: number
  dmgReduction: boolean
  result: SimulateDamageResponse | null
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

function savePersistedState(s: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch { }
}

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center rounded px-3 py-2 min-w-[80px] ${highlight ? 'bg-[#1a2a1a]' : 'bg-[#222]'}`}>
      <span className="text-[#888] text-[10px] uppercase tracking-wide">{label}</span>
      <span className={`font-bold text-sm mt-0.5 ${highlight ? 'text-[#a3e635]' : 'text-[#e5e7eb]'}`}>{value}</span>
    </div>
  )
}

function CardRow({ card }: { card: SimCardResult }) {
  const { t } = useTranslation()
  const hasSpark = !!card.spark_id
  const coefficient = (card.eff_value / 100).toFixed(2)
  const displayName = card.name || card.card_id.replace(/^c_\d+_/, '')
  const [imgError, setImgError] = useState(false)

  return (
    <>
      <tr className="border-b border-[#2a2a2a] hover:bg-[#1e1e1e] transition-colors">
        <td className="px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            {card.icon_path && !imgError ? (
              <img
                src={assetUrl(card.icon_path)}
                alt=""
                className="w-8 h-8 rounded flex-shrink-0 object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-8 h-8 rounded flex-shrink-0 bg-[#282828]" />
            )}
            <div className="flex items-center gap-1">
              <span className="text-[#e5e7eb] font-medium">{displayName}</span>
              {hasSpark && (
                <span className="text-[#facc15] text-[10px]" title={t('simulator.epifaniaApplied')}>✦</span>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2 text-center text-[#b3b3b3] text-xs">{card.cost}</td>
        <td className="px-3 py-2 text-center text-[#b3b3b3] text-xs font-mono">{coefficient}×</td>
        <td className="px-3 py-2 text-center text-[#b3b3b3] text-xs">{card.hits}</td>
        <td className="px-3 py-2 text-right text-[#e5e7eb] text-xs font-mono">
          {card.normal_damage.toLocaleString()}
        </td>
        <td className="px-3 py-2 text-right text-[#e5e7eb] text-xs font-mono">
          {card.crit_damage.toLocaleString()}
        </td>
        <td className="px-3 py-2 text-right text-[#a3e635] text-xs font-mono font-bold">
          {card.avg_damage.toLocaleString()}
        </td>
      </tr>
      {card.hits > 1 && (
        <tr className="border-b border-[#282828] bg-[#141414]">
          <td className="px-3 py-1 text-[9px] text-[#555] pl-14" colSpan={4}>
            {t('simulator.perHit')}
          </td>
          <td className="px-3 py-1 text-right text-[#555] text-[10px] font-mono">
            {(card.normal_damage / card.hits).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </td>
          <td className="px-3 py-1 text-right text-[#555] text-[10px] font-mono">
            {(card.crit_damage / card.hits).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </td>
          <td className="px-3 py-1 text-right text-[#6a9e35] text-[10px] font-mono">
            {(card.avg_damage / card.hits).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </td>
        </tr>
      )}
    </>
  )
}

export function SimulatorPage() {
  const { t } = useTranslation()

  const [charName, setCharName] = useState(() => loadPersistedState()?.charName ?? '')
  const [deckId, setDeckId] = useState<number | null>(() => loadPersistedState()?.deckId ?? null)
  const [morale, setMorale] = useState(() => loadPersistedState()?.morale ?? 0)
  const [useSparks, setUseSparks] = useState(() => loadPersistedState()?.useSparks ?? true)
  const [monsterDef, setMonsterDef] = useState(() => loadPersistedState()?.monsterDef ?? 20)
  const [weaken, setWeaken] = useState(() => loadPersistedState()?.weaken ?? false)
  const [vulnerableStacks, setVulnerableStacks] = useState(() => loadPersistedState()?.vulnerableStacks ?? 0)
  const [dmgReduction, setDmgReduction] = useState(() => loadPersistedState()?.dmgReduction ?? false)
  const [result, setResult] = useState<SimulateDamageResponse | null>(() => loadPersistedState()?.result ?? null)

  // Callers must pass every field that just changed in `patch` to override the closure snapshot.
  function persist(patch: Partial<PersistedState>) {
    savePersistedState({
      charName, deckId, morale, useSparks, monsterDef,
      weaken, vulnerableStacks, dmgReduction, result,
      ...patch,
    })
  }

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

  const { data: decks = [] } = useQuery<DeckInfo[]>({
    queryKey: ['simulate-decks', charName],
    queryFn: () => api.simulateDecks(charName),
    enabled: charName !== '' && (status?.data_loaded ?? false),
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: () =>
      api.simulateDamage({
        char_name: charName,
        deck_id: deckId,
        morale,
        use_sparks: useSparks,
        monster_def: monsterDef,
        frightened: weaken,
        exposed_stacks: vulnerableStacks,
        fortitude: dmgReduction,
      }),
    onSuccess: (data) => { setResult(data); persist({ result: data }) },
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
            onChange={(v) => { setCharName(v); setDeckId(null); persist({ charName: v, deckId: null }) }}
          />
        </div>

        {charName && decks.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-[#b3b3b3] text-xs">{t('simulator.deck')}</label>
            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto pr-0.5">
              <button
                type="button"
                onClick={() => { setDeckId(null); persist({ deckId: null }) }}
                className={`text-left text-xs px-2 py-1.5 rounded transition-colors ${
                  deckId === null
                    ? 'bg-[#c084fc] text-white'
                    : 'bg-[#222] text-[#888] hover:text-[#e5e7eb]'
                }`}
              >
                {t('simulator.deckAuto')}
              </button>
              {decks.map((d) => {
                const label = d.bookmark_slot > 0
                  ? t('simulator.deckSlot', { slot: d.bookmark_slot })
                  : `#${d.deck_id}`
                const sub = t('simulator.deckPoints', {
                  point: d.point.toLocaleString(),
                  count: d.card_count,
                })
                return (
                  <button
                    key={d.deck_id}
                    type="button"
                    onClick={() => { setDeckId(d.deck_id); persist({ deckId: d.deck_id }) }}
                    className={`text-left text-xs px-2 py-1.5 rounded transition-colors ${
                      deckId === d.deck_id
                        ? 'bg-[#c084fc] text-white'
                        : 'bg-[#222] text-[#888] hover:text-[#e5e7eb]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{d.name || label}</span>
                      {d.bookmark_slot > 0 && !d.name && (
                        <span className="shrink-0 text-[9px] opacity-60">★</span>
                      )}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${deckId === d.deck_id ? 'text-white/70' : 'text-[#555]'}`}>
                      {sub}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

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
            onChange={(e) => { const v = Number(e.target.value); setMorale(v); persist({ morale: v }) }}
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
          <div className="flex flex-col gap-2 mt-1">
            {DEF_PRESET_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[9px] text-[#555] uppercase tracking-wider mb-1">
                  {t(group.label)}
                </p>
                <div className="flex flex-wrap gap-1">
                  {group.presets.map((p) => (
                    <button
                      key={`${group.label}-${p.label}`}
                      type="button"
                      onClick={() => { setMonsterDef(p.value); persist({ monsterDef: p.value }) }}
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
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="number"
              min={0}
              max={9999}
              value={monsterDef}
              onChange={(e) => { const v = Math.max(0, Number(e.target.value)); setMonsterDef(v); persist({ monsterDef: v }) }}
              className="flex-1 bg-[#222] border border-[#333] text-[#e5e7eb] text-xs rounded px-2 py-1 w-0 font-mono"
            />
          </div>
        </div>

        {/* Buffs & Debuffs */}
        <div className="flex flex-col gap-2">
          <label className="text-[#b3b3b3] text-xs">{t('simulator.buffsDebuffs')}</label>

          <div className="flex flex-col gap-1.5 bg-[#1e1e1e] rounded p-2">
            <div className="flex items-center justify-between">
              <label className="text-[#f87171] text-xs cursor-pointer" htmlFor="weaken">
                {t('simulator.weaken')}
                <span className="ml-1 text-[#555] text-[10px]">{t('simulator.weakenHint')}</span>
              </label>
              <input
                id="weaken"
                type="checkbox"
                checked={weaken}
                onChange={(e) => { setWeaken(e.target.checked); persist({ weaken: e.target.checked }) }}
                className="accent-[#f87171]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-[#34d399] text-xs cursor-pointer" htmlFor="dmg-reduction">
                {t('simulator.dmgReduction')}
                <span className="ml-1 text-[#555] text-[10px]">{t('simulator.dmgReductionHint')}</span>
              </label>
              <input
                id="dmg-reduction"
                type="checkbox"
                checked={dmgReduction}
                onChange={(e) => { setDmgReduction(e.target.checked); persist({ dmgReduction: e.target.checked }) }}
                className="accent-[#34d399]"
              />
            </div>

            <div className="flex flex-col gap-0.5 mt-1">
              <div className="flex justify-between items-center">
                <span className="text-[#facc15] text-xs">{t('simulator.vulnerable')}</span>
                <span className="text-[#facc15] text-xs font-mono">
                  {vulnerableStacks > 0
                    ? t('simulator.vulnerableHint', { mult: (1 + vulnerableStacks * 0.5).toFixed(1) })
                    : 'off'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                value={vulnerableStacks}
                onChange={(e) => { const v = Number(e.target.value); setVulnerableStacks(v); persist({ vulnerableStacks: v }) }}
                className="w-full accent-[#facc15]"
              />
              <div className="flex justify-between text-[#555] text-[10px]">
                <span>0</span>
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="use-sparks"
            type="checkbox"
            checked={useSparks}
            onChange={(e) => { setUseSparks(e.target.checked); persist({ useSparks: e.target.checked }) }}
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
          <p className="mt-1">{t('simulator.buffNote')}</p>
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
              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="text-[#ffffff] font-bold text-sm">{result.char_name}</h3>
                {result.deck_id != null && (
                  <span className="text-[#555] text-[10px]">deck #{result.deck_id}</span>
                )}
              </div>
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
                {result.buff_mult !== 1 && (
                  <StatPill
                    label={t('simulator.buffMult')}
                    value={`×${result.buff_mult.toFixed(3)}`}
                    highlight={result.buff_mult > 1}
                  />
                )}
              </div>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#1e1e1e] rounded px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[#888] text-[10px] uppercase tracking-wide">{t('simulator.totalNormal')}</span>
                <span className="text-[#e5e7eb] font-bold text-lg font-mono">
                  {result.total_normal.toLocaleString()}
                </span>
              </div>
              <div className="bg-[#1e1e1e] rounded px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[#888] text-[10px] uppercase tracking-wide">{t('simulator.totalCrit')}</span>
                <span className="text-[#e5e7eb] font-bold text-lg font-mono">
                  {result.total_crit.toLocaleString()}
                </span>
              </div>
              <div className="bg-[#1a2a1a] rounded px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[#888] text-[10px] uppercase tracking-wide">{t('simulator.totalAvg')}</span>
                <span className="text-[#a3e635] font-bold text-lg font-mono">
                  {result.total_avg.toLocaleString()}
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
                      <th className="px-3 py-2 text-left min-w-[160px]">{t('simulator.col.card')}</th>
                      <th className="px-3 py-2 text-center">{t('simulator.col.cost')}</th>
                      <th className="px-3 py-2 text-center">{t('simulator.col.coefficient')}</th>
                      <th className="px-3 py-2 text-center">{t('simulator.col.hits')}</th>
                      <th className="px-3 py-2 text-right">{t('simulator.col.normal')}</th>
                      <th className="px-3 py-2 text-right">{t('simulator.col.crit')}</th>
                      <th className="px-3 py-2 text-right text-[#a3e635]">{t('simulator.col.avg')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.cards]
                      .sort((a, b) => b.avg_damage - a.avg_damage)
                      .map((card) => (
                        <CardRow key={`${card.card_id}-${card.spark_id}`} card={card} />
                      ))}
                  </tbody>
                </table>
                <p className="text-[#555] text-[10px] mt-2 px-1">
                  ✦ = {t('simulator.epifaniaNote')}
                  &nbsp;·&nbsp; {t('simulator.avgNote')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
