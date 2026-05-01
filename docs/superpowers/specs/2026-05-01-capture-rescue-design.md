# Capture & Rescue — Design Spec

**Date:** 2026-05-01
**Status:** Approved

---

## Goal

Port the Capture and Rescue features from the Python/Tkinter app into the new Tauri/React frontend. The FastAPI sidecar wraps the existing `CaptureManager` to expose HTTP and WebSocket endpoints. The frontend gains three new pages: Setup, Capture, and Rescue.

## Architecture

The FastAPI sidecar imports and orchestrates `CaptureManager` (from `Vribbels/capture/manager.py`) as a singleton stored in `AppState`. A queue bridges CaptureManager log callbacks to a WebSocket endpoint so the frontend receives real-time log messages.

Three new route files are added to the sidecar:

```
api/routes/setup.py    — prerequisites check, mitmproxy install, cert generation
api/routes/capture.py  — start/stop/status of the capture proxy
api/routes/rescue.py   — read rescue records captured in the current session
```

Three new pages are added to the frontend:

```
src/pages/setup/SetupPage.tsx     → /setup
src/pages/capture/CapturePage.tsx → /capture
src/pages/rescue/RescuePage.tsx   → /rescue
```

`recharts` is added as a frontend dependency for the rescue pie chart.

## API Layer

### Setup

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/setup/status` | Returns `{ admin, mitmproxy, mitmproxy_version, certificate }` |
| POST | `/api/setup/install-mitmproxy` | Runs `pip install mitmproxy`, returns `{ ok, error? }` |
| POST | `/api/setup/generate-cert` | Starts mitmdump briefly to generate CA cert in `~/.mitmproxy/` |
| POST | `/api/setup/open-cert` | Opens `.cer` file in Windows Explorer for manual import |

### Capture

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/capture/status` | Returns `{ running, region, admin, fragments_saved, file_path }` |
| POST | `/api/capture/start` | Body `{ region: "global"\|"asia", debug: bool }` — starts proxy |
| POST | `/api/capture/stop` | Stops proxy, returns `{ file_path, region }` |
| POST | `/api/capture/set-region` | Body `{ region: "global"\|"asia" }` |

### WebSocket

| Path | Description |
|------|-------------|
| `/ws/capture-log` | Streams `{ level: "info"\|"success"\|"error"\|"warning", message, timestamp }` |

When a log message contains "Saved: N Memory Fragments", the frontend triggers a refetch of `/api/fragments`.

### Rescue

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rescue/records` | Returns records grouped by banner for the current session |

Response shape:
```json
[
  {
    "banner_id": "seasonal_combatant",
    "banner_name": "Evento de Personagem",
    "pulls": [ { "pull_number", "name", "rarity", "element", "pity", "timestamp", "image_url" } ],
    "stats": {
      "total": 157,
      "five_star": 3,
      "four_star": 15,
      "avg_pity_5": 45.0,
      "avg_pity_4": 12.3,
      "win_rate_50_50": 0.5663,
      "resources_spent": 15700  // jades = total_pulls × 160
    }
  }
]
```

## Setup Page (`/setup`)

Vertical checklist with four items rendered from `/api/setup/status`:

1. **Administrador** — ✓ green or ✗ red with text instruction to reopen as admin. No button — admin cannot be granted programmatically.
2. **mitmproxy** — ✓ green showing version, or ✗ red with "Instalar" button → `POST /api/setup/install-mitmproxy` with spinner.
3. **Certificado CA** — ✓ green or ✗ red with "Gerar" button → `POST /api/setup/generate-cert`.
4. **Importar certificado no Windows** — shown only after cert is generated. Text instructions + "Abrir certificado" button → `POST /api/setup/open-cert`. Manual checkbox "✓ Já importei o certificado" persisted to `localStorage`.

Collapsible "Como funciona" box below the checklist explaining the MITM proxy in plain language.

## Capture Page (`/capture`)

Two-column layout:

**Left column — controls:**
- Compact prerequisites bar: three inline badges (Admin, mitmproxy, Certificado) with link "→ ir para Setup" if any fail.
- Region dropdown: Global / Asia. Auto-detection label "✓ Detectado: Global" appears when the proxy identifies the region from captured `world_id`.
- Debug mode checkbox.
- **Start Capture** button (coral `#cc785c`), disabled if admin is missing or any prerequisite fails. Becomes **Stop Capture** (red) while running.
- Secondary buttons: "Abrir Snapshots" (opens folder) and "Carregar Último" (loads latest capture file via `POST /api/load`).

**Right column — real-time log:**
- WebSocket connection to `/ws/capture-log`, auto-reconnect on disconnect.
- Color-coded by level: green = success, red = error, yellow = warning, gray = info.
- Auto-scroll to bottom with pause-scroll toggle button.
- Empty state (capture not running): numbered instructions — "1. Clique Start Capture 2. Abra o jogo 3. Navegue até o inventário".

## Rescue Page (`/rescue`)

Data sourced from `GET /api/rescue/records`. Refetches every 10 seconds while capture is running, manual refresh button otherwise.

**Banner tabs** across the top — one tab per `banner_name` in the response. Active tab in coral. If no records, single empty-state message: "Nenhum registro capturado ainda. Inicie o capture e navegue até Rescue Records no jogo."

Each tab contains three blocks:

### Block 1 — Stats + Pie Chart
Side by side:
- Left: two-column stats table (Total de Saltos, Recursos Gastos, Saltos 5★, Saltos 4★, Pity 5★ Médio, Pity 4★ Médio, 50/50 Win Rate).
- Right: pie chart with three slices — 5★ coral (`#cc785c`), 4★ purple (`#8b5cf6`), 3★ gray (`#a09d96`). Built with `recharts`.

### Block 2 — Saltos 5★ Recentes
Responsive grid of portrait cards:
- Character portrait image fetched from `image_url` (CDN `cdn.czndecksmeta.com`). Generic icon fallback on load error.
- Pity badge in the bottom-left corner of each card.
- Ordered newest to oldest.

### Block 3 — Histórico Completo
Table columns: Nº do Roll, Personagem (small icon + name + element badge), Pity, Banner, Hora.
- Rarity filter (Todos / ★★★★★ / ★★★★) above the table.
- Client-side pagination, 50 rows per page.

## State Management

- Setup and capture status are polled every 5 seconds via `useQuery` with `refetchInterval`.
- The `/ws/capture-log` WebSocket is managed in a custom `useCaptureLog` hook that handles connect/disconnect tied to the component lifecycle.
- Rescue records refetch every 10 seconds when `capture.running === true`, otherwise on demand.
- The `localStorage` key `setup.cert_imported` persists the manual certificate import checkbox.

## Admin Handling

`GET /api/capture/status` always returns `admin: bool` (checked via `ctypes.windll.shell32.IsUserAnAdmin()`). The frontend disables Start Capture and shows a warning banner if `admin === false`. No UAC elevation is attempted — the user is instructed to reopen the app as administrator.

## Error Handling

- `POST /api/capture/start` returns 403 if `admin === false`.
- `POST /api/capture/start` returns 409 if capture is already running.
- `POST /api/capture/stop` returns 409 if capture is not running.
- Setup endpoints return 500 with `{ ok: false, error: "..." }` on failure (e.g. pip install fails).
- WebSocket `/ws/capture-log` closes gracefully when capture stops; client reconnects automatically if capture restarts.

## Out of Scope

- Reading rescue records from the old Python/Tkinter app's snapshot files.
- Exporting rescue records to JSON (future plan).
- Live pity counter overlay while capture is running.
