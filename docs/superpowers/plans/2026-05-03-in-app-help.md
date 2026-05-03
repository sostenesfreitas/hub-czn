# In-App Help & Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared `InfoPopover` component and wire contextual `ⓘ` tooltips across all pages, plus collapsible help accordions on Capture and Optimizer pages.

**Architecture:** A single `InfoPopover` component wraps Radix UI `Popover`. Each page imports it and passes an i18n translation string. Capture and Optimizer pages get collapsible accordions (same `useState` + ChevronRight/Down pattern already used in SetupPage). All new text is in `en.ts` and `pt-BR.ts`.

**Tech Stack:** React + TypeScript, radix-ui v1.4.3 (Popover), react-i18next, lucide-react, Tailwind CSS.

---

## File Structure

| File | Change |
|------|--------|
| `src/components/ui/info-popover.tsx` | **Create** — shared InfoPopover component |
| `src/i18n/en.ts` | Add `tips.*`, `capture.howToUse.*`, `capture.prereq.adminTip`, `capture.prereq.mitmproxyTip`, `capture.log.step4`, `optimizer.help.*`, `optimizer.*Tip`, `optimizer.statPriorityLabel` |
| `src/i18n/pt-BR.ts` | Same keys, Portuguese text |
| `src/pages/fragments/FragmentsPage.tsx` | ⓘ on GS and Potential column headers |
| `src/pages/combatants/ScoringPanel.tsx` | ⓘ on CRate, CDmg, DoT%, Ego stat labels |
| `src/pages/capture/CapturePage.tsx` | ⓘ on Admin/mitmproxy badges, how-to-use accordion, log step4 |
| `src/pages/optimizer/OptimizerPanel.tsx` | Fix hardcoded stat priority label, ⓘ on 4 controls, how-it-works accordion |

---

## Task 1: InfoPopover component + i18n keys

**Files:**
- Create: `src/components/ui/info-popover.tsx`
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/pt-BR.ts`

- [ ] **Step 1: Create `src/components/ui/info-popover.tsx`**

```tsx
import * as React from 'react'
import { Popover } from 'radix-ui'

interface InfoPopoverProps {
  content: React.ReactNode
  className?: string
}

