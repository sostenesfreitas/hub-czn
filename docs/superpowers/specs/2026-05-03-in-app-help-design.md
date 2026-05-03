# In-App Help & Tooltips Design

**Date:** 2026-05-03
**Status:** Approved

## Summary

Add contextual help throughout the app via a single reusable `InfoPopover` component (`ⓘ` icon → click popover). Four areas change: stat abbreviation tooltips (Scoring, Fragments), Capture page tutorial, and Optimizer page help. All new text is bilingual (EN + PT-BR).

---

## Problem

Users who don't know the game's terminology or haven't done the first-time setup can't figure out what GS, CRate, CDmg, DoT, or Ego mean, don't understand why admin rights are needed, don't know what to do after capturing, and can't understand how the optimizer uses their scoring weights.

---

## Design

### Component — `InfoPopover`

**File:** `src/components/ui/info-popover.tsx`

A thin wrapper around Radix UI `Popover`. Renders a small grey `ⓘ` trigger inline with text. Click to open, click anywhere else to close (works on touch too).

Props:
```ts
interface InfoPopoverProps {
  content: React.ReactNode  // the text/JSX shown inside the popover
  className?: string        // optional extra class on the trigger span
}
```

Visual spec:
- Trigger: `ⓘ` in `text-[#666]`, `hover:text-[#999]`, `cursor-pointer`, `text-sm`, inline `<span>`
- Popover content: dark card — `bg-[#1e1e1e] border border-[#444] rounded-md p-3 text-xs text-[#d4d4d4] shadow-xl max-w-[240px] z-50`
- No arrow/triangle needed

Usage pattern:
```tsx
import { InfoPopover } from '@/components/ui/info-popover'

<span className="flex items-center gap-1">
  CRate
  <InfoPopover content={t('tips.crate')} />
</span>
```

---

### i18n keys (new)

#### Shared abbreviation tips — `tips.*`

```
tips.gs          "Gear Score — measures how well a gear piece rolled relative to its maximum potential (0–100)."
tips.potential   "Potential — the possible final GS range based on remaining upgrade slots (low = min rolls, high = max rolls)."
tips.crate       "Crit Rate — probability that an attack deals critical damage."
tips.cdmg        "Crit Damage — bonus damage multiplier applied on critical hits."
tips.dot         "Damage over Time — periodic damage applied after an attack (e.g. burn, bleed)."
tips.ego         "Ego — a unique stat in Chaos Zero Nightmare that scales specific character skills."
```

#### Capture page — `capture.howToUse.*` and `capture.prereq.*`

```
capture.howToUse.title    "How to use Capture"
capture.howToUse.step1    "Click Start Capture"
capture.howToUse.step2    "Open the game"
capture.howToUse.step3    "Navigate to Memory Fragments — your gear inventory will be captured automatically"
capture.howToUse.step4    "Navigate to Rescue Records — your pull history will be captured automatically"
capture.howToUse.step5    "Click Stop Capture when done"
capture.howToUse.step6    "Click Load Latest, then go to Optimizer or Rescue Records to use your data"
capture.prereq.adminTip   "Admin rights let the app modify the Windows hosts file to redirect game traffic through the local proxy. No data leaves your machine."
capture.prereq.mitmproxyTip "mitmproxy acts as a local reverse proxy that intercepts the game's WebSocket messages to extract gear and rescue data in real time."
```

#### Optimizer page — `optimizer.help.*` and `optimizer.*Tip`

