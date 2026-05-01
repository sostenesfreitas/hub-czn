def test_status_ok(client):
    response = client.get("/api/status")
    assert response.status_code == 200


def test_status_no_data_loaded(client):
    data = client.get("/api/status").json()
    assert data["ok"] is True
    assert data["data_loaded"] is False
    assert data["fragments"] == 0
    assert data["combatants"] == 0
    assert data["loaded_file"] is None


def test_load_missing_path_returns_422(client):
    response = client.post("/api/load", json={})
    assert response.status_code == 422


def test_fragments_without_load_returns_400(client):
    response = client.get("/api/fragments")
    assert response.status_code == 400


def test_game_data_has_sets_and_stats(client):
    response = client.get("/api/game-data")
    assert response.status_code == 200
    body = response.json()
    assert "sets" in body
    assert "stats" in body
    assert len(body["sets"]) > 0
