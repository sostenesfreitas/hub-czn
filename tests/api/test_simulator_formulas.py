"""Per-formula unit tests. F_BASE_DMG is anchored on Track B verified hits."""
import random

import pytest

from api.game_data.eff_instances import EffInstance
from api.simulator.formulas import _formula_base_damage
from api.simulator.state import BattleState, CharState, MonsterState


def _state(caster: CharState, target: MonsterState) -> BattleState:
    return BattleState(turn=1, player_team=[caster], enemies=[target],
                       hand=[], deck=[], discard=[], morale=0,
                       ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))


def _fake_inst(eff_value: int) -> EffInstance:
    raw = {"id": "fake", "eff": "SKILL_EFF_DMG", "eff_value": str(eff_value),
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_SELECTED",
           "link_cs_id": "[]"}
    return EffInstance(id="fake", eff_type="SKILL_EFF_DMG", raw=raw)


# Track B verified: c_30075_srt4_mut hit. ATK=1087, eff_value=75, DR=0.334, no crit -> 547
def test_f_base_dmg_track_b_verified_hit_1():
    caster = CharState(id="c", atk=1087, def_=300, hp=1, hp_current=1,
                       cri=10.0, cri_dmg_rate=221.0)
    target = MonsterState(id="m", def_=540, hp=99999, hp_current=99999, dmg_decrease_rate=0.334)
    result = _formula_base_damage(_fake_inst(75), caster, [target], _state(caster, target))
    # Predicted 543; observed 547. Allow ±5%.
    assert abs(result.damage - 547) / 547 < 0.05


def test_f_base_dmg_non_crit_uses_factor_one():
    caster = CharState(id="c", atk=1000, def_=300, hp=1, hp_current=1,
                       cri=0.0, cri_dmg_rate=200.0)  # 0% crit -> never crits
    target = MonsterState(id="m", def_=200, hp=99999, hp_current=99999, dmg_decrease_rate=0.4)
    result = _formula_base_damage(_fake_inst(100), caster, [target], _state(caster, target))
    # dmg = 1000 * 1.0 * (1 - 0.4) * 1.0 = 600
    assert result.damage == 600


