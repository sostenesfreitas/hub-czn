# Optimizer Sets & Wildcards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the two-piece set maximum to 3 and add an opt-in wildcard toggle that opens the gear pool to the full inventory beyond selected sets.

**Architecture:** Three independent layers, each committed separately: (1) shared type and i18n strings, (2) backend Pydantic model + pool-building logic, (3) frontend UI wiring. The backend change is a pure read of one new flag — no algorithmic rework needed since the set-requirement validation already works for any number of sets.

**Tech Stack:** TypeScript/React, Pydantic v2, react-i18next (flat `as const` objects)

---

## File Map

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `allow_wildcards: boolean` to `OptimizerConfig` |
| `src/i18n/en.ts` | Add `optimizer.allowWildcards` + `allowWildcardsTip` |
| `src/i18n/pt-BR.ts` | Same keys in Portuguese |
| `api/routes/optimize.py` | Add `allow_wildcards: bool = False` to `OptimizeStartRequest`; pass to settings dict |
| `Vribbels/optimizer/optimizer.py` | Read `allow_wildcards` from settings; skip set filter when `True` |
| `src/pages/optimizer/OptimizerPanel.tsx` | `maxSelect={3}`, `.slice(0, 3)`, wildcard checkbox below two-piece section |

---

### Task 1: Shared type + i18n strings

**Files:**
- Modify: `src/lib/types.ts:179-191`
- Modify: `src/i18n/en.ts:274`
- Modify: `src/i18n/pt-BR.ts:274`

- [ ] **Step 1: Add `allow_wildcards` to `OptimizerConfig`**

  In `src/lib/types.ts`, `OptimizerConfig` currently ends at line 191:

  ```ts
  export interface OptimizerConfig {
    char_name: string
    four_piece_sets: number[]
    two_piece_sets: number[]
    main_stat_4: string | null
    main_stat_5: string | null
    main_stat_6: string | null
    top_percent: number
    include_equipped: boolean
    excluded_heroes: string[]
    max_results: number
    stat_weights: Record<string, number> | null
  }
  ```

  Add `allow_wildcards` after `stat_weights`:

  ```ts
  export interface OptimizerConfig {
    char_name: string
    four_piece_sets: number[]
    two_piece_sets: number[]
    main_stat_4: string | null
    main_stat_5: string | null
    main_stat_6: string | null
    top_percent: number
    include_equipped: boolean
    excluded_heroes: string[]
    max_results: number
    stat_weights: Record<string, number> | null
    allow_wildcards: boolean
  }
  ```

- [ ] **Step 2: Add i18n keys — English**

  In `src/i18n/en.ts`, line 274 currently reads:

  ```ts
      statPriorityLabel: 'Stat Priority (-1 to 3)',
    },
  ```

  Insert two new keys before the closing `},`:

  ```ts
      statPriorityLabel: 'Stat Priority (-1 to 3)',
      allowWildcards: 'Wildcard pieces',
      allowWildcardsTip: 'When on, slots beyond the set minimums are filled with the highest-scoring pieces from your full inventory, regardless of set. Has no effect when all 6 slots are already committed to selected sets.',
    },
  ```

- [ ] **Step 3: Add i18n keys — Portuguese**

  In `src/i18n/pt-BR.ts`, same position (line 274):

  ```ts
      statPriorityLabel: 'Prioridade de Stat (-1 a 3)',
      allowWildcards: 'Peças coringa',
      allowWildcardsTip: 'Quando ativado, os slots além dos mínimos de set são preenchidos com as melhores peças do inventário inteiro, independente de set. Não tem efeito quando todos os 6 slots já estão comprometidos pelos sets selecionados.',
    },
  ```

