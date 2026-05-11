"""
Diagnose F_BASE_DMG's eff_value scale empirically.

For each outlier from the most recent replay report, compute predicted
damage under four hypotheses and compare against the variant description
(deck_builder ground truth) and observed damage (when available).

Writes docs/research/dmg_scale_investigation.md.

Run:
  python scripts/investigate_dmg_scale.py
"""
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from api.game_data.eff_instances import EffInstanceIndex
from api.simulator.replay.char_resolver import CharResolver


CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
REPORT_PATH = REPO / "docs" / "research" / "replay_report_websocket_debug_20260511_100845.md"
OUTPUT_PATH = REPO / "docs" / "research" / "dmg_scale_investigation.md"

_OUTLIER_ROW = re.compile(
    r"^\|\s*(\d+)\s*\|\s*([^|]+)\|\s*`([^`]+)`\s*\|\s*([A-Z_]+)\s*\|\s*(\d+)\s*\|\s*(\d+|None)\s*\|"
)
_CARD_PREFIX = re.compile(r"^(c_\d+_[a-z]+\d+)")


def parse_outliers(report_md: str) -> list[dict]:
    outliers: list[dict] = []
    for line in report_md.split("\n"):
        m = _OUTLIER_ROW.match(line)
        if not m:
            continue
        seq, char, sid, eff_type, sim, obs = m.groups()
        outliers.append({
            "seq": int(seq),
            "char": char.strip(),
            "skill_eff_id": sid,
            "eff_type": eff_type,
            "sim": int(sim),
            "obs": None if obs == "None" else int(obs),
        })
    return outliers


def card_base_from_eff_id(skill_eff_id: str) -> str | None:
    """'c_30093_uni2_rsp3_01' -> 'c_30093_uni2' (strip rsp/mut/lbk/seq suffixes).

    Deck-builder variant keys use the form c_<char_id>_<cardtype><n> only.
    """
    m = _CARD_PREFIX.match(skill_eff_id)
    return m.group(1) if m else None


def predict(eff_value: int, count: int, atk: int, dr: float, cf: float, hypothesis: str) -> int:
    """Return predicted damage under one hypothesis."""
    if hypothesis == "H1_per_hit_x_count":
        return int(atk * (eff_value / 100.0) * count * (1.0 - dr) * cf)
    if hypothesis == "H2_pre_multiplied":
        return int(atk * (eff_value / 100.0) * (1.0 - dr) * cf)
    if hypothesis == "H3_div_1000":
        return int(atk * (eff_value / 1000.0) * (1.0 - dr) * cf)
    if hypothesis == "H4_no_crit_no_dr":
        return int(atk * (eff_value / 100.0))
    return 0


def main():
    if not REPORT_PATH.exists():
        print(f"Replay report missing: {REPORT_PATH}")
        print("Run scripts/replay_capture.py first.")
        return 1
    report_md = REPORT_PATH.read_text(encoding="utf-8")
    outliers = parse_outliers(report_md)
    if not outliers:
        print("No outliers found in report — replay may not have run.")
        return 1
    index = EffInstanceIndex(CLIENT_DB)
    resolver = CharResolver()

    lines = [
        "# F_BASE_DMG Scale Investigation",
        "",
        "Empirical diagnosis of why predicted damages overshoot observed.",
        "For each outlier, four hypotheses are computed and compared to",
        "the variant description's expected eff_pct (deck_builder ground truth).",
        "",
        "Atk used: 1100 (placeholder; matches mid-game level 60 char average).",
        "",
        "| seq | char | skill_eff_id | inst eff_value | inst count | desc pct | sim (current) | H1 ×count | H3 /1000 | obs |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    atk_assumed = 1100
    dr_assumed = 0.30
    cf_assumed = 1.0
    for o in outliers[:30]:
        try:
            inst = index.get(o["skill_eff_id"])
        except KeyError:
            inst = None
        eff_val = inst.eff_value if inst else 0
        count = inst.eff_count_value if inst else 1
        base = card_base_from_eff_id(o["skill_eff_id"])
        exp = resolver.card_expectation(base) if base else None
        desc_pct = exp.eff_pct if exp else None
        h1 = predict(eff_val, count, atk_assumed, dr_assumed, cf_assumed, "H1_per_hit_x_count")
        h3 = predict(eff_val, count, atk_assumed, dr_assumed, cf_assumed, "H3_div_1000")
        lines.append(
            f"| {o['seq']} | {o['char']} | `{o['skill_eff_id']}` | {eff_val} | {count} | "
            f"{desc_pct if desc_pct is not None else '?'} | {o['sim']} | {h1} | {h3} | {o['obs']} |"
        )
    lines.append("")
    lines.append("## Verdict criteria")
    lines.append("")
    lines.append("- If `inst eff_value` ≈ `desc pct` → scale is /100 and current code is correct (H2). Overshoot comes from elsewhere (count? double-mult?).")
    lines.append("- If `inst eff_value` ≈ `desc pct × count` → eff_value is pre-multiplied by count. Sim should divide.")
    lines.append("- If `inst eff_value` ≈ `desc pct × 10` → scale is /1000 (H3).")
    lines.append("- If all hypotheses miss → ATK or DR is wrong, not eff_value.")
    OUTPUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
