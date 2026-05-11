"""
CSMultiplierIndex: indexes SKILL_EFF_DAMAGE_VALUE_ADD instances by cs_id
across the 3 cs shards in the client db.

Public API:
    idx = CSMultiplierIndex()  # lazy-loaded on first lookup
    mods = idx.lookup("cs00_0002")  # list[DamageModifier]
    ids = idx.all_cs_ids()  # set[str]

Used by api/simulator/formulas.py:_compose_dva_multiplier to apply incoming
and outgoing damage multipliers based on observed dva_stacks at fire time.
"""
import json
import re
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path


_DEFAULT_CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
_CS_SHARDS = (
    "cs(monster)@skill_eff.json",
    "cs(card1)@skill_eff.json",
    "cs(card2)@skill_eff.json",
)
_INSTANCE_SUFFIX_RE = re.compile(r"_\d+$")


@dataclass(frozen=True)
class DamageModifier:
    """One damage modifier attached to a cs_id."""
    cs_id: str
    eff_value: int
    sign: str
    direction: str
    link_cs_id: list[str]
    source_id: str


def _parse_direction(eff_opt) -> str:
    """Parse eff_opt field into normalized direction tag."""
    if not isinstance(eff_opt, str):
        return "other"
    s = eff_opt.strip("[]").strip()
    if s == "take":
        return "take"
    if s == "attack":
        return "attack"
    return "other"


def _parse_list_field(raw) -> list[str]:
    """Parse link_cs_id-style field. May be list, '[]', 'none', or '[a,b]'."""
    if isinstance(raw, list):
        return [str(v) for v in raw if v and v != "none"]
    if not raw or raw in ("[]", "none"):
        return []
    if isinstance(raw, str) and raw.startswith("[") and raw.endswith("]"):
        return [v.strip() for v in raw[1:-1].split(",") if v.strip() and v.strip() != "none"]
    return []


def _strip_instance_suffix(inst_id: str) -> str:
    """Strip trailing _NN suffix: 'cs00_0002_01' -> 'cs00_0002'."""
    return _INSTANCE_SUFFIX_RE.sub("", inst_id)


class CSMultiplierIndex:
    def __init__(self, client_db_path: Path = _DEFAULT_CLIENT_DB):
        self._db_path = Path(client_db_path)

    @cached_property
    def _by_cs_id(self) -> dict[str, list[DamageModifier]]:
        out: dict[str, list[DamageModifier]] = {}
        for shard_name in _CS_SHARDS:
            shard_path = self._db_path / shard_name
            if not shard_path.exists():
                continue
            try:
                data = json.loads(shard_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            rows = data if isinstance(data, list) else list(data.values())
            for row in rows:
                if not isinstance(row, dict):
                    continue
                if row.get("eff") != "SKILL_EFF_DAMAGE_VALUE_ADD":
                    continue
                source_id = str(row.get("id", "") or "")
                if not source_id:
                    continue
                cs_id = _strip_instance_suffix(source_id)
                try:
                    eff_value = int(row.get("eff_value", 0) or 0)
                except (TypeError, ValueError):
                    eff_value = 0
                mod = DamageModifier(
                    cs_id=cs_id,
                    eff_value=eff_value,
                    sign=str(row.get("eff_value_math_sign", "") or ""),
                    direction=_parse_direction(row.get("eff_opt")),
                    link_cs_id=_parse_list_field(row.get("link_cs_id")),
                    source_id=source_id,
                )
                out.setdefault(cs_id, []).append(mod)
        return out

    def lookup(self, cs_id: str) -> list[DamageModifier]:
        return list(self._by_cs_id.get(str(cs_id), []))

    def all_cs_ids(self) -> set[str]:
        return set(self._by_cs_id.keys())
