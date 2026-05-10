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
    }
  }
"""
import json
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


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result = parse_skill_eff_files(CLIENT_DB)
    OUTPUT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(result)} eff_types to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