def test_f_base_dmg_applies_to_first_target_only():
    caster = CharState(id="c", atk=1000, def_=300, hp=1, hp_current=1,
                       cri=0.0, cri_dmg_rate=200.0)
    t1 = MonsterState(id="m1", def_=0, hp=99999, hp_current=99999, dmg_decrease_rate=0.0)
    t2 = MonsterState(id="m2", def_=0, hp=99999, hp_current=99999, dmg_decrease_rate=0.0)
    state = BattleState(turn=1, player_team=[caster], enemies=[t1, t2],
                        hand=[], deck=[], discard=[], morale=0,
                        ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    result = _formula_base_damage(_fake_inst(100), caster, [t1, t2], state)
    assert result.target_id == "m1"
    assert t1.hp_current < 99999
    assert t2.hp_current == 99999


from api.simulator.formulas import (
    _formula_add_cs,
    _formula_shield,
    _formula_heal,
    _formula_draw,
    _formula_discard,
    _formula_move_card,
    _formula_noop,
)
from api.simulator.state import CardState


def test_f_draw_moves_from_deck_to_hand():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    state = BattleState(turn=1, player_team=[caster], enemies=[],
                        hand=[],
                        deck=[CardState(card_id="c1", cost=1), CardState(card_id="c2", cost=1)],
                        discard=[], morale=0, ego_state={}, spark_state={}, cs_stacks={},
                        rng=random.Random(0))
    raw = {"id": "fake", "eff": "SKILL_EFF_CARD_DRAW", "eff_value": "1",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_CASTER",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_CARD_DRAW", raw=raw)
    _formula_draw(inst, caster, [], state)
    assert len(state.hand) == 1
    assert len(state.deck) == 1


def test_f_discard_moves_hand_to_discard():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    state = BattleState(turn=1, player_team=[caster], enemies=[],
                        hand=[CardState(card_id="c1", cost=1)], deck=[], discard=[],
                        morale=0, ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    raw = {"id": "fake", "eff": "SKILL_EFF_CARD_DISCARD", "eff_value": "1",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_CASTER",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_CARD_DISCARD", raw=raw)
    _formula_discard(inst, caster, [], state)
    assert len(state.hand) == 0
    assert len(state.discard) == 1


def test_f_noop_returns_skipped_with_no_state_change():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    state = _state(caster, MonsterState(id="m", def_=0, hp=1, hp_current=1))
    raw = {"id": "fake", "eff": "SKILL_EFF_BATTLE_SKIP", "eff_value": "0",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_NONE",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_BATTLE_SKIP", raw=raw)
    result = _formula_noop(inst, caster, [], state)
    assert result.skipped is True


def test_f_add_cs_increments_target_stacks():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    target = MonsterState(id="m1", def_=0, hp=1, hp_current=1)
    state = _state(caster, target)
    # SKILL_EFF_CS_SET_ADD uses link_cs_id for the cs_id; eff_count_value for quantity.
    raw = {"id": "fake", "eff": "SKILL_EFF_CS_SET_ADD", "eff_value": "0",
           "eff_count_value": "2", "target_unit_type": "TARGET_UNIT_SELECTED",
           "link_cs_id": "[cs_91]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_CS_SET_ADD", raw=raw)
    result = _formula_add_cs(inst, caster, [target], state)
    assert state.cs_stacks["m1"]["cs_91"] == 2
    assert result.cs_added == {"cs_91": 2}


def test_f_shield_adds_to_target():
    caster = CharState(id="c", atk=1000, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    ally = CharState(id="a1", atk=0, def_=0, hp=5000, hp_current=5000, cri=0.0, cri_dmg_rate=0)
    state = BattleState(turn=1, player_team=[caster, ally], enemies=[],
                        hand=[], deck=[], discard=[], morale=0,
                        ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    raw = {"id": "fake", "eff": "SKILL_EFF_SHIELD", "eff_value": "30",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_CASTER",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_SHIELD", raw=raw)
    # 30% of caster.atk = 300
    result = _formula_shield(inst, caster, [ally], state)
    assert ally.shield == 300
    assert result.shield_added == 300


def test_f_heal_restores_hp():
    caster = CharState(id="c", atk=1000, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    ally = CharState(id="a1", atk=0, def_=0, hp=5000, hp_current=2000, cri=0.0, cri_dmg_rate=0)
    state = BattleState(turn=1, player_team=[caster, ally], enemies=[],
                        hand=[], deck=[], discard=[], morale=0,
                        ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    raw = {"id": "fake", "eff": "SKILL_EFF_HEAL", "eff_value": "50",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_CASTER",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_HEAL", raw=raw)
    # 50% of caster.atk = 500
    _formula_heal(inst, caster, [ally], state)
    assert ally.hp_current == 2500


from api.simulator.formulas import (
    _formula_add_cs_random,
    _formula_add_card,
    _formula_kill,
    _formula_max_hp_modify,
    _formula_energy_change,
    _formula_stress_add,
    FORMULA_REGISTRY,
)


def test_f_add_cs_random_picks_one_from_list():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    target = MonsterState(id="m1", def_=0, hp=1, hp_current=1)
    state = _state(caster, target)
    raw = {"id": "fake", "eff": "SKILL_EFF_CS_SET_ADD_RANDOM", "eff_value": "0",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_SELECTED",
           "link_cs_id": "[cs_a,cs_b,cs_c]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_CS_SET_ADD_RANDOM", raw=raw)
    result = _formula_add_cs_random(inst, caster, [target], state)
    # exactly one cs_id was added
    assert len(result.cs_added) == 1
    chosen = next(iter(result.cs_added))
    assert chosen in {"cs_a", "cs_b", "cs_c"}
    assert state.cs_stacks["m1"][chosen] == 1


def test_f_add_card_appends_to_hand():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    state = BattleState(turn=1, player_team=[caster], enemies=[],
                        hand=[], deck=[], discard=[],
                        morale=0, ego_state={}, spark_state={}, cs_stacks={},
                        rng=random.Random(0))
    raw = {"id": "fake", "eff": "SKILL_EFF_CARD_GET", "eff_value": "1",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_CASTER",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_CARD_GET", raw=raw)
    result = _formula_add_card(inst, caster, [caster], state)
    assert len(state.hand) == 1
    assert result.cards_moved


def test_f_kill_zeros_target_hp():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    target = MonsterState(id="m1", def_=0, hp=9999, hp_current=9999)
    state = _state(caster, target)
    raw = {"id": "fake", "eff": "SKILL_EFF_KILL", "eff_value": "0",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_SELECTED",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_KILL", raw=raw)
    _formula_kill(inst, caster, [target], state)
    assert target.hp_current == 0


def test_f_energy_change_adjusts_morale():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    state = BattleState(turn=1, player_team=[caster], enemies=[],
                        hand=[], deck=[], discard=[], morale=5,
                        ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0))
    raw = {"id": "fake", "eff": "SKILL_EFF_ENERGY_CHANGE", "eff_value": "2",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_CASTER",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_ENERGY_CHANGE", raw=raw)
    _formula_energy_change(inst, caster, [caster], state)
    assert state.morale == 7


def test_f_stress_add_accumulates():
    caster = CharState(id="c", atk=0, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    target = MonsterState(id="m1", def_=0, hp=9999, hp_current=9999)
    state = _state(caster, target)
    raw = {"id": "fake", "eff": "SKILL_EFF_STRESS_ADD", "eff_value": "3",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_SELECTED",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_STRESS_ADD", raw=raw)
    _formula_stress_add(inst, caster, [target], state)
    _formula_stress_add(inst, caster, [target], state)
    # __stress__ key holds the running counter
    assert state.cs_stacks["m1"]["__stress__"] == 6


def test_all_catalog_formula_refs_registered():
    """The schema test relies on this — every formula_ref must be in the registry."""
    import json
    from pathlib import Path
    REPO = Path(__file__).resolve().parents[2]
    catalog = json.loads((REPO / "api" / "data" / "eff_type_catalog.json").read_text(encoding="utf-8"))
    refs = {body["effect"]["formula_ref"] for body in catalog.values() if body["effect"].get("formula_ref")}
    missing = refs - set(FORMULA_REGISTRY.keys())
    assert not missing, f"missing: {missing}"


from api.simulator.formulas import _find_firing_card


def test_find_firing_card_finds_card_in_hand():
    caster = CharState(id="c", atk=100, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    target = MonsterState(id="m", def_=0, hp=1, hp_current=1)
    card_with_skill = CardState(card_id="c_x", cost=1, outline=True,
                                skill_eff_ids=["c_x_01", "c_x_02"])
    state = BattleState(
        turn=1, player_team=[caster], enemies=[target],
        hand=[card_with_skill], deck=[], discard=[],
        morale=0, ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0),
    )
    found = _find_firing_card("c_x_01", state)
    assert found is not None
    assert found.card_id == "c_x"
    assert found.outline is True


def test_find_firing_card_returns_none_when_not_found():
    caster = CharState(id="c", atk=100, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    target = MonsterState(id="m", def_=0, hp=1, hp_current=1)
    state = BattleState(
        turn=1, player_team=[caster], enemies=[target],
        hand=[], deck=[], discard=[],
        morale=0, ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0),
    )
    assert _find_firing_card("c_anything_01", state) is None


def test_find_firing_card_checks_deck_and_discard():
    caster = CharState(id="c", atk=100, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0)
    target = MonsterState(id="m", def_=0, hp=1, hp_current=1)
    card_in_deck = CardState(card_id="c_d", cost=1, outline=False, skill_eff_ids=["c_d_01"])
    card_in_discard = CardState(card_id="c_e", cost=1, outline=False, skill_eff_ids=["c_e_01"])
    state = BattleState(
        turn=1, player_team=[caster], enemies=[target],
        hand=[], deck=[card_in_deck], discard=[card_in_discard],
        morale=0, ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0),
    )
    assert _find_firing_card("c_d_01", state).card_id == "c_d"
    assert _find_firing_card("c_e_01", state).card_id == "c_e"


def test_f_base_dmg_applies_weak_mult_when_outline_and_weak():
    """When firing card has outline=True AND target.weak=True, F_BASE_DMG
    multiplies by caster.weak_ego_dmg_rate / 100."""
    caster = CharState(id="c", atk=1000, def_=0, hp=1, hp_current=1,
                       cri=0.0, cri_dmg_rate=0,
                       weak_ego_dmg_rate=125.0)
    target = MonsterState(id="m", def_=0, hp=99999, hp_current=99999,
                          dmg_decrease_rate=0.0, weak=True)
    firing_card = CardState(card_id="c_x", cost=1, outline=True,
                            skill_eff_ids=["fake"])
    state = BattleState(
        turn=1, player_team=[caster], enemies=[target],
        hand=[firing_card], deck=[], discard=[],
        morale=0, ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0),
    )
    # _def_reduce(0) = 268/503 ≈ 0.533
    # cf with rng seed 0: random() first call returns 0.844; 84.4 vs cri=0.0 → no crit, cf=1.0
    # weak_mult = 125/100 = 1.25
    # expected: 1000 * 1.0 * (1 - 0.533) * 1.0 * 1.25 ≈ 583
    result = _formula_base_damage(_fake_inst(100), caster, [target], state)
    assert 570 <= result.damage <= 595


def test_f_base_dmg_no_weak_mult_when_outline_but_target_not_weak():
    """outline=True but target.weak=False → no weak_mult (×1.0)."""
    caster = CharState(id="c", atk=1000, def_=0, hp=1, hp_current=1,
                       cri=0.0, cri_dmg_rate=0,
                       weak_ego_dmg_rate=125.0)
    target = MonsterState(id="m", def_=0, hp=99999, hp_current=99999,
                          dmg_decrease_rate=0.0, weak=False)
    firing_card = CardState(card_id="c_x", cost=1, outline=True,
                            skill_eff_ids=["fake"])
    state = BattleState(
        turn=1, player_team=[caster], enemies=[target],
        hand=[firing_card], deck=[], discard=[],
        morale=0, ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0),
    )
    # weak_mult = 1.0; expected ≈ 1000 * 1.0 * (1 - 0.533) * 1.0 ≈ 467
    result = _formula_base_damage(_fake_inst(100), caster, [target], state)
    assert 460 <= result.damage <= 475


def test_f_base_dmg_no_weak_mult_when_target_weak_but_no_outline():
    """target.weak=True but no firing card with outline → no weak_mult."""
    caster = CharState(id="c", atk=1000, def_=0, hp=1, hp_current=1,
                       cri=0.0, cri_dmg_rate=0,
                       weak_ego_dmg_rate=125.0)
    target = MonsterState(id="m", def_=0, hp=99999, hp_current=99999,
                          dmg_decrease_rate=0.0, weak=True)
    state = BattleState(
        turn=1, player_team=[caster], enemies=[target],
        hand=[], deck=[], discard=[],
        morale=0, ego_state={}, spark_state={}, cs_stacks={}, rng=random.Random(0),
    )
    result = _formula_base_damage(_fake_inst(100), caster, [target], state)
    assert 460 <= result.damage <= 475


def test_f_base_dmg_records_dva_stacks_when_state_has_dva():
    """When state.dva_stacks has target stacks, EffectResult.dva_stacks_observed
    reports them ALL (regardless of inst.link_cs_id — Sprint 2e applies the
    multiplier; Sprint 2d just observes)."""
    caster = CharState(id="c", atk=1000, def_=0, hp=1, hp_current=1,
                       cri=0.0, cri_dmg_rate=0)
    target = MonsterState(id="m1", def_=0, hp=99999, hp_current=99999,
                          dmg_decrease_rate=0.0)
    state = _state(caster, target)
    state.dva_stacks = {"m1": {"cs_91": 3, "cs_112": 1}}

    # inst with EMPTY link_cs_id (matches real DMG data)
    raw = {"id": "fake_empty_link", "eff": "SKILL_EFF_DMG", "eff_value": "100",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_SELECTED",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake_empty_link", eff_type="SKILL_EFF_DMG", raw=raw)

    result = _formula_base_damage(inst, caster, [target], state)
    # All target stacks observed, regardless of inst.link_cs_id
    assert result.dva_stacks_observed == {"cs_91": 3, "cs_112": 1}


def test_f_base_dmg_dva_observed_empty_when_state_lacks_dva():
    """Synthetic state without dva_stacks attribute → observation is empty."""
    caster = CharState(id="c", atk=1000, def_=0, hp=1, hp_current=1,
                       cri=0.0, cri_dmg_rate=0)
    target = MonsterState(id="m1", def_=0, hp=99999, hp_current=99999,
                          dmg_decrease_rate=0.0)
    state = _state(caster, target)
    # explicitly NOT setting state.dva_stacks
    raw = {"id": "fake_w_link", "eff": "SKILL_EFF_DMG", "eff_value": "100",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_SELECTED",
           "link_cs_id": "[cs_91]"}
    inst = EffInstance(id="fake_w_link", eff_type="SKILL_EFF_DMG", raw=raw)

    result = _formula_base_damage(inst, caster, [target], state)
    assert result.dva_stacks_observed == {}


def test_f_base_dmg_track_b_verified_hit_1_unchanged_post_sprint_2d():
    """Regression: Track B's c_30075_srt4_mut hit MUST still pass ±5%.
    No state.dva_stacks, inst has no link_cs_id → no behavior change."""
    caster = CharState(id="c", atk=1087, def_=300, hp=1, hp_current=1,
                       cri=10.0, cri_dmg_rate=221.0)
    target = MonsterState(id="m", def_=540, hp=99999, hp_current=99999,
                          dmg_decrease_rate=0.334)
    state = _state(caster, target)
    result = _formula_base_damage(_fake_inst(75), caster, [target], state)
    assert abs(result.damage - 547) / 547 < 0.05


from api.simulator.formulas import _compose_dva_multiplier
from api.game_data.cs_multipliers import DamageModifier


class _MockMultiplierIndex:
    """Mock CSMultiplierIndex for unit tests."""
    def __init__(self, mods_by_cs_id: dict):
        self._mods = mods_by_cs_id
    def lookup(self, cs_id: str):
        return list(self._mods.get(cs_id, []))


def test_compose_dva_multiplier_empty_stacks_returns_1():
    state = _state(
        CharState(id="c", atk=100, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0),
        MonsterState(id="m", def_=0, hp=1, hp_current=1),
    )
    # No dva_stacks attribute set
    assert _compose_dva_multiplier(state, "m", direction="take") == 1.0


def test_compose_dva_multiplier_no_index_returns_1():
    state = _state(
        CharState(id="c", atk=100, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0),
        MonsterState(id="m", def_=0, hp=1, hp_current=1),
    )
    state.dva_stacks = {"m": {"cs_91": 3}}
    # No cs_multiplier_index attribute set
    assert _compose_dva_multiplier(state, "m", direction="take") == 1.0


def test_compose_dva_multiplier_one_take_modifier_with_presence():
    state = _state(
        CharState(id="c", atk=100, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0),
        MonsterState(id="m", def_=0, hp=1, hp_current=1),
    )
    state.dva_stacks = {"m": {"cs_91": 3}}
    state.cs_multiplier_index = _MockMultiplierIndex({
        "cs_91": [DamageModifier(
            cs_id="cs_91", eff_value=50, sign="MATHSIGN_ADD_HUND_MULTIPLY_PCT",
            direction="take", link_cs_id=[], source_id="cs_91_01",
        )]
    })
    assert _compose_dva_multiplier(state, "m", direction="take") == 1.5


def test_compose_dva_multiplier_two_take_modifiers_compose_multiplicatively():
    state = _state(
        CharState(id="c", atk=100, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0),
        MonsterState(id="m", def_=0, hp=1, hp_current=1),
    )
    state.dva_stacks = {"m": {"cs_a": 1, "cs_b": 1}}
    state.cs_multiplier_index = _MockMultiplierIndex({
        "cs_a": [DamageModifier(
            cs_id="cs_a", eff_value=50, sign="MATHSIGN_MULTIPLY_PCT",
            direction="take", link_cs_id=[], source_id="cs_a_01",
        )],
        "cs_b": [DamageModifier(
            cs_id="cs_b", eff_value=50, sign="MATHSIGN_MULTIPLY_PCT",
            direction="take", link_cs_id=[], source_id="cs_b_01",
        )],
    })
    # 1.5 * 1.5 = 2.25
    assert _compose_dva_multiplier(state, "m", direction="take") == 2.25


def test_compose_dva_multiplier_attack_modifier_skipped_for_take_call():
    state = _state(
        CharState(id="c", atk=100, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0),
        MonsterState(id="m", def_=0, hp=1, hp_current=1),
    )
    state.dva_stacks = {"m": {"cs_91": 1}}
    state.cs_multiplier_index = _MockMultiplierIndex({
        "cs_91": [DamageModifier(
            cs_id="cs_91", eff_value=50, sign="MATHSIGN_MULTIPLY_PCT",
            direction="attack", link_cs_id=[], source_id="cs_91_01",
        )]
    })
    # attack-direction modifier not applied when caller asks for take
    assert _compose_dva_multiplier(state, "m", direction="take") == 1.0


def test_compose_dva_multiplier_skips_mathsign_add_in_v1():
    state = _state(
        CharState(id="c", atk=100, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0),
        MonsterState(id="m", def_=0, hp=1, hp_current=1),
    )
    state.dva_stacks = {"m": {"cs_91": 1}}
    state.cs_multiplier_index = _MockMultiplierIndex({
        "cs_91": [DamageModifier(
            cs_id="cs_91", eff_value=120, sign="MATHSIGN_ADD",
            direction="take", link_cs_id=[], source_id="cs_91_01",
        )]
    })
    # MATHSIGN_ADD (flat add) not composed as multiplier in v1
    assert _compose_dva_multiplier(state, "m", direction="take") == 1.0


def test_compose_dva_multiplier_skips_modifiers_with_link_cs_id():
    state = _state(
        CharState(id="c", atk=100, def_=0, hp=1, hp_current=1, cri=0.0, cri_dmg_rate=0),
        MonsterState(id="m", def_=0, hp=1, hp_current=1),
    )
    state.dva_stacks = {"m": {"cs_91": 1}}
    state.cs_multiplier_index = _MockMultiplierIndex({
        "cs_91": [DamageModifier(
            cs_id="cs_91", eff_value=50, sign="MATHSIGN_MULTIPLY_PCT",
            direction="take", link_cs_id=["cs_other"], source_id="cs_91_01",
        )]
    })
    # link_cs_id-gated modifier skipped in v1 (conditional gates not evaluated)
    assert _compose_dva_multiplier(state, "m", direction="take") == 1.0


def test_f_base_dmg_applies_caster_and_target_dva_when_state_has_index():
    """When both caster and target have applicable modifiers, F_BASE_DMG
    multiplies by both dva multipliers."""
    caster = CharState(id="c", atk=1000, def_=0, hp=1, hp_current=1,
                       cri=0.0, cri_dmg_rate=0)
    target = MonsterState(id="m1", def_=0, hp=99999, hp_current=99999,
                          dmg_decrease_rate=0.0)
    state = _state(caster, target)
    state.dva_stacks = {
        "c": {"cs_attack": 1},
        "m1": {"cs_take": 1},
    }
    state.cs_multiplier_index = _MockMultiplierIndex({
        "cs_attack": [DamageModifier(
            cs_id="cs_attack", eff_value=50, sign="MATHSIGN_MULTIPLY_PCT",
            direction="attack", link_cs_id=[], source_id="cs_attack_01",
        )],
        "cs_take": [DamageModifier(
            cs_id="cs_take", eff_value=100, sign="MATHSIGN_ADD_HUND_MULTIPLY_PCT",
            direction="take", link_cs_id=[], source_id="cs_take_01",
        )],
    })
    # Base: 1000 * 1.0 * (1 - 268/503) * 1.0 * 1.0 ≈ 467
    # With caster_dva=1.5, target_dva=2.0: 467 * 1.5 * 2.0 ≈ 1401
    raw = {"id": "fake", "eff": "SKILL_EFF_DMG", "eff_value": "100",
           "eff_count_value": "1", "target_unit_type": "TARGET_UNIT_SELECTED",
           "link_cs_id": "[]"}
    inst = EffInstance(id="fake", eff_type="SKILL_EFF_DMG", raw=raw)
    result = _formula_base_damage(inst, caster, [target], state)
    assert 1380 <= result.damage <= 1420  # ~1401 ± 1.5%


def test_f_base_dmg_track_b_verified_hit_1_unchanged_post_2e1():
    """Regression: Track B's c_30075_srt4_mut hit MUST still pass ±5%.
    No state.dva_stacks, no cs_multiplier_index → both multipliers degrade
    to 1.0 → behavior identical."""
    caster = CharState(id="c", atk=1087, def_=300, hp=1, hp_current=1,
                       cri=10.0, cri_dmg_rate=221.0)
    target = MonsterState(id="m", def_=540, hp=99999, hp_current=99999,
                          dmg_decrease_rate=0.334)
    state = _state(caster, target)
    result = _formula_base_damage(_fake_inst(75), caster, [target], state)
    assert abs(result.damage - 547) / 547 < 0.05


# =============================================================================
# Sprint 2f1 — Track B oracle hits (3 known failing per docs/research/combat_mechanics.md).
# Encoded as @pytest.mark.xfail(strict=False) so v1 closing one silently is OK.
# Sprint 2f1 measurement-first deep-dive concluded:
#   - v2 cs_multiplier features (count scaling / MATHSIGN_ADD / link_cs_id) do NOT
#     explain the LBK 4.43x gap; the actual mechanism is csMap[cs].term_value-based
#     (deferred to Sprint 2f2).
#   - The two c_30093_srt4_rsp1 hits aren't measurable in the available captures
#     (snapshots don't land after Heidemarie skill hits).
# These oracles remain in tree as permanent regression markers.  When Sprint 2f2's
# term_value implementation lands, remove @pytest.mark.xfail from the closed hit.
# =============================================================================

from api.game_data.cs_multipliers import CSMultiplierIndex as _SprintTrackBCSIndex


def _track_b_state(caster: CharState, target: MonsterState,
                   dva_stacks: dict | None = None,
                   with_real_cs_index: bool = False,
                   rng_seed: int = 0) -> BattleState:
    """Construct a BattleState for Track B oracle reconstructions."""
    state = BattleState(turn=1, player_team=[caster], enemies=[target],
                        hand=[], deck=[], discard=[], morale=0,
                        ego_state={}, spark_state={}, cs_stacks={},
                        rng=random.Random(rng_seed))
    if dva_stacks is not None:
        state.dva_stacks = dva_stacks
    if with_real_cs_index:
        state.cs_multiplier_index = _SprintTrackBCSIndex()
    return state


def _track_b_dmg_inst(eff_value: int) -> EffInstance:
    raw = {"id": "track_b_oracle", "eff": "SKILL_EFF_DMG",
           "eff_value": str(eff_value), "eff_count_value": "1",
           "target_unit_type": "TARGET_UNIT_SELECTED", "link_cs_id": "[]"}
    return EffInstance(id="track_b_oracle", eff_type="SKILL_EFF_DMG", raw=raw)


@pytest.mark.xfail(strict=False, reason=(
    "Sprint 2f1: documented in docs/research/combat_mechanics.md "
    "(c_30093_srt4_rsp1 crit obs=1398, pred=1275, -8.8%). "
    "Hypothesis: dva_css [110,111,112] consumed before snapshot. "
    "Not measurable in available captures; closing depends on Sprint 2f2 "
    "term_value-based composition."
))
def test_track_b_oracle_c_30093_srt4_rsp1_crit_1398():
    # Stub inputs — derived from doc (no capture-source available for this hit).
    caster = CharState(id="c", atk=1000, def_=300, hp=1, hp_current=1,
                       cri=100.0, cri_dmg_rate=237.0)
    target = MonsterState(id="m", def_=500, hp=99999, hp_current=99999,
                          dmg_decrease_rate=0.27)
    state = _track_b_state(caster, target, dva_stacks={
        "m": {"cs00_0110": 1, "cs00_0111": 1, "cs00_0112": 1}
    }, with_real_cs_index=True)
    result = _formula_base_damage(_track_b_dmg_inst(75), caster, [target], state)
    assert abs(result.damage - 1398) / 1398 < 0.05


@pytest.mark.xfail(strict=False, reason=(
    "Sprint 2f1: documented in docs/research/combat_mechanics.md "
    "(c_30093_srt4_rsp1 crit obs=1148, pred=1275, +11.0%). "
    "Same root cause as the 1398 hit but different stack values consumed. "
    "Closing depends on Sprint 2f2 term_value-based composition."
))
def test_track_b_oracle_c_30093_srt4_rsp1_crit_1148():
    caster = CharState(id="c", atk=1000, def_=300, hp=1, hp_current=1,
                       cri=100.0, cri_dmg_rate=237.0)
    target = MonsterState(id="m", def_=500, hp=99999, hp_current=99999,
                          dmg_decrease_rate=0.27)
    state = _track_b_state(caster, target, dva_stacks={
        "m": {"cs00_0110": 1, "cs00_0111": 1, "cs00_0112": 1}
    }, with_real_cs_index=True)
    result = _formula_base_damage(_track_b_dmg_inst(75), caster, [target], state)
    assert abs(result.damage - 1148) / 1148 < 0.05


@pytest.mark.xfail(strict=False, reason=(
    "Sprint 2f1: documented in docs/research/combat_mechanics.md "
    "(c_1052_uni4_lbk crit obs=10743, pred=3029, -71.8%, 4.43x multiplier). "
    "Sprint 2f1 deep-dive confirmed in capture websocket_debug_20260510_154057: "
    "target 39 seq=425 sim=1771 obs=4197 (same mechanic, different battle). "
    "Hypothesis: csMap[cs].term_value-based charging stack — NOT explained by "
    "cs_multipliers v2 features A/B/C. Closing depends on Sprint 2f2 architecture."
))
def test_track_b_oracle_c_1052_uni4_lbk_crit_10743():
    caster = CharState(id="c", atk=1500, def_=300, hp=1, hp_current=1,
                       cri=100.0, cri_dmg_rate=195.0)
    target = MonsterState(id="m", def_=500, hp=99999, hp_current=99999,
                          dmg_decrease_rate=0.27)
    state = _track_b_state(caster, target, dva_stacks={
        "m": {"cs00_0091": 23}
    }, with_real_cs_index=True)
    result = _formula_base_damage(_track_b_dmg_inst(100), caster, [target], state)
    assert abs(result.damage - 10743) / 10743 < 0.05


# ===========================================================================
# Sprint 2f2 — _compose_skill_map_multiplier (v2 path, Branch E no-op)
# ===========================================================================

from api.simulator.formulas import _compose_skill_map_multiplier


def test_compose_skill_map_multiplier_returns_1_when_state_lacks_skill_map():
    """Synth/Track B states leave skill_map_raw=None -> identity 1.0."""
    import random
    from api.simulator.state import BattleState
    state = BattleState(
        turn=1, player_team=[], enemies=[], hand=[], deck=[], discard=[],
        morale=0, ego_state={}, spark_state={}, cs_stacks={},
        rng=random.Random(0),
    )
    assert _compose_skill_map_multiplier(state, "any_unit", direction="take") == 1.0


def test_compose_skill_map_multiplier_returns_1_when_state_lacks_cs_map():
    """skill_map_raw populated but cs_map_raw absent -> identity 1.0."""
    import random
    from api.simulator.state import BattleState
    state = BattleState(
        turn=1, player_team=[], enemies=[], hand=[], deck=[], discard=[],
        morale=0, ego_state={}, spark_state={}, cs_stacks={},
        rng=random.Random(0),
        skill_map_raw={"1": {"eff_value": 50}},
    )
    assert _compose_skill_map_multiplier(state, "any_unit", direction="take") == 1.0


def test_compose_skill_map_multiplier_branch_E_returns_1_regardless_of_input():
    """Branch E no-op: returns 1.0 even with full state.skill_map_raw + cs_map_raw."""
    import random
    from api.simulator.state import BattleState
    state = BattleState(
        turn=1, player_team=[], enemies=[], hand=[], deck=[], discard=[],
        morale=0, ego_state={}, spark_state={}, cs_stacks={},
        rng=random.Random(0),
        skill_map_raw={"10": {"eff_value": 100, "eff_opts": [], "parent": {"type": "CS"}}},
        cs_map_raw={"100": {"owner_id": 39, "term_value": 5, "skillEffs": [10]}},
    )
    # Branch E ignores everything and returns 1.0
    assert _compose_skill_map_multiplier(state, "39", direction="take") == 1.0
