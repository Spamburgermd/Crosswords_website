"""UI-facing proxy to the shared placement engine."""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

PlacementResult = Tuple[Optional[Dict[tuple[int, int], str]], Optional[List[dict]]]

try:
    from crosswords_server.app.services.placement_impl import auto_place_all_words as _server_auto_place  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - standalone UI fallback
    import sys
    from pathlib import Path as _Path

    _server_auto_place = None
    current = _Path(__file__).resolve()
    repo_root = None
    for parent in current.parents:
        if (parent / 'crosswords_server').exists():
            repo_root = parent
            break
    if repo_root:
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))
        try:
            from crosswords_server.app.services.placement_impl import auto_place_all_words as _server_auto_place  # type: ignore
        except ModuleNotFoundError:
            _server_auto_place = None


def auto_place_all_words(words: List[str], max_tries: int = 2000) -> PlacementResult:
    """Delegate to the server placement engine to keep rules in sync."""
    if _server_auto_place is None:
        raise RuntimeError(
            "Server placement engine unavailable. Ensure crosswords_server is on PYTHONPATH "
            "or install the package before using auto placement."
        )
    # The server implementation ignores max_tries but we keep the signature for compatibility.
    return _server_auto_place(words)
