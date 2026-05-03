# Optimizer UX Improvements — Design Spec

**Date:** 2026-05-03
**Status:** Approved

## Summary

Three UX improvements to the optimizer page:

1. **State persistence** — save the last config + results to `localStorage` so the user returns to where they left off.
2. **Avatar in gear result cards** — show a small circular portrait of the character currently using each piece in the optimizer results.
3. **Character selector with avatar** — replace the native `<select>` with a custom searchable dropdown that shows each character's portrait next to their name.

---

## Background

Currently, navigating away from the optimizer page discards all state — config, results, and selected rank. Users must re-configure and re-run from scratch on every visit. The gear result cards show `equipped_to` as invisible data (not rendered). The character selector is a plain native `<select>` with no visual identity cues.

---

## Design

### 1 — State persistence

**Storage key:** `czn_optimizer_state`

**Stored shape:**
```ts
{
  config: OptimizerConfig
  results: OptimizeResult[]
  selectedRank: number | null
}
```

**Save:** When `jobState` transitions to `'done'` (job completes successfully), serialize and write to `localStorage`. Each new successful run overwrites the previous entry.

**Restore:** On `OptimizerPage` mount, read `czn_optimizer_state`. If it contains a non-empty `results` array, initialize `config`, `results`, `selectedRank`, and set `jobState` to `'done'` so the results panel renders immediately. If the key is absent or malformed, fall back to `DEFAULT_CONFIG` and empty results (current behavior).

**Scope:** Global — one saved state across all characters. Only the last completed run is retained.

**No expiry / version guard:** If the stored shape is incompatible (e.g. after a schema change), a `try/catch` on parse silently falls back to default state.

---

### 2 — Avatar in gear result cards

**Component:** `GearSlotCard` in `src/pages/combatants/CombatantDetail.tsx`

**New optional props:**
```ts
equippedToPortrait?: string   // resolved portrait URL
equippedToName?: string       // character display name for tooltip
```

**Rendering:** When `equippedToPortrait` is present, render a 24px circular `<img>` in the top-right corner of the card header (absolutely positioned). On image load error, fall back to a small `<User>` icon (same pattern as `CombatantCard`). The element carries `title={equippedToName}` for a tooltip.

**Portrait resolution:** Done in `ResultsArea.tsx`. If `combatants` is not already available there, pass it as a prop from `OptimizerPage.tsx` (which fetches it via the existing query used by `OptimizerPanel`). For each `GearSlot` in the expanded build, look up:
```ts
const char = combatants.find(c => c.char_id === slot.equipped_to)
const portrait = char ? assetUrl(char.portrait_url) : undefined
const name = char?.char_name
```
Pass `equippedToPortrait={portrait}` and `equippedToName={name}` to `GearSlotCard`.

**When `equipped_to` is null or no matching character is found:** props are `undefined`, no avatar renders.

---

### 3 — Character selector with avatar

**New component:** `src/components/ui/character-combobox.tsx`

**Props:**
```ts
interface CharacterComboboxProps {
  combatants: Combatant[]
  value: string           // selected char_id
  onChange: (charId: string) => void
  disabled?: boolean
  placeholder?: string
}
```

**Trigger button:** Matches the visual style of `SetCombobox` — dark background, purple focus border. Shows the selected character's 24px circular portrait + `char_name`. If no character is selected, shows the placeholder text.

**Dropdown:** Positioned `div` with `z-50`, rendered below the trigger. Contains:
- A search `<input>` that filters characters by `char_name` (case-insensitive).
- A scrollable list (max-height ~200px) of matching characters, each row showing a 24px circular portrait + `char_name`. Selected character is highlighted in purple. Click selects and closes.

**Click-outside:** `useEffect` attaches a `mousedown` listener to `document`; clicking outside the component closes the dropdown.

**Avatar fallback:** Same `onError` pattern as `CombatantCard` — shows a `<User>` icon if `portrait_url` is missing or fails to load.

**Usage in `OptimizerPanel.tsx`:** Replace the native `<select>` block (lines 225–264) with `<CharacterCombobox combatants={combatants} value={config.char_name} onChange={...} disabled={disabled} />`. The `onChange` handler replicates the existing preset-load logic currently inside the `<select onChange>`.

---

## Files changed

| File | Change |
|------|--------|
| `src/pages/optimizer/OptimizerPage.tsx` | Restore state on mount; save state on job completion |
| `src/components/ui/character-combobox.tsx` | New component — custom searchable dropdown with avatars |
| `src/pages/optimizer/OptimizerPanel.tsx` | Replace native `<select>` with `CharacterCombobox` |
| `src/pages/combatants/CombatantDetail.tsx` | Add `equippedToPortrait` + `equippedToName` props to `GearSlotCard` |
| `src/pages/optimizer/ResultsArea.tsx` | Resolve portrait URL per slot and pass to `GearSlotCard` |

---

## Out of scope

- Per-character saved state (only global last-run is stored).
- Expiry or versioning of stored state (silent fallback on parse error is sufficient).
- Showing avatars anywhere other than the optimizer results and the character selector.
- Any changes to how the optimizer runs or scores builds.
