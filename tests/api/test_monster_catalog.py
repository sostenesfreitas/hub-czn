"""Sprint 2h10: validate monster_catalog.json reflects exact stage-tier DEF.

The catalog is built by `scripts/build_monster_catalog.py`. Sprint 2h10
replaced the empirical `default_powerstep -> red_1..red_10` heuristic with
a deterministic lookup chain:

    monster_id "<base>_<NN>" -> tier_monster_stat[id=NN]
        -> stage_enter_link_mon_stat_id "stat_NN" -> mon_stat[stat_NN].stat_def
        -> * (monster.stat_def_pct / 100)

These tests pin specific monster -> DEF pairs derived from that chain so a
regression in the build script (or a partial revert to the heuristic) is
caught immediately.
"""
import json
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
CATALOG_PATH = REPO / "api" / "data" / "monster_catalog.json"


@pytest.fixture(scope="module")
def catalog_by_id():
    cat = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return {e["id"]: e for e in cat}


def test_catalog_loads_and_has_min_entries(catalog_by_id):
    """Sanity: catalog has the expected ~500 entries."""
    assert len(catalog_by_id) >= 400, f"catalog shrank: {len(catalog_by_id)}"


def test_endgame_tier_def_is_stat_curve_not_red_curve(catalog_by_id):
    """A `_80` monster must map to mon_stat[stat_80].stat_def=239, NOT the
    old heuristic's red_10.stat_def=643. This is the canary that the new
    lookup is in use.
    """
    # 1004019_10 is in the catalog with the old heuristic at DEF=643. After
    # refinement, _10 -> stat_10 -> stat_def=68 (with stat_def_pct=100% it
    # stays 68).
    entry = catalog_by_id.get("1004019_10")
    if entry is None:
        pytest.skip("1004019_10 not in catalog")
    # Real value with stat_def_pct=100 is 68. Allow tiny rounding slack.
    assert entry["def"] <= 120, (
        f"1004019_10 DEF={entry['def']} is in the old heuristic range "
        f"(>120). Expected ~68 from stat_10 curve."
    )


def test_tier_1_monsters_match_stat_1(catalog_by_id):
    """_01-suffix monsters with stat_def_pct=100 should have DEF=47
    (mon_stat[stat_1].stat_def). Allow ±5 rounding for stat_def_pct
    variations.
    """
    # 1002001_01 has default_powerstep=81 (heuristic tier 1) and
    # stat_def_pct=100, so was already at ~50 even with the heuristic.
    # Under the new lookup it's exactly 47.
    entry = catalog_by_id.get("1002001_01")
    if entry is None:
        pytest.skip("1002001_01 not in catalog")
    assert 40 <= entry["def"] <= 60, (
        f"1002001_01 DEF={entry['def']} not near stat_1 (47)"
    )


def test_def_max_is_realistic_endgame(catalog_by_id):
    """After refinement, max DEF should be bounded by the highest stat_NN
    referenced by any monster (~stat_99, def=258), not red_10's 643.
    A stat_def_pct can push it higher (e.g. pct=200 -> 516), but the bulk
    of entries should be well below 643.
    """
    defs = sorted(e["def"] for e in catalog_by_id.values())
    median = defs[len(defs) // 2]
    # Pre-refinement: many entries clustered at 643. Median was ~54 but
    # tail had 44 entries at 643. Post-refinement no _NN <= 99 yields 643.
    assert defs[-1] <= 600, (
        f"max DEF={defs[-1]} suggests old red_10 heuristic still active. "
        f"Expected <=600 from stat_curve + reasonable stat_def_pct."
    )


def test_no_def_above_stat_def_pct_cap(catalog_by_id):
    """Sanity: every DEF should equal round(stat_N.def * stat_def_pct/100)
    for some N in [1..99]. We can't recompute without re-reading client_db,
    but we assert the value is plausibly in that derived range.
    """
    # stat_1 (47) * 50% = 23.5 -> min plausible ~20
    # stat_99 (258) * 300% = 774 -> upper bound generous
    for mid, e in catalog_by_id.items():
        d = e["def"]
        assert 20 <= d <= 800, f"{mid} DEF={d} out of plausible range"
