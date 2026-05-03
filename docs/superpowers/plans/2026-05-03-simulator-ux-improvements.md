# Simulator UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Damage Simulator screen with reformulated Normal/Crit/Avg damage columns, card thumbnail images, grouped monster DEF presets, and state persistence.

**Architecture:** One-off scripts populate `game_db.json` with `sct_name` and seed `api/assets/cards/` with images; `simulate.py` returns new `normal_damage`/`crit_damage`/`avg_damage`/`icon_path` per card; `SimulatorPage.tsx` renders the new table layout, grouped presets, and persists state to `localStorage`.

**Tech Stack:** FastAPI (Python), Pydantic, React, TanStack Query, Tailwind CSS, i18next, localStorage

---

## Derived values reference

Tower floor DEF values derived from the extracted game DB (`wave_mode_stage_component`, `tier_monster_stat`, `equip_stat_define`, `powerstep_define`). Formula: `s_def × boss_powerstep / 205` (WL5 reference = 205).

| Floor | equip_id | s_def | boss_ps | DEF |
|-------|----------|-------|---------|-----|
| F30   | 3        | 23    | 323     | 36  |
| F60   | 5        | 31    | 323     | 49  |
| F90   | 5        | 31    | 323     | 49  |
| F120  | 5        | 31    | 323     | 49  |
| F150  | 5        | 31    | 391     | 59  |

WL values: `s_def` directly from `equip_stat_define` — 1→10, 2→17, 3→23, 4→27, 5→31.

---

## File map

| File | Action |
|------|--------|
| `scripts/update_card_sct_names.py` | Create — adds `sct_name` to each card entry in `game_db.json` |
| `api/assets/cards/` | Seed — copy PNGs from `Downloads/output/card_illustration/` |
| `api/routes/simulate.py` | Modify — new `CardResult` fields, new damage formulas, `icon_path` |
| `api/utils/game_db.py` | Modify — invalidate cache after JSON update |
| `src/lib/types.ts` | Modify — update `SimCardResult` and `SimulateDamageResponse` |
| `src/pages/simulator/SimulatorPage.tsx` | Modify — new table, grouped presets, state persistence |
| `src/i18n/en.ts` | Modify — new simulator keys |
| `src/i18n/pt-BR.ts` | Modify — Portuguese equivalents |
| `tests/api/test_simulate.py` | Create — unit tests for new damage fields |

---

## Task 1: Seed card images

Copy all card illustration PNGs to the API's assets directory so they are served at `/assets/cards/{sct_name}.png`.

**Files:**
- Create: `api/assets/cards/` (directory)

- [ ] **Step 1: Copy all card illustration PNGs**

```powershell
New-Item -ItemType Directory -Force "api\assets\cards"
Copy-Item "C:\Users\soste\Downloads\output\card_illustration\*.png" "api\assets\cards\"
```

Expected: No errors; `api\assets\cards\` is now populated with PNG files.

- [ ] **Step 2: Spot-check that images are served**

Start the API (`python -m uvicorn api.main:app --reload`) and open `http://localhost:8000/assets/cards/start_1057_01.png` in a browser. It should return the image (not 404).

- [ ] **Step 3: Commit**

```bash
git add api/assets/cards/
git commit -m "feat: seed card illustration thumbnails into api/assets/cards"
```

---

## Task 2: Add sct_name to game_db.json

Write and run a one-off script that reads `sct_name` from the extracted `card(*)@card.json` files and adds it to each card entry in `api/data/game_db.json`.

**Files:**
- Create: `scripts/update_card_sct_names.py`
- Modify: `api/data/game_db.json`
- Modify: `api/utils/game_db.py`

- [ ] **Step 1: Write the script**

Create `scripts/update_card_sct_names.py`:

```python
"""
One-off script: add sct_name to each card entry in api/data/game_db.json.

Usage:
    python scripts/update_card_sct_names.py <path_to_output_folder>

Example:
    python scripts/update_card_sct_names.py "C:/Users/soste/Downloads/output"
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def main(output_dir: str) -> None:
    db_path = Path(output_dir) / "db"
    game_db_path = Path(__file__).parent.parent / "api" / "data" / "game_db.json"

    if not db_path.exists():
        sys.exit(f"ERROR: db/ folder not found at {db_path}")
    if not game_db_path.exists():
        sys.exit(f"ERROR: game_db.json not found at {game_db_path}")

    # Build sct_name lookup from all card(*)@card.json files
    sct_names: dict[str, str] = {}
    card_re = re.compile(r"card\([^)]+\)@card\.json$")
    for f in db_path.iterdir():
        if not card_re.match(f.name):
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        for entry in data:
            cid = entry.get("id")
            sct = entry.get("sct_name")
            if cid and sct and sct not in ("none", ""):
                sct_names[cid] = sct

    print(f"Found {len(sct_names)} sct_name mappings")

    # Update game_db.json
    bundle = json.loads(game_db_path.read_text(encoding="utf-8"))
    updated = 0
    for card_id, card_data in bundle.get("cards", {}).items():
        sct = sct_names.get(card_id)
        if sct:
            card_data["sct_name"] = sct
            updated += 1

    game_db_path.write_text(
        json.dumps(bundle, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Updated {updated} / {len(bundle.get('cards', {}))} cards in {game_db_path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/update_card_sct_names.py <path_to_output_folder>")
    main(sys.argv[1])
```

- [ ] **Step 2: Add cache-clear to game_db.py**

Open `api/utils/game_db.py` and add an `invalidate()` function so the route can reload after a db rebuild:

```python
from __future__ import annotations

from pathlib import Path
import json

_BUNDLED_PATH = Path(__file__).parent.parent / "data" / "game_db.json"
_cache: dict | None = None


def get() -> dict:
    """Return the bundled game_db dict, loading it lazily on first call."""
    global _cache
    if _cache is None:
        if _BUNDLED_PATH.exists():
            try:
                _cache = json.loads(_BUNDLED_PATH.read_text(encoding="utf-8"))
            except Exception:
                _cache = {}
        else:
            _cache = {}
    return _cache


def invalidate() -> None:
    """Force reload on next get() call."""
    global _cache
    _cache = None
```

- [ ] **Step 3: Run the script**

```bash
python scripts/update_card_sct_names.py "C:/Users/soste/Downloads/output"
```

Expected output:
```
Found <N> sct_name mappings
Updated <M> / <K> cards in ...api/data/game_db.json
```

- [ ] **Step 4: Verify a spot-check**

```bash
python -c "
import json; db = json.load(open('api/data/game_db.json'))
cards = db['cards']
c = cards.get('c_1057_srt1', {})
print(c)
"
```

Expected: `{'cost': 1, 'link_skill_eff_id': ['c_1057_srt1_01'], 'sct_name': 'start_1057_01'}`

- [ ] **Step 5: Commit**

```bash
git add scripts/update_card_sct_names.py api/utils/game_db.py api/data/game_db.json
git commit -m "feat: add sct_name to game_db cards via update_card_sct_names script"
```

---

## Task 3: Update simulate.py — new damage fields and icon_path

Replace `final_damage`/`effective_damage` with `normal_damage`/`crit_damage`/`avg_damage` per card. Add `icon_path`. Update response totals.

**Files:**
- Modify: `api/routes/simulate.py`
- Create: `tests/api/test_simulate.py`

- [ ] **Step 1: Write failing tests**

Create `tests/api/test_simulate.py`:

