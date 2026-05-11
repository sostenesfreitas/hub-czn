"""Sprint 2f3 T3 - empirical investigation via cs_map_raw.

For each measurable LBK hit in the capture:
- Find snapshot frame where lastDamageEvent matches
- Extract cs_map_raw entries with caster_id == caster.id at fire time
- Cross-reference with CSMultiplierIndex
- Compute candidate formulas for MATHSIGN_ADD modifiers

Usage: python scripts/inspect_lbk_csmap_caster_entries.py
"""
import json
import sys
import math
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from api.game_data.eff_instances import EffInstanceIndex
from api.simulator.runtime import Runtime
from api.simulator.replay.capture_reader import CaptureReader
from api.simulator.replay.reconstructor import StateReconstructor
from api.simulator.replay.harness import ReplayHarness
from api.game_data.cs_multipliers import CSMultiplierIndex

CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
CATALOG = REPO / "api" / "data" / "eff_type_catalog.json"

CAP_LBK_RICH = Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260510_154057.jsonl")
CAP_C30093 = Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260509_111039.jsonl")
CAP_LBK_LOW = Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots\websocket_debug_20260505_104037.jsonl")


def load_frames(cap_path: Path) -> list:
    """Return one entry per line: the battle_wt dict, or None."""
    frames = []
    if not cap_path.exists():
        return frames
    for line in cap_path.open("r", encoding="utf-8"):
        try:
            raw = json.loads(line)
        except json.JSONDecodeError:
            frames.append(None)
            continue
        data = raw.get("data")
        if not isinstance(data, dict):
            frames.append(None)
            continue
        snap = data.get("snapshot")
        bw = (snap.get("cache") or {}).get("battle_wt") if isinstance(snap, dict) else None
        frames.append(bw if isinstance(bw, dict) else None)
    return frames


def find_snapshot_for_hit(all_frames: list, target_id: str, obs_damage: int) -> tuple:
    """Linear search for first battle_wt where monster[target_id].lastDamageEvent.damage == obs_damage."""
    for line_idx, bw in enumerate(all_frames):
        if not isinstance(bw, dict):
            continue
        mons = bw.get("monsters", [])
        tm = next((m for m in mons if str(m.get("id")) == target_id), None)
        if tm is None:
            continue
        lde = tm.get("lastDamageEvent") or {}
        if lde.get("damage") == obs_damage:
            return bw, line_idx
    return None, None


CANDIDATES = {
    "(a) eff": lambda eff, tv: eff,
    "(b) eff*tv/100": lambda eff, tv: eff * tv / 100.0,
    "(c) eff*tv": lambda eff, tv: eff * tv,
    "(d) eff+tv": lambda eff, tv: eff + tv,
    "(e) eff*log(tv+1)": lambda eff, tv: eff * math.log(tv + 1) if tv > 0 else 0.0,
}


def compute_flat_add(cs_map: dict, idx: CSMultiplierIndex, caster_id: str,
                     cand_fn) -> tuple:
    """Returns (flat_add_pct, contrib_list).

    contrib_list: list of (cs_inst, res_id, tv, eff_value, sign, contribution)
    """
    flat_add_pct = 0.0
    contribs = []
    for k, cs_entry in cs_map.items():
        if not isinstance(cs_entry, dict):
            continue
        if str(cs_entry.get("caster_id")) != caster_id:
            continue
        try:
            tv = int(cs_entry.get("term_value", 0) or 0)
        except (TypeError, ValueError):
            tv = 0
        if tv <= 0:
            continue
        res_id = cs_entry.get("res_id", "")
        for m in idx.lookup(res_id):
            if m.direction != "attack":
                continue
            if m.link_cs_id:
                continue
            if m.sign != "MATHSIGN_ADD":
                continue
            c = cand_fn(m.eff_value, tv)
            flat_add_pct += c
            contribs.append((k, res_id, tv, m.eff_value, m.sign, c))
    return flat_add_pct, contribs


