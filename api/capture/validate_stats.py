"""Validate the optimizer's stat formula against game-computed stats from a capture.

For each chars[] message in a websocket_debug_*.jsonl capture, build a synthetic
gear list from equipped_pieces, run optimizer.calculate_build_stats(), and compare
the predicted ATK/DEF/HP/CRate/CDmg to the game's status.info values.

Usage:
  python -m api.capture.validate_stats <capture.jsonl> <memory_fragments_*.json> [--out report.json]
"""

import argparse
import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

# Make the project's `optimizer` package importable (mirrors api/state.py)
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.optimizer.optimizer import GearOptimizer
from api.models.memory_fragment import MemoryFragment
from game_data import get_character_name


# Game stat key  ->  optimizer stat key
STAT_MAP = {
    "S_ATK": "ATK",
    "S_DEF": "DEF",
    "S_HP": "HP",
    "S_CRI": "CRate",
    "S_CRI_DMG_RATE": "CDmg",
}


def _piece_dict_to_modeldict(slot_key: str, piece: dict) -> dict:
    """Convert one entry of chars[].equipped_pieces (keyed by ITEM_PIECE_N)
    into the schema MemoryFragment.from_json expects. The game returns the
    same payload either way; we just align field names and ensure char_res_id
    is propagated so the model resolves equipped_to."""
    return {
        "id": piece["id"],
        "res_id": piece["res_id"],
        "level": piece.get("level", 0),
        "lock": piece.get("lock", 0),
        "char_res_id": piece.get("char_res_id", 0),
        "stat_list": piece.get("stat_list", []),
    }


def _build_gear(char: dict) -> list[MemoryFragment]:
    eq = char.get("equipped_pieces") or {}
    if not isinstance(eq, dict):
        return []
    gear = []
    for slot_key, piece in eq.items():
        if not isinstance(piece, dict):
            continue
        try:
            mf = MemoryFragment.from_json(_piece_dict_to_modeldict(slot_key, piece))
            gear.append(mf)
        except Exception as e:
            print(f"  warn: could not parse piece {piece.get('id')} ({slot_key}): {e}", file=sys.stderr)
    return gear


def _iter_chars_messages(jsonl_path: Path):
    """Yield (line_index, char_dict) for every char that has both equipped_pieces
    AND status.info in the capture. Skips synthetic placeholder chars (negative ids)."""
    seen_keys = set()  # dedup: same (char_id, equipped_piece_ids tuple) only once
    with jsonl_path.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            d = obj.get("data", {})
            chars = d.get("chars")
            if not isinstance(chars, list):
                continue
            for char in chars:
                if not isinstance(char, dict):
                    continue
                if char.get("res_id", 0) < 0:
                    continue  # synthetic supporter slot
                eq = char.get("equipped_pieces")
                stat = char.get("status", {}).get("info") if isinstance(char.get("status"), dict) else None
                if not eq or not stat:
                    continue
                eq_ids = tuple(sorted((piece.get("id") for piece in eq.values()
                                       if isinstance(piece, dict))))
                key = (char.get("res_id"), eq_ids)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                yield i, char