```
optimizer.help.title         "How the optimizer works"
optimizer.help.body          "The optimizer scores every possible gear combination using the stat weights you configure in the Scoring tab. Set your priorities there first — higher weight means that stat matters more when ranking builds."
optimizer.help.weightScale   "Weight scale: 0 = ignored, 1 = normal contribution, 2 = double weight."
optimizer.topPercentTip      "Only consider gear in the top X% by Gear Score. Lower % = faster search but may exclude some viable pieces. 60% is a safe default."
optimizer.maxResultsTip      "Maximum number of builds to display. Lower values are faster to browse."
optimizer.includeEquippedTip "When on, gear already equipped on characters is also evaluated. Useful when optimizing your full collection."
optimizer.excludeCharsTip    "Gear equipped on excluded characters is reserved and won't be used in builds."
optimizer.statPriorityLabel  "Stat Priority (-1 to 3)"
```

**Note:** `optimizer.statPriorityLabel` replaces the hardcoded Portuguese string `"Prioridade de Stat (-1 a 3)"` in `OptimizerPanel.tsx` line 304. The actual `<input>` has `min={-1} max={3}` — the range is correct as -1 to 3.

---

### Changes per file

#### `src/components/ui/info-popover.tsx` (new)

Thin Radix Popover wrapper as described above.

#### `src/i18n/en.ts`

Add `tips` object at the top level. Add `capture.howToUse`, `capture.prereq.adminTip`, `capture.prereq.mitmproxyTip`. Add `optimizer.help`, `optimizer.topPercentTip`, `optimizer.maxResultsTip`, `optimizer.includeEquippedTip`, `optimizer.excludeCharsTip`, `optimizer.statPriorityLabel`.

#### `src/i18n/pt-BR.ts`

Same structure. Portuguese equivalents:

```
tips.gs          "Gear Score — mede o quão bem uma peça de gear rolou em relação ao seu potencial máximo (0–100)."
tips.potential   "Potencial — o intervalo de GS final possível com base nos slots de upgrade restantes (baixo = rolls mínimos, alto = rolls máximos)."
tips.crate       "Crit Rate — probabilidade de um ataque causar dano crítico."
tips.cdmg        "Crit Damage — multiplicador de dano bônus aplicado em acertos críticos."
tips.dot         "Dano ao Longo do Tempo — dano periódico após um ataque (ex: queimadura, sangramento)."
tips.ego         "Ego — um atributo único em Chaos Zero Nightmare que escala habilidades específicas de personagens."

capture.howToUse.title    "Como usar a Captura"
capture.howToUse.step1    "Clique em Iniciar Captura"
capture.howToUse.step2    "Abra o jogo"
capture.howToUse.step3    "Navegue até Fragmentos de Memória — seu inventário será capturado automaticamente"
capture.howToUse.step4    "Navegue até Rescue Records — seu histórico de pulls será capturado automaticamente"
capture.howToUse.step5    "Clique em Parar Captura quando terminar"
capture.howToUse.step6    "Clique em Carregar Último, depois vá para o Otimizador ou Registros de Rescue para usar os dados"
capture.prereq.adminTip   "Direitos de administrador permitem que o app modifique o arquivo hosts do Windows para redirecionar o tráfego do jogo pelo proxy local. Nenhum dado sai da sua máquina."
capture.prereq.mitmproxyTip "O mitmproxy funciona como um proxy reverso local que intercepta as mensagens WebSocket do jogo para extrair dados de gear e rescue em tempo real."

optimizer.help.title         "Como funciona o otimizador"
optimizer.help.body          "O otimizador pontua todas as combinações de gear possíveis usando os pesos de stats configurados na aba Pontuação. Configure suas prioridades lá primeiro — peso mais alto significa que aquele stat importa mais ao classificar builds."
optimizer.help.weightScale   "Escala de peso: 0 = ignorado, 1 = contribuição normal, 2 = peso duplo."
optimizer.topPercentTip      "Considerar apenas o gear no top X% por Gear Score. % menor = busca mais rápida, mas pode excluir algumas peças viáveis. 60% é um padrão seguro."
optimizer.maxResultsTip      "Número máximo de builds a exibir. Valores menores são mais rápidos de navegar."
optimizer.includeEquippedTip "Quando ativado, o gear já equipado em personagens também é avaliado. Útil para otimizar toda a coleção."
optimizer.excludeCharsTip    "O gear equipado em personagens excluídos é reservado e não será usado em builds."
optimizer.statPriorityLabel  "Prioridade de Stat (-1 a 3)"
```

