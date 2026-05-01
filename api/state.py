import sys
import os

# Allow importing from existing Vribbels package during transition
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Vribbels'))

from optimizer import GearOptimizer


class AppState:
    def __init__(self):
        self.optimizer = GearOptimizer()
        self.data_loaded: bool = False
        self.loaded_file: str | None = None


# Global singleton — imported by all route modules
state = AppState()
