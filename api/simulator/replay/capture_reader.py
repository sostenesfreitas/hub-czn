"""
CaptureReader: lazy parser for websocket_debug_*.jsonl captures.

Reads s2c frames carrying data.snapshot.cache.battle_wt, parses the
companion data.dev_msg field for SkillEff lines, and yields one
CaptureEvent per valid frame.
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
    dev_msg_lines: list[str] = field(default_factory=list)
    skill_eff_ids: list[str] = field(default_factory=list)


class CaptureReader:
    """Lazy iterator over a websocket_debug_*.jsonl capture."""

    def __init__(self, path: Path):
        self._path = Path(path)

    def events(self) -> Iterator[CaptureEvent]:
        """Yield CaptureEvents for s2c frames carrying a battle_wt snapshot."""
        seq = 0
        with self._path.open(encoding="utf-8") as f:
            for line in f:
                event = self._parse_line(line, seq)
                if event is None:
                    continue
                yield event
                seq += 1

    def first_battle_wt(self) -> dict | None:
        """Return the first frame's battle_wt for state reconstruction."""
        for event in self.events():
            return event.snapshot
        return None

    @staticmethod
    def _parse_line(line: str, seq: int) -> CaptureEvent | None:
        try:
            raw = json.loads(line)
        except json.JSONDecodeError:
            return None
        if raw.get("dir") != "s2c":
            return None
        data = raw.get("data")
        if not isinstance(data, dict):
            return None
        bw = data.get("snapshot", {}).get("cache", {}).get("battle_wt")
        if not isinstance(bw, dict):
            return None
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
        return CaptureEvent(
            ts=raw.get("ts", ""),
            seq=seq,
            snapshot=bw,
            dev_msg_lines=dev_msg_lines,
            skill_eff_ids=skill_eff_ids,
        )