export function InfoPopover({ content, className }: InfoPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        className={`text-[#666] hover:text-[#999] cursor-pointer text-sm leading-none bg-transparent border-none p-0 inline-flex items-center ${className ?? ''}`}
        aria-label="More information"
      >
        ⓘ
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-[#1e1e1e] border border-[#444] rounded-md p-3 text-xs text-[#d4d4d4] shadow-xl max-w-[240px] z-50"
          sideOffset={4}
          onOpenAutoFocus={e => e.preventDefault()}
        >
          {content}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

- [ ] **Step 2: Add i18n keys to `en.ts`**

Add a top-level `tips` object (after the `common` block, before `export default en`):

```ts
tips: {
  gs: 'Gear Score — measures how well a gear piece rolled relative to its maximum potential (0–100).',
  potential: 'Potential — the possible final GS range based on remaining upgrade slots (low = min rolls, high = max rolls).',
  crate: 'Crit Rate — probability that an attack deals critical damage.',
  cdmg: 'Crit Damage — bonus damage multiplier applied on critical hits.',
  dot: 'Damage over Time — periodic damage applied after an attack (e.g. burn, bleed).',
  ego: 'Ego — a unique stat in Chaos Zero Nightmare that scales specific character skills.',
},
```

In `capture`, add after `stopError` and before the `modal` block:

```ts
howToUse: {
  title: 'How to use Capture',
  step1: '1. Click Start Capture',
  step2: '2. Open the game',
  step3: '3. Navigate to Memory Fragments — your gear inventory will be captured automatically',
  step4: '4. Navigate to Rescue Records — your pull history will be captured automatically',
  step5: '5. Click Stop Capture when done',
  step6: '6. Click Load Latest, then go to Optimizer or Rescue Records to use your data',
},
```

In `capture.prereq`, add after `certificate`:

```ts
adminTip: 'Admin rights let the app modify the Windows hosts file to redirect game traffic through the local proxy. No data leaves your machine.',
mitmproxyTip: "mitmproxy acts as a local reverse proxy that intercepts the game's WebSocket messages to extract gear and rescue data in real time.",
```

In `capture.log`, add after `step3`:

```ts
step4: '4. Click Load Latest → go to Optimizer or Rescue Records',
```

In `optimizer`, add after `noBuilds`:

```ts
help: {
  title: 'How the optimizer works',
  body: 'The optimizer scores every possible gear combination using the stat weights you configure in the Scoring tab. Set your priorities there first — higher weight means that stat matters more when ranking builds.',
  weightScale: 'Weight scale: -1 = penalize, 0 = ignored, 1 = normal, 2 = double, 3 = triple weight.',
},
topPercentTip: 'Only consider gear in the top X% by Gear Score. Lower % = faster search but may exclude viable pieces. 60% is a safe default.',
maxResultsTip: 'Maximum number of builds to display. Lower values are faster to browse.',
includeEquippedTip: 'When on, gear already equipped on characters is also evaluated. Useful when optimizing your full collection.',
excludeCharsTip: 'Gear equipped on excluded characters is reserved and will not be used in builds.',
statPriorityLabel: 'Stat Priority (-1 to 3)',
```

- [ ] **Step 3: Add i18n keys to `pt-BR.ts`**

Add top-level `tips` block:

```ts
tips: {
  gs: 'Gear Score — mede o quão bem uma peça de gear rolou em relação ao seu potencial máximo (0–100).',
  potential: 'Potencial — o intervalo de GS final possível com base nos slots de upgrade restantes (baixo = rolls mínimos, alto = rolls máximos).',
  crate: 'Crit Rate — probabilidade de um ataque causar dano crítico.',
  cdmg: 'Crit Damage — multiplicador de dano bônus aplicado em acertos críticos.',
  dot: 'Dano ao Longo do Tempo — dano periódico após um ataque (ex: queimadura, sangramento).',
  ego: 'Ego — um atributo único em Chaos Zero Nightmare que escala habilidades específicas de personagens.',
},
```

In `capture`, add `howToUse` (same position as EN):

```ts
howToUse: {
  title: 'Como usar a Captura',
  step1: '1. Clique em Iniciar Captura',
  step2: '2. Abra o jogo',
  step3: '3. Navegue até Fragmentos de Memória — seu inventário será capturado automaticamente',
  step4: '4. Navegue até Rescue Records — seu histórico de pulls será capturado automaticamente',
  step5: '5. Clique em Parar Captura quando terminar',
  step6: '6. Clique em Carregar Último, depois vá para o Otimizador ou Registros de Rescue',
},
```

In `capture.prereq`, add:

```ts
adminTip: 'Direitos de administrador permitem que o app modifique o arquivo hosts do Windows para redirecionar o tráfego do jogo pelo proxy local. Nenhum dado sai da sua máquina.',
mitmproxyTip: 'O mitmproxy funciona como um proxy reverso local que intercepta as mensagens WebSocket do jogo para extrair dados de gear e rescue em tempo real.',
```

In `capture.log`, add:

```ts
step4: '4. Clique em Carregar Último → vá para o Otimizador ou Registros de Rescue',
```

In `optimizer`, add:

```ts
help: {
  title: 'Como funciona o otimizador',
  body: 'O otimizador pontua todas as combinações de gear possíveis usando os pesos de stats configurados na aba Pontuação. Configure suas prioridades lá primeiro — peso mais alto significa que aquele stat importa mais ao classificar builds.',
  weightScale: 'Escala de peso: -1 = penalizar, 0 = ignorado, 1 = normal, 2 = duplo, 3 = triplo.',
},
topPercentTip: 'Considerar apenas o gear no top X% por Gear Score. % menor = busca mais rápida, mas pode excluir peças viáveis. 60% é um padrão seguro.',
maxResultsTip: 'Número máximo de builds a exibir. Valores menores são mais rápidos de navegar.',
includeEquippedTip: 'Quando ativado, o gear já equipado em personagens também é avaliado. Útil para otimizar toda a coleção.',
excludeCharsTip: 'O gear equipado em personagens excluídos é reservado e não será usado em builds.',
statPriorityLabel: 'Prioridade de Stat (-1 a 3)',
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/info-popover.tsx src/i18n/en.ts src/i18n/pt-BR.ts
git commit -m "feat: add InfoPopover component and in-app help i18n keys"
```

---

## Task 2: Fragments table — GS and Potential column ⓘ

**Files:**
- Modify: `src/pages/fragments/FragmentsPage.tsx:74-105`

The current code builds a flat `COLS` string array and maps it to `<TableHead>` cells. Change `COLS` to hold `{ key: string; label: React.ReactNode }` objects so GS and Potential can embed an `InfoPopover`.

- [ ] **Step 1: Update imports**

Add to the imports at the top of `FragmentsPage.tsx`:

```tsx
import { InfoPopover } from '@/components/ui/info-popover'
```

- [ ] **Step 2: Replace the `COLS` array**

Replace the existing `COLS` array (lines 74–86) with:

```tsx
const COLS: { key: string; label: React.ReactNode }[] = [
  { key: 'slot',      label: t('fragments.col.slot') },
  { key: 'set',       label: t('fragments.col.set') },
  { key: 'level',     label: t('fragments.col.level') },
  { key: 'main',      label: t('fragments.col.main') },
  { key: 'sub1',      label: t('fragments.col.sub1') },
  { key: 'sub2',      label: t('fragments.col.sub2') },
  { key: 'sub3',      label: t('fragments.col.sub3') },
  { key: 'sub4',      label: t('fragments.col.sub4') },
  { key: 'gs',        label: <span className="flex items-center gap-1">{t('fragments.col.gs')}<InfoPopover content={t('tips.gs')} /></span> },
  { key: 'potential', label: <span className="flex items-center gap-1">{t('fragments.col.potential')}<InfoPopover content={t('tips.potential')} /></span> },
  { key: 'equipped',  label: t('fragments.col.equipped') },
]
```

- [ ] **Step 3: Update the TableHead render**

Replace (lines 101–105):

```tsx
{COLS.map(h => (
  <TableHead key={h} className="text-[#b3b3b3] text-xs font-medium h-9">
    {h}
  </TableHead>
))}
```

with:

```tsx
{COLS.map(col => (
  <TableHead key={col.key} className="text-[#b3b3b3] text-xs font-medium h-9">
    {col.label}
  </TableHead>
))}
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/fragments/FragmentsPage.tsx
git commit -m "feat: add GS and Potential tooltips to Fragments table headers"
```

---

## Task 3: ScoringPanel stat abbreviation ⓘ

**Files:**
- Modify: `src/pages/combatants/ScoringPanel.tsx:37-68`

The `WeightInput` component renders `{stat}` as the label. Add an optional `tip` prop; when provided, render `InfoPopover` after the label text.

- [ ] **Step 1: Update imports in `ScoringPanel.tsx`**

Add:

```tsx
import { InfoPopover } from '@/components/ui/info-popover'
```

- [ ] **Step 2: Add `tip` prop to `WeightInput`**

Change the `WeightInput` props interface and label:

```tsx
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
      <label htmlFor={id} className="text-xs text-[#b3b3b3] truncate flex-1 flex items-center gap-1 min-w-0">
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
```

- [ ] **Step 3: Add stat-to-tip map and pass tips in `PanelContent`**

In `PanelContent` (before the `return`), add a tips map:

```tsx
const STAT_TIPS: Record<string, string> = {
  CRate: t('tips.crate'),
  CDmg: t('tips.cdmg'),
  'DoT%': t('tips.dot'),
  Ego: t('tips.ego'),
}
```

Then in the `WeightInput` call (lines ~149–157), pass the tip:

```tsx
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
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/combatants/ScoringPanel.tsx
git commit -m "feat: add stat abbreviation tooltips to ScoringPanel"
```

---

## Task 4: Capture page — prereq ⓘ, how-to-use accordion, log step4

**Files:**
- Modify: `src/pages/capture/CapturePage.tsx`

Three changes: add optional `tip` prop to `PrereqBadge`, add a how-to-use accordion, add `capture.log.step4` to the idle hint.

- [ ] **Step 1: Update imports**

Add to existing lucide-react import:

```tsx
import { CheckCircle, XCircle, Radio, Square, FolderOpen, Download, Loader2, ChevronRight, ChevronDown } from 'lucide-react'
```

Add InfoPopover import:

```tsx
import { InfoPopover } from '@/components/ui/info-popover'
```

- [ ] **Step 2: Add `tip` prop to `PrereqBadge`**

Replace the current `PrereqBadge` (lines 19–26):

```tsx
function PrereqBadge({ ok, label, tip }: { ok: boolean; label: string; tip?: string }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${ok ? 'text-green-400' : 'text-red-400'}`}>
      {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
      {label}
      {tip && <InfoPopover content={tip} />}
    </span>
  )
}
```

- [ ] **Step 3: Pass tips to Admin and mitmproxy badges**

In `CapturePage`'s render (the prereqs card, around line 262–264), change:

```tsx
<PrereqBadge ok={isAdmin} label={t('capture.prereq.admin')} tip={t('capture.prereq.adminTip')} />
<PrereqBadge ok={setupStatus?.mitmproxy ?? false} label={t('capture.prereq.mitmproxy')} tip={t('capture.prereq.mitmproxyTip')} />
<PrereqBadge ok={setupStatus?.certificate ?? false} label={t('capture.prereq.certificate')} />
```

(Certificate badge has no `tip` — unchanged.)

- [ ] **Step 4: Add `howToUseOpen` state**

In `CapturePage` function body, after the existing state declarations, add:

```tsx
const [howToUseOpen, setHowToUseOpen] = useState(false)
```

- [ ] **Step 5: Add how-to-use accordion**

In the left column `<div>`, insert the accordion between the prereqs card (`</div>`) and the region selector (`{/* Region selector */}`):

```tsx
{/* How to use accordion */}
<div className="rounded-lg bg-[#181818] border border-[#282828] overflow-hidden">
  <button
    type="button"
    aria-expanded={howToUseOpen}
    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#b3b3b3] hover:text-[#ffffff]"
    onClick={() => setHowToUseOpen(v => !v)}
  >
    {howToUseOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
    {t('capture.howToUse.title')}
  </button>
  {howToUseOpen && (
    <ol className="px-4 pb-3 text-xs text-[#b3b3b3] leading-relaxed space-y-1 list-none">
      {(['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const).map(k => (
        <li key={k}>{t(`capture.howToUse.${k}`)}</li>
      ))}
    </ol>
  )}
</div>
```

- [ ] **Step 6: Add log step4**

In the log idle area (around lines 384–390), add `step4`:

```tsx
{messages.length === 0 && !running && (
  <div className="text-[#404040] space-y-1">
    <p>{t('capture.log.step1')}</p>
    <p>{t('capture.log.step2')}</p>
    <p>{t('capture.log.step3')}</p>
    <p>{t('capture.log.step4')}</p>
  </div>
)}
```

- [ ] **Step 7: Verify TypeScript**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/capture/CapturePage.tsx
git commit -m "feat: add prereq tooltips, how-to-use accordion, and log step4 to Capture page"
```

---

## Task 5: Optimizer panel — fix hardcoded label, ⓘ on controls, how-it-works accordion

**Files:**
- Modify: `src/pages/optimizer/OptimizerPanel.tsx`

- [ ] **Step 1: Update imports**

Add to existing lucide-react import:

```tsx
import { Play, Square, ChevronRight, ChevronDown } from 'lucide-react'
```

Add InfoPopover and useState:

```tsx
import { useState } from 'react'
import { InfoPopover } from '@/components/ui/info-popover'
```

(`useState` is not yet imported in this file — add it. `useEffect` and `useRef` are already imported via `import { useEffect, useRef } from 'react'` — change to `import { useEffect, useRef, useState } from 'react'`.)

- [ ] **Step 2: Add `helpOpen` state**

In `OptimizerPanel` function body, after the other hooks, add:

```tsx
const [helpOpen, setHelpOpen] = useState(false)
```

- [ ] **Step 3: Fix hardcoded stat priority label (line 303–305)**

Replace:

```tsx
<p className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
  Prioridade de Stat (-1 a 3)
</p>
```

with:

```tsx
<p className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
  {t('optimizer.statPriorityLabel')}
</p>
```

- [ ] **Step 4: Add how-it-works accordion at top of rendered panel**

In the `return` block, insert at the very start of `<aside>` content (before the `{/* Character */}` block, around line 199):

```tsx
{/* How it works accordion */}
<div className="rounded-lg border border-[#282828] overflow-hidden">
  <button
    type="button"
    aria-expanded={helpOpen}
    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#b3b3b3] hover:text-[#ffffff]"
    onClick={() => setHelpOpen(v => !v)}
  >
    {helpOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
    {t('optimizer.help.title')}
  </button>
  {helpOpen && (
    <div className="px-3 pb-3 space-y-1">
      <p className="text-xs text-[#b3b3b3] leading-relaxed">{t('optimizer.help.body')}</p>
      <p className="text-[10px] text-[#666]">{t('optimizer.help.weightScale')}</p>
    </div>
  )}
</div>
```

- [ ] **Step 5: Add ⓘ to "Top % gear" label (line ~348–349)**

Replace:

```tsx
<label htmlFor="optimizer-top-pct" className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
  {t('optimizer.topPercent')}
</label>
```

with:

```tsx
<label htmlFor="optimizer-top-pct" className="text-[10px] uppercase tracking-wider text-[#b3b3b3] flex items-center gap-1">
  {t('optimizer.topPercent')}
  <InfoPopover content={t('optimizer.topPercentTip')} />
</label>
```

- [ ] **Step 6: Add ⓘ to "Max results" label (line ~367–368)**

Replace:

```tsx
<label htmlFor="optimizer-max-results" className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
  {t('optimizer.maxResults')}
</label>
```

with:

```tsx
<label htmlFor="optimizer-max-results" className="text-[10px] uppercase tracking-wider text-[#b3b3b3] flex items-center gap-1">
  {t('optimizer.maxResults')}
  <InfoPopover content={t('optimizer.maxResultsTip')} />
</label>
```

- [ ] **Step 7: Add ⓘ to "Include equipped" (line ~393)**

Replace:

```tsx
<span className="text-xs text-[#ffffff]">{t('optimizer.includeEquipped')}</span>
```

with:

```tsx
<span className="text-xs text-[#ffffff] flex items-center gap-1">
  {t('optimizer.includeEquipped')}
  <InfoPopover content={t('optimizer.includeEquippedTip')} />
</span>
```

- [ ] **Step 8: Add ⓘ to "Exclude characters" label (line ~399–400)**

Replace:

```tsx
<label className="text-[10px] uppercase tracking-wider text-[#b3b3b3]">
  {t('optimizer.excludeChars')}
</label>
```

with:

```tsx
<label className="text-[10px] uppercase tracking-wider text-[#b3b3b3] flex items-center gap-1">
  {t('optimizer.excludeChars')}
  <InfoPopover content={t('optimizer.excludeCharsTip')} />
</label>
```

- [ ] **Step 9: Verify TypeScript**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/pages/optimizer/OptimizerPanel.tsx
git commit -m "feat: add how-it-works accordion and control tooltips to Optimizer panel"
```

---

## Manual smoke test (after all tasks)

1. **Fragments page** — column headers "GS" and "Pot." each show a `ⓘ` icon. Click each → popover appears with definition. Click elsewhere → closes.
2. **Scoring panel** — CRate, CDmg, DoT%, Ego weight inputs each have a `ⓘ`. Click each → correct definition appears.
3. **Capture page** — Admin badge has `ⓘ` (mitmproxy too). Click "How to use Capture" header → accordion expands with 6 steps. Log idle state shows 4 steps including "Load Latest".
4. **Optimizer page** — "How the optimizer works" accordion at top. Click → explanation + weight scale. "Top % gear", "Max results", "Include equipped", "Exclude characters" each have `ⓘ`. Stat Priority label reads "Stat Priority (-1 to 3)" in EN.
