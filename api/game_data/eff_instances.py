"""
Lazy-loaded index of every SKILL_EFF instance shipped in the client db.

Reads ~43 *skill_eff.json shards from CLIENT_DB on first access, builds a
~10k-entry dict, caches in-process. Read-only.
"""
import json
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path


def _parse_list_field(raw) -> list[str]:
    """Parse a list-like field. May arrive as native list, '[]', 'none', or '[a,b]'."""
    if isinstance(raw, list):
        return [str(v) for v in raw if v and v != "none"]
    if not raw or raw in ("[]", "none"):
        return []
    if isinstance(raw, str) and raw.startswith("[") and raw.endswith("]"):
        return [v.strip() for v in raw[1:-1].split(",") if v.strip() and v.strip() != "none"]
    return []


@dataclass(frozen=True)
class EffInstance:
    """One row from a *skill_eff.json shard."""
    id: str
    eff_type: str
    raw: dict = field(repr=False)

    @cached_property
    def eff_value(self) -> int:
        return int(self.raw.get("eff_value", "0") or 0)

    @cached_property
    def eff_count_value(self) -> int:
        return int(self.raw.get("eff_count_value", "0") or 0)

    @cached_property
    def target_unit_type(self) -> str:
        return self.raw.get("target_unit_type", "")

    @cached_property
    def link_cs_id(self) -> list[str]:
        return _parse_list_field(self.raw.get("link_cs_id"))


class EffInstanceIndex:
    """Resolve any skill_eff instance id to a typed EffInstance."""

    def __init__(self, client_db_path: Path):
        self._db_path = Path(client_db_path)
        self._by_id: dict[str, EffInstance] | None = None
        self._by_type: dict[str, list[EffInstance]] | None = None

    def _ensure_loaded(self):
        if self._by_id is not None:
            return
        by_id: dict[str, EffInstance] = {}
        by_type: dict[str, list[EffInstance]] = {}
        for shard in self._db_path.glob("*skill_eff.json"):
            if shard.stat().st_size <= 2:
                continue
            data = json.loads(shard.read_text(encoding="utf-8"))
            rows = data if isinstance(data, list) else list(data.values())
            for row in rows:
                rid = row.get("id")
                eff = row.get("eff")
                if not rid or not eff:
                    continue
                inst = EffInstance(id=rid, eff_type=eff, raw=row)
                by_id[rid] = inst
                by_type.setdefault(eff, []).append(inst)
        self._by_id = by_id
        self._by_type = by_type

    def get(self, instance_id: str) -> EffInstance:
        self._ensure_loaded()
        return self._by_id[instance_id]

    def by_type(self, eff_type: str) -> list[EffInstance]:
        self._ensure_loaded()
        return list(self._by_type.get(eff_type, []))
