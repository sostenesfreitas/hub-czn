"""
BattleState and participating dataclasses for the CZN combat simulator.

State mutations happen through explicit methods (apply_damage, add_cs, etc.),
not direct attribute assignment, so the runtime can hook events later.
"""
import random
from dataclasses import dataclass, field


@dataclass
class CharState:
    id: str
    atk: int
    def_: int
    hp: int
    hp_current: int
    cri: float
    cri_dmg_rate: float
    weak_ego_dmg_rate: float = 100.0
    shield: int = 0
    is_ego_active: bool = False  # toggled when card.outline triggers


@dataclass
class MonsterState:
    id: str
    def_: int
    hp: int
    hp_current: int
    dmg_decrease_rate: float = 0.0
    weak: bool = False
    shield: int = 0

    def apply_damage(self, amount: float) -> int:
        """Subtract damage from hp_current after shield. Returns damage actually dealt."""
        dealt = max(0, int(round(amount)))
        if self.shield > 0:
            absorbed = min(self.shield, dealt)
            self.shield -= absorbed
            dealt -= absorbed
        self.hp_current = max(0, self.hp_current - dealt)
        return dealt


@dataclass
class CardState:
    card_id: str
    cost: int
    outline: bool = False
    skill_eff_ids: list[str] = field(default_factory=list)


@dataclass
class EgoState:
    stage: int = 0
    progress: int = 0


@dataclass
class SparkState:
    enhanced: bool = False


@dataclass
class BattleState:
    turn: int
    player_team: list[CharState]
    enemies: list[MonsterState]
    hand: list[CardState]
    deck: list[CardState]
    discard: list[CardState]
    morale: int
    ego_state: dict[str, EgoState]
    spark_state: dict[str, SparkState]
    cs_stacks: dict[str, dict[str, int]]
    rng: random.Random

    def add_cs(self, unit_id: str, cs_id: str, amount: int = 1) -> None:
        self.cs_stacks.setdefault(unit_id, {})
        self.cs_stacks[unit_id][cs_id] = self.cs_stacks[unit_id].get(cs_id, 0) + amount

    def remove_cs(self, unit_id: str, cs_id: str, amount: int = 1) -> int:
        """Remove up to `amount` stacks. Returns the number actually removed."""
        current = self.cs_stacks.get(unit_id, {}).get(cs_id, 0)
        removed = min(current, amount)
        if removed > 0:
            self.cs_stacks[unit_id][cs_id] = current - removed
        return removed
