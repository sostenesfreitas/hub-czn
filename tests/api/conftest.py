import pytest
from fastapi.testclient import TestClient
from api.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_char_weights():
    from api.state import state
    state.optimizer.char_weights = {}
    yield
    state.optimizer.char_weights = {}
