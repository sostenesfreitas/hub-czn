# Hub CZN — Frontend Migration Design

**Date:** 2026-05-01  
**Status:** Approved  
**Scope:** Replace Tkinter UI with Tauri + Vite/React/shadcn desktop app; Python becomes a FastAPI sidecar.

---

## 1. Goal

The existing Tkinter interface is visually dated and has a low ceiling for UX improvements. The migration replaces it entirely with a modern desktop app (Tauri) while keeping the Python optimizer and capture engine intact as a backend sidecar. The result is a single installable `.msi` with a native desktop window powered by web tech.

---

## 2. Architecture

```
Hub_CZN_Optimizer.msi
├── Tauri shell (Rust, ~5 MB overhead)
│   └── Opens native WebView2 window
│
├── Frontend  (Vite + React + shadcn/ui)
│   ├── React Router v6  — 8 routes, fixed sidebar nav
│   ├── TanStack Query   — server state (fragments, combatants)
│   ├── Zustand          — UI state (optimizer config, selected result)
│   └── WebSocket client — live capture updates + optimizer progress
│
└── Python Sidecar  (FastAPI + uvicorn, compiled with PyInstaller)
    ├── REST API on 127.0.0.1:7842
    ├── WebSocket on /ws
    ├── Capture engine (mitmproxy, headless)
    ├── GearOptimizer (unchanged)
    └── Setup (cert generation, proxy config)
```

**Startup sequence:**
1. Tauri shell launches.
2. Tauri spawns the Python sidecar (`hub-czn-api.exe`) as a managed child process.
3. Sidecar binds to port 7842 (tries 7843, 7844… on conflict).
4. Frontend learns the port via a Tauri IPC command (`get_api_port`).
5. Frontend connects to REST API and opens WebSocket.
6. On app close, Tauri kills the sidecar.

---

## 3. API — Python FastAPI Sidecar

**Base URL:** `http://127.0.0.1:{port}/api`

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Server health + whether data is loaded |
| `POST` | `/api/load` | Load a capture JSON file (path resolved via Tauri file dialog) |
| `GET` | `/api/fragments` | All MemoryFragments (supports filter query params: slot, set, unequipped) |
| `GET` | `/api/combatants` | CharacterInfo + current 6-piece gear for each combatant |
| `GET` | `/api/game-data` | Static game data: SETS, STATS, CHARACTERS definitions |
| `POST` | `/api/scoring` | Save stat weight config + recalculate gear_score for all fragments |
| `POST` | `/api/optimize/start` | Start optimization job with given config |
| `POST` | `/api/optimize/cancel` | Cancel active optimization job |
| `GET` | `/api/capture/start` | Start mitmproxy proxy |
| `GET` | `/api/capture/stop` | Stop mitmproxy proxy |
| `POST` | `/api/setup/cert` | Generate and install MITM certificate |
| `GET` | `/api/rescue-records` | Full captured pull history |

### WebSocket `/ws`

Single persistent connection. Server pushes typed events:

```json
{ "type": "capture.update",    "data": { "fragments": 291 } }
{ "type": "capture.status",    "message": "Proxy listening on :8080" }
{ "type": "optimize.progress", "checked": 12400, "total": 50000, "found": 8 }
{ "type": "optimize.done",     "results": [ ... ] }
{ "type": "optimize.cancelled" }
{ "type": "data.loaded",       "fragments": 291, "combatants": 24 }
```

The `GearOptimizer.optimize()` method is unchanged. The API wraps it in a background thread and pipes `progress_callback` events through the WebSocket.

---

## 4. Frontend

### Routes

| Path | Content |
|------|---------|
| `/optimizer` | Stat Priority sliders, Set Config, Main Stats, Results table, Build detail |
| `/fragments` | Filterable Memory Fragment inventory table |
| `/combatants` | Character list + selected character gear detail |
| `/scoring` | Stat weight sliders + presets (Reset, DPS, Tank) |
| `/capture` | Start/Stop proxy, real-time log output |
| `/setup` | Certificate generation, proxy port config |
| `/rescue` | Pull history table, JSON export |
| `/about` | Version info, update status, links |