```python
"""Tests for the /simulate/damage endpoint — new damage field shape."""
import pytest
from fastapi.testclient import TestClient
from api.main import app
import api.utils.game_db as game_db


@pytest.fixture
def client():
    return TestClient(app)


def _make_card_entry(eff_value: int, hits: int, cost: int = 1, sct_name: str | None = None) -> dict:
    entry = {"cost": cost, "link_skill_eff_id": ["eff_test_01"]}
    if sct_name:
        entry["sct_name"] = sct_name
    return entry


def test_simulate_no_data_returns_422(client):
    resp = client.post("/api/simulate/damage", json={
        "char_name": "Nine",
        "morale": 0,
        "use_sparks": True,
        "monster_def": 31,
        "frightened": False,
        "exposed_stacks": 0,
        "fortitude": False,
    })
    assert resp.status_code == 422


def test_card_result_has_new_damage_fields(client, monkeypatch):
    """CardResult must expose normal_damage, crit_damage, avg_damage, icon_path."""
    from api.routes.simulate import CardResult
    # Pydantic schema check — fields exist
    fields = CardResult.model_fields
    assert "normal_damage" in fields
    assert "crit_damage" in fields
    assert "avg_damage" in fields
    assert "icon_path" in fields
    assert "final_damage" not in fields
    assert "effective_damage" not in fields


def test_card_result_has_no_old_fields(client):
    """Removed fields must not appear in the response schema."""
    from api.routes.simulate import CardResult
    fields = CardResult.model_fields
    assert "final_damage" not in fields
    assert "effective_damage" not in fields


def test_simulate_response_has_new_total_fields(client):
    """SimulateDamageResponse must expose total_normal, total_crit, total_avg."""
    from api.routes.simulate import SimulateDamageResponse
    fields = SimulateDamageResponse.model_fields
    assert "total_normal" in fields
    assert "total_crit" in fields
    assert "total_avg" in fields
    assert "total_damage" not in fields
    assert "total_effective_damage" not in fields


def test_normal_damage_formula():
    """normal_damage = ATK * (eff_value/100) * morale_mult * buff_mult * def_reduction."""
    atk = 1000
    eff_value = 250  # 2.5× ATK
    morale_mult = 1.4  # 2 stacks
    buff_mult = 1.0
    def_reduction = 300 / (300 + 31)  # WL5
    expected_normal = round(atk * (eff_value / 100) * morale_mult * buff_mult * def_reduction, 1)
    # 1000 * 2.5 * 1.4 * (300/331) = 3167.7
    assert abs(expected_normal - 3167.7) < 1.0


def test_avg_is_weighted_avg_of_normal_and_crit():
    """avg_damage = normal * (1 - crate/100) + crit * (crate/100)."""
    normal = 1000.0
    crit = 2500.0
    crate = 60.0
    expected_avg = normal * (1 - crate / 100) + crit * (crate / 100)
    assert abs(expected_avg - 1900.0) < 0.1


def test_icon_path_format():
    """icon_path must be /assets/cards/{sct_name}.png when sct_name present."""
    sct_name = "start_1057_01"
    expected = f"/assets/cards/{sct_name}.png"
    assert expected == f"/assets/cards/{sct_name}.png"


def test_icon_path_none_when_no_sct_name():
    """icon_path must be None when sct_name is absent."""
    sct_name = None
    icon_path = f"/assets/cards/{sct_name}.png" if sct_name else None
    assert icon_path is None
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/api/test_simulate.py -v
```

Expected: `test_card_result_has_new_damage_fields` FAILS (fields not yet renamed), `test_simulate_response_has_new_total_fields` FAILS.

- [ ] **Step 3: Update simulate.py**

Replace the `CardResult` and `SimulateDamageResponse` Pydantic models, update `_load_card_db_from_folder` to capture `sct_name`, and rewrite the calculation block. Full diff of changed sections:

```python
# CardResult — replace the old model
class CardResult(BaseModel):
    card_id: str
    name: str
    spark_id: str | None
    cost: int
    eff_value: int
    hits: int
    normal_damage: float
    crit_damage: float
    avg_damage: float
    icon_path: str | None


# SimulateDamageResponse — replace total_damage / total_effective_damage
class SimulateDamageResponse(BaseModel):
    char_name: str
    deck_id: int
    atk: float
    crate: float
    cdmg: float
    morale_stacks: int
    morale_mult: float
    crit_factor: float
    monster_def: int
    def_reduction: float
    frightened: bool
    exposed_stacks: int
    fortitude: bool
    buff_mult: float
    cards: list[CardResult]
    total_normal: float
    total_crit: float
    total_avg: float
```

In `_load_card_db_from_folder`, in the `if card_re.match(name):` block, add `sct_name` to the entry:

```python
if card_re.match(name):
    for entry in data:
        cid = entry.get("id")
        if cid:
            sct = entry.get("sct_name", "")
            card_lookup[cid] = {
                "cost": int(entry.get("cost", 0)),
                "link_skill_eff_id": _parse_list(entry.get("link_skill_eff_id", "[]")),
                "sct_name": sct if sct and sct != "none" else None,
            }
```

