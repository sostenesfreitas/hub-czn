# Optimizer Set Improvements — Design Spec

**Date:** 2026-05-03
**Status:** Approved

## Summary

Two improvements to the optimizer's gear set system:

1. **3 two-piece set slots** — raise the maximum from 2 to 3, allowing a full 2+2+2 six-piece build locked to set bonuses.
2. **Wildcard pieces toggle** — an optional toggle that expands the gear pool beyond selected sets, filling remaining slots with the highest-scoring pieces from the full inventory.

---

## Background

A combatant equips exactly 6 gear pieces. Today the optimizer enforces:

- Up to 1 four-piece set (requires ≥4 pieces of that set in the build).
- Up to 2 two-piece sets (requires ≥2 pieces of each selected set in the build).
- The gear pool for optimization is restricted to pieces belonging to the selected sets only.

This means a 2+2+2 configuration (three distinct two-piece bonuses) is impossible today, and there is no way to discover whether a high-scoring off-set piece outperforms a third set piece.

---

## Design

### 1 — Three two-piece set slots

**What changes:** `maxSelect` on the two-piece set combobox increases from 2 to 3.

**Backend behavior:** The optimizer already checks `all(count.get(s, 0) >= 2 for s in two_piece_sets)` — this logic works unchanged for 3 sets. No algorithmic change needed.

**Character preset auto-fill:** The slice `recommended_sets[:2]` in `OptimizerPanel.tsx` becomes `recommended_sets[:3]`.

**Interaction with wildcards:** With 3 sets selected, all 6 slots are committed to set pieces (2+2+2). The wildcard toggle has no practical effect in this configuration.

---

### 2 — Wildcard pieces toggle

**Location in UI:** Immediately below the two-piece set selector, above the horizontal divider that separates sets from the other controls. Matches the visual style of the "Include equipped" toggle. Includes an `ⓘ` InfoPopover.

**Default state:** Off (preserves existing behavior for all current users).

**Behavior when off:** Pool restricted to pieces from selected sets (current behavior).

**Behavior when on:** Pool expanded to the full inventory. The set requirements are still enforced (≥2 pieces per selected set in every evaluated build). The remaining slots (6 minus 2×number-of-selected-sets) are filled by whatever pieces score highest, regardless of set.

Examples with wildcard on:
- 0 sets selected: all 6 slots free — best 6 pieces from inventory.
- 1 two-piece set: 2 locked to set + 4 free.
- 2 two-piece sets: 2+2 locked + 2 free.
- 3 two-piece sets: 2+2+2 locked — no free slots; toggle has no effect.
- 1 four-piece set: 4 locked + 2 free.
- 1 four-piece set + 1 two-piece set: 4+2 locked — no free slots; toggle has no effect.

**Backend implementation:** `allow_wildcards: bool = False` is added to `OptimizeStartRequest`. When `True`, the pool-building step in `_optimize_inner` skips the set-membership filter and includes all inventory pieces for the character's slot type. The set-requirement validation after combination generation is unchanged.

---

## i18n keys (new)

### `en.ts`

In `optimizer`, add after `excludeCharsTip`:

```ts
allowWildcards: 'Wildcard pieces',
allowWildcardsTip: 'When on, slots beyond the set minimums are filled with the highest-scoring pieces from your full inventory, regardless of set. Has no effect when all 6 slots are already committed to selected sets.',
```

### `pt-BR.ts`

```ts
allowWildcards: 'Peças coringa',
allowWildcardsTip: 'Quando ativado, os slots além dos mínimos de set são preenchidos com as melhores peças do inventário inteiro, independente de set. Não tem efeito quando todos os 6 slots já estão comprometidos pelos sets selecionados.',
```

---

## Files changed

| File | Change |
|------|--------|
| `src/pages/optimizer/OptimizerPanel.tsx` | `maxSelect={3}` on two-piece combobox; preset slice `[:3]`; wildcard toggle UI below two-piece selector |
| `src/lib/types.ts` | Add `allow_wildcards: boolean` to `OptimizerConfig` |
| `api/routes/optimize.py` | Add `allow_wildcards: bool = False` to `OptimizeStartRequest`; pass to optimizer |
| `Vribbels/optimizer/optimizer.py` | When `allow_wildcards=True`, skip set-membership filter in pool-building step |
| `src/i18n/en.ts` | Add `optimizer.allowWildcards`, `optimizer.allowWildcardsTip` |
| `src/i18n/pt-BR.ts` | Same keys, Portuguese text |

---

## Out of scope

- Scoring set bonuses in stat-weight units (would enable option C "optimizer decides automatically") — deferred; hard to calibrate fairly.
- Changing the maximum four-piece set slots (remains 1).
- Any changes to how set bonuses are calculated or displayed in results.