#### `src/pages/capture/CapturePage.tsx`

1. **`ⓘ` on prereq badges** — Add an optional `tip?: string` prop to `PrereqBadge`. When provided, render an `InfoPopover` immediately after the label text. Pass `t('capture.prereq.adminTip')` to the Admin badge and `t('capture.prereq.mitmproxyTip')` to the mitmproxy badge. Do not add a tip to the Certificate badge (Setup page already covers it).

2. **"How to use Capture" accordion** — Add a collapsible section between the prereqs card and the region selector. Use a `useState(false)` toggle (`howToUseOpen`). The toggle button uses `ChevronRight`/`ChevronDown` from lucide-react and the same class pattern as Setup (`SetupPage.tsx` lines 190–205):
   ```tsx
   <div className="rounded-lg bg-[#181818] border border-[#282828] overflow-hidden">
     <button type="button" aria-expanded={howToUseOpen}
       className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#b3b3b3] hover:text-[#ffffff]"
       onClick={() => setHowToUseOpen(v => !v)}>
       {howToUseOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
       {t('capture.howToUse.title')}
     </button>
     {howToUseOpen && (
       <ol className="px-3 pb-3 text-xs text-[#b3b3b3] leading-relaxed space-y-1 list-decimal list-inside">
         {[1,2,3,4,5,6].map(n => <li key={n}>{t(`capture.howToUse.step${n}` as const)}</li>)}
       </ol>
     )}
   </div>
   ```

3. **Post-capture log step** — In the log idle area (currently `capture.log.step1/2/3`), add a 4th key: `capture.log.step4` = `"4. Click Load Latest → go to Optimizer or Rescue Records"`. This step shows when `messages.length === 0 && !running` (same condition as the other steps — no logic change needed).

#### `src/pages/optimizer/OptimizerPanel.tsx`

1. **Fix hardcoded Portuguese** — Replace the hardcoded "Prioridade de Stat (-1 a 3)" label with `t('optimizer.statPriorityLabel')`. Verify and correct the actual slider range (0–3 vs -1–3) in the i18n string.

2. **`ⓘ` on control labels** — Add `InfoPopover` next to: "Top % gear", "Max results", "Include equipped gear", "Exclude characters". Use the corresponding `*Tip` i18n keys.

3. **"How the optimizer works" accordion** — Add a collapsible section at the top of the panel (above character selector), collapsed by default. Use the same `useState` + `ChevronRight`/`ChevronDown` toggle pattern as the Capture accordion above. Content: `optimizer.help.title` as the toggle label; expanded body shows `optimizer.help.body` then `optimizer.help.weightScale` in a smaller muted line.

#### `src/components/combatants/ScoringPanel.tsx`

Add `InfoPopover` next to each stat abbreviation label in the weight sliders:
- CRate → `t('tips.crate')`
- CDmg → `t('tips.cdmg')`
- DoT% → `t('tips.dot')`
- Ego → `t('tips.ego')`

Stat names are currently hardcoded strings in the component — wrap the abbreviations with `InfoPopover` inline.

#### `src/pages/fragments/FragmentsPage.tsx` (or the table component)

Add `InfoPopover` to "GS" and "Potential" (or "Pot.") column headers:
- GS → `t('tips.gs')`
- Potential → `t('tips.potential')`

---

## Out of scope

- Tooltip on elemental damage type names (Passion, Order, Justice, Void, Instinct) — deferred; these are game-specific and need game documentation to explain accurately.
- Fixing ALL hardcoded strings in OptimizerPanel — only the stat priority label that we're already touching.
- A dedicated `/help` page.
- Onboarding wizard or first-run tour.
