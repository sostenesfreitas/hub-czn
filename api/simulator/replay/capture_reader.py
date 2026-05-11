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
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

from api.simulator.replay.dev_msg_parser import SkillEffFire, parse_dev_msg
from api.simulator.replay.event_parser import (
    BattleEvent, parse_dev_msg as parse_full_dev_msg,
)


@dataclass(frozen=True)
class CaptureEvent:
    """One normalized frame from a capture file."""
    ts: str
    seq: int
    snapshot: dict
    is_state_update: bool = False
    dev_msg_lines: list[str] = field(default_factory=list)
    skill_eff_fires: list[SkillEffFire] = field(default_factory=list)
    parsed_events: list[BattleEvent] = field(default_factory=list)

    @property
    def skill_eff_ids(self) -> list[str]:
        """Backwards-compat shim — equivalent to [f.skill_eff_id for f in skill_eff_fires]."""
        return [f.skill_eff_id for f in self.skill_eff_fires]


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
        skill_eff_fires: list[SkillEffFire] = []
        dev_msg_lines: list[str] = []
        parsed_events: list[BattleEvent] = []
        if isinstance(dev_msg, str) and dev_msg:
            skill_eff_fires = parse_dev_msg(dev_msg)
            dev_msg_lines = [ln for ln in dev_msg.split("\n") if "SkillEff" in ln]
            parsed_events = parse_full_dev_msg(dev_msg)
        if bw is None and not skill_eff_fires:
            return None
        return CaptureEvent(
            ts=raw.get("ts", ""),
            seq=seq,
            snapshot=bw if bw is not None else {},
            is_state_update=bw is not None,
            dev_msg_lines=dev_msg_lines,
            skill_eff_fires=skill_eff_fires,
            parsed_events=parsed_events,
        )
