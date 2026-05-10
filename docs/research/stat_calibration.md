# Stat Calibration — Before/After Scaling Integration

**Client data version**: 2026-05-01
**Validated against**: 9 unique (char, gear) samples across 2 capture sessions (2 of 4 JSONL files contained battle data)

## Before (legacy CHARACTERS dict, pre-A3)

Taken from `api/snapshots/stat_validation_report.json` at `HEAD` before the batch run — single capture, 5 samples:

| Stat   | N | mean_abs | mean_pct | median_pct | max_abs_pct | within_1% |
|--------|---|----------|----------|------------|-------------|-----------|
| ATK    | 5 | -343.15  | -31.92%  | -24.10%    | 47.62%      | 0%        |
| DEF    | 5 | -150.39  | -36.09%  | -39.03%    | 47.76%      | 0%        |
| HP     | 5 | -384.27  | -44.48%  | -47.23%    | 52.49%      | 0%        |
| CRate  | 5 |  -4.00   |  -6.78%  |   0.00%    | 17.51%      | 60%       |
| CDmg   | 5 |  -2.40   |  -1.15%  |   0.00%    |  5.74%      | 80%       |

## After (scaling tables, post-A3)

Batch run across 4 captures (2 with battle data), 9 samples:

| Stat   | N | mean_abs | mean_pct | median_pct | max_abs_pct | within_1% |
|--------|---|----------|----------|------------|-------------|-----------|
| ATK    | 9 | -347.29  | -40.98%  | -36.67%    | 73.34%      | 0%        |
| DEF    | 9 | -185.10  | -41.46%  | -37.52%    | 75.72%      | 0%        |
| HP     | 9 | -360.43  | -40.39%  | -34.66%    | 84.99%      | 0%        |
| CRate  | 9 |   -1.11  |  -2.65%  |   0.00%    | 23.87%      | 89%       |
| CDmg   | 9 |    0.00  |   0.00%  |   0.00%    |  0.00%      | 100%      |

**Interpretation**: The scaling tables (A3) did not meaningfully reduce the ATK/DEF/HP gap. The residual is NOT primarily base-stat scaling — see root cause analysis below.

## Root Cause: Memory Fragments Level Mismatch

Investigation via `scripts/debug_char_stats.py` revealed that `calculate_build_stats` uses `char_info.level` / `char_info.ascend` from the **memory_fragments file**, NOT the actual level visible in the battle frame.

This causes severe misprediction when the memory_fragments file is stale or incomplete:

| Character   | Battle level | char_info.level | ATK error |
|-------------|-------------|-----------------|-----------|
| Cassius     | L58+5       | L1+0 (unlocked but not leveled) | -73%  |
| Magna       | L58+5       | L50+4 (understated)             | -39%  |
| Heidemarie  | L60+5       | L60+5 (correct)                 | -38%  |

Even Heidemarie with a **correct** level in memory_fragments still shows -38% error — confirming a second, separate gap beyond the level mismatch.

## Residual gap analysis (Heidemarie, level correct)

```
Observed:  ATK=1534  DEF=247  HP=696
Predicted: ATK=946   DEF=154  HP=497
```

Gear-only contribution (summing piece stats):
- ATK% from gear: 25+25 = 50% + flat 22
- CRate/CDmg: perfect match (0% error)

The ATK/DEF/HP gap persists even when level is correct, pointing to missing flat-stat sources:
- **Limit break** bonus stats (not wired — `limit_<id>` groups in scaling tables)
- **Potential nodes beyond 50/60** if any exist
- Possible **multiplicative friendship bonus** instead of additive

## Sources of stat scaling (current)

| Source | Status | Notes |
|---|---|---|
| L1 base stats (`s_atk`, `s_def`, `s_hp`, `s_cri`, `s_cri_dmg_rate`) | Wired | from char_base_l1.json |
| Per-level deltas (cumulative sum) | Wired | from level_scaling.json |
| Ascend bonus | Wired | from ascend_scaling.json (only `dev_ascend` group) |
| Friendship bonus | Partial | Existing optimizer reads from CharacterInfo.friendship_bonus tuple |
| Limit break | NOT WIRED | `limit_<id>` groups in client data — candidate for next sprint |
| Partner card stats + passive | Wired | from partners.py |
| Potential nodes (50/60) | Wired | from existing potentials code |
| character_info level sync | BROKEN | optimizer uses mf level, not battle frame level |

## Open questions

- [ ] The validation methodology must pass `char["level"]` and `char["ascend"]` from the battle frame into `calculate_build_stats` — currently uses stale memory_fragments level. This is the most impactful fix.
- [ ] Is limit_break the dominant remaining gap (even with correct level)? Check `limit_<id>` groups for Heidemarie at L60+5.
- [ ] Are friendship bonuses applied multiplicatively in-game? (current: additive flat)
- [ ] Sample size is only 9 — need 20+ to draw firm conclusions. Trigger a new capture session that includes a fully-leveled roster.

## Stopping conditions met (A4)

Task A4 halted at Step 5 due to:
1. `median_pct` on ATK/DEF/HP: -36.67% / -37.52% / -34.66% — far worse than ±5% threshold
2. Sample count = 9, below minimum of 20

## Snapshot version

Client data extracted: 2026-05-01 (`extracted_db/*.db` mtime).
Captures: 4 sessions (2026-05-04, 2026-05-05, 2026-05-09 x2) — only 2 contained battle frames.
Memory fragments used: `memory_fragments_20260509_232009.json` (latest by mtime in AppData snapshot dir).
