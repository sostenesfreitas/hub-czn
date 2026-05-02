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
