"""Regression test: replay captured SkillEff events through the simulator
and report fidelity. Slow — marked with pytest.mark.slow."""
import json
import re
from pathlib import Path

import pytest

CAPTURE_DIR = Path.home() / "AppData" / "Local" / "hub-czn" / "snapshots"
# CORRECTION: the SkillEff res_id is alphanumeric (e.g. rr_lux_01_01_01),
# not digits-only. Use the same pattern as build_eff_catalog_scaffold.py.
SKILL_EFF_PATTERN = re.compile(r"SkillEff\s+\d+:[^:]+:([A-Z_][A-Z_0-9]*)")


@pytest.mark.slow
def test_skill_eff_dmg_dispatch_rate_at_least_80_percent():
    """At least 80% of captured SKILL_EFF_DMG observations must route to a real
    F_* formula in the catalog (not stub, not missing). Damage accuracy is
    reported separately by scripts/validate_catalog_against_captures.py."""
    if not CAPTURE_DIR.exists():
        pytest.skip("no capture directory")
    files = list(CAPTURE_DIR.glob("websocket_debug_*.jsonl"))
    if not files:
        pytest.skip("no capture files")

    REPO = Path(__file__).resolve().parents[2]
    catalog = json.loads((REPO / "api" / "data" / "eff_type_catalog.json").read_text(encoding="utf-8"))

    total = 0
    dispatched = 0
    for src in files:
        for line in src.open(encoding="utf-8", errors="ignore"):
            for m in SKILL_EFF_PATTERN.finditer(line):
                eff_type = m.group(1)
                if eff_type != "SKILL_EFF_DMG":
                    continue
                total += 1
                entry = catalog.get(eff_type)
                ref = entry["effect"].get("formula_ref") if entry else None
                if ref and not ref.startswith("F_UNKNOWN") and ref != "F_NOOP":
                    dispatched += 1

    if total == 0:
        pytest.skip("no SKILL_EFF_DMG observations")
    rate = dispatched / total
    assert rate >= 0.80, f"dispatch rate {rate:.1%} below 80% target ({dispatched}/{total})"
