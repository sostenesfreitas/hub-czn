"""Parse SkillEff lines from a websocket_debug_*.jsonl capture and emit:

  - skill_eff_schema.json: {EFF_TYPE: {count, param_keys, examples}}
  - equip_effects.json:    {equip_res_id (leaf + base): {count, effects[...]}}

Usage:
  python -m api.capture.analyze_dev_msg <path-to.jsonl> [<output-dir>]
"""

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path


SKILL_EFF_RE = re.compile(
    r"^SkillEff\s+(?P<slot>\d+):(?P<source>[^:]+):(?P<eff>SKILL_EFF_\w+)(?::(?P<rest>.*))?$"
)
PARAM_RE = re.compile(r"([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(\[[^\]]*\]|\S+)")
EQ_BASE_RE = re.compile(r"^(eq_[a-z0-9]+_\d+)")  # eq_pub_032_01_01 -> eq_pub_032


def split_devmsg(dm: str):
    for raw in dm.split("**battle log :"):
        raw = raw.strip()
        if raw:
            yield raw


def parse_params(rest: str):
    if not rest:
        return {}
    return {k: v for k, v in PARAM_RE.findall(rest)}


def equip_base(source_id: str):
    m = EQ_BASE_RE.match(source_id)
    return m.group(1) if m else None


def main():
    if len(sys.argv) < 2:
        print("usage: analyze_dev_msg.py <jsonl> [out-dir]", file=sys.stderr)
        sys.exit(2)
    src = Path(sys.argv[1])
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else src.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    schema = defaultdict(lambda: {
        "count": 0,
        "param_keys": Counter(),
        "examples": [],
        "source_id_kinds": Counter(),
    })
    equip_leaf = defaultdict(lambda: {"count": 0, "effects": Counter(), "examples": []})
    equip_base_agg = defaultdict(lambda: {
        "count": 0,
        "leaves": Counter(),
        "effects": Counter(),
    })

    n_lines = 0
    n_skill_eff = 0
    n_messages = 0

    with src.open("r", encoding="utf-8") as f:
        for raw_line in f:
            try:
                obj = json.loads(raw_line)
            except json.JSONDecodeError:
                continue
            dm = obj.get("data", {}).get("dev_msg")
            if not dm:
                continue
            n_messages += 1
            for line in split_devmsg(dm):
                n_lines += 1
                m = SKILL_EFF_RE.match(line)
                if not m:
                    continue
                n_skill_eff += 1
                source = m.group("source")
                eff = m.group("eff")
                rest = m.group("rest") or ""
                params = parse_params(rest)

                e = schema[eff]
                e["count"] += 1
                for k in params:
                    e["param_keys"][k] += 1
                # crude source kind classifier
                kind = (
                    "equip" if source.startswith("eq_")
                    else "card" if source.startswith("c_") or source.startswith("cs")
                    else "char_skill" if re.match(r"\d+_c\d+_", source)
                    else "ego_relic" if source.startswith("rr_")
                    else "potential" if source.startswith("add_r_spark") or "_pt" in source
                    else "other"
                )
                e["source_id_kinds"][kind] += 1
                if len(e["examples"]) < 5:
                    e["examples"].append(line[:300])

                if source.startswith("eq_"):
                    leaf = equip_leaf[source]
                    leaf["count"] += 1
                    leaf["effects"][eff] += 1
                    if len(leaf["examples"]) < 3:
                        leaf["examples"].append(line[:300])
                    base = equip_base(source)
                    if base:
                        b = equip_base_agg[base]
                        b["count"] += 1
                        b["leaves"][source] += 1
                        b["effects"][eff] += 1

    # serialize
    schema_out = {}
    for eff, v in sorted(schema.items(), key=lambda x: -x[1]["count"]):
        schema_out[eff] = {
            "count": v["count"],
            "param_keys": dict(v["param_keys"].most_common()),
            "source_id_kinds": dict(v["source_id_kinds"].most_common()),
            "examples": v["examples"],
        }

    leaf_out = {}
    for src_id, v in sorted(equip_leaf.items(), key=lambda x: -x[1]["count"]):
        leaf_out[src_id] = {
            "count": v["count"],
            "effects": dict(v["effects"].most_common()),
            "examples": v["examples"],
        }

    base_out = {}
    for base, v in sorted(equip_base_agg.items(), key=lambda x: -x[1]["count"]):
        base_out[base] = {
            "count": v["count"],
            "effects": dict(v["effects"].most_common()),
            "leaves": dict(v["leaves"].most_common()),
        }

    summary = {
        "source_file": str(src),
        "messages_with_dev_msg": n_messages,
        "battle_log_lines": n_lines,
        "skill_eff_lines": n_skill_eff,
        "distinct_eff_types": len(schema_out),
        "distinct_equip_leaves": len(leaf_out),
        "distinct_equip_bases": len(base_out),
    }

    (out_dir / "skill_eff_schema.json").write_text(
        json.dumps({"summary": summary, "by_type": schema_out}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out_dir / "equip_effects.json").write_text(
        json.dumps(
            {"summary": summary, "by_leaf": leaf_out, "by_base": base_out},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(json.dumps(summary, indent=2))
    print()
    print(f"wrote {out_dir / 'skill_eff_schema.json'}")
    print(f"wrote {out_dir / 'equip_effects.json'}")


if __name__ == "__main__":
    main()
