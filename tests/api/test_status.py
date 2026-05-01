def test_status_ok(client):
    response = client.get("/api/status")
    assert response.status_code == 200


def test_status_no_data_loaded(client):
    data = response = client.get("/api/status").json()
    assert data["ok"] is True
    assert data["data_loaded"] is False
    assert data["fragments"] == 0
    assert data["combatants"] == 0
    assert data["loaded_file"] is None
