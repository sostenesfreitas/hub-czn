"""EffectResult dataclass — kept in its own module to avoid circular imports."""
from dataclasses import dataclass, field


@dataclass
class EffectResult:
    skipped: bool = False
    skip_reason: str = ""
    damage: int = 0
    target_id: str | None = None
    cs_added: dict[str, int] = field(default_factory=dict)
    shield_added: int = 0
    cards_moved: list[str] = field(default_factory=list)
    dva_stacks_observed: dict[str, int] = field(default_factory=dict)

    @classmethod
    def skipped_with(cls, reason: str) -> "EffectResult":
        return cls(skipped=True, skip_reason=reason)
