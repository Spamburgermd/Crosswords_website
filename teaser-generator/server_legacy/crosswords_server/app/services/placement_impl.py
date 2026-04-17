from __future__ import annotations
from typing import Dict, List, Tuple, Optional

GRID_SIZE = 10
Coord = Tuple[int, int]
LettersMap = Dict[Coord, str]

def auto_place_all_words(words: List[str]) -> Tuple[Optional[LettersMap], Optional[List[dict]]]:
    clean: List[str] = []
    for w in words:
        w2 = ''.join(ch for ch in (w or '').upper() if 'A' <= ch <= 'Z')
        if not w2 or len(w2) > GRID_SIZE:
            return None, None
        clean.append(w2)

    letters: LettersMap = {}
    placed: List[dict] = []
    coord_to_words: Dict[Coord, set[int]] = {}

    word_specs = sorted(
        [(word, idx) for idx, word in enumerate(clean)],
        key=lambda item: (-len(item[0]), item[1]),
    )

    def in_bounds(r: int, c: int) -> bool:
        return 0 <= r < GRID_SIZE and 0 <= c < GRID_SIZE

    def cells_for(word: str, r: int, c: int, orient: str) -> List[Coord]:
        if orient == 'H':
            return [(r, c + i) for i in range(len(word))]
        return [(r + i, c) for i in range(len(word))]

    def add_coord_owner(idx: int, coord: Coord) -> None:
        coord_to_words.setdefault(coord, set()).add(idx)

    def can_place(word: str, r: int, c: int, orient: str) -> tuple[bool, int]:
        coords = cells_for(word, r, c, orient)
        intersections_per_word: Dict[int, int] = {}
        total_intersections = 0

        for pos, (rr, cc) in enumerate(coords):
            if not in_bounds(rr, cc):
                return False, 0

            existing = letters.get((rr, cc))
            if existing is not None:
                if existing != word[pos]:
                    return False, 0
                owners = coord_to_words.get((rr, cc), set())
                for owner in owners:
                    intersections_per_word[owner] = intersections_per_word.get(owner, 0) + 1
                    if intersections_per_word[owner] > 1:
                        return False, 0
                total_intersections += 1
                continue

            if orient == 'H':
                neighbors = [(rr - 1, cc), (rr + 1, cc)]
            else:
                neighbors = [(rr, cc - 1), (rr, cc + 1)]
            for nr, nc in neighbors:
                if in_bounds(nr, nc) and (nr, nc) in letters:
                    return False, 0

        # Ensure the cells immediately before and after the word are clear
        if coords:
            if orient == 'H':
                edge_cells = [
                    (coords[0][0], coords[0][1] - 1),
                    (coords[-1][0], coords[-1][1] + 1),
                ]
            else:
                edge_cells = [
                    (coords[0][0] - 1, coords[0][1]),
                    (coords[-1][0] + 1, coords[-1][1]),
                ]
            for er, ec in edge_cells:
                if in_bounds(er, ec) and (er, ec) in letters:
                    return False, 0

        if placed and total_intersections == 0:
            return False, 0
        return True, total_intersections

    def commit(word: str, r: int, c: int, orient: str, original_index: int) -> None:
        coords = cells_for(word, r, c, orient)
        idx = len(placed)
        for (rr, cc), ch in zip(coords, word):
            letters[(rr, cc)] = ch
            add_coord_owner(idx, (rr, cc))
        placed.append({
            'text': word,
            'orient': orient,
            'coords': coords,
            'original_index': original_index,
        })

    # Place first word near the middle horizontally
    first_word, first_idx = word_specs[0]
    start_r = GRID_SIZE // 2
    start_c = max(0, (GRID_SIZE - len(first_word)) // 2)
    ok, _ = can_place(first_word, start_r, start_c, 'H')
    if not ok:
        found = False
        for rr in range(GRID_SIZE):
            for cc in range(GRID_SIZE - len(first_word) + 1):
                ok, _ = can_place(first_word, rr, cc, 'H')
                if ok:
                    commit(first_word, rr, cc, 'H', first_idx)
                    found = True
                    break
            if found:
                break
        if not found:
            return None, None
    else:
        commit(first_word, start_r, start_c, 'H', first_idx)

    # Place remaining words
    for word, original_index in word_specs[1:]:
        placed_this = False

        letter_cells: Dict[str, List[Coord]] = {}
        for coord, ch in letters.items():
            letter_cells.setdefault(ch, []).append(coord)

        for offset, ch in enumerate(word):
            if ch not in letter_cells:
                continue
            for (er, ec) in letter_cells[ch]:
                start_r = er
                start_c = ec - offset
                if in_bounds(start_r, start_c) and in_bounds(start_r, start_c + len(word) - 1):
                    ok, _ = can_place(word, start_r, start_c, 'H')
                    if ok:
                        commit(word, start_r, start_c, 'H', original_index)
                        placed_this = True
                        break

                start_r = er - offset
                start_c = ec
                if in_bounds(start_r, start_c) and in_bounds(start_r + len(word) - 1, start_c):
                    ok, _ = can_place(word, start_r, start_c, 'V')
                    if ok:
                        commit(word, start_r, start_c, 'V', original_index)
                        placed_this = True
                        break
            if placed_this:
                break

        if not placed_this:
            for rr in range(GRID_SIZE):
                for cc in range(GRID_SIZE):
                    for orient in ('H', 'V'):
                        ok, inter = can_place(word, rr, cc, orient)
                        if ok and inter >= 1:
                            commit(word, rr, cc, orient, original_index)
                            placed_this = True
                            break
                    if placed_this:
                        break
                if placed_this:
                    break

        if not placed_this:
            return None, None

    placed_sorted: List[dict] = []
    for entry in sorted(placed, key=lambda e: e['original_index']):
        cleaned = entry.copy()
        cleaned.pop('original_index', None)
        placed_sorted.append(cleaned)

    return letters, placed_sorted
