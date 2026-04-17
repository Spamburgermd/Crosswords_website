from __future__ import annotations  # (recommended on Py 3.10+ / 3.13)
from typing import Dict, Tuple, List, Set, Any
try:
    from ..utils.types import Coord, LettersMap
except ImportError:
    from utils.types import Coord, LettersMap

class GameState:
    def __init__(self, words: List[str], letters: Dict[Tuple[int,int], str], placed: List[dict], settings: Dict[str, Any]):
        self.words = words
        self.letters = letters
        self.placed = placed
        self.settings = settings
        self.guesses = []
