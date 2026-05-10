"""
Extracts damage-related ground truth from captured battle snapshots.

Two extractors:
  - extract_def_pairs(snapshot_dir) -> list of (DEF, observed_dmg_decrease)
  - extract_per_hit_events(jsonl_path) -> list of dicts with attacker, defender, dmg, skill, turn, buffs
"""
import json
from pathlib import Path


def extract_def_pairs(snapshot_dir: Path) -> list[tuple[int, float]]:
    """Yields (enemy_def, enemy_dmg_decrease) for every battle file with both fields."""
    pairs = []
    for fp in sorted(snapshot_dir.glob("battle_*.json")):
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if "enemy_def" in data and "enemy_dmg_decrease" in data:
            pairs.append((int(data["enemy_def"]), float(data["enemy_dmg_decrease"])))
    return pairs


def extract_per_hit_events(jsonl_path: Path) -> list[dict]:
    """Parse websocket_debug_*.jsonl, yielding battle event frames with damage info.

    Returns list of dicts. Schema is the raw frame — downstream consumers
    (validate_damage.py) extract atk/def/dmg/skill/turn/buffs from these.
    """
    events = []
    if not jsonl_path.exists():
        return events
    with jsonl_path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                frame = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(frame, dict) and any(k in str(frame) for k in ("dmg", "damage", "DMG")):
                events.append(frame)
    return events
