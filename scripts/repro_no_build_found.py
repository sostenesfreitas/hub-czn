"""Reproduce the 'no build found' bug with stat weights.

Tests three scenarios with the user's actual save data:
  A) weight=3 on CRate, min_priority_substats=0 (default) -> should yield builds
  B) weight=3 on CRate, min_priority_substats=1            -> should be tighter but still yield
  C) weight=3 on CRate, min_priority_substats=2            -> should yield 0 (math impossible)

Also dumps slot-level candidate counts so we see exactly where the funnel collapses.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "api"))

from api.optimizer.optimizer import GearOptimizer
from api.game_data.constants import EQUIPMENT_SLOTS  # for nicer slot names


def latest_capture() -> Path:
    snaps = sorted(
        Path(r"C:/Users/soste/AppData/Local/hub-czn/snapshots").glob("memory_fragments_*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not snaps:
        sys.exit("No memory_fragments_*.json snapshots found")
    return snaps[0]


def slot_candidate_counts(opt: GearOptimizer, char_name: str, settings: dict) -> dict[int, int]:
    """Replicate the per-slot filtering the optimizer does, to see where it bottoms out."""
    stat_weights = settings.get("stat_weights") or {}
    if stat_weights:
        for f in opt.fragments:
            f.calculate_priority_score(stat_weights)
    use_priority = any(v != 0 for v in stat_weights.values())
    min_pri = settings.get("min_priority_substats", 0)
    priority_stats = {k for k, v in stat_weights.items() if v > 0} if min_pri > 0 else None

    counts = {}
    for slot in (1, 2, 3, 4, 5, 6):
        c = opt.get_gear_by_slot(
            slot,
            include_equipped=True,
            exclude_char=char_name,
            top_percent=settings.get("top_percent", 100),
            use_priority_score=use_priority,
            min_rarity=3,
            priority_stats=priority_stats,
            min_priority_substats=min_pri,
        )
        counts[slot] = len(c)
    return counts


def run_scenario(opt: GearOptimizer, char_name: str, label: str, settings: dict):
    print(f"\n--- {label} ---")
    print(f"  settings: stat_weights={settings.get('stat_weights')}, "
          f"min_priority_substats={settings.get('min_priority_substats')}, "
          f"top_percent={settings.get('top_percent')}")
    counts = slot_candidate_counts(opt, char_name, settings)
    print(f"  slot candidate counts: {counts}")
    if min(counts.values()) == 0:
        empty = [EQUIPMENT_SLOTS.get(s, str(s)) for s, c in counts.items() if c == 0]
        print(f"  --> AT LEAST ONE SLOT HAS 0 CANDIDATES: {empty} -> optimize() will return []")
    else:
        # only run full optimize when slot counts are small enough to terminate
        total = 1
        for c in counts.values():
            total *= c
        if total > 200_000:
            print(f"  (skipping full optimize: {total:,} permutations would be too slow)")
        else:
            import time
            t0 = time.time()
            results = opt.optimize(char_name, settings)
            print(f"  optimize() returned: {len(results)} build(s)  ({time.time()-t0:.2f}s)")


def main():
    cap = latest_capture()
    print(f"Loading {cap.name} ...")
    opt = GearOptimizer()
    opt.load_data(str(cap))

    char_name = next(iter(opt.character_info))
    print(f"Using char: {char_name}")
    print(f"Total fragments: {len(opt.fragments)}")

    base = {
        "four_piece_sets": [],
        "two_piece_sets": [],
        "main_stat_4": [],
        "main_stat_5": [],
        "main_stat_6": [],
        "top_percent": 100,
        "include_equipped": True,
        "excluded_heroes": [],
        "max_results": 5,
        "stat_constraints": None,
        "allow_wildcards": False,
    }

    # A: just the weight, no min_priority_substats
    run_scenario(opt, char_name, "A: weight=3 on CRate, min_pri=0", {
        **base, "stat_weights": {"CRate": 3}, "min_priority_substats": 0,
    })
    # B: with min_priority_substats=1
    run_scenario(opt, char_name, "B: weight=3 on CRate, min_pri=1", {
        **base, "stat_weights": {"CRate": 3}, "min_priority_substats": 1,
    })
    # C: with min_priority_substats=2 (math-impossible: only 1 priority stat)
    run_scenario(opt, char_name, "C: weight=3 on CRate, min_pri=2 (only 1 priority stat)", {
        **base, "stat_weights": {"CRate": 3}, "min_priority_substats": 2,
    })
    # D: weight on TWO stats + min_pri=2 (should work)
    run_scenario(opt, char_name, "D: weight=3 on CRate+CDmg, min_pri=2", {
        **base, "stat_weights": {"CRate": 3, "CDmg": 3}, "min_priority_substats": 2,
    })


if __name__ == "__main__":
    main()
