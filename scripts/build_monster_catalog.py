"""Builds api/data/monster_catalog.json from client_db monster definitions.

Sprint 2h1: feeds the Optimizer's Monster Picker dropdown.

Walks <CLIENT_DB>/monster(*)@monster.json shards, extracts monster id +
display name + a representative DEF value + has_weak marker.

DEF derivation
--------------
Client `monster.json` rows expose `default_powerstep` (a power-tier id) and
`stat_def_pct` (a per-monster multiplier). They do NOT carry an absolute DEF
value -- that is sourced at runtime from `mon_stat.json` (red/blue/green/
purple/orange tier tables) according to the encounter level. For the picker
we want a single representative DEF so the user can pick a monster and get
a reasonable `target_def` baseline for the AvgDMG estimator.

We map `default_powerstep` -> stat tier (1..10) using the closest powerstep
breakpoint, look up `mon_stat[red_<tier>].stat_def`, and apply
`stat_def_pct / 100`. The exact color (red/blue/...) does not matter because
all colors share the same stat curve in `mon_stat.json` (verified for tiers
1..10). This yields DEF values in the observed in-game range (~50-650).

has_weak derivation
-------------------
Monsters with `faction_ego` in the elemental-color set
(RED/ORANGE/BLUE/PURPLE/GREEN) are vulnerable to weak-ego damage. Monsters
with `EGO_NONE`/`none`/`EGO_NORMS`/`EGO_INSTINCT` are not.

Display name
------------
Monster rows store `name` as a string id (e.g. `monster@name@1007021_01`).
We resolve it via the English text shard at `output/text/en/text.json`.

Usage: python scripts/build_monster_catalog.py
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
TEXT_EN = Path(r"C:\Users\soste\Downloads\output\text\en\text.json")
OUTPUT = REPO / "api" / "data" / "monster_catalog.json"

# default_powerstep -> stat tier (1..10) breakpoints.
# Empirical fit: powerstep id ~100 = tier 1 baseline, 225 = tier 10 max.
# Below 100 the row is for damage_revise table only; we floor to tier 1.
_POWERSTEP_BREAKS = [
    (110, 1),
    (130, 2),
    (140, 3),
    (150, 4),
    (160, 5),
    (170, 6),
    (180, 7),
    (200, 8),
    (215, 9),
    (10_000, 10),
]

# Elemental-color faction_ego values that map to has_weak=True.
_WEAK_FACTION_EGOS = {"RED", "ORANGE", "BLUE", "PURPLE", "GREEN"}


def _powerstep_to_tier(ps: int) -> int:
    """Map default_powerstep id to mon_stat tier 1..10."""
    for cap, tier in _POWERSTEP_BREAKS:
        if ps <= cap:
            return tier
    return 10


def _load_name_table() -> dict[str, str]:
    """Return id -> text mapping for monster@name@* keys."""
    if not TEXT_EN.exists():
        print(f"WARNING: {TEXT_EN} not found; falling back to raw name ids",
              file=sys.stderr)
        return {}
    rows = json.loads(TEXT_EN.read_text(encoding="utf-8"))
    return {
        r["id"]: r["text"]
        for r in rows
        if isinstance(r, dict) and str(r.get("id", "")).startswith("monster@name@")
    }


def _load_mon_stat_tiers() -> dict[int, int]:
    """Return tier (1..10) -> stat_def from mon_stat.json (red_X tier)."""
    p = CLIENT_DB / "mon_stat@mon_stat.json"
    if not p.exists():
        raise FileNotFoundError(f"Required client_db file missing: {p}")
    rows = json.loads(p.read_text(encoding="utf-8"))
    tiers: dict[int, int] = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        rid = str(r.get("id", ""))
        # Use red_X as the canonical tier source (all colors share the curve).
        if not rid.startswith("red_"):
            continue
        suffix = rid.removeprefix("red_")
        if not suffix.isdigit():
            continue
        tier = int(suffix)
        try:
            tiers[tier] = int(float(r.get("stat_def", 0)))
        except (TypeError, ValueError):
            continue
    return tiers


def main() -> int:
    name_table = _load_name_table()
    tier_def = _load_mon_stat_tiers()
    if not tier_def:
        print("ERROR: no mon_stat tiers parsed; cannot derive DEF",
              file=sys.stderr)
        return 1

    catalog: list[dict] = []
    skipped_no_id = 0
    skipped_dup = 0
    seen_ids: set[str] = set()

    for shard in sorted(CLIENT_DB.glob("monster(*)@monster.json")):
        if shard.stat().st_size <= 2:
            continue
        try:
            data = json.loads(shard.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Skip {shard.name}: {e}", file=sys.stderr)
            continue
        rows = data if isinstance(data, list) else list(data.values())
        for row in rows:
            if not isinstance(row, dict):
                continue
            mid = row.get("id")
            if not mid:
                skipped_no_id += 1
                continue
            mid = str(mid)
            if mid in seen_ids:
                skipped_dup += 1
                continue
            seen_ids.add(mid)

            name_key = str(row.get("name", "") or "")
            name = name_table.get(name_key) or name_key or mid

            try:
                ps = int(row.get("default_powerstep", 100) or 100)
            except (TypeError, ValueError):
                ps = 100
            try:
                pct = float(row.get("stat_def_pct", 100) or 100)
            except (TypeError, ValueError):
                pct = 100.0

            tier = _powerstep_to_tier(ps)
            base_def = tier_def.get(tier) or tier_def.get(1) or 50
            def_value = int(round(base_def * (pct / 100.0)))

            faction = str(row.get("faction_ego", "") or "").upper()
            has_weak = faction in _WEAK_FACTION_EGOS

            # Filter out non-combat props (interactive set pieces, half-death
            # markers, etc.) -- they aren't meaningful monsters to optimize
            # against.
            grade = str(row.get("grade", "") or "")
            if grade in (
                "GRADE_INTERACTIVE_PROP",
                "GRADE_PROP_KEEP_HALF_DEATH",
                "GRADE_PROP_KEEP_HALF_DEATH_NOTICE",
            ):
                continue

            catalog.append({
                "id": mid,
                "name": name,
                "def": def_value,
                "has_weak": has_weak,
            })

    # Sort by DEF then name for predictable UI order
    catalog.sort(key=lambda e: (e["def"], e["name"]))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    if catalog:
        defs = [e["def"] for e in catalog]
        print(
            f"Wrote {len(catalog)} monsters to {OUTPUT.name} "
            f"(DEF range {min(defs)}-{max(defs)}). "
            f"skipped_no_id={skipped_no_id} skipped_dup={skipped_dup}"
        )
    else:
        print("WARNING: catalog is empty")
    return 0


if __name__ == "__main__":
    sys.exit(main())
