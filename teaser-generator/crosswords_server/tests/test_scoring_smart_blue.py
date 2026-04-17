import pytest

from app.game_logic.scoring import score_guess


def test_smart_blue_example_letter():
    """Example A: LETTER target with other word PROSE; S should become BLUE."""
    target = "LETTER"
    others = ["PROSE"]
    guess = "SETLER"
    # Expected: S=BLUE, E=GREEN, T=GREEN, L=YELLOW, E=GREEN, R=GREEN
    assert score_guess(guess, target, others) == ["B", "G", "G", "Y", "G", "G"]


def test_smart_blue_global_pool_shrinks():
    """Global pool counts are consumed so repeated blues cannot exceed true counts.

    Post-pass upgrade: if a letter got Blue anywhere in the guess, remaining Reds
    of that letter are upgraded to Blue to avoid the Blue+Red contradiction.
    """
    target = "PROSE"
    others = ["LETTER"]
    # Global letters: P R O S E L E T T E R
    # Guess uses T twice; only two T's exist globally, both should be consumed once used.
    first = score_guess("TTOOO", target, others)
    # Two T's should be BLUE (global), remaining O's handled normally (one yellow, others red).
    assert first[0] == "B" and first[1] == "B"
    # A second guess reusing many T's: pool has 2 T's → first 2 are Blue, rest would be Red,
    # but post-pass upgrades all Reds of T to Blue since T got Blue.
    second = score_guess("TTTTT", target, others)
    assert second == ["B", "B", "B", "B", "B"]

