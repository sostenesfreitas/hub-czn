# scripts/build_eff_catalog_scaffold.py
"""
Phase A of the eff_type catalog build. Reads client JSONs and capture sessions,
emits api/data/eff_type_catalog.json with deterministically derivable fields
populated and semantic fields left null for Phase B.

Re-runnable: if the output file exists, manually-filled semantic fields are
preserved (merge-by-id); auto-derived fields (counts, links, params_used) are
refreshed.

Run:
  python scripts/build_eff_catalog_scaffold.py
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
SNAPSHOT_DIR = REPO / "api" / "snapshots"
CAPTURE_DIR = Path.home() / "AppData" / "Local" / "hub-czn" / "snapshots"
OUTPUT_PATH = REPO / "api" / "data" / "eff_type_catalog.json"
AUDIT_PATH = REPO / "docs" / "research" / "eff_catalog_audit.md"

EXTRA_UNOBSERVED = {
    "SKILL_EFF_DAMAGE_VALUE_ADD",
    "SKILL_EFF_SHIELD_VALUE_ADD",
    "SKILL_EFF_CURE_VALUE_ADD",
    "SKILL_EFF_CRITICAL_PCT_VALUE_ADD",
    "SKILL_EFF_COUNT_VALUE_ADDITIONAL",
    "SKILL_EFF_TARGET_CS_VALUE_ADD",
    "SKILL_EFF_CARD_COST_CHANGE",
}
EXCLUDED_UNOBSERVED = {"SKILL_EFF_TUTORIAL", "SKILL_EFF_RUN", "SKILL_EFF_CURRENCY_ADD"}

CATEGORY_BY_PREFIX = [
    ("SKILL_EFF_DMG", "damage"),
    ("SKILL_EFF_DAMAGE", "damage"),
    ("SKILL_EFF_SHIELD", "shield"),
    ("SKILL_EFF_HEAL", "heal"),
    ("SKILL_EFF_CURE", "heal"),
    ("SKILL_EFF_CS_", "cs_management"),
    ("SKILL_EFF_CARD_", "card_control"),
    ("SKILL_EFF_STRESS", "status"),
    ("SKILL_EFF_CRITICAL", "stat_mod"),
    ("SKILL_EFF_COUNT_VALUE", "stat_mod"),
    ("SKILL_EFF_TARGET_CS", "stat_mod"),
]
DEFAULT_CATEGORY = "meta"


def infer_category(eff_type: str) -> str:
    for prefix, cat in CATEGORY_BY_PREFIX:
        if eff_type.startswith(prefix):
            return cat
    return DEFAULT_CATEGORY


def load_existing_catalog() -> dict:
    if OUTPUT_PATH.exists():
        return json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    return {}


def load_skill_eff_instances() -> list[dict]:
    """Read all *skill_eff.json shards and flatten to one big list."""
    instances = []
    for shard in CLIENT_DB.glob("*skill_eff.json"):
        if shard.stat().st_size <= 2:
            continue
        data = json.loads(shard.read_text(encoding="utf-8"))
        if isinstance(data, list):
            instances.extend(data)
        elif isinstance(data, dict):
            instances.extend(data.values())
    return instances


def load_observed_counts() -> dict[str, int]:
    """Count SkillEff lines in capture dev_msg streams, grouped by eff_type."""
    pattern = re.compile(r"SkillEff\s+\d+:\d+:([A-Z_]+)")
    counts: Counter[str] = Counter()
    sources = list(CAPTURE_DIR.glob("websocket_debug_*.jsonl")) + list(SNAPSHOT_DIR.glob("websocket_debug_*.jsonl"))
    for src in sources:
        for line in src.open(encoding="utf-8", errors="ignore"):
            for m in pattern.findall(line):
                counts[m] += 1
    return dict(counts)


def detect_params_used(instances: list[dict]) -> list[str]:
    """Return keys whose value varies across instances (i.e., are actually parameters)."""
    if not instances:
        return []
    first = instances[0]
    varying = []
    for key in first.keys():
        values = {inst.get(key) for inst in instances if key in inst}
        if len(values) > 1:
            varying.append(key)
    return sorted(varying)


def majority_target(instances: list[dict]) -> str | None:
    targets = Counter(i.get("target_unit_type", "") for i in instances)
    if not targets:
        return None
    top = targets.most_common(1)[0][0]
    mapping = {
        "TARGET_UNIT_SELECTED": "selected_unit",
        "TARGET_UNIT_SELF": "self",
        "TARGET_UNIT_ALL_ENEMY": "all_enemies",
        "TARGET_UNIT_ALL_ALLY": "all_allies",
        "TARGET_UNIT_NONE": None,
    }
    return mapping.get(top)


def linked_ids(instances: list[dict], field: str) -> list[str]:
    """Collect distinct non-empty values from a list-or-id field."""
    seen = set()
    for inst in instances:
        raw = inst.get(field, "")
        if isinstance(raw, list):
            for v in raw:
                if v and v != "none":
                    seen.add(str(v))
        elif raw and raw != "none" and raw != "[]":
            for v in str(raw).strip("[]").split(","):
                v = v.strip()
                if v and v != "none":
                    seen.add(v)
    return sorted(seen)


def sample_ids(instances: list[dict], n: int = 5) -> list[str]:
    return sorted({inst.get("id", "") for inst in instances if inst.get("id")})[:n]


def build() -> dict:
    print(f"Loading client SkillEff instances from {CLIENT_DB} ...")
    all_instances = load_skill_eff_instances()
    print(f"  loaded {len(all_instances)} instances")

    by_type: dict[str, list[dict]] = defaultdict(list)
    for inst in all_instances:
        eff = inst.get("eff")
        if eff:
            by_type[eff].append(inst)

    observed = load_observed_counts()
    print(f"  observed {sum(observed.values())} SkillEff lines across {len(observed)} types")

    scope = (set(observed) | EXTRA_UNOBSERVED) - EXCLUDED_UNOBSERVED
    scope &= set(by_type)
    print(f"  catalog scope: {len(scope)} eff_types")

    existing = load_existing_catalog()
    out = {}
    for eff_type in sorted(scope):
        instances = by_type[eff_type]
        prev = existing.get(eff_type, {})
        out[eff_type] = {
            "category": prev.get("category") or infer_category(eff_type),
            "trigger": prev.get("trigger"),
            "target_resolution": prev.get("target_resolution") or majority_target(instances),
            "effect": prev.get("effect") or {"kind": None, "formula_ref": None},
            "stack_rule": prev.get("stack_rule"),
            "params_used": detect_params_used(instances),
            "confidence": prev.get("confidence", "unknown"),
            "observed_count": observed.get(eff_type, 0),
            "client_instances": len(instances),
            "linked_conditions": linked_ids(instances, "eff_link_condition_id"),
            "linked_cs_ids": linked_ids(instances, "link_cs_id"),
            "notes": prev.get("notes", ""),
            "todos": prev.get("todos") or _make_initial_todos(prev),
        }
    return out


def _make_initial_todos(prev: dict) -> list[str]:
    if prev:
        return []
    return ["fill trigger", "fill effect.kind", "fill effect.formula_ref", "fill stack_rule"]


def write_audit(catalog: dict):
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for eff, body in sorted(catalog.items(), key=lambda kv: -kv[1]["observed_count"]):
        rows.append(
            f"| `{eff}` | {body['category']} | {body['observed_count']} | {body['client_instances']} | "
            f"{body['target_resolution'] or '?'} | {len(body['linked_conditions'])} | {len(body['linked_cs_ids'])} |"
        )
    AUDIT_PATH.write_text(
        "# eff_type Catalog Audit\n\nGenerated by `scripts/build_eff_catalog_scaffold.py`.\n\n"
        "| eff_type | category | observed | client | target | #conds | #cs |\n"
        "|---|---|---|---|---|---|---|\n"
        + "\n".join(rows) + "\n",
        encoding="utf-8",
    )


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    catalog = build()
    OUTPUT_PATH.write_text(json.dumps(catalog, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    write_audit(catalog)
    print(f"Wrote {len(catalog)} entries to {OUTPUT_PATH}")
    print(f"Wrote audit to {AUDIT_PATH}")


if __name__ == "__main__":
    main()