### Folder Structure

```
src/
├── components/
│   ├── ui/                ← shadcn/ui primitives
│   ├── layout/            ← Sidebar, AppShell, TopBar
│   ├── optimizer/         ← StatPriority, SetConfig, ResultsTable, BuildDetail
│   ├── fragments/         ← FragmentTable, FragmentFilters
│   ├── combatants/        ← CombatantList, CombatantDetail, GearSlot
│   ├── scoring/           ← StatWeightSliders, PresetButtons
│   ├── capture/           ← CaptureControls, CaptureLog
│   ├── setup/             ← CertPanel, ProxyConfig
│   └── rescue/            ← PullHistoryTable, ExportButton
├── hooks/
│   ├── useWebSocket.ts    ← single connection, distributed via context
│   ├── useOptimizer.ts    ← job state: progress, results, cancel
│   └── useData.ts         ← TanStack Query wrappers for fragments/combatants
├── lib/
│   ├── api.ts             ← typed fetch wrappers for all endpoints
│   └── types.ts           ← TypeScript interfaces mirroring Python models
└── store/
    └── optimizer.ts       ← Zustand: optimizer config, selected build
```

### Visual System (from DESIGN.md)

- **Background:** `#181715` (surface-dark), cards on `#252320` (elevated)
- **Accent:** `#cc785c` (coral) — active nav item, primary CTAs, selected row highlight
- **Text:** `#faf9f5` primary, `#a09d96` muted
- **Tables:** `rowHeight: 28px`, dimmed headings, coral selection
- **Sidebar:** icons + labels, active route in coral

---

## 5. Build & Packaging

### Repository Structure

```
hub-czn/
├── src-tauri/                  ← Tauri shell
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── src/main.rs             ← spawns sidecar, exposes get_api_port command
│
├── src/                        ← React frontend
│
├── api/                        ← Python sidecar
│   ├── main.py                 ← uvicorn entrypoint
│   ├── routes/                 ← endpoints split by domain
│   ├── optimizer/              ← GearOptimizer (moved from Vribbels/)
│   ├── capture/                ← mitmproxy engine (moved)
│   ├── game_data/              ← SETS, CHARACTERS, etc. (moved)
│   └── models/                 ← MemoryFragment, Stat, CharacterInfo (moved)
│
├── package.json
├── vite.config.ts
└── requirements.txt
```

### Build Pipeline (`build.bat`)

```
Step 1 — Python sidecar
  pip install -r requirements.txt
  pyinstaller api/hub_czn_api.spec --clean --noconfirm
  copy dist\hub-czn-api.exe src-tauri\binaries\hub-czn-api-x86_64-pc-windows-msvc.exe

Step 2 — Frontend
  npm install
  npm run build                  → dist/

Step 3 — Tauri bundle
  cargo tauri build              → src-tauri/target/release/bundle/msi/Hub_CZN_Optimizer.msi
```

Tauri requires the sidecar binary to follow the naming convention:
`src-tauri/binaries/{name}-{target-triple}.exe`

### Dev Workflow

```bash
# Terminal 1 — Python sidecar with hot-reload
cd api && uvicorn main:app --port 7842 --reload

# Terminal 2 — Tauri with hot-reload frontend
npm run tauri dev
```

---

## 6. Migration Sequence

The Tkinter app (`Vribbels/`) stays untouched until the new stack is working. Migration order:

1. Scaffold Tauri + Vite/React/shadcn project
2. Build Python FastAPI sidecar (port existing code, no logic changes)
3. Wire Tauri → sidecar port discovery
4. Implement frontend routes one at a time (start with Fragments — read-only, low risk)
5. Implement Optimizer route (WebSocket progress)
6. Implement Capture + Setup routes
7. Validate full flow end-to-end
8. Remove `Vribbels/` Tkinter code
9. Update `build.bat` and `.spec` for new layout
10. Cut release

---

## 7. Out of Scope

- Materials tab (removed by user decision — not relevant for now)
- GPU acceleration for optimizer (future consideration)
- macOS / Linux support (Windows only, same as current)
- Cloud sync or multi-device support
