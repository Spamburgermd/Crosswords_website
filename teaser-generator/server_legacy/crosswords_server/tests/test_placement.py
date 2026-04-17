
"""Regression tests for crossword word placement rules."""

from __future__ import annotations

import random
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import pytest

from crosswords_server.app.services.placement import auto_place_all_words

GRID_SIZE = 10

FOUR_LETTER = [
    "LENT",
    "ANTE",
    "PANE",
    "NEAT",
    "TAPE",
    "PELT",
    "LATE",
    "TEAL",
    "TALC",
    "PLAN",
    "PEAN",
]

FIVE_LETTER = [
    "PLANT",
    "LEANT",
    "PETAL",
    "PLATE",
    "TAPES",
    "LEAPT",
    "PLEAT",
    "LATEN",
    "ALPEN",
]

SIX_LETTER = [
    "PLANET",
    "PLANER",
    "PLANED",
    "PLANTE",
    "PLANES",
]


Coord = Tuple[int, int]
LettersMap = Dict[Coord, str]


def _check_rules(letters: LettersMap, placed: Sequence[dict]) -> Optional[str]:
    """Return None when the placement respects adjacency/intersection rules."""

    word_coords: List[set[Coord]] = [set(tuple(coord) for coord in entry["coords"]) for entry in placed]
    for i in range(len(word_coords)):
        for j in range(i + 1, len(word_coords)):
            shared = word_coords[i] & word_coords[j]
            if len(shared) > 1:
                return (
                    f"Words '{placed[i]['text']}' and '{placed[j]['text']}' share "
                    f"{len(shared)} letters at {sorted(shared)}"
                )

    horizontal_spans = {
        tuple(tuple(coord) for coord in entry["coords"])
        for entry in placed
        if entry.get("orient") == "H"
    }
    vertical_spans = {
        tuple(tuple(coord) for coord in entry["coords"])
        for entry in placed
        if entry.get("orient") == "V"
    }

    grid: List[List[Optional[str]]] = [[None for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    for (r, c), ch in letters.items():
        grid[r][c] = ch

    for r in range(GRID_SIZE):
        c = 0
        while c < GRID_SIZE:
            if grid[r][c]:
                segment: List[Coord] = []
                while c < GRID_SIZE and grid[r][c]:
                    segment.append((r, c))
                    c += 1
                if len(segment) >= 2 and tuple(segment) not in horizontal_spans:
                    return f"Row {r} has extraneous wordlet {segment}"
            else:
                c += 1

    for c in range(GRID_SIZE):
        r = 0
        while r < GRID_SIZE:
            if grid[r][c]:
                segment = []
                while r < GRID_SIZE and grid[r][c]:
                    segment.append((r, c))
                    r += 1
                if len(segment) >= 2 and tuple(segment) not in vertical_spans:
                    return f"Column {c} has extraneous wordlet {segment}"
            else:
                r += 1

    return None


@pytest.mark.slow
def test_auto_place_respects_crossword_adjacency() -> None:
    """High-volume random placements should never violate adjacency rules."""

    random.seed(1337)
    successes = 0
    attempts = 0
    target_successes = 10_000
    max_attempts = 50_000

    while successes < target_successes and attempts < max_attempts:
        attempts += 1
        word_set = [
            random.choice(SIX_LETTER),
            *random.sample(FOUR_LETTER, 2),
            *random.sample(FIVE_LETTER, 2),
        ]

        letters, placed = auto_place_all_words(word_set)
        if not letters or not placed:
            continue  # retry with a fresh random selection

        failure = _check_rules(letters, placed)
        if failure:
            pytest.fail(
                f"Placement failed adjacency rules after {successes} successes "
                f"(attempt {attempts}): {failure}. Words={word_set}, placed={placed}"
            )

        successes += 1

    assert successes == target_successes, (
        f"Expected {target_successes} successful placements, got {successes} after {attempts} attempts"
    )