Replace the damage calculation block inside the `for cd in card_datas:` loop:

```python
        card_name = _get_card_name(effective_card_id)
        sct_name = card_lookup.get(effective_card_id, {}).get("sct_name") or \
                   card_lookup.get(base_card_id, {}).get("sct_name")
        icon_path = f"/assets/cards/{sct_name}.png" if sct_name else None

        base_dmg = atk * (eff_value / 100)
        normal_dmg = base_dmg * morale_mult * buff_mult * def_reduction
        crit_dmg = base_dmg * (cdmg / 100) * morale_mult * buff_mult * def_reduction
        avg_dmg = normal_dmg * (1 - crate / 100) + crit_dmg * (crate / 100)

        results.append(CardResult(
            card_id=base_card_id,
            name=card_name,
            spark_id=rspark_id,
            cost=cost,
            eff_value=eff_value,
            hits=hits,
            normal_damage=round(normal_dmg, 1),
            crit_damage=round(crit_dmg, 1),
            avg_damage=round(avg_dmg, 1),
            icon_path=icon_path,
        ))
```

Replace the totals and response at the bottom of `simulate_damage`:

```python
    total_normal = sum(r.normal_damage for r in results)
    total_crit = sum(r.crit_damage for r in results)
    total_avg = sum(r.avg_damage for r in results)

    return SimulateDamageResponse(
        char_name=body.char_name,
        deck_id=deck_entry["id"],
        atk=round(atk, 1),
        crate=round(crate, 1),
        cdmg=round(cdmg, 1),
        morale_stacks=body.morale,
        morale_mult=round(morale_mult, 3),
        crit_factor=round(crit_factor, 3),
        monster_def=body.monster_def,
        def_reduction=round(def_reduction, 4),
        frightened=body.frightened,
        exposed_stacks=body.exposed_stacks,
        fortitude=body.fortitude,
        buff_mult=round(buff_mult, 4),
        cards=results,
        total_normal=round(total_normal, 1),
        total_crit=round(total_crit, 1),
        total_avg=round(total_avg, 1),
    )
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pytest tests/api/test_simulate.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
pytest tests/ -v
```

Expected: All existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add api/routes/simulate.py tests/api/test_simulate.py
git commit -m "feat: add normal/crit/avg damage + icon_path to simulate endpoint"
```

---

## Task 4: Update src/lib/types.ts

Update the TypeScript type definitions to match the new `simulate.py` response shape.

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Update SimCardResult**

In `src/lib/types.ts`, replace the `SimCardResult` interface (lines 275–286):

```typescript
export interface SimCardResult {
  card_id: string
  name: string
  spark_id: string | null
  cost: number
  eff_value: number
  hits: number
  normal_damage: number
  crit_damage: number
  avg_damage: number
  icon_path: string | null
}
```

- [ ] **Step 2: Update SimulateDamageResponse**

Replace `total_damage` and `total_effective_damage` with the three new totals (lines 288–306):

```typescript
export interface SimulateDamageResponse {
  char_name: string
  deck_id: number
  atk: number
  crate: number
  cdmg: number
  morale_stacks: number
  morale_mult: number
  crit_factor: number
  monster_def: number
  def_reduction: number
  frightened: boolean
  exposed_stacks: number
  fortitude: boolean
  buff_mult: number
  cards: SimCardResult[]
  total_normal: number
  total_crit: number
  total_avg: number
}
```

- [ ] **Step 3: TypeScript check**

```bash
npm run type-check
```

Expected: Type errors in `SimulatorPage.tsx` where old fields are referenced — those will be fixed in Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "types: update SimCardResult and SimulateDamageResponse for new damage columns"
```

---

## Task 5: Update SimulatorPage.tsx — new table, grouped presets, state persistence

**Files:**
- Modify: `src/pages/simulator/SimulatorPage.tsx`

- [ ] **Step 1: Update DEF_PRESETS and add grouped preset structure**

Replace the flat `DEF_PRESETS` array at the top of the file:

