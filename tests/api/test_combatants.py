def test_combatants_no_data_returns_empty_list(client):
    response = client.get("/api/combatants")
    assert response.status_code == 200
    assert response.json() == []


def test_combatants_response_is_list(client):
    body = client.get("/api/combatants").json()
    assert isinstance(body, list)


def test_combatant_stats_no_data_returns_404(client):
    response = client.get("/api/combatants/Nine/stats")
    assert response.status_code == 404


def test_combatant_stats_unknown_char_returns_404(client):
    response = client.get("/api/combatants/NonexistentCharacter/stats")
    assert response.status_code == 404


def test_combatants_export_no_data(client):
    response = client.get("/api/combatants/export")
    assert response.status_code == 422


def test_combatants_export_returns_detail_when_no_data(client):
    response = client.get("/api/combatants/export")
    assert response.status_code == 422
    assert "No data loaded" in response.json()["detail"]
