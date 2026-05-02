# Home Page Design

**Date:** 2026-05-02
**Status:** Approved

## Goal

Replace the default redirect from `/` to `/fragments` with a real Home page that shows an onboarding guide on the first visit and a live dashboard on subsequent visits.

## Architecture

Single file `src/pages/home/HomePage.tsx` containing three components:

- `HomePage` — reads `localStorage.getItem('home.onboarding_done')` and renders either `OnboardingView` or `DashboardView`
- `OnboardingView` — static hero + numbered steps, no API calls
- `DashboardView` — 4 status cards, each backed by an existing API query

No new backend endpoints. All data comes from existing routes:
- `/api/setup/status` — already used by SetupPage
- `/api/fragments` — already used by FragmentsPage
- `/api/capture/status` — already used by CapturePage
- `/api/rescue/records` — already used by RescuePage

## Routing Changes

- `src/App.tsx` — `<Route index>` renders `<HomePage />` instead of `<Navigate to="/fragments">`
- `src/components/layout/Sidebar.tsx` — add "Home" entry at top of nav with `Home` icon from lucide-react

## OnboardingView

Shown when `localStorage.getItem('home.onboarding_done')` is `null`.

**Content:**

- Title: **Hub CZN**
- Subtitle: "Gerenciamento e otimização de equipamentos para Chaos Zero Nightmare — inspirado no Fribbels."
- Section heading: "Como começar:"
- 4 numbered steps:
  1. **Setup** — "Configure mitmproxy e o certificado CA" — button "Ir para Setup"
  2. **Capture** — "Intercepte o tráfego do jogo para extrair inventário e registros de rescue"
  3. **Optimizer** — "Monte os melhores sets com base nas suas prioridades"
  4. **Rescue Records** — "Acompanhe seu histórico de banners e analise seus pulls"

**Transition logic:**

Clicking "Ir para Setup" calls `localStorage.setItem('home.onboarding_done', 'true')` then navigates to `/setup`. On next visit to `/`, `DashboardView` is shown.

## DashboardView

Shown when `localStorage.getItem('home.onboarding_done') === 'true'`.

**4 status cards** — each is a `NavLink` to its page:

| Card | Data source | Value shown | Empty state |
|------|-------------|-------------|-------------|
| Setup | `/api/setup/status` | "✓ Completo" or "✗ Pendente" | n/a (always has data) |
| Fragmentos | `/api/fragments` | "{n} itens" | "Sem dados" |
| Capture | `/api/capture/status` | "Ativo" (green) or "Parado" | n/a (always has data) |
| Rescue Records | `/api/rescue/records` | "{n} registros" | "Sem dados" |

Setup card uses amber color when status is incomplete (`✗ Pendente`); green when complete.
Capture card uses green text when active, neutral when stopped.

**"Ver guia novamente" link** — small, muted, at the bottom. Calls `localStorage.removeItem('home.onboarding_done')` and re-renders (no page reload needed — `useState` tracks the flag).

## State Management

`HomePage` holds `const [seen, setSeen] = useState(() => localStorage.getItem('home.onboarding_done') === 'true')`.

- `OnboardingView` receives `onDone: () => void` prop → calls `localStorage.setItem(...)` then `setSeen(true)`
- `DashboardView` receives `onReset: () => void` prop → calls `localStorage.removeItem(...)` then `setSeen(false)`

No global state, no context, no new stores.

## Queries

`DashboardView` calls all 4 queries in parallel. Each uses the default `staleTime: 30_000` from QueryClient. Loading state per card shows a subtle skeleton (muted text "…"). Error state per card shows "—" without crashing the whole dashboard.

## Visual Style

Follows existing dark theme tokens: `#181715` background, `#252320` card surface, `#2e2c28` border, `#cc785c` accent, `#faf9f5` text, `#a09d96` muted text. Cards use the same `rounded-lg bg-[#252320] border border-[#2e2c28]` pattern as SetupPage rows.

## Files

| Action | Path |
|--------|------|
| Create | `src/pages/home/HomePage.tsx` |
| Modify | `src/App.tsx` |
| Modify | `src/components/layout/Sidebar.tsx` |
