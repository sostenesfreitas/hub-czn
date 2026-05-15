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
            d = obj.get("data") or {}
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

    # Bug A fix: override the stale memory_fragments level/ascend with battle-time values.
    # optimizer.character_info[char_name] is populated from the loaded memory_fragments file,
    # which may be stale (e.g., a character captured at a different point in time).
    # The battle frame carries the authoritative level and ascend at the time of capture.
    battle_level = char.get("level")
    battle_ascend = char.get("ascend")
    info = optimizer.character_info.get(char_name) if char_name else None
    _saved_level = None
    _saved_ascend = None
    if info is not None and battle_level is not None:
        _saved_level, _saved_ascend = info.level, info.ascend
        info.level = battle_level
        if battle_ascend is not None:
            info.ascend = battle_ascend

    try:
        predicted = optimizer.calculate_build_stats(gear, char_name)
    except Exception as e:
        return {"char_name": char_name, "res_id": res_id, "error": str(e)}
    finally:
        # Restore overridden values so subsequent calls are not affected.
        if info is not None and _saved_level is not None:
            info.level = _saved_level
            info.ascend = _saved_ascend

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


def _aggregate_and_print(rows: list, errors: list, label: str = "") -> dict:
    """Aggregate per-stat diffs from rows, print table + worst offenders, return summary dict."""
    agg = defaultdict(lambda: {"abs_diffs": [], "pct_diffs": []})
    for r in rows:
        for stat, d in r["diffs"].items():
            agg[stat]["abs_diffs"].append(d["abs_diff"])
            agg[stat]["pct_diffs"].append(d["pct_diff"])

    header = f"Stat formula validation: {len(rows)} unique (char, gear) samples"
    if label:
        header += f"  [{label}]"
    print()
    print("=" * 78)
    print(header)
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

    return summary


def run_batch(snapshot_dir: Path, optimizer: GearOptimizer, out_path: Path | None = None) -> dict:
    """Run validation across ALL websocket_debug_*.jsonl files in snapshot_dir.

    Returns the aggregated summary dict (same shape as single-capture mode).
    """
    jsonl_files = sorted(snapshot_dir.glob("websocket_debug_*.jsonl"))
    if not jsonl_files:
        print(f"No websocket_debug_*.jsonl files found in {snapshot_dir}", file=sys.stderr)
        sys.exit(2)

    print(f"Batch mode: found {len(jsonl_files)} capture file(s) in {snapshot_dir}")

    all_rows: list = []
    all_errors: list = []
    # Use a global dedup key across all captures so cross-file duplicates are
    # also removed (same char snapshot appearing in two capture files).
    global_seen: set = set()

    for jsonl_path in jsonl_files:
        file_rows = []
        file_errors = []
        print(f"  Scanning {jsonl_path.name} ...")
        for i, char in _iter_chars_messages(jsonl_path):
            eq = char.get("equipped_pieces") or {}
            eq_ids = tuple(sorted(
                p.get("id") for p in eq.values() if isinstance(p, dict)
            ))
            global_key = (char.get("res_id"), eq_ids)
            if global_key in global_seen:
                continue
            global_seen.add(global_key)

            result = _compare(char, optimizer)
            if result is None:
                continue
            if "error" in result:
                file_errors.append(result)
                continue
            result["_source"] = jsonl_path.name
            file_rows.append(result)

        print(f"    -> {len(file_rows)} rows, {len(file_errors)} errors")
        all_rows.extend(file_rows)
        all_errors.extend(file_errors)

    if not all_rows:
        print("No comparable chars found across any capture. Did they include battle data?")
        sys.exit(1)

    summary = _aggregate_and_print(all_rows, all_errors, label=f"{len(jsonl_files)} captures")

    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            json.dumps({"summary": summary, "rows": all_rows, "errors": all_errors},
                       ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\nDetailed report -> {out_path}")

    return summary


def main():
    ap = argparse.ArgumentParser(
        description="Validate optimizer stat formula against captured game data."
    )
    ap.add_argument("capture", type=Path, nargs="?",
                    help="websocket_debug_*.jsonl  (omit when --batch is used)")
    ap.add_argument("memory_fragments", type=Path, nargs="?",
                    help="memory_fragments_*.json  (omit when --batch is used)")
    ap.add_argument("--out", type=Path, default=None, help="write detailed report json")
    ap.add_argument(
        "--batch", type=Path, default=None, metavar="SNAPSHOT_DIR",
        help=(
            "Run across ALL websocket_debug_*.jsonl files in SNAPSHOT_DIR. "
            "The latest memory_fragments_*.json in that dir is used automatically."
        ),
    )
    args = ap.parse_args()

    if args.batch is not None:
        # ---- BATCH MODE ----
        snapshot_dir = args.batch
        if not snapshot_dir.is_dir():
            print(f"snapshot_dir not found: {snapshot_dir}", file=sys.stderr)
            sys.exit(2)

        # Pick the latest memory_fragments file by mtime
        mf_files = sorted(snapshot_dir.glob("memory_fragments_*.json"),
                          key=lambda p: p.stat().st_mtime)
        if not mf_files:
            print(f"No memory_fragments_*.json found in {snapshot_dir}", file=sys.stderr)
            sys.exit(2)
        mf_path = mf_files[-1]
        print(f"Using latest memory_fragments: {mf_path.name}")

        optimizer = GearOptimizer()
        optimizer.load_data(str(mf_path))

        run_batch(snapshot_dir, optimizer, out_path=args.out)
        return

    # ---- SINGLE-CAPTURE MODE ----
    if args.capture is None or args.memory_fragments is None:
        ap.error("positional args 'capture' and 'memory_fragments' are required "
                 "unless --batch is used")

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

    summary = _aggregate_and_print(rows, errors)

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(
            json.dumps({"summary": summary, "rows": rows, "errors": errors},
                       ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\nDetailed report -> {args.out}")


if __name__ == "__main__":
    main()
