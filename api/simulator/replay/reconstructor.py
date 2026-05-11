"""
StateReconstructor: builds a BattleState from a captured battle_wt snapshot.

Reads chars[i].status.info for player stats and monsters[i].status.info
for enemy stats. Falls back to defaults when status.info is empty (first
frame of a capture often is).
"""
import random

from api.simulator.state import BattleState, CharState, MonsterState, CardState, EgoState, SparkState


class StateReconstructor:
    """Convert a battle_wt snapshot dict into a BattleState."""

    def reconstruct(self, battle_wt: dict, rng_seed: int = 0) -> BattleState:
        chars = self._build_chars(battle_wt.get("chars", []))
        monsters = self._build_monsters(battle_wt.get("monsters", []))
        cs_stacks = self._build_cs_stacks(battle_wt.get("csMap", {}))
        hand, deck, discard = self._build_cards(battle_wt.get("cardMap", {}))
        ego_state = self._build_ego_state(battle_wt.get("cardMap", {}))
        spark_state = self._build_spark_state(battle_wt.get("cardMap", {}))
        card_owner_lookup = self._build_card_owner_lookup(battle_wt.get("cardMap", {}))
        morale = int(battle_wt.get("ep", 0) or 0)
        return BattleState(
            turn=int(battle_wt.get("turn", 1) or 1),
            player_team=chars,
            enemies=monsters,
            hand=hand, deck=deck, discard=discard,
            morale=morale,
            ego_state=ego_state,
            spark_state=spark_state,
            cs_stacks=cs_stacks,
            rng=random.Random(rng_seed),
            card_owner_lookup=card_owner_lookup,
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
                atk=int(info.get("S_ATK", 0) or 0),
                cri=float(info.get("S_CRI", 0) or 0),
                cri_dmg_rate=float(info.get("S_CRI_DMG_RATE", 0) or 0),
            ))
        return out

    @staticmethod
    def _build_cs_stacks(cs_map: dict) -> dict[str, dict[str, int]]:
        out: dict[str, dict[str, int]] = {}
        for entry in cs_map.values():
            owner = str(entry.get("owner_id", "") or "")
            res_id = str(entry.get("res_id", "") or "")
            term = int(entry.get("term_value", 0) or 0)
            if not owner or not res_id:
                continue
            out.setdefault(owner, {})[res_id] = term
        return out

    @staticmethod
    def _build_cards(card_map: dict) -> tuple[list[CardState], list[CardState], list[CardState]]:
        hand: list[CardState] = []
        deck: list[CardState] = []
        discard: list[CardState] = []
        for entry in card_map.values():
            card = CardState(
                card_id=str(entry.get("res_id", "")),
                cost=int(entry.get("cost", 0) or 0),
                outline=bool(entry.get("interruptOutline", False)),
                skill_eff_ids=list(entry.get("skill_eff_ids", []) or []),
            )
            place = entry.get("card_place", "")
            if place == "CARD_PLACE_HAND":
                hand.append(card)
            elif place == "CARD_PLACE_DECK":
                deck.append(card)
            elif place == "CARD_PLACE_DISCARD":
                discard.append(card)
            else:
                hand.append(card)
        return hand, deck, discard

    @staticmethod
    def _build_ego_state(card_map: dict) -> dict[str, EgoState]:
        out: dict[str, EgoState] = {}
        for entry in card_map.values():
            char_id = str(entry.get("char_id", "") or "")
            cur_ego_raw = entry.get("curEgo", 0) or 0
            # Handle both int (stage) and str (enum like 'EGO_NARCISSISM')
            if isinstance(cur_ego_raw, str):
                # String enum: map to a non-zero stage (we don't know exact stage from enum alone)
                cur_ego = 1 if cur_ego_raw != "none" else 0
            else:
                cur_ego = int(cur_ego_raw)
            if not char_id:
                continue
            current = out.get(char_id)
            if current is None or cur_ego > current.stage:
                out[char_id] = EgoState(stage=cur_ego)
        return out

    @staticmethod
    def _build_spark_state(card_map: dict) -> dict[str, SparkState]:
        out: dict[str, SparkState] = {}
        for entry in card_map.values():
            char_id = str(entry.get("char_id", "") or "")
            r_spark = entry.get("r_spark", "none")
            if not char_id:
                continue
            if r_spark and r_spark != "none":
                out[char_id] = SparkState(enhanced=True)
            else:
                out.setdefault(char_id, SparkState(enhanced=False))
        return out

    @staticmethod
    def _build_card_owner_lookup(card_map: dict) -> dict[str, str]:
        """Map card-instance-id (string) to owning char_id (string).
        Used by ReplayHarness to translate dev_msg 'X used card Y' caster_ids
        (which are card-instance ids) into actual unit ids."""
        out: dict[str, str] = {}
        for card_inst_id, entry in card_map.items():
            char_id = entry.get("char_id")
            if char_id is not None:
                out[str(card_inst_id)] = str(char_id)
        return out
