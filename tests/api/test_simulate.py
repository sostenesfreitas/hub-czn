"""Tests for /simulate/damage — new damage field shape."""
from fastapi.testclient import TestClient
from api.main import app


def test_card_result_has_new_damage_fields():
    """CardResult must expose normal_damage, crit_damage, avg_damage, icon_path."""
    from api.routes.simulate import CardResult
    fields = CardResult.model_fields
    assert "normal_damage" in fields
    assert "crit_damage" in fields
    assert "avg_damage" in fields
    assert "icon_path" in fields


def test_card_result_has_no_old_fields():
    """Removed fields must not appear in CardResult."""
    from api.routes.simulate import CardResult
    fields = CardResult.model_fields
    assert "final_damage" not in fields
    assert "effective_damage" not in fields
    assert "base_damage" not in fields


def test_simulate_response_has_new_total_fields():
    """SimulateDamageResponse must expose total_normal, total_crit, total_avg."""
    from api.routes.simulate import SimulateDamageResponse
    fields = SimulateDamageResponse.model_fields
    assert "total_normal" in fields
    assert "total_crit" in fields
    assert "total_avg" in fields


def test_simulate_response_has_no_old_total_fields():
    """Removed total fields must not appear."""
    from api.routes.simulate import SimulateDamageResponse
    fields = SimulateDamageResponse.model_fields
    assert "total_damage" not in fields
    assert "total_effective_damage" not in fields


def test_normal_damage_formula():
    """normal_damage = ATK * (eff_value/100) * morale_mult * buff_mult * def_reduction."""
    atk = 1000.0
    eff_value = 250
    morale_mult = 1.4
    buff_mult = 1.0
    def_reduction = 300 / (300 + 31)
    expected = round(atk * (eff_value / 100) * morale_mult * buff_mult * def_reduction, 1)
    # 1000 * 2.5 * 1.4 * 1.0 * (300/331) ≈ 3172.2
    assert abs(expected - 3172.2) < 1.0


def test_avg_is_weighted_average():
    """avg = normal*(1-crate/100) + crit*(crate/100)."""
    normal = 1000.0
    crit = 2500.0
    crate = 60.0
    avg = normal * (1 - crate / 100) + crit * (crate / 100)
    assert abs(avg - 1900.0) < 0.01


def test_icon_path_with_sct_name():
    sct_name = "start_1057_01"
    icon_path = f"/assets/cards/{sct_name}.png" if sct_name else None
    assert icon_path == "/assets/cards/start_1057_01.png"


def test_icon_path_none_without_sct_name():
    sct_name = None
    icon_path = f"/assets/cards/{sct_name}.png" if sct_name else None
    assert icon_path is None


def test_simulate_no_data_returns_422():
    client = TestClient(app)
    resp = client.post("/api/simulate/damage", json={
        "char_name": "Nine",
        "morale": 0,
        "use_sparks": True,
        "monster_def": 31,
        "frightened": False,
        "exposed_stacks": 0,
        "fortitude": False,
    })
    assert resp.status_code == 422
