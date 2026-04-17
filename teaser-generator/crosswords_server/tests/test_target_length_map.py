from crosswords_server.app.routers.games import _canonical_targets_from_layout


def test_target_length_map_ignores_word_list_order():
    layout = [
        {"coords": [[0, 0], [0, 1], [0, 2], [0, 3]], "orient": "H"},
        {"coords": [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]], "orient": "H"},
        {"coords": [[2, 0], [3, 0], [4, 0]], "orient": "V"},
        {"coords": [[3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6]], "orient": "H"},
    ]
    canonical = _canonical_targets_from_layout(layout)
    length_map = {entry["target_index"]: entry["length"] for entry in canonical}

    naive_target_lengths = [4, 5, 3, 4]  # pretend the stored word list has mismatched lengths
    assert length_map[3] == 6
    assert length_map[3] != naive_target_lengths[3]
    assert length_map[0] == 4