def report_hit(label: str, r, all_frames: list, idx: CSMultiplierIndex,
               caster_candidates: tuple) -> None:
    ratio = (r.obs_damage / r.sim_damage) if r.sim_damage else 0.0
    print(f"--- {label} seq={r.seq} target={r.target_id} sim={r.sim_damage} obs={r.obs_damage} ratio={ratio:.4f} ---")
    target_id = str(r.target_id)
    bw, line_idx = find_snapshot_for_hit(all_frames, target_id, r.obs_damage)
    if bw is None:
        print(f"  NO snapshot frame found with lde.damage={r.obs_damage} for target={target_id}")
        return
    print(f"  matched snapshot at line {line_idx}")
    cs_map = bw.get("csMap", {})
    for cand_caster_id in caster_candidates:
        entries = []
        for k, cs_entry in cs_map.items():
            if not isinstance(cs_entry, dict):
                continue
            if str(cs_entry.get("caster_id")) == cand_caster_id:
                entries.append((k, cs_entry))
        print(f"  csMap entries with caster_id={cand_caster_id}: {len(entries)}")
        for k, cs_entry in entries[:40]:
            res_id = cs_entry.get("res_id")
            tv = cs_entry.get("term_value")
            owner = cs_entry.get("owner_id")
            mods = idx.lookup(res_id)
            attack_mods = [m for m in mods if m.direction == "attack" and not m.link_cs_id]
            mods_str = ""
            if attack_mods:
                mods_str = " | mods: " + ", ".join(
                    f"eff={m.eff_value} sign={m.sign}" for m in attack_mods
                )
            print(f"    cs_inst[{k}] res={res_id} tv={tv} owner={owner}{mods_str}")


def eval_candidates(label: str, r, all_frames: list, idx: CSMultiplierIndex,
                    caster_id: str) -> None:
    ratio = (r.obs_damage / r.sim_damage) if r.sim_damage else 0.0
    target_id = str(r.target_id)
    bw, _ = find_snapshot_for_hit(all_frames, target_id, r.obs_damage)
    if bw is None:
        print(f"  {label} seq={r.seq}: NO snapshot")
        return
    cs_map = bw.get("csMap", {})
    print(f"  {label} seq={r.seq} sim={r.sim_damage} obs={r.obs_damage} ratio={ratio:.4f}")
    for cand_name, cand_fn in CANDIDATES.items():
        flat_add_pct, contribs = compute_flat_add(cs_map, idx, caster_id, cand_fn)
        v2_mult = 1.0 + flat_add_pct / 100.0
        predicted = r.sim_damage * v2_mult
        err_pct = (predicted - r.obs_damage) / r.obs_damage * 100 if r.obs_damage else 0.0
        within = "WITHIN_5PCT" if abs(err_pct) <= 5.0 else ""
        print(
            f"    cand={cand_name:18s} flat_add={flat_add_pct:9.2f} "
            f"v2_mult={v2_mult:.4f} predicted={predicted:8.0f} "
            f"obs={r.obs_damage} err={err_pct:+7.1f}% {within}"
        )


def replay_capture(cap_path: Path):
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    instances = EffInstanceIndex(CLIENT_DB)
    runtime = Runtime(catalog=catalog, instances=instances)
    harness = ReplayHarness(runtime, StateReconstructor())
    summary, reports = harness.replay(CaptureReader(cap_path))
    return summary, reports


