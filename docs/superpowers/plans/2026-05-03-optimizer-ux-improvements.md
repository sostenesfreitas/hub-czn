# Optimizer UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three UX improvements to the optimizer: persist the last config + results across page navigation; show a character avatar on gear cards indicating who has each piece equipped; replace the native character `<select>` with a searchable dropdown that shows portraits.

**Architecture:** Each task touches independent files. Task 1 is pure state management in `OptimizerPage`. Task 2 adds optional props to `GearSlotCard` and resolves portraits in `ResultsArea`. Task 3 creates a new `CharacterCombobox` component and wires it into `OptimizerPanel`, replacing the native `<select>`.

**Tech Stack:** React 18, TypeScript, TanStack Query (for cached combatants data), `localStorage` for persistence, `lucide-react` icons.

---

## File Map

| File | Change |
|------|--------|
| `src/pages/optimizer/OptimizerPage.tsx` | Add `configRef`; restore state on mount; save to localStorage on job complete |
| `src/pages/combatants/CombatantDetail.tsx` | Add `equippedToPortrait?` + `equippedToName?` props to `GearSlotCard` |
| `src/pages/optimizer/ResultsArea.tsx` | Get combatants from query cache; pass portrait props to `GearSlotCard` |
| `src/components/ui/character-combobox.tsx` | New searchable dropdown component with per-row avatars |
| `src/pages/optimizer/OptimizerPanel.tsx` | Replace native `<select>` with `CharacterCombobox` |

---

### Task 1: State persistence

**Files:**
- Modify: `src/pages/optimizer/OptimizerPage.tsx`

- [ ] **Step 1: Add `configRef` to track current config inside the WS callback**

  The WS `useEffect` runs once on mount, so `config` state is stale inside it. Add a ref that always reflects the current config, the same pattern already used for `jobStateRef`.

  Current code at lines 36–37:
  ```tsx
  const jobStateRef = useRef<JobState>('idle')
  jobStateRef.current = jobState
  ```

  Add immediately after:
  ```tsx
  const configRef = useRef<OptimizerConfig>(DEFAULT_CONFIG)
  configRef.current = config
  ```

- [ ] **Step 2: Save state to `localStorage` when a job completes**

  In the WS `onmessage` handler, the `optimize.done` case currently reads:
  ```tsx
  case 'optimize.done':
    setResults(msg.results as OptimizeResult[])
    setJobState('done')
    setProgress(null)
    break
  ```

  Replace with:
  ```tsx
  case 'optimize.done': {
    const newResults = msg.results as OptimizeResult[]
    setResults(newResults)
    setJobState('done')
    setProgress(null)
    try {
      localStorage.setItem(
        'czn_optimizer_state',
        JSON.stringify({ config: configRef.current, results: newResults, selectedRank: null })
      )
    } catch { /* storage quota — ignore */ }
    break
  }
  ```

- [ ] **Step 3: Restore state on mount**

  Add a new `useEffect` that runs only once (empty dep array), after the existing state declarations but before the WS `useEffect`:

  ```tsx
  // Restore last session state
  useEffect(() => {
    try {
      const raw = localStorage.getItem('czn_optimizer_state')
      if (!raw) return
      const saved = JSON.parse(raw) as {
        config: OptimizerConfig
        results: OptimizeResult[]
        selectedRank: number | null
      }
      if (!saved.results?.length) return
      setConfig(saved.config)
      setResults(saved.results)
      setSelectedRank(saved.selectedRank ?? null)
      setJobState('done')
    } catch { /* malformed — fall back to default */ }
  }, [])
  ```

