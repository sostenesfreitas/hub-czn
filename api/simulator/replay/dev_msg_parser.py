"""
Parser for dev_msg strings.  Segments by 'card_use-start' markers and
extracts caster/target context per SkillEff fire.

Patterns observed in production captures:
- '--------card_use-start--------'           segment delimiter
- '<unit_id> used card <card_res_id>'         caster declaration
- '<unit_id>(<role>) added <cs> to <W>(<role2>) value <N> sign ...'
- 'SkillEff <n>:<res_id>:<TYPE>[:<params>]'   the fire itself
"""
import re
from dataclasses import dataclass, field


SEGMENT_MARKER = "card_use-start"
_USED_CARD = re.compile(r"\b(\d+)\s+used\s+card\b")
_ADDED_TO_TARGET = re.compile(r"\badded\s+\S+\s+to\s+(\d+)\(monster\)")
_SKILL_EFF = re.compile(r"SkillEff\s+\d+:([^:\s]+):([A-Z_][A-Z_0-9]*)")


@dataclass(frozen=True)
class SkillEffFire:
    skill_eff_id: str
    eff_type: str
    caster_id: str | None = None
    target_id: str | None = None
    raw_line: str = ""


def parse_dev_msg(dev_msg: str) -> list[SkillEffFire]:
    if not isinstance(dev_msg, str) or not dev_msg:
        return []
    fires: list[SkillEffFire] = []
    caster: str | None = None
    target: str | None = None
    for raw_line in dev_msg.split("\n"):
        line = raw_line.strip()
        if SEGMENT_MARKER in line:
            caster = None
            target = None
            continue
        if "used card" in line:
            m = _USED_CARD.search(line)
            if m:
                caster = m.group(1)
            continue
        m_target = _ADDED_TO_TARGET.search(line)
        if m_target:
            target = m_target.group(1)
        if "SkillEff" in line:
            m = _SKILL_EFF.search(line)
            if m:
                fires.append(SkillEffFire(
                    skill_eff_id=m.group(1),
                    eff_type=m.group(2),
                    caster_id=caster,
                    target_id=target,
                    raw_line=raw_line,
                ))
    return fires