- [ ] **Step 4: Check TypeScript compiles**

  Run: `npx tsc --noEmit`

  Expected: no errors. If the compiler complains about `allow_wildcards` missing from an object literal, the default value will be wired in Task 3.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/types.ts src/i18n/en.ts src/i18n/pt-BR.ts
  git commit -m "feat: add allow_wildcards to OptimizerConfig and i18n keys"
  ```

---

### Task 2: Backend — allow_wildcards flag

**Files:**
- Modify: `api/routes/optimize.py:25-36` (request model) and `api/routes/optimize.py:115-126` (settings dict)
- Modify: `Vribbels/optimizer/optimizer.py:463-495` (pool building)

- [ ] **Step 1: Add field to `OptimizeStartRequest`**

  In `api/routes/optimize.py`, `OptimizeStartRequest` ends at line 36:

  ```python
  class OptimizeStartRequest(BaseModel):
      char_name: str
      four_piece_sets: list[int] = Field(default_factory=list)
      two_piece_sets: list[int] = Field(default_factory=list)
      main_stat_4: str | None = None
      main_stat_5: str | None = None
      main_stat_6: str | None = None
      top_percent: int = Field(default=100, ge=1, le=100)
      include_equipped: bool = True
      excluded_heroes: list[str] = Field(default_factory=list)
      max_results: int = Field(default=10, ge=1, le=50)
      stat_weights: dict[str, int] | None = None
  ```

  Add `allow_wildcards` after `stat_weights`:

  ```python
  class OptimizeStartRequest(BaseModel):
      char_name: str
      four_piece_sets: list[int] = Field(default_factory=list)
      two_piece_sets: list[int] = Field(default_factory=list)
      main_stat_4: str | None = None
      main_stat_5: str | None = None
      main_stat_6: str | None = None
      top_percent: int = Field(default=100, ge=1, le=100)
      include_equipped: bool = True
      excluded_heroes: list[str] = Field(default_factory=list)
      max_results: int = Field(default=10, ge=1, le=50)
      stat_weights: dict[str, int] | None = None
      allow_wildcards: bool = False
  ```

- [ ] **Step 2: Pass flag through settings dict**

  In `api/routes/optimize.py`, the `settings` dict at lines 115–126:

  ```python
  settings = {
      "four_piece_sets": body.four_piece_sets,
      "two_piece_sets": body.two_piece_sets,
      "main_stat_4": [body.main_stat_4] if body.main_stat_4 else [],
      "main_stat_5": [body.main_stat_5] if body.main_stat_5 else [],
      "main_stat_6": [body.main_stat_6] if body.main_stat_6 else [],
      "top_percent": body.top_percent,
      "include_equipped": body.include_equipped,
      "excluded_heroes": body.excluded_heroes,
      "max_results": body.max_results,
      "stat_weights": body.stat_weights,
  }
  ```

  Add `allow_wildcards` after `stat_weights`:

  ```python
  settings = {
      "four_piece_sets": body.four_piece_sets,
      "two_piece_sets": body.two_piece_sets,
      "main_stat_4": [body.main_stat_4] if body.main_stat_4 else [],
      "main_stat_5": [body.main_stat_5] if body.main_stat_5 else [],
      "main_stat_6": [body.main_stat_6] if body.main_stat_6 else [],
      "top_percent": body.top_percent,
      "include_equipped": body.include_equipped,
      "excluded_heroes": body.excluded_heroes,
      "max_results": body.max_results,
      "stat_weights": body.stat_weights,
      "allow_wildcards": body.allow_wildcards,
  }
  ```

- [ ] **Step 3: Read the flag and change pool building in optimizer**

  In `Vribbels/optimizer/optimizer.py`, in `_optimize_inner()`, after the existing `max_results` read at line 463:

  ```python
  max_results = settings.get("max_results", 100)
  ```

  Add the new read immediately after:

  ```python
  max_results = settings.get("max_results", 100)
  allow_wildcards = settings.get("allow_wildcards", False)
  ```

  Then change the `required_sets` argument in the `get_gear_by_slot()` call at line 489 (currently):

  ```python
  required_sets=all_required_sets if all_required_sets else None,
  ```

  Replace with:

  ```python
  required_sets=None if allow_wildcards else (all_required_sets if all_required_sets else None),
  ```

  Full context around the change (lines 484–494 after edit):

  ```python
          candidates = self.get_gear_by_slot(
              slot_num,
              include_equipped=include_equipped,
              exclude_char=char_name,
              excluded_heroes=excluded_heroes,
              required_sets=None if allow_wildcards else (all_required_sets if all_required_sets else None),
              required_main=main_filter,
              top_percent=top_percent,
              use_priority_score=use_priority,
              min_rarity=3
          )
  ```

- [ ] **Step 4: Manual smoke test**

  Start the dev server (`npm run tauri dev` or just the API: `uvicorn api.main:app --reload`).

  Test with wildcard OFF (default): run an optimization with one two-piece set selected — confirm the result builds only contain pieces from that set (same as before).

  Test with wildcard ON: POST to `/optimize/start` with `"allow_wildcards": true` and one two-piece set. The result should include non-set pieces in the 4 free slots.

- [ ] **Step 5: Commit**

  ```bash
  git add api/routes/optimize.py Vribbels/optimizer/optimizer.py
  git commit -m "feat: add allow_wildcards flag to optimizer pool building"
  ```

---

### Task 3: Frontend UI — maxSelect=3 + wildcard toggle

**Files:**
- Modify: `src/pages/optimizer/OptimizerPanel.tsx:122` (preset slice)
- Modify: `src/pages/optimizer/OptimizerPanel.tsx:292` (maxSelect)
- Modify: `src/pages/optimizer/OptimizerPanel.tsx:297` (insert wildcard toggle)

**Note:** `OptimizerPanel` receives `config: OptimizerConfig` as a prop and calls `patch()` to update individual fields. The `allow_wildcards` field added in Task 1 needs a default value wired in wherever the initial config object is constructed. Check `OptimizerPage.tsx` or wherever `OptimizerConfig` is initialized and ensure `allow_wildcards: false` is included there too.

- [ ] **Step 1: Find where `OptimizerConfig` is initialized and add the default**

  Run: `grep -r "four_piece_sets" src/pages/optimizer/ --include="*.tsx" -n`

  In whatever file constructs the initial config object, add `allow_wildcards: false` alongside the other fields. For example, if there is a `DEFAULT_CONFIG` or similar:

  ```ts
  const DEFAULT_CONFIG: OptimizerConfig = {
    char_name: '',
    four_piece_sets: [],
    two_piece_sets: [],
    main_stat_4: null,
    main_stat_5: null,
    main_stat_6: null,
    top_percent: 60,
    include_equipped: false,
    excluded_heroes: [],
    max_results: 10,
    stat_weights: null,
    allow_wildcards: false,  // add this
  }
  ```

- [ ] **Step 2: Increase preset auto-fill slice from 2 to 3**

  In `src/pages/optimizer/OptimizerPanel.tsx`, line 122:

  ```ts
      .slice(0, 2)
  ```

  Change to:

  ```ts
      .slice(0, 3)
  ```

- [ ] **Step 3: Increase `maxSelect` from 2 to 3**

  In `src/pages/optimizer/OptimizerPanel.tsx`, line 292:

  ```tsx
          maxSelect={2}
  ```

  Change to:

  ```tsx
          maxSelect={3}
  ```

- [ ] **Step 4: Add the wildcard toggle below the two-piece sets section**

  The two-piece `<div>` block (lines 283–297) currently ends with:

  ```tsx
        </div>
      </div>

      {/* Main stats */}
  ```

  Insert the wildcard toggle between the closing `</div>` of the two-piece block and the `{/* Main stats */}` comment:

  ```tsx
        </div>
      </div>

      {/* Wildcard toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none border-t border-[#282828] pt-3 -mt-1">
        <input
          type="checkbox"
          checked={config.allow_wildcards}
          onChange={(e) => patch({ allow_wildcards: e.target.checked })}
          disabled={disabled}
          className="accent-[#c084fc]"
        />
        <span className="text-xs text-[#ffffff] flex items-center gap-1">
          {t('optimizer.allowWildcards')}
          <InfoPopover content={t('optimizer.allowWildcardsTip')} />
        </span>
      </label>

      {/* Main stats */}
  ```

  The `border-t` and `pt-3 -mt-1` match the visual separation used between the sets section and controls section in the sidebar.

- [ ] **Step 5: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`

  Expected: no errors. Fix any missing `allow_wildcards` default in the config initializer if TypeScript reports it.