def main() -> int:
    idx = CSMultiplierIndex()

    # === LBK rich capture ===
    print("=" * 78)
    print(f"=== Sprint 2f3 T3 - cs_map_raw analysis for LBK hits ===")
    print(f"=== Capture: {CAP_LBK_RICH.name}")
    print("=" * 78)
    _, reports = replay_capture(CAP_LBK_RICH)
    all_frames = load_frames(CAP_LBK_RICH)
    lbk_hits = [
        r for r in reports
        if r.skill_eff_id.startswith("c_1052_uni4_lbk")
        and r.status == "dispatched"
        and r.obs_damage is not None
    ]
    print(f"Measurable LBK hits: {len(lbk_hits)}")
    print()

    for r in lbk_hits[:5]:
        report_hit("LBK", r, all_frames, idx, caster_candidates=("3",))
        print()

    print()
    print("=== Candidate formula evaluation (MATHSIGN_ADD only, caster_id=3) ===")
    print()
    for r in lbk_hits[:5]:
        eval_candidates("LBK", r, all_frames, idx, caster_id="3")
        print()

    # === Detailed contribution dump for seq=425 (the canonical sim=1771, obs=4197 hit) ===
    print()
    print("=== Detailed contribution dump (best candidate per hit) ===")
    for r in lbk_hits[:5]:
        target_id = str(r.target_id)
        bw, _ = find_snapshot_for_hit(all_frames, target_id, r.obs_damage)
        if bw is None:
            continue
        cs_map = bw.get("csMap", {})
        print(f"  --- seq={r.seq} sim={r.sim_damage} obs={r.obs_damage} ---")
        for cand_name, cand_fn in CANDIDATES.items():
            flat_add_pct, contribs = compute_flat_add(cs_map, idx, "3", cand_fn)
            if contribs:
                print(f"    {cand_name}: total={flat_add_pct:.2f}")
                for k, res_id, tv, ev, sign, c in contribs:
                    print(f"      cs_inst[{k}] res={res_id} tv={tv} eff={ev} sign={sign} contrib={c:.2f}")

    # === Cross-check c_30093 capture (single passing hit at seq=173 ratio 0.981) ===
    print()
    print("=" * 78)
    print(f"=== Cross-check capture: {CAP_C30093.name}")
    print("=" * 78)
    if CAP_C30093.exists():
        _, c_reports = replay_capture(CAP_C30093)
        c_frames = load_frames(CAP_C30093)
        c_hits = [
            r for r in c_reports
            if r.skill_eff_id.startswith("c_30093_srt4_rsp1")
            and r.status == "dispatched"
            and r.obs_damage is not None
        ]
        print(f"Measurable c_30093 hits: {len(c_hits)}")
        # The caster is c_30093 char. Try caster_id candidates "3", "1", "2" (all player chars).
        for r in c_hits[:5]:
            for cid in ("1", "2", "3"):
                # Quick check: are there any caster_id=cid entries at fire time?
                target_id = str(r.target_id)
                bw, _ = find_snapshot_for_hit(c_frames, target_id, r.obs_damage)
                if bw is None:
                    continue
                cs_map = bw.get("csMap", {})
                cnt = sum(
                    1 for ce in cs_map.values()
                    if isinstance(ce, dict) and str(ce.get("caster_id")) == cid
                )
                if cnt > 0:
                    print(f"  seq={r.seq} caster_candidate={cid} entries={cnt}")
            eval_candidates("C30093", r, c_frames, idx, caster_id="3")
            # Also try "1" because c_30093 was apparently char 1 in that capture
            eval_candidates("C30093", r, c_frames, idx, caster_id="1")
            eval_candidates("C30093", r, c_frames, idx, caster_id="2")
            print()
    else:
        print(f"  NOT FOUND")

    # === Cross-check LBK low capture (smaller obs values) ===
    print()
    print("=" * 78)
    print(f"=== Cross-check capture: {CAP_LBK_LOW.name}")
    print("=" * 78)
    if CAP_LBK_LOW.exists():
        _, l_reports = replay_capture(CAP_LBK_LOW)
        l_frames = load_frames(CAP_LBK_LOW)
        l_hits = [
            r for r in l_reports
            if r.skill_eff_id.startswith("c_1052_uni4_lbk")
            and r.status == "dispatched"
            and r.obs_damage is not None
        ]
        print(f"Measurable c_1052 (low) hits: {len(l_hits)}")
        for r in l_hits[:5]:
            for cid in ("1", "2", "3"):
                target_id = str(r.target_id)
                bw, _ = find_snapshot_for_hit(l_frames, target_id, r.obs_damage)
                if bw is None:
                    continue
                cs_map = bw.get("csMap", {})
                cnt = sum(
                    1 for ce in cs_map.values()
                    if isinstance(ce, dict) and str(ce.get("caster_id")) == cid
                )
                if cnt > 0:
                    print(f"  seq={r.seq} caster_candidate={cid} entries={cnt}")
            eval_candidates("LBK_LOW", r, l_frames, idx, caster_id="3")
            print()
    else:
        print(f"  NOT FOUND")

    return 0


if __name__ == "__main__":
    sys.exit(main())
