"""
Aggregates skill effect definitions across all client *@skill_eff.json files
into a single canonical dictionary, indexed by eff_type.

Output schema:
  {
    "<EFF_TYPE>": {
      "instances": [<full row from source>, ...],
      "params_keys": ["value_x", "value_y", ...],
      "source_files": ["card(camille)@skill_eff.json", ...],
      "instance_count": N,
      "observed_count": M,
    }
  }
"""
import json
import re
from collections import defaultdict
from pathlib import Path

CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
OUTPUT_PATH = Path(__file__).parent.parent / "snapshots" / "skill_eff_dictionary.json"


def parse_skill_eff_files(source_dir: Path) -> dict:
    out = defaultdict(lambda: {"instances": [], "params_keys": set(), "source_files": set()})
    for fp in sorted(source_dir.glob("*skill_eff*.json")):
        try:
            rows = json.loads(fp.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            # Real client data uses "eff" as the effect type key; fallbacks for synthetic/test data
            eff_type = row.get("eff") or row.get("eff_type") or row.get("type") or "UNKNOWN"
            entry = out[eff_type]
            entry["instances"].append(row)
            # Capture numeric/typed value fields: real data uses eff_value, eff_count_value, etc.
            entry["params_keys"].update(
                k for k in row.keys()
                if k in ("eff_value", "eff_count_value", "duration")
                or k.startswith("value_")
                or k.startswith("eff_value_type")
                or k.startswith("eff_condition_value")
            )
            entry["source_files"].add(fp.name)
    return {
        k: {
            "instances": v["instances"],
            "params_keys": sorted(v["params_keys"]),
            "source_files": sorted(v["source_files"]),
            "instance_count": len(v["instances"]),
        }
        for k, v in out.items()
    }


# Format: "SkillEff <num>:<res_id>:<TYPE>[:params]"
# Example: "**battle log : SkillEff 107:rr_lux_01_01_01:SKILL_EFF_DMG_IGNORE_COND"
SKILL_EFF_LINE_PATTERN = re.compile(r"SkillEff\s+\d+:[^:]+:([A-Z_][A-Z_0-9]*)")


def parse_dev_msg_skill_eff_lines(dev_msg: str) -> list[str]:
    """Extract SKILL_EFF_* types from dev_msg battle log text.

    Returns list of type names in order of appearance (with duplicates).
    """
    if not dev_msg:
        return []
    return SKILL_EFF_LINE_PATTERN.findall(dev_msg)


def cross_ref_observed_events(static_dict: dict, observed_types: list[str]) -> dict:
    """Annotate static_dict entries with observed_count from a list of observed types.

    Mutates and returns static_dict. Types not in static_dict are silently dropped
    (we only track what exists in the canonical dictionary).
    """
    counts = {}
    for t in observed_types:
        counts[t] = counts.get(t, 0) + 1
    for eff_type, entry in static_dict.items():
        entry["observed_count"] = counts.get(eff_type, 0)
    return static_dict


def load_observed_skill_effs(jsonl_dir: Path) -> list[str]:
    """Walk all websocket_debug_*.jsonl files and extract every SkillEff type observed."""
    all_types: list[str] = []
    for fp in sorted(jsonl_dir.glob("websocket_debug_*.jsonl")):
        with fp.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    frame = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(frame, dict):
                    continue
                data = frame.get("data") or {}
                if not isinstance(data, dict):
                    continue
                dev_msg = data.get("dev_msg")
                if isinstance(dev_msg, str) and "SkillEff" in dev_msg:
                    all_types.extend(parse_dev_msg_skill_eff_lines(dev_msg))
    return all_types


def main():
    import os
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result = parse_skill_eff_files(CLIENT_DB)

    snap_dir = Path(os.environ.get("LOCALAPPDATA", "")) / "hub-czn" / "snapshots"
    observed_types = load_observed_skill_effs(snap_dir)
    result = cross_ref_observed_events(result, observed_types)

    OUTPUT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    observed_count = sum(1 for v in result.values() if v.get("observed_count", 0) > 0)
    print(f"Wrote {len(result)} eff_types ({observed_count} observed in dev_msg, "
          f"total observations: {len(observed_types)}) to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