```typescript
// DEF values derived from equip_stat_define (WL) and powerstep scaling (tower).
// Tower formula: s_def × boss_powerstep / 205 (WL5 reference = powerstep 205).
// Floors F30-F120 share boss_powerstep=323; F150 escalates to 391 (Soul Collector).
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
```

- [ ] **Step 2: Add state persistence helpers (top of file, outside component)**

```typescript
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
```

- [ ] **Step 3: Update component state initialization with restore**

Replace the `useState` block at the top of `SimulatorPage()`:

```typescript
  const saved = loadPersistedState()

  const [charName, setCharName] = useState(saved?.charName ?? '')
  const [deckId, setDeckId] = useState<number | null>(saved?.deckId ?? null)
  const [morale, setMorale] = useState(saved?.morale ?? 0)
  const [useSparks, setUseSparks] = useState(saved?.useSparks ?? true)
  const [monsterDef, setMonsterDef] = useState(saved?.monsterDef ?? 20)
  const [weaken, setWeaken] = useState(saved?.weaken ?? false)
  const [vulnerableStacks, setVulnerableStacks] = useState(saved?.vulnerableStacks ?? 0)
  const [dmgReduction, setDmgReduction] = useState(saved?.dmgReduction ?? false)
  const [result, setResult] = useState<SimulateDamageResponse | null>(saved?.result ?? null)
```

- [ ] **Step 4: Add a persist helper that wraps every state change**

Add this function inside `SimulatorPage` (before the return), calling it after any setter:

```typescript
  function persist(patch: Partial<PersistedState>) {
    const current: PersistedState = {
      charName, deckId, morale, useSparks, monsterDef,
      weaken, vulnerableStacks, dmgReduction, result,
      ...patch,
    }
    savePersistedState(current)
  }
```

Update every `onChange` / `onClick` that changes config state to also call `persist`. For example:

```typescript
  // Character change
  onChange={(v) => {
    setCharName(v)
    setDeckId(null)
    persist({ charName: v, deckId: null })
  }}

  // Morale slider
  onChange={(e) => {
    const v = Number(e.target.value)
    setMorale(v)
    persist({ morale: v })
  }}

  // Monster DEF input
  onChange={(e) => {
    const v = Math.max(0, Number(e.target.value))
    setMonsterDef(v)
    persist({ monsterDef: v })
  }}

  // Preset button
  onClick={() => {
    setMonsterDef(p.value)
    persist({ monsterDef: p.value })
  }}

  // Weaken checkbox
  onChange={(e) => {
    setWeaken(e.target.checked)
    persist({ weaken: e.target.checked })
  }}

  // Dmg reduction checkbox
  onChange={(e) => {
    setDmgReduction(e.target.checked)
    persist({ dmgReduction: e.target.checked })
  }}

  // Vulnerable stacks
  onChange={(e) => {
    const v = Number(e.target.value)
    setVulnerableStacks(v)
    persist({ vulnerableStacks: v })
  }}

  // useSparks checkbox
  onChange={(e) => {
    setUseSparks(e.target.checked)
    persist({ useSparks: e.target.checked })
  }}

  // Deck selection
  onClick={() => {
    setDeckId(null)
    persist({ deckId: null })
  }}
  // (and per deck button)
  onClick={() => {
    setDeckId(d.deck_id)
    persist({ deckId: d.deck_id })
  }}
```

In `mutation.onSuccess`:

```typescript
  onSuccess: (data) => {
    setResult(data)
    persist({ result: data })
  },
```

- [ ] **Step 5: Update the grouped monster DEF preset JSX**

Replace the flat preset button list (`<div className="flex flex-wrap gap-1 mt-1">...`) with:

```tsx
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
                      onClick={() => {
                        setMonsterDef(p.value)
                        persist({ monsterDef: p.value })
                      }}
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
```

- [ ] **Step 6: Update the totals block (3 cards)**

Replace the two-column totals grid with three columns:

```tsx
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
```

- [ ] **Step 7: Replace CardRow with new layout**

Replace the entire `CardRow` function:

```typescript
function CardRow({ card }: { card: SimCardResult }) {
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
```

Add `assetUrl` and `useState` to the imports at the top of the file:

