# About Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/about` placeholder with a real page showing app version, description, and GitHub links.

**Architecture:** A new `GET /api/about` endpoint reads the version from `Vribbels/version.py` and returns version + pre-built GitHub URLs. The frontend queries this endpoint with TanStack Query and renders three sections: app info, a "check for updates" button (opens releases page externally), and links — matching the style of every other page in the app.

**Tech Stack:** Python + FastAPI · React 18 + TypeScript · TanStack Query v5 · @tauri-apps/plugin-opener · Tailwind v4

---

## File Map

**New files:**
- `api/routes/about.py` — `GET /api/about` returning version + GitHub URLs
- `src/pages/about/AboutPage.tsx` — full page component
- `tests/api/test_about.py` — backend tests

**Modified files:**
- `api/main.py` — import + register `about` router
- `src/lib/types.ts` — add `AboutInfo` interface
- `src/lib/api.ts` — add `about()` method
- `src/App.tsx` — replace `<Placeholder name="About" />` with `<AboutPage />`
- `src-tauri/capabilities/default.json` — add `opener:allow-open` permission

---

## Task 1: Backend `/api/about` endpoint

**Files:**
- Create: `api/routes/about.py`
- Modify: `api/main.py` (line 8 imports + line 28 router registration)
- Create: `tests/api/test_about.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/test_about.py`:

```python
def test_about_returns_version(client):
    response = client.get("/api/about")
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "1.8.0"


def test_about_returns_github_urls(client):
    response = client.get("/api/about")
    body = response.json()
    assert body["github_url"] == "https://github.com/sostenesfreitas/hub-czn"
    assert body["releases_url"] == "https://github.com/sostenesfreitas/hub-czn/releases"
    assert body["issues_url"] == "https://github.com/sostenesfreitas/hub-czn/issues"
```

- [ ] **Step 2: Run tests to verify they fail**

```
python -m pytest tests/api/test_about.py -v
```

Expected: FAIL — `404 Not Found` for both tests.

- [ ] **Step 3: Create `api/routes/about.py`**

```python
import os
import sys

from fastapi import APIRouter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Vribbels'))

try:
    from version import __version__
except ImportError:
    __version__ = "unknown"

router = APIRouter()

_GITHUB_REPO = "sostenesfreitas/hub-czn"


@router.get("/about")
def get_about():
    return {
        "version": __version__,
        "github_url": f"https://github.com/{_GITHUB_REPO}",
        "releases_url": f"https://github.com/{_GITHUB_REPO}/releases",
        "issues_url": f"https://github.com/{_GITHUB_REPO}/issues",
    }
```

- [ ] **Step 4: Register the router in `api/main.py`**

Current line 8:
```python
from api.routes import status, data, ws, setup, capture, rescue, scoring, combatants, optimize
```

Change to:
```python
from api.routes import status, data, ws, setup, capture, rescue, scoring, combatants, optimize, about
```

After line 27 (`app.include_router(optimize.router, ...)`), add:
```python
    app.include_router(about.router, prefix="/api", tags=["about"])
```

- [ ] **Step 5: Run tests to verify they pass**

```
python -m pytest tests/api/test_about.py -v
```

Expected: 2 PASSED.

- [ ] **Step 6: Run full test suite**

```
python -m pytest tests/ -q
```

Expected: All existing tests + 2 new = all PASSED.

- [ ] **Step 7: Commit**

```bash
git add api/routes/about.py api/main.py tests/api/test_about.py
git commit -m "feat: add /api/about endpoint with version and GitHub URLs"
```

---

## Task 2: Frontend AboutPage

**Files:**
- Modify: `src/lib/types.ts` — add `AboutInfo` at the end
- Modify: `src/lib/api.ts` — add `about()` method
- Create: `src/pages/about/AboutPage.tsx`
- Modify: `src/App.tsx` — import + replace Placeholder
- Modify: `src-tauri/capabilities/default.json` — add opener permission

- [ ] **Step 1: Add `AboutInfo` to `src/lib/types.ts`**

At the end of the file, after the last interface, add:

```typescript
export interface AboutInfo {
  version: string
  github_url: string
  releases_url: string
  issues_url: string
}
```

- [ ] **Step 2: Add `about()` to `src/lib/api.ts`**

In the existing `import type { ... }` block at the top, add `AboutInfo` to the imports:

