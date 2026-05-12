# Monster DEF refinement via client_db stage data — Sprint 2h10

## Outcome: A (clean exact-lookup path exists)

The catalog's per-monster representative DEF can be derived **deterministically**
from `tier_monster_stat` + `mon_stat`, eliminating Sprint 2h1's empirical
`default_powerstep` breakpoint heuristic.

## Investigation summary

Sprint 2h1's `build_monster_catalog.py` mapped each monster's
`default_powerstep` to one of 10 stat tiers (`red_1`..`red_10`) via empirical
breakpoints (`110→1, 130→2, ..., 215+→10`). The script assumed `mon_stat`
exposes a 1..10 tier curve and that `default_powerstep` is the tier index.

Both assumptions are wrong:

1. **`default_powerstep` is not a tier index.** It's a key into
   `powerstep_define@powerstep_define.json` (1257 rows), which carries
   `dmg_revise`, `hp_revise`, `cure_revise`, `shield_revise` — a small
   percent modifier (~0.01..12). It's not a stat-curve tier.
2. **`mon_stat` has 200 stat tiers, not 10.** The `red_1..red_10` rows are
   one subset (a color-banded curve). The canonical stage tier curve lives
   in `stat_1`..`stat_200` (DEF 47..~700+), and is what stages actually
   reference.

## The real chain (Outcome A)

Three client_db tables form a complete lookup:

### 1. Monster row id encodes the level

Every monster row id has form `<base>_<NN>`, e.g. `1004019_10`,
`1007021_02`, `1004006_80`. The `NN` suffix is the **monster level / tier
index** (1..99 observed). This matches the `_NN` suffix in
`battle.slot{i}_monster_multiple_link = "1004006_80"` — same id, same level.

### 2. `tier_monster_stat@tier_monster_stat.json` (715 rows)

Master per-level table keyed by `id` (= tier index, 1..9999).

Relevant fields:
- `monster_level` — display level
- `stage_enter_link_mon_stat_id` — key into `mon_stat` (e.g. `stat_80`)
- `default_revise_link_monster_level_stat_key` — key into
  `monster_level_stat` for per-level pct revise (e.g. `default_worldlv10`)
- `link_equip_stat_define_id` — equipment scaling tier

### 3. `mon_stat@mon_stat.json` `stat_N` rows (200 rows, `stat_1`..`stat_200`)

The canonical stat curve. Fields: `stat_atk`, `stat_def`, `stat_hp`,
`dmg_decrease_rate`. This is what the game uses at stage-enter.

Sample resolved chain:
```
monster 1004019_10
  -> level suffix '10' -> tier_monster_stat[id=10]
  -> stage_enter_link_mon_stat_id = 'stat_10'
  -> mon_stat[stat_10].stat_def = 68
  -> apply monster.stat_def_pct (100%) -> def = 68
```

### Other dramatis personae (not used)

- `monster_level_stat@monster_level_stat.json` (456 rows): a per-monster
  **level revise pct** curve (0..15%). Indexed by `_NN`, grouped by world
  level (`default_worldlv1`..`default_worldlv10`). Not a tier curve —
  it's a small bonus on top of `mon_stat` values.
- `compare_monster_level_stat@compare_monster_level_stat.json` (43 rows):
  per-faction comparison; all zero in current data.
- `powerstep_define@powerstep_define.json` (1257 rows): dmg/hp/cure/shield
  revise pct curve. Separate from stat curve.

## Suffix coverage

All 28 distinct monster id suffixes resolve cleanly to a `stat_N` curve:

| suffix | tier | mon_stat key | stat_def |
|--------|------|--------------|----------|
| _01    | 1    | stat_1       | 47       |
| _02    | 2    | stat_2       | 49       |
| _10    | 10   | stat_10      | 68       |
| _20    | 20   | stat_20      | 92       |
| _50    | 50   | stat_50      | 206      |
| _80    | 80   | stat_80      | 239      |
| _85    | 85   | stat_85      | 244      |
| _88    | 88   | stat_88      | 247      |
| _99    | 99   | stat_99      | 258      |

Only `_00` (1 monster) is missing from `tier_monster_stat` — fall back to
`stat_1` (DEF 47).

## Expected impact on catalog

Current catalog (heuristic): DEF range 27..643, with bimodal cluster (most
monsters at ~54 or ~643). Distribution:

```
DEF 0-49:    1
DEF 50-99: 364   (heuristic tier 1)
DEF 100-149: 7
DEF 200-249: 16
DEF 250-299: 22
DEF 300-349: 12
DEF 350-399: 13
DEF 400-449: 1
DEF 450-499: 19
DEF 550-599: 11
DEF 600-649: 44   (heuristic tier 10)
```

Refined catalog (exact lookup): DEF range ~27..258, distributed across the
actual `stat_1..stat_99` curve. Heuristic DEF=643 entries will collapse
toward 239-258 (real `stat_80..stat_99` values). Heuristic DEF=54 entries
at `_01` stay near 47.

The current catalog significantly **over-estimates endgame monster DEF**
(643 vs real ~258). For the Optimizer's AvgDMG estimator, this matters:
lower DEF target → higher DR factor → higher estimated damage. Refinement
will produce more realistic AvgDMG numbers for endgame builds.

## Implementation plan

Refactor `scripts/build_monster_catalog.py`:

1. Replace `_load_mon_stat_tiers` to read `stat_N` rows (1..200) instead of
   `red_N` (1..10).
2. Replace `_powerstep_to_tier` with `_id_suffix_to_tier`: parse trailing
   `_NN` from monster id, return `int(NN)`.
3. Use `tier_monster_stat[id=tier].stage_enter_link_mon_stat_id` to look
   up `mon_stat[stat_X].stat_def`. Fall back to `stat_1` on miss.
4. Continue applying `monster.stat_def_pct / 100` as multiplier.
5. Drop `_POWERSTEP_BREAKS`.

TDD: known case `1004019_10` should yield DEF ≈ 68 (was 643 via heuristic).