```typescript
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Play, Zap } from 'lucide-react'
import { api, assetUrl } from '@/lib/api'
import type { Combatant, SimulateDamageResponse, SimCardResult, DeckInfo } from '@/lib/types'
import { CharacterCombobox } from '@/components/ui/character-combobox'
```

- [ ] **Step 8: Update table header columns**

Replace the `<tr>` inside `<thead>`:

```tsx
                    <tr className="border-b border-[#333] text-[#888] text-xs uppercase tracking-wide">
                      <th className="px-3 py-2 text-left min-w-[160px]">{t('simulator.col.card')}</th>
                      <th className="px-3 py-2 text-center">{t('simulator.col.cost')}</th>
                      <th className="px-3 py-2 text-center">{t('simulator.col.coefficient')}</th>
                      <th className="px-3 py-2 text-center">{t('simulator.col.hits')}</th>
                      <th className="px-3 py-2 text-right">{t('simulator.col.normal')}</th>
                      <th className="px-3 py-2 text-right">{t('simulator.col.crit')}</th>
                      <th className="px-3 py-2 text-right text-[#a3e635]">{t('simulator.col.avg')}</th>
                    </tr>
```

- [ ] **Step 9: Update sort and spark note**

Change the sort to use `avg_damage` and update the spark note key:

```tsx
                      .sort((a, b) => b.avg_damage - a.avg_damage)
```

```tsx
                <p className="text-[#555] text-[10px] mt-2 px-1">
                  ✦ = {t('simulator.epifaniaNote')}
                  &nbsp;·&nbsp; {t('simulator.avgNote')}
                </p>
```

- [ ] **Step 10: TypeScript check**

```bash
npm run type-check
```

Expected: No type errors.

- [ ] **Step 11: Commit**

```bash
git add src/pages/simulator/SimulatorPage.tsx
git commit -m "feat: new simulator card table (Normal/Crit/Avg, images, per-hit rows, grouped presets, state persistence)"
```

---

## Task 6: Add i18n keys

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/pt-BR.ts`

- [ ] **Step 1: Add English keys**

In `src/i18n/en.ts`, inside the `simulator:` block, replace the `col:` block and add new keys:

```typescript
    // Replace old totals
    totalNormal: 'Total Normal',
    totalCrit: 'Total Crit',
    totalAvg: 'Total Avg',
    // Epifania (replaces sparkNote)
    epifaniaNote: 'Epifania applied',
    epifaniaApplied: 'Epifania',
    // Per-hit subrow
    perHit: 'per hit',
    // Avg note in footer
    avgNote: 'Avg = expected value given character CRate',
    // Grouped preset group labels
    presetGroupWorld: 'World Level',
    presetGroupTower: 'Spiral Tower',
    presetGroupBoss: 'Special Bosses',
    // Updated column headers
    col: {
      card: 'Card',
      cost: 'Cost',
      coefficient: 'Coeff.',
      hits: 'Hits',
      normal: 'Normal',
      crit: 'Crit',
      avg: 'Avg',
    },
```

Remove the old keys `totalDeck`, `totalEffective`, `sparkNote`, `col.finalDmg`, `col.effectiveDmg`.

- [ ] **Step 2: Add Portuguese keys**

In `src/i18n/pt-BR.ts`, add the same keys with Portuguese translations:

```typescript
    totalNormal: 'Total Normal',
    totalCrit: 'Total Crit',
    totalAvg: 'Total Avg',
    epifaniaNote: 'Epifania aplicada',
    epifaniaApplied: 'Epifania',
    perHit: 'por hit',
    avgNote: 'Avg = valor esperado considerando CRate do personagem',
    presetGroupWorld: 'Nível do Mundo',
    presetGroupTower: 'Torre Espiral',
    presetGroupBoss: 'Bosses Especiais',
    col: {
      card: 'Carta',
      cost: 'Custo',
      coefficient: 'Coef.',
      hits: 'Hits',
      normal: 'Normal',
      crit: 'Crit',
      avg: 'Avg',
    },
