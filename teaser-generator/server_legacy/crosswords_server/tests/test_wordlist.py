"""Sanity tests for EOWL-based word list: known words accepted, invalid rejected."""

from __future__ import annotations

import pytest

from crosswords_server.app.services import twl


def test_apple_is_valid() -> None:
    """APPLE is in EOWL; should be accepted."""
    assert twl.is_twl_word("APPLE") is True
    assert twl.is_twl_word("apple") is True


def test_invalid_word_rejected() -> None:
    """Random non-dictionary string should be rejected."""
    assert twl.is_twl_word("XXXXX") is False


def test_wordlist_has_required_lengths() -> None:
    """Bot needs 4, 5, 6-letter words; ensure pools are non-empty."""
    pool4 = twl.get_words_by_length(4)
    pool5 = twl.get_words_by_length(5)
    pool6 = twl.get_words_by_length(6)
    assert len(pool4) > 0, "Need 4-letter words for bot"
    assert len(pool5) > 0, "Need 5-letter words for bot"
    assert len(pool6) > 0, "Need 6-letter words for bot"
