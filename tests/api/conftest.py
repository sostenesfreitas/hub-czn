import pytest
from fastapi.testclient import TestClient
from api.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_optimizer_state():
    from api.state import state
    from game_data.constants import ALL_STAT_NAMES
    state.optimizer.char_weights = {}
    state.optimizer.priorities = {name: 0 for name in ALL_STAT_NAMES}
    yield
    state.optimizer.char_weights = {}
    state.optimizer.priorities = {name: 0 for name in ALL_STAT_NAMES}
