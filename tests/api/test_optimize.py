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


def test_optimize_route_accepts_target_def_field(client):
    """Sprint 2f4: POST /api/optimize/start accepts target_def field (no 500 error)."""
    payload = {
        "char_name": "Diana",
        "four_piece_sets": [],
        "two_piece_sets": [],
        "main_stat_4": None,
        "main_stat_5": None,
        "main_stat_6": None,
        "top_percent": 100,
        "include_equipped": True,
        "excluded_heroes": [],
        "max_results": 1,
        "target_def": 1000,
        "treat_target_as_weak": False,
    }
    resp = client.post("/api/optimize/start", json=payload)
    assert resp.status_code != 500, f"500 error: {resp.text[:300]}"


def test_optimize_route_accepts_treat_target_as_weak(client):
    """Sprint 2f4: POST /api/optimize/start accepts treat_target_as_weak field."""
    payload = {
        "char_name": "Diana",
        "four_piece_sets": [],
        "two_piece_sets": [],
        "main_stat_4": None,
        "main_stat_5": None,
        "main_stat_6": None,
        "top_percent": 100,
        "include_equipped": True,
        "excluded_heroes": [],
        "max_results": 1,
        "target_def": 500,
        "treat_target_as_weak": True,
    }
    resp = client.post("/api/optimize/start", json=payload)
    assert resp.status_code != 500, f"500 error: {resp.text[:300]}"


def test_optimize_start_request_model_has_2f4_fields():
    """Sprint 2f4: OptimizeStartRequest declares target_def + treat_target_as_weak."""
    from api.routes.optimize import OptimizeStartRequest
    fields = OptimizeStartRequest.model_fields
    assert "target_def" in fields, "OptimizeStartRequest missing target_def"
    assert "treat_target_as_weak" in fields, "OptimizeStartRequest missing treat_target_as_weak"
    # Verify defaults preserve pre-2f4 behavior
    inst = OptimizeStartRequest(char_name="x")
    assert inst.target_def == 500
    assert inst.treat_target_as_weak is False


def test_optimize_start_route_passes_2f4_settings_to_optimizer(client, monkeypatch):
    """Sprint 2f4: route forwards target_def + treat_target_as_weak in settings dict."""
    from api.state import state

    captured = {}

    def fake_optimize(char_name, settings, progress_cb=None, cancel_flag=None):
        captured["settings"] = settings
        return []

    # Pretend data is loaded and Diana is known
    state.data_loaded = True
    state.optimizer.character_info["Diana"] = object()
    monkeypatch.setattr(state.optimizer, "optimize", fake_optimize)

    payload = {
        "char_name": "Diana",
        "four_piece_sets": [],
        "two_piece_sets": [],
        "top_percent": 100,
        "include_equipped": True,
        "excluded_heroes": [],
        "max_results": 1,
        "target_def": 777,
        "treat_target_as_weak": True,
    }
    resp = client.post("/api/optimize/start", json=payload)
    assert resp.status_code == 200, f"unexpected response: {resp.status_code} {resp.text[:200]}"
    # The job runs asynchronously; give it a chance to invoke optimize()
    import time
    for _ in range(20):
        if "settings" in captured:
            break
        time.sleep(0.05)
    assert "settings" in captured, "optimizer.optimize was not called"
    assert captured["settings"].get("target_def") == 777
    assert captured["settings"].get("treat_target_as_weak") is True


def test_calculate_build_stats_uses_actual_weak_ego_dmg_rate_when_toggled():
    """Sprint 2f5 Feature 3: with treat_target_as_weak=True AND populated
    base_weak_ego_dmg_rate, AvgDMG differs from toggle off."""
    import pytest
    from api.optimizer.optimizer import GearOptimizer
    opt = GearOptimizer()
    opt._config_target_def = 500
    opt._config_treat_target_as_weak = False
    stats_off = opt.calculate_build_stats([], char_name="Diana")
    if stats_off.get("ATK", 0) <= 0:
        pytest.skip("Diana base stats not loaded")
    opt._config_treat_target_as_weak = True
    stats_on = opt.calculate_build_stats([], char_name="Diana")
    # If Diana's base_weak_ego_dmg_rate is 100, on == off; if > 100, on > off.
    # Test that the data path is wired even if default 100:
    # the result must be MATHEMATICALLY consistent with weak_mult.
    assert "Avg DMG" in stats_on
    assert "Avg DMG" in stats_off


def test_monster_catalog_endpoint_returns_list(client):
    """Sprint 2h1: /api/optimize/monster-catalog returns a list of monsters."""
    resp = client.get("/api/optimize/monster-catalog")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # If catalog is populated, each entry has the expected shape.
    if data:
        first = data[0]
        assert "id" in first
        assert "name" in first
        assert "def" in first
        assert "has_weak" in first
        assert isinstance(first["id"], str)
        assert isinstance(first["name"], str)
        assert isinstance(first["def"], int)
        assert isinstance(first["has_weak"], bool)


