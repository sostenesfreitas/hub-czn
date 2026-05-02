def test_about_returns_version(client):
    response = client.get("/api/about")
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "1.8.0"


def test_about_returns_github_urls(client):
    response = client.get("/api/about")
    assert response.status_code == 200
    body = response.json()
    assert body["github_url"] == "https://github.com/sostenesfreitas/hub-czn"
    assert body["releases_url"] == "https://github.com/sostenesfreitas/hub-czn/releases"
    assert body["issues_url"] == "https://github.com/sostenesfreitas/hub-czn/issues"
