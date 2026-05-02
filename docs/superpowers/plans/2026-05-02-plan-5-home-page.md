# Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Home page that shows an onboarding guide on the first visit and a live 4-card dashboard on subsequent visits, replacing the current redirect from `/` to `/fragments`.

**Architecture:** A single `HomePage.tsx` file holds `OnboardingView` and `DashboardView` as local components. `HomePage` reads a `localStorage` flag (`home.onboarding_done`) via `useState` lazy initializer to decide which view to render — no API calls block the initial render. `DashboardView` fires 4 parallel `useQuery` calls using already-existing API methods. Routing and sidebar both get a "Home" entry added.

**Tech Stack:** React 18 + TypeScript · TanStack Query v5 · React Router v6 · Tailwind v4 · lucide-react

---

## File Map

**New files:**
- `src/pages/home/HomePage.tsx` — `HomePage`, `OnboardingView`, `DashboardView`

**Modified files:**
- `src/App.tsx` — replace `<Navigate to="/fragments">` index route with `<HomePage />`
- `src/components/layout/Sidebar.tsx` — add Home nav entry at the top

---

## Task 1: Create `HomePage.tsx`

**Files:**
- Create: `src/pages/home/HomePage.tsx`

- [ ] **Step 1: Create the file with `OnboardingView`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { api } from '@/lib/api'

