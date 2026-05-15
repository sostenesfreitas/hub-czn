"""Print detailed rows from the stat validation report."""
import json
from pathlib import Path

r = json.loads(Path("api/snapshots/stat_validation_report.json").read_text(encoding="utf-8"))
for row in r["rows"]:
    name = row.get("char_name")
    level = row.get("level")
    ascend = row.get("ascend")
    pieces = row.get("n_pieces")
    source = row.get("_source", "?")
    print(f"{name} L{level}+{ascend} pieces={pieces} source={source}")
    for stat, d in row.get("diffs", {}).items():
        obs = d["observed"]
        pred = d["predicted"]
        pct = d["pct_diff"]
        print(f"  {stat}: obs={obs} pred={pred} pct={pct:+.2f}%")
    print()
