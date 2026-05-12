"""Dump csMap stacks + skillMap entries + obs/sim/ratio for the measurable
Track B oracle hits. Outputs human-readable text for empirical formula fitting.

Usage:
  python scripts/inspect_track_b_skill_map.py
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from api.game_data.eff_instances import EffInstanceIndex
from api.simulator.runtime import Runtime
from api.simulator.replay.capture_reader import CaptureReader
from api.simulator.replay.reconstructor import StateReconstructor
from api.simulator.replay.harness import ReplayHarness


CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
CATALOG = REPO / "api" / "data" / "eff_type_catalog.json"

CAPTURES = [
    ("c_30093", Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260509_111039.jsonl"), "c_30093_srt4_rsp1"),
    ("c_1052_rich", Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260510_154057.jsonl"), "c_1052_uni4_lbk"),
    ("c_1052_low", Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260505_104037.jsonl"), "c_1052_uni4_lbk"),
]


def _find_battle_wt_at_or_after(capture_path: Path, target_seq: int) -> dict | None:
    """Walk the JSONL and return the battle_wt at the snapshot frame nearest
    AFTER target_seq (the harness uses next-snapshot semantics).
    """
    seq = 0
    last_bw_before = None
    for line in capture_path.open("r", encoding="utf-8"):
        try:
            raw = json.loads(line)
        except json.JSONDecodeError:
            continue
        data = raw.get("data")
        if not isinstance(data, dict):
            continue
        seq += 1
        snap = data.get("snapshot")
        bw = (snap.get("cache") or {}).get("battle_wt") if isinstance(snap, dict) else None
        if isinstance(bw, dict):
            if seq >= target_seq:
                return bw
            last_bw_before = bw
    return last_bw_before


def main() -> int:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    instances = EffInstanceIndex(CLIENT_DB)

    for label, cap_path, target_prefix in CAPTURES:
        print(f"\n{'='*70}")
        print(f"== {label}: {cap_path.name}")
        print(f"== target prefix: {target_prefix}")
        print('='*70)
        if not cap_path.exists():
            print(f"  MISSING: {cap_path}")
            continue
        runtime = Runtime(catalog=catalog, instances=instances)
        harness = ReplayHarness(runtime, StateReconstructor())
        summary, reports = harness.replay(CaptureReader(cap_path))

        matches = [
            r for r in reports
            if r.skill_eff_id.startswith(target_prefix)
            and r.status == "dispatched"
            and r.obs_damage is not None
        ]
        print(f"  measurable hits: {len(matches)}")
        if not matches:
            continue

        for r in matches:
            ratio = (r.obs_damage / r.sim_damage) if r.sim_damage else 0.0
            print(f"\n  --- seq={r.seq} {r.skill_eff_id} target={r.target_id} ---")
            print(f"    sim={r.sim_damage} obs={r.obs_damage} delta={(r.delta_pct or 0)*100:+.1f}% ratio={ratio:.4f}")
            print(f"    accumulator stacks ({len(r.dva_stacks_observed)}):")
            for k, v in sorted(r.dva_stacks_observed.items()):
                print(f"      {k}={v}")

            bw = _find_battle_wt_at_or_after(cap_path, r.seq)
            if bw is None:
                print("    NO snapshot battle_wt found for this seq")
                continue
            cs_map = bw.get("csMap", {})
            skill_map = bw.get("skillMap", {})
            target_cs_entries = []
            for cs_inst_id, cs_entry in cs_map.items():
                if not isinstance(cs_entry, dict):
                    continue
                if str(cs_entry.get("owner_id")) == str(r.target_id):
                    target_cs_entries.append((cs_inst_id, cs_entry))
            print(f"    snapshot csMap entries on target ({len(target_cs_entries)}):")
            for cs_inst_id, cs_entry in target_cs_entries:
                res_id = cs_entry.get("res_id")
                tv = cs_entry.get("term_value")
                skill_effs = cs_entry.get("skillEffs", [])
                print(f"      cs_inst[{cs_inst_id}] res={res_id} term_value={tv} skillEffs={skill_effs}")
                for seid in skill_effs:
                    entry = skill_map.get(str(seid))
                    if entry is None:
                        print(f"        skillMap[{seid}] NOT FOUND")
                        continue
                    ev = entry.get("eff_value")
                    eopts = entry.get("eff_opts", [])
                    parent = entry.get("parent", {})
                    eres = entry.get("res_id")
                    print(f"        skillMap[{seid}] res={eres} eff_value={ev} opts={eopts} parent={parent}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
