"""
CaptureReader: lazy parser for websocket_debug_*.jsonl captures.

The CZN server sends dev_msg (with SkillEff lines) and battle_wt (with
snapshot state) in SEPARATE s2c frames.  CaptureReader therefore yields
events for frames that carry EITHER:
  - data.snapshot.cache.battle_wt  → is_state_update=True
  - SkillEff entries in data.dev_msg → is_state_update=False, snapshot={}
Frames with neither are silently skipped.
"""
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator


# Same alphanumeric pattern as scripts/build_eff_catalog_scaffold.py.
# res_id is alphanumeric+underscore, NOT digits-only.
SKILL_EFF_PATTERN = re.compile(r"SkillEff\s+\d+:([^:]+):([A-Z_][A-Z_0-9]*)")


@dataclass(frozen=True)
class CaptureEvent:
    """One normalized frame from a capture file."""
    ts: str
    seq: int
    snapshot: dict
    is_state_update: bool = False
    dev_msg_lines: list[str] = field(default_factory=list)
    skill_eff_ids: list[str] = field(default_factory=list)


class CaptureReader:
    """Lazy iterator over a websocket_debug_*.jsonl capture."""

    def __init__(self, path: Path):
        self._path = Path(path)

    def events(self) -> Iterator[CaptureEvent]:
        """Yield CaptureEvents for s2c frames carrying a battle_wt snapshot
        OR SkillEff entries in dev_msg."""
        seq = 0
        with self._path.open(encoding="utf-8") as f:
            for line in f:
                event = self._parse_line(line, seq)
                if event is None:
                    continue
                yield event
                seq += 1

    def first_battle_wt(self) -> dict | None:
        """Return the first state-update frame's battle_wt for reconstruction."""
        for event in self.events():
            if event.is_state_update:
                return event.snapshot
        return None

    @staticmethod
    def _parse_line(line: str, seq: int) -> "CaptureEvent | None":
        try:
            raw = json.loads(line)
        except json.JSONDecodeError:
            return None
        if raw.get("dir") != "s2c":
            return None
        data = raw.get("data")
        if not isinstance(data, dict):
            return None
        bw = None
        snap = data.get("snapshot")
        if isinstance(snap, dict):
            cache = snap.get("cache")
            if isinstance(cache, dict):
                bw = cache.get("battle_wt")
                if not isinstance(bw, dict):
                    bw = None
        dev_msg = data.get("dev_msg", "")
        skill_eff_ids: list[str] = []
        dev_msg_lines: list[str] = []
        if isinstance(dev_msg, str):
            for ln in dev_msg.split("\n"):
                if "SkillEff" in ln:
                    dev_msg_lines.append(ln)
                    m = SKILL_EFF_PATTERN.search(ln)
                    if m:
                        skill_eff_ids.append(m.group(1))
        if bw is None and not skill_eff_ids:
            return None
        return CaptureEvent(
            ts=raw.get("ts", ""),
            seq=seq,
            snapshot=bw if bw is not None else {},
            is_state_update=bw is not None,
            dev_msg_lines=dev_msg_lines,
            skill_eff_ids=skill_eff_ids,
        )
