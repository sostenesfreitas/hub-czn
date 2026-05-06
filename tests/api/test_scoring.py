import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api'))
from game_data.constants import ALL_STAT_NAMES


def test_get_scoring_priorities_returns_all_stat_names(client):
    response = client.get("/api/scoring/priorities")
    assert response.status_code == 200
    body = response.json()
    assert "weights" in body
    assert set(body["weights"].keys()) == set(ALL_STAT_NAMES)


def test_get_scoring_priorities_values_are_ints(client):
    body = client.get("/api/scoring/priorities").json()
    for v in body["weights"].values():
        assert isinstance(v, int)


def test_save_scoring_priorities_round_trips(client):
    weights = {name: 5 for name in ALL_STAT_NAMES}
    response = client.post("/api/scoring/priorities", json={"weights": weights})
    assert response.status_code == 200
    assert response.json()["weights"] == weights


def test_save_scoring_priorities_value_above_10_returns_422(client):
    weights = {ALL_STAT_NAMES[0]: 11}
    response = client.post("/api/scoring/priorities", json={"weights": weights})
    assert response.status_code == 422


def test_save_scoring_priorities_negative_value_returns_422(client):
    weights = {ALL_STAT_NAMES[0]: -1}
    response = client.post("/api/scoring/priorities", json={"weights": weights})
    assert response.status_code == 422


def test_save_scoring_priorities_unknown_stat_returns_422(client):
    response = client.post("/api/scoring/priorities", json={"weights": {"NONEXISTENT_STAT": 5}})
    assert response.status_code == 422


def test_save_scoring_priorities_partial_update_merges(client):
    weights = {ALL_STAT_NAMES[0]: 7}
    response = client.post("/api/scoring/priorities", json={"weights": weights})
    assert response.status_code == 200
    body = response.json()["weights"]
    assert set(body.keys()) == set(ALL_STAT_NAMES)
    assert body[ALL_STAT_NAMES[0]] == 7


# ── char-weights ──────────────────────────────────────────────────────────────

def test_get_char_weights_no_override_returns_404(client):
    response = client.get("/api/scoring/char-weights/Luke")
    assert response.status_code == 404


def test_save_char_weights_round_trips(client):
    weights = {name: 5 for name in ALL_STAT_NAMES}
    response = client.post("/api/scoring/char-weights/Luke", json={"weights": weights})
    assert response.status_code == 200
    assert response.json()["weights"] == weights


def test_save_char_weights_unknown_stat_returns_422(client):
    response = client.post(
        "/api/scoring/char-weights/Luke",
        json={"weights": {"NONEXISTENT_STAT": 5}},
    )
    assert response.status_code == 422


def test_save_char_weights_value_above_10_returns_422(client):
    response = client.post(
        "/api/scoring/char-weights/Luke",
        json={"weights": {ALL_STAT_NAMES[0]: 11}},
    )
    assert response.status_code == 422


def test_get_char_weights_after_save_returns_weights(client):
    weights = {name: 3 for name in ALL_STAT_NAMES}
    client.post("/api/scoring/char-weights/Luke", json={"weights": weights})
    response = client.get("/api/scoring/char-weights/Luke")
    assert response.status_code == 200
    assert response.json()["weights"] == weights


def test_delete_char_weights_returns_ok(client):
    weights = {name: 5 for name in ALL_STAT_NAMES}
    client.post("/api/scoring/char-weights/Luke", json={"weights": weights})
    response = client.delete("/api/scoring/char-weights/Luke")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_delete_char_weights_then_get_returns_404(client):
    weights = {name: 5 for name in ALL_STAT_NAMES}
    client.post("/api/scoring/char-weights/Luke", json={"weights": weights})
    client.delete("/api/scoring/char-weights/Luke")
    response = client.get("/api/scoring/char-weights/Luke")
    assert response.status_code == 404


def test_delete_char_weights_nonexistent_returns_ok(client):
    response = client.delete("/api/scoring/char-weights/NonExistent")
    assert response.status_code == 200
    assert response.json()["ok"] is True
