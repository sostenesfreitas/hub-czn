"""Empirical verification for Sprint 2f3 T2.

Replays the LBK capture and dumps state.dva_stacks[caster_id] for each
c_1052_uni4_lbk dispatched event. Confirms that Sprint 2f3 T1 (accumulator
fix) makes caster-side cs01_0805 visible at fire time.

Usage: python scripts/inspect_lbk_caster_state.py
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
from api.simulator import formulas as F


CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
CATALOG = REPO / "api" / "data" / "eff_type_catalog.json"
CAP = Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260510_154057.jsonl")


def main() -> int:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    instances = EffInstanceIndex(CLIENT_DB)

    fired_caster_stacks = []

    orig = F._formula_base_damage
    def patched(inst, caster, targets, state):
        result = orig(inst, caster, targets, state)
        if inst.id.startswith("c_1052_uni4_lbk"):
            dva = getattr(state, "dva_stacks", None)
            caster_stacks = dict(dva.get(str(caster.id), {})) if dva else {}
            fired_caster_stacks.append((inst.id, str(caster.id), caster_stacks, result.damage if not getattr(result, "skipped", False) else 0))
        return result
    F._formula_base_damage = patched
    F.FORMULA_REGISTRY["F_BASE_DMG"] = patched
    F.FORMULA_REGISTRY["F_DMG_COOP"] = patched

    runtime = Runtime(catalog=catalog, instances=instances)
    harness = ReplayHarness(runtime, StateReconstructor())
    summary, reports = harness.replay(CaptureReader(CAP))

    lbk_reports = [r for r in reports if r.skill_eff_id.startswith("c_1052_uni4_lbk") and r.status == "dispatched"]
    measurable = [r for r in lbk_reports if r.obs_damage is not None]

    print(f"=== Sprint 2f3 T2 — Caster-side state.dva_stacks at LBK fire times ===")
    print(f"Total c_1052_uni4_lbk dispatched: {len(lbk_reports)}")
    print(f"With obs_damage (measurable): {len(measurable)}")
    print()

    has_lbk_stack = sum(1 for _, _, st, _ in fired_caster_stacks if "cs01_0805" in st)
    print(f"LBK fires where caster_dva_stacks contains 'cs01_0805': {has_lbk_stack} / {len(fired_caster_stacks)}")
    print()
    print("First 10 LBK fires' caster_stacks (truncated to 8 stacks per fire):")
    for i, (skill_eff_id, caster_id, caster_stacks, sim) in enumerate(fired_caster_stacks[:10]):
        print(f"  fire {i+1}: skill_eff_id={skill_eff_id} caster={caster_id} sim={sim} stacks={len(caster_stacks)}")
        for j, (k, v) in enumerate(sorted(caster_stacks.items())[:8]):
            mark = "  ← LBK charging stack" if k == "cs01_0805" else ""
            print(f"    {k}={v}{mark}")
    print()
    print("Measurable LBK hits (sim, obs, ratio):")
    for r in measurable[:10]:
        ratio = (r.obs_damage / r.sim_damage) if r.sim_damage else 0.0
        print(f"  seq={r.seq} target={r.target_id} sim={r.sim_damage} obs={r.obs_damage} ratio={ratio:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