function OnboardingView({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()

  function handleStart() {
    localStorage.setItem('home.onboarding_done', 'true')
    onDone()
    navigate('/setup')
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-lg">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-[#faf9f5]">Hub CZN</h1>
        <p className="text-sm text-[#a09d96]">
          Gerenciamento e otimização de equipamentos para Chaos Zero Nightmare —
          inspirado no Fribbels.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs text-[#3a3835] uppercase tracking-wider">Como começar</p>

        <div className="flex flex-col gap-2">
          <div className="p-4 rounded-lg bg-[#252320] border border-[#2e2c28] flex items-start gap-4">
            <span className="text-[#cc785c] font-bold text-sm shrink-0 w-4">1</span>
            <div className="flex-1 min-w-0">
              <p className="text-[#faf9f5] font-medium text-sm">Setup</p>
              <p className="text-[#a09d96] text-xs mt-0.5">
                Configure mitmproxy e o certificado CA
              </p>
            </div>
            <button
              type="button"
              onClick={handleStart}
              className="shrink-0 text-xs px-3 py-1.5 rounded bg-[#cc785c] hover:bg-[#b8674d] text-white transition-colors"
            >
              Ir para Setup
            </button>
          </div>

          {[
            {
              n: 2,
              title: 'Capture',
              detail: 'Intercepte o tráfego do jogo para extrair inventário e registros de rescue',
            },
            {
              n: 3,
              title: 'Optimizer',
              detail: 'Monte os melhores sets com base nas suas prioridades',
            },
            {
              n: 4,
              title: 'Rescue Records',
              detail: 'Acompanhe seu histórico de banners e analise seus pulls',
            },
          ].map(({ n, title, detail }) => (
            <div
              key={n}
              className="p-4 rounded-lg bg-[#252320] border border-[#2e2c28] flex items-start gap-4"
            >
              <span className="text-[#3a3835] font-bold text-sm shrink-0 w-4">{n}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[#faf9f5] font-medium text-sm">{title}</p>
                <p className="text-[#a09d96] text-xs mt-0.5">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `DashboardView` below `OnboardingView` in the same file**

```tsx
function StatusCard({
  label,
  value,
  to,
  accent,
}: {
  label: string
  value: string
  to: string
  accent?: boolean
}) {
  return (
    <NavLink
      to={to}
      className="p-4 rounded-lg bg-[#252320] border border-[#2e2c28] flex flex-col gap-2
                 hover:border-[#cc785c44] hover:bg-[#2e2c28] transition-colors"
    >
      <p className="text-xs text-[#3a3835] uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-medium ${accent ? 'text-[#cc785c]' : 'text-[#faf9f5]'}`}>
        {value}
      </p>
    </NavLink>
  )
}

function DashboardView({ onReset }: { onReset: () => void }) {
  const { data: setup } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.setupStatus(),
  })
  const { data: fragments } = useQuery({
    queryKey: ['fragments'],
    queryFn: () => api.fragments(),
  })
  const { data: capture } = useQuery({
    queryKey: ['capture-status'],
    queryFn: () => api.captureStatus(),
  })
  const { data: rescue } = useQuery({
    queryKey: ['rescue-records'],
    queryFn: () => api.rescueRecords(),
  })

  const setupComplete = setup
    ? setup.admin && setup.mitmproxy && setup.certificate
    : null

  return (
    <div className="p-6 flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-[#faf9f5]">Hub CZN</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusCard
          label="Setup"
          value={setupComplete == null ? '…' : setupComplete ? '✓ Completo' : '✗ Pendente'}
          to="/setup"
          accent={setupComplete === false}
        />
        <StatusCard
          label="Fragmentos"
          value={fragments == null ? '…' : fragments.length > 0 ? `${fragments.length} itens` : 'Sem dados'}
          to="/fragments"
        />
        <StatusCard
          label="Capture"
          value={capture == null ? '…' : capture.running ? 'Ativo' : 'Parado'}
          to="/capture"
          accent={capture?.running}
        />
        <StatusCard
          label="Rescue Records"
          value={rescue == null ? '…' : rescue.length > 0 ? `${rescue.length} registros` : 'Sem dados'}
          to="/rescue"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          localStorage.removeItem('home.onboarding_done')
          onReset()
        }}
        className="text-xs text-[#3a3835] hover:text-[#a09d96] transition-colors self-start"
      >
        Ver guia novamente
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Add the `HomePage` root component at the end of the file**

```tsx
export function HomePage() {
  const [seen, setSeen] = useState(
    () => localStorage.getItem('home.onboarding_done') === 'true'
  )

  return seen
    ? <DashboardView onReset={() => setSeen(false)} />
    : <OnboardingView onDone={() => setSeen(true)} />
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/home/HomePage.tsx
git commit -m "feat: add HomePage with onboarding and dashboard views"
```

---

## Task 2: Wire routing and sidebar

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update `src/App.tsx`**

Add the import at the top with the other page imports:
```typescript
import { HomePage } from './pages/home/HomePage'
```

Replace:
```typescript
          <Route index element={<Navigate to="/fragments" replace />} />
```
with:
```typescript
          <Route index element={<HomePage />} />
```

Keep the `Navigate` import — it's still used by other routes (`/scoring` and `*`).

- [ ] **Step 2: Update `src/components/layout/Sidebar.tsx`**

Add `Home` to the lucide imports:
```typescript
import {
  Home, Swords, Layers, Users, BarChart2,
  Radio, Settings, Gift, Info,
} from 'lucide-react'
```

Add a Home entry at the top of the `NAV` array:
```typescript
const NAV = [
  { to: '/',           label: 'Home',             icon: Home },
  { to: '/optimizer',  label: 'Optimizer',        icon: Swords },
  { to: '/fragments',  label: 'Memory Fragments',  icon: Layers },
  { to: '/combatants', label: 'Combatants',        icon: Users },
  { to: '/scoring',    label: 'Scoring',           icon: BarChart2 },
  { to: '/capture',    label: 'Capture',           icon: Radio },
  { to: '/setup',      label: 'Setup',             icon: Settings },
  { to: '/rescue',     label: 'Rescue Records',    icon: Gift },
  { to: '/about',      label: 'About',             icon: Info },
]
```

Note: the `NavLink` for `/` must use `end` prop so it only highlights when exactly on `/`, not on every sub-route. Update the `NavLink` in Sidebar.tsx:

```tsx
<NavLink
  key={to}
  to={to}
  end={to === '/'}
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```
python -m pytest tests/ -q
```

Expected: 40 passed (no backend changes, so all tests still pass).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: wire Home route and add Home entry to sidebar"
```