def _compare(char: dict, optimizer: GearOptimizer) -> dict | None:
    res_id = char.get("res_id")
    char_name = get_character_name(res_id) if res_id else None
    if not char_name or char_name == f"Character {res_id}":
        return None

    gear = _build_gear(char)
    if not gear:
        return None

    try:
        predicted = optimizer.calculate_build_stats(gear, char_name)
    except Exception as e:
        return {"char_name": char_name, "res_id": res_id, "error": str(e)}

    info = char["status"]["info"]
    diffs = {}
    for game_key, opt_key in STAT_MAP.items():
        observed = info.get(game_key)
        pred = predicted.get(opt_key)
        if observed is None or pred is None:
            continue
        abs_diff = pred - observed
        pct_diff = (abs_diff / observed * 100) if observed else 0.0
        diffs[opt_key] = {
            "observed": round(observed, 2),
            "predicted": round(pred, 2),
            "abs_diff": round(abs_diff, 2),
            "pct_diff": round(pct_diff, 2),
        }

    return {
        "char_name": char_name,
        "res_id": res_id,
        "level": char.get("level"),
        "ascend": char.get("ascend"),
        "n_pieces": len(gear),
        "diffs": diffs,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("capture", type=Path, help="websocket_debug_*.jsonl")
    ap.add_argument("memory_fragments", type=Path,
                    help="memory_fragments_*.json (loaded into optimizer for char data)")
    ap.add_argument("--out", type=Path, default=None, help="write detailed report json")
    args = ap.parse_args()

    if not args.capture.exists():
        print(f"capture not found: {args.capture}", file=sys.stderr)
        sys.exit(2)
    if not args.memory_fragments.exists():
        print(f"memory_fragments not found: {args.memory_fragments}", file=sys.stderr)
        sys.exit(2)

    print(f"Loading optimizer with {args.memory_fragments.name} ...")
    optimizer = GearOptimizer()
    optimizer.load_data(str(args.memory_fragments))

    rows = []
    errors = []
    print(f"Scanning {args.capture.name} ...")
    for i, char in _iter_chars_messages(args.capture):
        result = _compare(char, optimizer)
        if result is None:
            continue
        if "error" in result:
            errors.append(result)
            continue
        rows.append(result)

    if not rows:
        print("No comparable chars found. Did the capture include battle data?")
        sys.exit(1)

    # aggregate per stat
    agg = defaultdict(lambda: {"abs_diffs": [], "pct_diffs": []})
    for r in rows:
        for stat, d in r["diffs"].items():
            agg[stat]["abs_diffs"].append(d["abs_diff"])
            agg[stat]["pct_diffs"].append(d["pct_diff"])

    print()
    print("=" * 78)
    print(f"Stat formula validation: {len(rows)} unique (char, gear) samples")
    if errors:
        print(f"  ({len(errors)} errors -- see report)")
    print("=" * 78)
    print(f"{'STAT':<8} {'N':>4} {'mean_abs':>10} {'mean_pct':>10} {'median_pct':>12} {'max_abs_pct':>14} {'within_1pct':>12}")
    summary = {}
    for stat in ("ATK", "DEF", "HP", "CRate", "CDmg"):
        a = agg[stat]
        if not a["abs_diffs"]:
            continue
        n = len(a["abs_diffs"])
        mean_abs = statistics.mean(a["abs_diffs"])
        mean_pct = statistics.mean(a["pct_diffs"])
        median_pct = statistics.median(a["pct_diffs"])
        max_abs_pct = max(abs(p) for p in a["pct_diffs"])
        within_1 = sum(1 for p in a["pct_diffs"] if abs(p) < 1.0)
        within_pct = within_1 / n * 100
        print(f"{stat:<8} {n:>4} {mean_abs:>10.2f} {mean_pct:>+10.2f} {median_pct:>+12.2f} {max_abs_pct:>14.2f} {within_pct:>11.1f}%")
        summary[stat] = {
            "n": n, "mean_abs": round(mean_abs, 3), "mean_pct": round(mean_pct, 3),
            "median_pct": round(median_pct, 3), "max_abs_pct": round(max_abs_pct, 3),
            "within_1pct_count": within_1, "within_1pct_rate": round(within_pct, 1),
        }

    # worst offenders per stat
    print()
    print("Worst offenders per stat (top 3 by |pct_diff|):")
    for stat in ("ATK", "DEF", "HP", "CRate", "CDmg"):
        worst = sorted(
            (r for r in rows if stat in r["diffs"]),
            key=lambda r: abs(r["diffs"][stat]["pct_diff"]),
            reverse=True,
        )[:3]
        if not worst:
            continue
        print(f"  {stat}:")
        for r in worst:
            d = r["diffs"][stat]
            print(f"    {r['char_name']:<14} L{r['level']}+{r['ascend']}  "
                  f"observed={d['observed']:>8}  predicted={d['predicted']:>8}  "
                  f"diff={d['pct_diff']:+.2f}%")

    if args.out:
        args.out.write_text(
            json.dumps({"summary": summary, "rows": rows, "errors": errors},
                       ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\nDetailed report -> {args.out}")


if __name__ == "__main__":
    main()
