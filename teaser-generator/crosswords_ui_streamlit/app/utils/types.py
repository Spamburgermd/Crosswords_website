# app/utils/types.py
# Central place for shared type aliases so imports are consistent.

from typing import Dict, Tuple

Coord = Tuple[int, int]            # (row, col)
LettersMap = Dict[Coord, str]      # {(row, col): "A", ...}
