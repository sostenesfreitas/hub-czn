"""
Runtime dispatcher: resolves a SKILL_EFF instance id via the catalog,
checks trigger eligibility, resolves targets, and invokes the formula.
"""
from api.game_data.eff_instances import EffInstanceIndex
from api.simulator.formulas import FORMULA_REGISTRY
from api.simulator.result import EffectResult
from api.simulator.state import BattleState, CharState, MonsterState


_ACTIVE_TRIGGERS = {"on_skill_use", "on_card_play", "manual", "on_hit"}


class Runtime:
    def __init__(self, catalog: dict, instances: EffInstanceIndex):
        self._catalog = catalog
        self._instances = instances

    def apply(
        self,
        instance_id: str,
        caster: CharState,
        state: BattleState,
        *,
        context: str = "active",
    ) -> EffectResult:
        inst = self._instances.get(instance_id)
        type_def = self._catalog.get(inst.eff_type)
        if type_def is None:
            return EffectResult.skipped_with(f"eff_type {inst.eff_type} not in catalog")

        if not self._trigger_eligible(type_def.get("trigger"), context):
            return EffectResult.skipped_with(f"trigger {type_def.get('trigger')} not eligible in context {context}")

        targets = self._resolve_targets(type_def.get("target_resolution"), caster, state)
        if targets is None:
            return EffectResult.skipped_with("no target resolved")

        formula_ref = type_def["effect"].get("formula_ref")
        formula = FORMULA_REGISTRY.get(formula_ref)
        if formula is None:
            raise KeyError(f"formula_ref {formula_ref!r} not in FORMULA_REGISTRY")

        return formula(inst, caster, targets, state)

    @staticmethod
    def _trigger_eligible(trigger: str | None, context: str) -> bool:
        if context == "active":
            return trigger in _ACTIVE_TRIGGERS
        if context == "turn_start":
            return trigger == "on_turn_start"
        if context == "turn_end":
            return trigger == "on_turn_end"
        return False

    @staticmethod
    def _resolve_targets(
        resolution: str | None,
        caster: CharState,
        state: BattleState,
    ) -> list | None:
        match resolution:
            case "self" | "caster":
                return [caster]
            case "selected_unit":
                return state.enemies[:1] if state.enemies else None
            case "all_enemies":
                return list(state.enemies)
            case "all_allies":
                return list(state.player_team)
            case _:
                return None