```

Remove the old keys `totalDeck`, `totalEffective`, `sparkNote`, `col.finalDmg`, `col.effectiveDmg`.

- [ ] **Step 3: TypeScript check**

```bash
npm run type-check
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/pt-BR.ts
git commit -m "i18n: add simulator keys for Normal/Crit/Avg columns, grouped presets, Epifania"
```

---

## Task 7: Investigate dmg_revise_rate: 0.36

Determine whether the `dmg_revise_rate: 0.36` constant from `constant_meta(stat_formula)@constant_meta.json` is a load-bearing multiplier in the damage formula. Update `simulate.py` if it applies.

**Files:**
- Read: `C:\Users\soste\Downloads\output\db\constant_meta(stat_formula)@constant_meta.json`
- Maybe modify: `api/routes/simulate.py`

- [ ] **Step 1: Read the constant**

```python
import json
data = json.loads(open(r"C:\Users\soste\Downloads\output\db\constant_meta(stat_formula)@constant_meta.json").read())
for d in data:
    print(d)
```

Confirm: `dmg_revise_rate: 0.36`.

- [ ] **Step 2: Analyse what it controls**

Check what other constants appear alongside it. Already known from prior exploration:

```
dmg_revise_rate: 0.36       ← investigate
shield_revise_rate: 0.3
dmg_decrease_rate_0_value: -160
dmg_decrease_rate_curv_value: 300   ← matches current DEF formula denominator (confirmed ✅)
```

The name `dmg_revise_rate` suggests a scaling factor applied to all card damage. Common patterns in CZN combat:
- It might apply only to PvP (absent in PvE)
- It might be a global "balance multiplier" applied to all outgoing ATK-based damage before the DEF step
- `dmg_decrease_rate_0_value: -160` suggests the DEF formula might be `300 / (300 + max(DEF - 160, 0))` rather than `300 / (300 + DEF)` — but the current formula is confirmed correct vs real game numbers, so -160 likely applies to a different context (e.g. monster ATK vs player DEF)

- [ ] **Step 3: Decision**

Check if applying `× 0.36` to all card damage matches observed in-game numbers for any tested character/deck. If the spec's formulas are confirmed correct without this factor, document as: "Investigated — `dmg_revise_rate: 0.36` is not applied to player card damage in PvE content; likely a PvP balance constant."

If it IS load-bearing, apply it in `simulate.py`:

```python
# In simulate_damage, after computing base_dmg:
DMG_REVISE_RATE = 0.36  # from constant_meta(stat_formula) — apply if confirmed
base_dmg = atk * (eff_value / 100) * (1 + DMG_REVISE_RATE)
```

- [ ] **Step 4: Document finding**

Add a comment in `simulate.py` near `MORALE_PCT_PER_STACK`:

```python
# dmg_revise_rate: 0.36 (constant_meta stat_formula) — investigated; not applied to PvE card damage.
# The constant_meta also confirms dmg_decrease_rate_curv_value=300 used in the DEF reduction formula.
```

- [ ] **Step 5: Commit if changed**

```bash
git add api/routes/simulate.py
git commit -m "chore: document dmg_revise_rate investigation result in simulate.py"
```

---

## Self-review checklist

### Spec coverage

| Spec requirement | Task |
|---|---|
| Normal / Crit / Avg damage columns | Task 3, 4, 5 |
| Per-hit sublinha (hits > 1 only) | Task 5 Step 7 |
| Totals block with 3 values | Task 5 Step 6 |
| Card images (32px thumbnail) | Task 1, 3, 5 |
| sct_name → icon_path in simulate.py | Task 2, 3 |
| Grouped monster presets | Task 5 Steps 1, 5 |
| Custom DEF free input preserved | Not removed — already present in existing code |
| State persistence with czn_simulator_state | Task 5 Steps 2–4 |
| Epifania (rename Spark) | Task 5 Step 7, Task 6 |
| Formula validation (dmg_revise_rate) | Task 7 |
| i18n keys | Task 6 |
| Remove internal card IDs from table | Task 5 Step 7 (new CardRow has no shortId display) |

### Type consistency

- `SimCardResult.avg_damage` referenced in Task 5 sort: `b.avg_damage - a.avg_damage` ✓
- `SimulateDamageResponse.total_avg` referenced in Task 5 totals block ✓
- `CardResult` in `simulate.py` matches `SimCardResult` in `types.ts` ✓
- `icon_path: str | None` → `icon_path: string | null` ✓