```typescript
import type {
  ApiStatus, GameData, LoadResponse, MemoryFragment,
  SetupStatus, SetupActionResponse, CaptureStatus,
  CaptureStartRequest, CaptureStopResponse, RescueBanner,
  Combatant, CombatantStats, ScoringPriorities,
  OptimizerConfig, EquipmentSet, AboutInfo,
} from './types'
```

At the end of the `api` object (after `optimizeCancel`), add:

```typescript
  about: () => request<AboutInfo>('/api/about'),
```

- [ ] **Step 3: Create `src/pages/about/AboutPage.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Github, Bug, BookOpen, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'

async function openUrl(url: string) {
  try {
    const { open } = await import('@tauri-apps/plugin-opener')
    await open(url)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function LinkRow({ icon, label, url }: { icon: React.ReactNode; label: string; url: string }) {
  return (
    <button
      type="button"
      onClick={() => openUrl(url)}
      className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#252320] border border-[#2e2c28]
                 text-left hover:border-[#cc785c44] hover:bg-[#2e2c28] transition-colors group"
    >
      <span className="text-[#a09d96] group-hover:text-[#cc785c] transition-colors shrink-0">
        {icon}
      </span>
      <span className="text-sm text-[#a09d96] group-hover:text-[#faf9f5] transition-colors flex-1">
        {label}
      </span>
      <ExternalLink size={12} className="text-[#3a3835] group-hover:text-[#a09d96] transition-colors shrink-0" />
    </button>
  )
}

export function AboutPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['about'],
    queryFn: () => api.about(),
    staleTime: Infinity,
  })

  return (
    <div className="p-6 flex flex-col gap-6 max-w-md">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-[#faf9f5]">Sobre</h1>
      </div>

      {/* App info */}
      <div className="p-4 rounded-lg bg-[#252320] border border-[#2e2c28] flex flex-col gap-2">
        <p className="text-lg font-semibold text-[#faf9f5]">Hub CZN</p>
        <p className="text-sm text-[#a09d96]">
          A Fribbels-inspired gear management and optimization tool
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[#3a3835]">Versão</span>
          {isLoading ? (
            <span className="text-xs text-[#3a3835]">…</span>
          ) : (
            <span className="text-xs font-mono text-[#cc785c]">{data?.version ?? '—'}</span>
          )}
        </div>
      </div>

      {/* Check for updates */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[#3a3835] uppercase tracking-wider px-1">Atualizações</p>
        <button
          type="button"
          onClick={() => data && openUrl(data.releases_url)}
          disabled={!data}
          className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#252320] border border-[#2e2c28]
                     text-left hover:border-[#cc785c44] hover:bg-[#2e2c28] transition-colors group
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw
            size={16}
            className="text-[#a09d96] group-hover:text-[#cc785c] transition-colors shrink-0"
          />
          <span className="text-sm text-[#a09d96] group-hover:text-[#faf9f5] transition-colors flex-1">
            Ver releases no GitHub
          </span>
          <ExternalLink
            size={12}
            className="text-[#3a3835] group-hover:text-[#a09d96] transition-colors shrink-0"
          />
        </button>
      </div>

      {/* Links */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[#3a3835] uppercase tracking-wider px-1">Links</p>
        <div className="flex flex-col gap-2">
          <LinkRow
            icon={<Github size={16} />}
            label="Repositório no GitHub"
            url={data?.github_url ?? 'https://github.com/sostenesfreitas/hub-czn'}
          />
          <LinkRow
            icon={<Bug size={16} />}
            label="Reportar um problema"
            url={data?.issues_url ?? 'https://github.com/sostenesfreitas/hub-czn/issues'}
          />
          <LinkRow
            icon={<BookOpen size={16} />}
            label="Documentação (README)"
            url={`${data?.github_url ?? 'https://github.com/sostenesfreitas/hub-czn'}#readme`}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update `src/App.tsx`**

Add the import at the top with the other page imports:
```typescript
import { AboutPage } from './pages/about/AboutPage'
```

Replace:
```typescript
          <Route path="about"      element={<Placeholder name="About" />} />
```
with:
```typescript
          <Route path="about"      element={<AboutPage />} />
```

- [ ] **Step 5: Add `opener:allow-open` to `src-tauri/capabilities/default.json`**

Current content:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "shell:allow-spawn"
  ]
}
```

Change `"permissions"` to:
```json
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "shell:allow-spawn",
    "opener:allow-open"
  ]
```

- [ ] **Step 6: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/api.ts src/pages/about/AboutPage.tsx src/App.tsx src-tauri/capabilities/default.json
git commit -m "feat: add AboutPage with version info and GitHub links"
```
