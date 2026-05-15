"""Sprint 2h7 — does the harness already dispatch chain SkillEffs that follow
ConditionTriggered events? Analyze the dev_msg sequence pattern across all captures.

For each ConditionTriggeredEvent, find:
- The next event in dev_msg order (SkillEff? Another condition? Stack add?)
- Whether the harness dispatched the following SkillEff (status='dispatched')
- The condition->skill_eff_id pairing

Usage: python scripts/research/condition_chain_analysis.py
"""
import json
import sys
import re
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))

from api.game_data.eff_instances import EffInstanceIndex
from api.simulator.runtime import Runtime
from api.simulator.replay.capture_reader import CaptureReader
from api.simulator.replay.reconstructor import StateReconstructor
from api.simulator.replay.harness import ReplayHarness
from api.simulator.replay.event_parser import ConditionTriggeredEvent, SkillEffEvent


CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
CATALOG = REPO / "api" / "data" / "eff_type_catalog.json"

CAPTURES = [
    REPO / "api" / "snapshots" / "websocket_debug_20260511_100845.jsonl",
    Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260510_154057.jsonl"),
    Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260509_111039.jsonl"),
    Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260505_104037.jsonl"),
]


def main() -> int:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    instances = EffInstanceIndex(CLIENT_DB)

    # Aggregate stats across all captures
    total_conditions = 0
    cond_followed_by_skilleff = 0
    cond_followed_by_other = 0
    cond_skilleff_dispatched = 0
    cond_skilleff_undispatched = 0  # skill_eff exists but harness didn't dispatch
    condition_to_skilleff_pairs = Counter()
    followup_eff_types = Counter()
    followup_status_distribution = Counter()
    sample_cond_followed_by_skilleff = []  # collect first 5 examples
    next_event_type_distribution = Counter()
    per_capture_stats: list[tuple[str, int, int]] = []

    for cap_path in CAPTURES:
        if not cap_path.exists():
            print(f"MISSING: {cap_path.name}")
            continue
        runtime = Runtime(catalog=catalog, instances=instances)
        harness = ReplayHarness(runtime, StateReconstructor())
        captured = list(CaptureReader(cap_path).events())
        summary, reports = harness.replay(CaptureReader(cap_path))

        # Build a lookup: skill_eff_id -> list[EventReport]
        reports_by_seid: dict[str, list] = {}
        for r in reports:
            reports_by_seid.setdefault(r.skill_eff_id, []).append(r)

        cap_total = 0
        cap_followed = 0

        # Walk each capture frame's parsed_events
        for ce in captured:
            events = list(ce.parsed_events)
            for i, ev in enumerate(events):
                if not isinstance(ev, ConditionTriggeredEvent):
                    continue
                total_conditions += 1
                cap_total += 1
                cond_id = ev.condition_id
                # Find next event of interest
                next_ev = events[i + 1] if i + 1 < len(events) else None
                next_type = type(next_ev).__name__ if next_ev is not None else "None"
                next_event_type_distribution[next_type] += 1
                if isinstance(next_ev, SkillEffEvent):
                    cond_followed_by_skilleff += 1
                    cap_followed += 1
                    followup_eff_types[next_ev.eff_type] += 1
                    pair_key = (cond_id, next_ev.eff_type)
                    condition_to_skilleff_pairs[pair_key] += 1
                    # Check dispatch status
                    matching_reports = reports_by_seid.get(next_ev.skill_eff_id, [])
                    if any(r.status == "dispatched" for r in matching_reports):
                        cond_skilleff_dispatched += 1
                        followup_status_distribution["dispatched"] += 1
                    elif matching_reports:
                        cond_skilleff_undispatched += 1
                        followup_status_distribution[matching_reports[0].status] += 1
                    else:
                        followup_status_distribution["no_report"] += 1
                    if len(sample_cond_followed_by_skilleff) < 8:
                        sample_cond_followed_by_skilleff.append(
                            (
                                cond_id,
                                next_ev.skill_eff_id,
                                next_ev.eff_type,
                                matching_reports[0].status if matching_reports else "no_report",
                            )
                        )
                elif next_ev is not None:
                    cond_followed_by_other += 1
        per_capture_stats.append((cap_path.name, cap_total, cap_followed))

    print(f"=== Sprint 2h7 condition_triggered followup analysis ===")
    print(f"Total ConditionTriggeredEvents: {total_conditions}")
    if total_conditions == 0:
        print("(no ConditionTriggered events in any capture — nothing to analyze)")
        return 0
    print(
        f"  followed by SkillEffEvent: {cond_followed_by_skilleff}"
        f" ({cond_followed_by_skilleff / total_conditions * 100:.1f}%)"
    )
    print(f"  followed by other event:   {cond_followed_by_other}")
    print(
        f"  no next event:             "
        f"{total_conditions - cond_followed_by_skilleff - cond_followed_by_other}"
    )
    print()
    print("Per-capture breakdown:")
    for name, t, f in per_capture_stats:
        pct = f / t * 100 if t > 0 else 0.0
        print(f"  {name}: {t} conditions, {f} followed by skill_eff ({pct:.1f}%)")
    print()
    print(f"Next-event type distribution (immediately after ConditionTriggered):")
    for kind, count in next_event_type_distribution.most_common():
        print(f"  {count:5d}  {kind}")
    print()
    print(f"Of conditions followed by SkillEff:")
    if cond_followed_by_skilleff > 0:
        print(
            f"  dispatched: {cond_skilleff_dispatched}"
            f" ({cond_skilleff_dispatched / cond_followed_by_skilleff * 100:.1f}%)"
        )
        print(f"  undispatched: {cond_skilleff_undispatched}")
        print(f"  follow-up status distribution: {dict(followup_status_distribution)}")
    print()
    print(f"Top follow-up eff_types:")
    for eff_type, count in followup_eff_types.most_common(15):
        print(f"  {count:5d}  {eff_type}")
    print()
    print(f"Top condition->eff_type pairs:")
    for (cond, eff_type), count in condition_to_skilleff_pairs.most_common(15):
        print(f"  {count:5d}  {cond[:50]:50s} -> {eff_type}")
    print()
    print(f"Sample condition->skill_eff_id pairs (first 8):")
    for cond, seid, eff_type, status in sample_cond_followed_by_skilleff:
        print(
            f"  cond={cond[:40]:40s} seid={seid[:40]:40s}"
            f" type={eff_type:30s} status={status}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