- [ ] **Step 4: Check TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/pages/optimizer/OptimizerPage.tsx
  git commit -m "feat: persist optimizer config and results in localStorage"
  ```

---

### Task 2: Avatar on gear result cards

**Files:**
- Modify: `src/pages/combatants/CombatantDetail.tsx:31`
- Modify: `src/pages/optimizer/ResultsArea.tsx:1`

- [ ] **Step 1: Add `User` import to `CombatantDetail.tsx`**

  Current import at line 3:
  ```tsx
  import { Loader2 } from 'lucide-react'
  ```

  Add `User` to the import:
  ```tsx
  import { Loader2, User } from 'lucide-react'
  ```

- [ ] **Step 2: Add optional props to `GearSlotCard`**

  Current signature at line 31:
  ```tsx
  export function GearSlotCard({ slot }: { slot: GearSlot }) {
  ```

  Change to:
  ```tsx
  export function GearSlotCard({
    slot,
    equippedToPortrait,
    equippedToName,
  }: {
    slot: GearSlot
    equippedToPortrait?: string
    equippedToName?: string
  }) {
  ```

- [ ] **Step 3: Render the avatar in the card header**

  The header div at line 49 is:
  ```tsx
  <div className="flex items-center gap-2.5 px-3 pt-3 pb-2.5 border-b border-[#1e1e1e]">
  ```

  Add `relative` so the avatar can be absolutely positioned:
  ```tsx
  <div className="relative flex items-center gap-2.5 px-3 pt-3 pb-2.5 border-b border-[#1e1e1e]">
  ```

  Then, just before the closing `</div>` of the header (after the text `<div className="flex-1 min-w-0">` block, around line 83), add:
  ```tsx
        {equippedToPortrait ? (
          <img
            src={equippedToPortrait}
            alt={equippedToName}
            title={equippedToName}
            className="absolute top-2 right-2 w-6 h-6 rounded-full object-cover border border-[#282828] shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : equippedToName ? (
          <div
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#282828] flex items-center justify-center shrink-0"
            title={equippedToName}
          >
            <User size={12} className="text-[#555]" />
          </div>
        ) : null}
  ```

  The fallback `<User>` icon renders when `equippedToName` is provided but the portrait URL fails or is absent (e.g. the character exists but has no portrait set).

- [ ] **Step 4: Resolve portraits in `ResultsArea.tsx`**

  Add `useQueryClient` and `Combatant` imports at the top of `ResultsArea.tsx`. Current imports:
  ```tsx
  import { useQuery } from '@tanstack/react-query'
  import { Loader2 } from 'lucide-react'
  import { useTranslation } from 'react-i18next'
  import { api } from '@/lib/api'
  import type { OptimizeResult, OptimizeProgress, CombatantStats, FinalStats } from '@/lib/types'
  import { GearSlotCard } from '../combatants/CombatantDetail'
  ```

  Replace with:
  ```tsx
  import { useQuery, useQueryClient } from '@tanstack/react-query'
  import { Loader2 } from 'lucide-react'
  import { useTranslation } from 'react-i18next'
  import { api, assetUrl } from '@/lib/api'
  import type { OptimizeResult, OptimizeProgress, CombatantStats, FinalStats, Combatant } from '@/lib/types'
  import { GearSlotCard } from '../combatants/CombatantDetail'
  ```

- [ ] **Step 5: Read combatants from query cache in `ResultsArea`**

  In `ResultsArea` function body, add after the existing `useQuery` for `currentStats` (around line 120):

  ```tsx
  const queryClient = useQueryClient()
  const combatants = queryClient.getQueryData<Combatant[]>(['combatants']) ?? []
  ```

  This reads the already-cached combatants list (populated by `OptimizerPanel`'s own query) without making a new network request.

- [ ] **Step 6: Pass portrait props to `GearSlotCard` in `ExpandedBuild`**

  `ExpandedBuild` currently renders:
  ```tsx
  {result.gear_slots.map((slot) => (
    <GearSlotCard key={slot.slot} slot={slot} />
  ))}
  ```

  `ExpandedBuild` needs access to `combatants`. Update its props interface and usage. The `combatants` read must happen in `ResultsArea` (where `useQueryClient` is called) and be passed down:

  **Update `ExpandedBuild` signature** (around line 76):
  ```tsx
  function ExpandedBuild({
    result,
    currentStats,
    combatants,
  }: {
    result: OptimizeResult
    currentStats: CombatantStats | undefined
    combatants: Combatant[]
  }) {
  ```

  **Update the `GearSlotCard` map** inside `ExpandedBuild`:
  ```tsx
  {result.gear_slots.map((slot) => {
    const owner = slot.equipped_to
      ? combatants.find((c) => c.char_id === slot.equipped_to)
      : undefined
    return (
      <GearSlotCard
        key={slot.slot}
        slot={slot}
        equippedToPortrait={owner?.portrait_url ? assetUrl(owner.portrait_url) : undefined}
        equippedToName={owner?.name}
      />
    )
  })}
  ```

  **Update the call site** in `ResultsArea` where `ExpandedBuild` is rendered (around line 222):
  ```tsx
  <ExpandedBuild
    result={r}
    currentStats={currentStats}
    combatants={combatants}
  />
  ```

- [ ] **Step 7: Check TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors.

- [ ] **Step 8: Commit**

  ```bash
  git add src/pages/combatants/CombatantDetail.tsx src/pages/optimizer/ResultsArea.tsx
  git commit -m "feat: show equipped-by avatar on gear result cards"
  ```

---

### Task 3: Character selector with avatars

**Files:**
- Create: `src/components/ui/character-combobox.tsx`
- Modify: `src/pages/optimizer/OptimizerPanel.tsx`

- [ ] **Step 1: Create `CharacterCombobox` component**

  Create `src/components/ui/character-combobox.tsx` with the full implementation:

  ```tsx
  import { useState, useRef, useEffect } from 'react'
  import { ChevronDown, User } from 'lucide-react'
  import { assetUrl } from '@/lib/api'
  import type { Combatant } from '@/lib/types'

  interface CharacterComboboxProps {
    combatants: Combatant[]
    value: string
    onChange: (charId: string) => void
    disabled?: boolean
    placeholder?: string
  }

  function CharAvatar({ combatant }: { combatant: Combatant }) {
    const [error, setError] = useState(false)
    if (!combatant.portrait_url || error) {
      return (
        <div className="w-6 h-6 rounded-full bg-[#282828] flex items-center justify-center shrink-0">
          <User size={12} className="text-[#555]" />
        </div>
      )
    }
    return (
      <img
        src={assetUrl(combatant.portrait_url)}
        alt={combatant.name}
        className="w-6 h-6 rounded-full object-cover shrink-0"
        onError={() => setError(true)}
      />
    )
  }

  export function CharacterCombobox({
    combatants,
    value,
    onChange,
    disabled,
    placeholder = 'Selecionar...',
  }: CharacterComboboxProps) {
    const [open, setOpen] = useState(false)
    const [filter, setFilter] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (!open) return
      function handleMouseDown(e: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false)
          setFilter('')
        }
      }
      document.addEventListener('mousedown', handleMouseDown)
      return () => document.removeEventListener('mousedown', handleMouseDown)
    }, [open])

    const selected = combatants.find((c) => c.char_id === value)
    const filtered = filter
      ? combatants.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
      : combatants

    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setOpen((o) => !o)
              setFilter('')
            }
          }}
          className="w-full bg-[#282828] border border-[#333333] rounded px-2.5 py-1.5 text-xs text-left flex items-center gap-2 outline-none focus:border-[#c084fc] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selected ? (
            <>
              <CharAvatar combatant={selected} />
              <span className="flex-1 truncate text-[#ffffff]">{selected.name}</span>
            </>
          ) : (
            <span className="flex-1 text-[#666666]">{placeholder}</span>
          )}
          <ChevronDown size={12} className="text-[#666] shrink-0" />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e1e] border border-[#333] rounded z-50 overflow-hidden shadow-xl">
            <div className="p-1.5 border-b border-[#282828]">
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-transparent text-xs text-[#b3b3b3] outline-none placeholder:text-[#444]"
              />
            </div>
            <div className="overflow-y-auto max-h-48">
              {filtered.map((c) => (
                <button
                  key={c.char_id}
                  type="button"
                  onClick={() => {
                    onChange(c.char_id)
                    setOpen(false)
                    setFilter('')
                  }}
                  className={[
                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-[#282828]',
                    c.char_id === value ? 'bg-[#c084fc]/10 text-[#c084fc]' : 'text-[#b3b3b3]',
                  ].join(' ')}
                >
                  <CharAvatar combatant={c} />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-[#444]">Nenhum personagem encontrado</p>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Import `CharacterCombobox` in `OptimizerPanel.tsx`**

  Current imports at the top of `OptimizerPanel.tsx`:
  ```tsx
  import { InfoPopover } from '@/components/ui/info-popover'
  import { SetCombobox } from './SetCombobox'
  ```

  Add:
  ```tsx
  import { InfoPopover } from '@/components/ui/info-popover'
  import { CharacterCombobox } from '@/components/ui/character-combobox'
  import { SetCombobox } from './SetCombobox'
  ```

- [ ] **Step 3: Replace the native `<select>` with `CharacterCombobox`**

  The character selector block currently spans lines 221–265:
  ```tsx
        {/* Character */}
        <div className="space-y-1">
          <label htmlFor="optimizer-char" className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
            {t('optimizer.character')}
          </label>
          <select
            id="optimizer-char"
            value={config.char_name}
            onChange={(e) => {
              const charId = e.target.value
              lastWeightInitRef.current = ''
              lastAutoFilledRef.current = ''

              const combatant = combatants.find((c) => c.char_id === charId)
              const resId = combatant?.res_id ?? null
              const cached = resId != null
                ? queryClient.getQueryData<CharPreset>(['scoring/char-preset', resId])
                : undefined

              const base: OptimizerConfig = {
                ...config,
                char_name: charId,
                four_piece_sets: [],
                two_piece_sets: [],
                main_stat_4: null,
                main_stat_5: null,
                main_stat_6: null,
              }

              if (cached && sets.length) {
                applyPreset(cached, charId, base)
              } else {
                onChange(base)
              }
            }}
            disabled={disabled || combatants.length === 0}
            className="w-full bg-[#282828] border border-[#333333] rounded px-2.5 py-1.5 text-xs text-[#ffffff] outline-none focus:border-[#c084fc] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{t('optimizer.selectChar')}</option>
            {combatants.map((c) => (
              <option key={c.char_id} value={c.char_id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
  ```

  Replace the entire block with:
  ```tsx
        {/* Character */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
            {t('optimizer.character')}
          </label>
          <CharacterCombobox
            combatants={combatants}
            value={config.char_name}
            onChange={(charId) => {
              lastWeightInitRef.current = ''
              lastAutoFilledRef.current = ''

              const combatant = combatants.find((c) => c.char_id === charId)
              const resId = combatant?.res_id ?? null
              const cached = resId != null
                ? queryClient.getQueryData<CharPreset>(['scoring/char-preset', resId])
                : undefined

              const base: OptimizerConfig = {
                ...config,
                char_name: charId,
                four_piece_sets: [],
                two_piece_sets: [],
                main_stat_4: null,
                main_stat_5: null,
                main_stat_6: null,
              }

              if (cached && sets.length) {
                applyPreset(cached, charId, base)
              } else {
                onChange(base)
              }
            }}
            disabled={disabled || combatants.length === 0}
            placeholder={t('optimizer.selectChar')}
          />
        </div>
  ```

- [ ] **Step 4: Check TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/ui/character-combobox.tsx src/pages/optimizer/OptimizerPanel.tsx
  git commit -m "feat: replace character select with avatar combobox"
  ```

---

## Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| Save `{ config, results, selectedRank }` to `czn_optimizer_state` on job complete | Task 1 Step 2 |
| Restore state on mount; set `jobState = 'done'` if results exist | Task 1 Step 3 |
| Silent fallback on malformed state | Task 1 Step 3 (`try/catch`) |
| `equippedToPortrait?` + `equippedToName?` props on `GearSlotCard` | Task 2 Step 2 |
| 24px circular avatar in top-right of card header | Task 2 Step 3 |
| Fallback icon when portrait absent or fails | Task 2 Step 3 |
| Combatants resolved from query cache in `ResultsArea` | Task 2 Step 5 |
| Portrait lookup per slot and passed to `GearSlotCard` | Task 2 Step 6 |
| `CharacterCombobox` with 24px circular avatar + search | Task 3 Step 1 |
| Trigger shows selected character portrait + name | Task 3 Step 1 |
| Dropdown lists all characters with portrait + name, filtered by search | Task 3 Step 1 |
| Click-outside closes dropdown | Task 3 Step 1 |
| Native `<select>` replaced in `OptimizerPanel` | Task 3 Steps 2–3 |
| Same onChange logic preserved (preset load, weight reset) | Task 3 Step 3 |
