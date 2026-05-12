def test_optimize_sets_returns_sorted_list(client):
    response = client.get("/api/optimize/sets")
    assert response.status_code == 200
    sets = response.json()
    assert isinstance(sets, list)
    assert len(sets) > 0
    names = [s["name"] for s in sets]
    assert names == sorted(names)


def test_optimize_sets_each_item_has_id_and_name(client):
    sets = client.get("/api/optimize/sets").json()
    assert all("id" in s and "name" in s for s in sets)


def test_optimize_start_no_data_returns_422(client):
    response = client.post("/api/optimize/start", json={
        "char_name": "Nine",
        "four_piece_sets": [],
        "two_piece_sets": [],
        "top_percent": 100,
        "include_equipped": True,
        "excluded_heroes": [],
        "max_results": 10,
    })
    assert response.status_code == 422


def test_optimize_start_invalid_top_percent_returns_422(client):
    response = client.post("/api/optimize/start", json={
        "char_name": "Nine",
        "four_piece_sets": [],
        "two_piece_sets": [],
        "top_percent": 0,
        "include_equipped": True,
        "excluded_heroes": [],
        "max_results": 10,
    })
    assert response.status_code == 422


def test_optimize_cancel_no_job_returns_not_cancelled(client):
    response = client.post("/api/optimize/cancel")
    assert response.status_code == 200
    assert response.json() == {"cancelled": False}


def test_calculate_build_stats_avgdmg_is_expected_damage_formula():
    """AvgDMG must equal expected_damage(atk, cri, cdmg, eff_pct).

    Sprint 2e2: optimizer.py:421 was crude `atk * cr/100 * cd/100`;
    replaced with `expected_damage(...)` which matches Track B's
    validated formula structure (atk * eff/100 * (1-DR) * cf_ev).
    """
    import pytest

    from api.optimizer.optimizer import GearOptimizer
    from api.optimizer.expected_damage import expected_damage
    from api.game_data.char_eff import best_damage_eff_for

    opt = GearOptimizer()
    test_char = "Diana"
    stats = opt.calculate_build_stats([], char_name=test_char)
    if stats.get("ATK", 0) <= 0:
        pytest.skip(f"{test_char}: base stats not available in scaling data")

    eff_pct = best_damage_eff_for(test_char)
    want = expected_damage(
        atk=stats["ATK"],
        cri=stats["CRate"],
        cri_dmg_rate=stats["CDmg"],
        eff_pct=eff_pct,
    )
    assert stats["Avg DMG"] == pytest.approx(want, abs=1e-3)


def test_calculate_build_stats_avgdmg_differs_by_eff_pct():
    """Two chars with the same stats but different eff_pct should yield
    different AvgDMG values (proves eff_pct sourcing is wired)."""
    import pytest

    from api.optimizer.optimizer import GearOptimizer
    from api.game_data.char_eff import best_damage_eff_for

    opt = GearOptimizer()
    chars = []
    for name in ("Diana", "Nia", "Haru", "Veronica", "Narja"):
        s = opt.calculate_build_stats([], char_name=name)
        if s.get("ATK", 0) > 0:
            chars.append((name, s))
        if len(chars) >= 2:
            break

    if len(chars) < 2:
        pytest.skip("need at least 2 known chars with scaling data")

    eff_a = best_damage_eff_for(chars[0][0])
    eff_b = best_damage_eff_for(chars[1][0])
    if eff_a == eff_b:
        pytest.skip(f"{chars[0][0]} and {chars[1][0]} share eff_pct={eff_a}")

    assert chars[0][1]["Avg DMG"] != chars[1][1]["Avg DMG"]


def test_calculate_build_stats_returns_avg_dmg_key():
    """UI contract: the output dict still has the `Avg DMG` field."""
    from api.optimizer.optimizer import GearOptimizer
    opt = GearOptimizer()
    stats = opt.calculate_build_stats([], char_name="Diana")
    assert "Avg DMG" in stats


def test_calculate_build_stats_uses_target_def_from_config():
    """Sprint 2f4: target_def from optimize() settings flows into AvgDMG.

    Note: per Track B's empirical fit (DR = 268/(def+503)), higher target_def
    yields LESS damage reduction — so higher DEF → higher AvgDMG. This test
    asserts wiring (values differ), not the sign of the relationship.
    """
    import pytest
    from api.optimizer.optimizer import GearOptimizer

    opt = GearOptimizer()
    opt._config_target_def = 1000
    opt._config_treat_target_as_weak = False
    stats_high_def = opt.calculate_build_stats([], char_name="Diana")
    opt._config_target_def = 500
    stats_low_def = opt.calculate_build_stats([], char_name="Diana")
    if stats_high_def.get("ATK", 0) <= 0:
        pytest.skip("Diana base stats not loaded")
    assert stats_high_def["Avg DMG"] != stats_low_def["Avg DMG"]


def test_calculate_build_stats_uses_treat_target_as_weak():
    """Sprint 2f4: treat_target_as_weak=True multiplies AvgDMG by weak_ego_dmg_rate."""
    import pytest
    from api.optimizer.optimizer import GearOptimizer
    opt = GearOptimizer()
    opt._config_target_def = 500
    opt._config_treat_target_as_weak = False
    stats_off = opt.calculate_build_stats([], char_name="Diana")
    opt._config_treat_target_as_weak = True
    stats_on = opt.calculate_build_stats([], char_name="Diana")
    if stats_off.get("ATK", 0) <= 0:
        pytest.skip("Diana base stats not loaded")
    assert stats_on["Avg DMG"] >= stats_off["Avg DMG"]


def test_calculate_build_stats_defaults_preserve_pre_2f4_behavior():
    """Default config values match pre-2f4 expected_damage."""
    import pytest
    from api.optimizer.optimizer import GearOptimizer
    from api.optimizer.expected_damage import expected_damage
    from api.game_data.char_eff import best_damage_eff_for

    opt = GearOptimizer()
    stats = opt.calculate_build_stats([], char_name="Diana")
    if stats.get("ATK", 0) <= 0:
        pytest.skip("Diana base stats not loaded")
    eff_pct = best_damage_eff_for("Diana")
    want = expected_damage(
        atk=stats["ATK"],
        cri=stats["CRate"],
        cri_dmg_rate=stats["CDmg"],
        eff_pct=eff_pct,
    )
    assert stats["Avg DMG"] == pytest.approx(want, abs=1e-3)
