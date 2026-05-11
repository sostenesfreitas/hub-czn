"""
StateReconstructor: builds a BattleState from a captured battle_wt snapshot.

Reads chars[i].status.info for player stats and monsters[i].status.info
for enemy stats. Falls back to defaults when status.info is empty (first
frame of a capture often is).
"""
import random

from api.simulator.state import BattleState, CharState, MonsterState


class StateReconstructor:
    """Convert a battle_wt snapshot dict into a BattleState."""

    def reconstruct(self, battle_wt: dict, rng_seed: int = 0) -> BattleState:
        chars = self._build_chars(battle_wt.get("chars", []))
        monsters = self._build_monsters(battle_wt.get("monsters", []))
        morale = int(battle_wt.get("ep", 0) or 0)
        return BattleState(
            turn=int(battle_wt.get("turn", 1) or 1),
            player_team=chars,
            enemies=monsters,
            hand=[], deck=[], discard=[],
            morale=morale,
            ego_state={}, spark_state={},
            cs_stacks={},
            rng=random.Random(rng_seed),
        )

    @staticmethod
    def _build_chars(chars_data: list[dict]) -> list[CharState]:
        out: list[CharState] = []
        for c in chars_data:
            info = c.get("status", {}).get("info", {}) or {}
            out.append(CharState(
                id=str(c.get("id", "")),
                atk=int(info.get("S_ATK", 0) or 0),
                def_=int(info.get("S_DEF", 0) or 0),
                hp=int(info.get("S_HP", 0) or 0),
                hp_current=int(info.get("S_CURRENT_HP", info.get("S_HP", 0)) or 0),
                cri=float(info.get("S_CRI", 0) or 0),
                cri_dmg_rate=float(info.get("S_CRI_DMG_RATE", 0) or 0),
                weak_ego_dmg_rate=float(info.get("S_WEAK_EGO_DMG_RATE", 100) or 100),
            ))
        return out

    @staticmethod
    def _build_monsters(mons_data: list[dict]) -> list[MonsterState]:
        out: list[MonsterState] = []
        for m in mons_data:
            info = m.get("status", {}).get("info", {}) or {}
            hp_max = int(info.get("S_HP", 0) or 0)
            hp_cur = int(info.get("S_CURRENT_HP", hp_max) or hp_max)
            out.append(MonsterState(
                id=str(m.get("id", "")),
                def_=int(info.get("S_DEF", 0) or 0),
                hp=hp_max,
                hp_current=hp_cur,
                dmg_decrease_rate=float(info.get("S_DMG_DECREASE_RATE", 0) or 0),
                weak=bool(m.get("weak", False)),
                shield=int(info.get("S_CURRENT_SHIELD", 0) or 0),
            ))
        return out