- [ ] **Step 6: Manual UI test**

  Start the dev server and open the Optimizer tab:
  - Confirm the two-piece set selector now accepts up to 3 sets.
  - Confirm "Wildcard pieces" checkbox appears below the two-piece selector with an ⓘ popover.
  - Confirm the popover text matches the i18n key.
  - Toggle wildcard on, run an optimization with one set — confirm non-set pieces appear in the result.
  - Toggle wildcard off — confirm only set pieces appear.
  - Select 3 two-piece sets and run — all 6 slots locked; wildcard on/off should not change results.

- [ ] **Step 7: Commit**

  ```bash
  git add src/pages/optimizer/OptimizerPanel.tsx
  git commit -m "feat: raise two-piece set max to 3 and add wildcard pieces toggle"
  ```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|-----------------|-----------|
| `maxSelect` from 2 → 3 | Task 3, Step 3 |
| `recommended_sets[:2]` → `[:3]` | Task 3, Step 2 |
| `allow_wildcards: bool = False` on `OptimizeStartRequest` | Task 2, Step 1 |
| Pass flag through settings dict | Task 2, Step 2 |
| Skip set filter when `allow_wildcards=True` in pool building | Task 2, Step 3 |
| Wildcard toggle in UI below two-piece selector | Task 3, Step 4 |
| Toggle default off | Task 3, Step 4 (`checked={config.allow_wildcards}` default `false`) |
| InfoPopover on wildcard toggle | Task 3, Step 4 |
| `optimizer.allowWildcards` + `allowWildcardsTip` in en.ts | Task 1, Step 2 |
| Same keys in pt-BR.ts | Task 1, Step 3 |
| `allow_wildcards: boolean` on `OptimizerConfig` | Task 1, Step 1 |
