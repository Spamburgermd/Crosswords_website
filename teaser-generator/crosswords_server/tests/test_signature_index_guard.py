import pytest
from fastapi import HTTPException

from crosswords_server.app.routers.games import _resolve_signature_and_index


def _sample_targets():
    return [
        {
            "target_index": 0,
            "length": 5,
            "coords": [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
            "dir": "A",
            "signature": "A|0,0;0,1;0,2;0,3;0,4",
        },
        {
            "target_index": 1,
            "length": 4,
            "coords": [[0, 0], [1, 0], [2, 0], [3, 0]],
            "dir": "D",
            "signature": "D|0,0;1,0;2,0;3,0",
        },
    ]


def test_signature_and_index_must_match():
    canonical = _sample_targets()
    with pytest.raises(HTTPException) as excinfo:
        _resolve_signature_and_index(
            canonical[1]["signature"],
            parsed_target_index=0,
            canonical_targets=canonical,
            request_id="test",
        )
    assert excinfo.value.status_code == 400
    assert "target_signature maps to target_index" in str(excinfo.value.detail)


def test_signature_resolves_when_matching():
    canonical = _sample_targets()
    entry, idx, sig = _resolve_signature_and_index(
        canonical[1]["signature"],
        parsed_target_index=1,
        canonical_targets=canonical,
        request_id="test",
    )
    assert idx == 1
    assert sig == canonical[1]["signature"]
    assert entry["length"] == 4