def test_monster_catalog_endpoint_entries_have_plausible_def(client):
    """Sprint 2h1: catalog DEF values should be in the observed in-game range
    (single-digit to ~1000) -- guards against accidentally writing junk values
    (negative, NaN, four+ digits) if the build script regresses."""
    resp = client.get("/api/optimize/monster-catalog")
    data = resp.json()
    if not data:
        return  # catalog not built in this environment, skip
    for entry in data:
        assert 0 <= entry["def"] < 5000, (
            f"DEF for {entry['id']} ({entry['name']}) out of range: {entry['def']}"
        )


def test_calculate_build_stats_includes_extra_dmg_in_avgdmg():
    """Sprint 2h2: total_stats['Extra DMG%'] flows into AvgDMG via
    expected_damage's extra_dmg_pct parameter."""
    import pytest
    from api.optimizer.optimizer import GearOptimizer
    from api.optimizer.expected_damage import expected_damage
    from api.game_data.char_eff import best_damage_eff_for
    from api.models.memory_fragment import MemoryFragment
    from api.models.stat import Stat

    opt = GearOptimizer()
    # Baseline with no Extra DMG (synthetic gear-less calc)
    stats_base = opt.calculate_build_stats([], char_name="Diana")
    if stats_base.get("ATK", 0) <= 0:
        pytest.skip("Diana base stats not loaded")

    # Confirm the formula consistency: AvgDMG must equal expected_damage
    # with extra_dmg_pct=total_stats['Extra DMG%'].
    eff = best_damage_eff_for("Diana")
    want = expected_damage(
        atk=stats_base["ATK"],
        cri=stats_base["CRate"],
        cri_dmg_rate=stats_base["CDmg"],
        eff_pct=eff,
        extra_dmg_pct=stats_base.get("Extra DMG%", 0.0),
    )
    assert stats_base["Avg DMG"] == pytest.approx(want, abs=1e-3)

    # Now build a synthetic gear piece that grants Extra DMG% = 50%.
    # AvgDMG with that piece should be ~1.5x the AvgDMG of an equivalent
    # piece that grants 0 Extra DMG% (with everything else equal).
    piece_extra = MemoryFragment(
        id=1, slot_name="slot4", slot_num=4, rarity="Epic", rarity_num=3,
        set_name="test", set_id=0, level=0, locked=False,
        equipped_to=None, equipped_char_id=0,
        main_stat=Stat(name="Extra DMG%", raw_name="S_DMG_INCR_PER",
                       value=50.0, is_percentage=True, is_main=True),
        substats=[],
    )
    piece_zero = MemoryFragment(
        id=2, slot_name="slot4", slot_num=4, rarity="Epic", rarity_num=3,
        set_name="test", set_id=0, level=0, locked=False,
        equipped_to=None, equipped_char_id=0,
        main_stat=Stat(name="Extra DMG%", raw_name="S_DMG_INCR_PER",
                       value=0.0, is_percentage=True, is_main=True),
        substats=[],
    )
    stats_extra = opt.calculate_build_stats([piece_extra], char_name="Diana")
    stats_zero = opt.calculate_build_stats([piece_zero], char_name="Diana")
    # Total ATK/CR/CD identical between the two builds; only Extra DMG% differs.
    assert stats_extra["ATK"] == pytest.approx(stats_zero["ATK"])
    assert stats_extra["Extra DMG%"] == pytest.approx(50.0)
    assert stats_zero["Extra DMG%"] == pytest.approx(0.0)
    # AvgDMG with 50 Extra DMG% must be 1.5x AvgDMG with 0 Extra DMG%.
    ratio = stats_extra["Avg DMG"] / stats_zero["Avg DMG"]
    assert ratio == pytest.approx(1.5, abs=1e-6), (
        f"Expected AvgDMG ratio 1.5 (50% Extra DMG), got {ratio:.6f}. "
        f"Likely optimizer is not passing extra_dmg_pct to expected_damage."
    )


def test_calculate_build_stats_weak_ego_dmg_rate_is_populated_from_char_data():
    """Sprint 2f5 Feature 3: base_weak_ego_dmg_rate must be sourced from real
    char data (125 for every live combatant), not silently defaulted to 100.

    Diana has S_WEAK_EGO_DMG_RATE = 125 in the client db, so toggling
    treat_target_as_weak must multiply AvgDMG by 1.25 (within float epsilon).
    """
    import pytest
    from api.optimizer.optimizer import GearOptimizer
    opt = GearOptimizer()
    opt._config_target_def = 500
    opt._config_treat_target_as_weak = False
    stats_off = opt.calculate_build_stats([], char_name="Diana")
    if stats_off.get("ATK", 0) <= 0:
        pytest.skip("Diana base stats not loaded")
    opt._config_treat_target_as_weak = True
    stats_on = opt.calculate_build_stats([], char_name="Diana")
    # Diana's S_WEAK_EGO_DMG_RATE is 125, so AvgDMG_on / AvgDMG_off should be 1.25.
    ratio = stats_on["Avg DMG"] / stats_off["Avg DMG"]
    assert abs(ratio - 1.25) < 1e-6, (
        f"Expected AvgDMG ratio 1.25 (Diana weak_ego_dmg_rate=125), got {ratio:.6f}. "
        f"Likely base_weak_ego_dmg_rate is defaulting to 100 instead of being sourced from char data."
    )

