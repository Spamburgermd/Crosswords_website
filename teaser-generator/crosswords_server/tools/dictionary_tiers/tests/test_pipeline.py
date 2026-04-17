"""Unit tests for dictionary tier build pipeline."""

from __future__ import annotations

import json
from pathlib import Path

from crosswords_server.tools.dictionary_tiers.build_wordlists import (
    WordRecord,
    build_records,
    normalize_word,
    records_sorted,
    write_outputs,
)


def make_config(tmp_path: Path, assignment_mode: str = "highest_only", overlap_policy: str = "allow") -> dict:
    """Build a compact config dict for tests."""
    allowlist = tmp_path / "allow.txt"
    allowlist.write_text(
        "apple\nfour\nyour\nour\nhour\ntour\npicker\nsicker\nlicker\nmuseum\nplanet\nthrone\ngame\ngames\nhat\nhats\narmor\narmour\nslurword\n",
        encoding="utf-8",
    )
    variant_map = tmp_path / "variants.yaml"
    variant_map.write_text("armour: armor\n", encoding="utf-8")
    deny = tmp_path / "deny.txt"
    deny.write_text("slurword\n", encoding="utf-8")
    return {
        "tiers": {
            "tier1_junior": {"zipf_min": 5.0, "min_len": 3, "max_len": 5},
            "tier2_core": {"zipf_min": 4.5, "min_len": 3, "max_len": 6},
            "tier3_standard": {"zipf_min": 4.0, "min_len": 4, "max_len": 6},
            "tier4_advanced": {"zipf_min": 3.3, "min_len": 4, "max_len": 7},
            "tier5_twl": {"zipf_min": 2.2, "min_len": 4, "max_len": 7},
        },
        "assignment_mode": assignment_mode,
        "tier5_overlap_policy": overlap_policy,
        "exclude_capitalized_candidates": True,
        "exclude_capitalized_twl": False,
        "enforce_twl_zipf_cutoff": True,
        "allow_twl_unknown_zipf": False,
        "enforce_us_spelling_for_1to4": True,
        "lower_tier_exclude_simple_plurals": True,
        "canon_min_len": 4,
        "canon_max_len": 6,
        "slur_hate_denylist_path": str(deny),
        "lower_tier_us_variant_map_path": str(variant_map),
        "us_allowlist_path": str(allowlist),
        "output_case": "uppercase",
    }


def test_normalization_and_regex_filtering() -> None:
    """Accept lowercase ASCII words, reject diacritics/punct/empty."""
    assert normalize_word("apple") == "apple"
    assert normalize_word(" Apple  ") == "apple"
    assert normalize_word("co-op") is None
    assert normalize_word("can't") is None
    assert normalize_word("résumé") is None
    assert normalize_word("abc123") is None
    assert normalize_word("") is None


def test_zipf_zero_excluded_for_candidates_and_twl(tmp_path: Path) -> None:
    """Unknown Zipf words no longer block preserved target tiers/canon in the final outputs."""
    candidates = tmp_path / "candidates.txt"
    twl = tmp_path / "twl.txt"
    candidates.write_text("apple\nzzzzzz\n", encoding="utf-8")
    twl.write_text("dorr\nzzzzzz\n", encoding="utf-8")
    config = make_config(tmp_path)

    score_map = {"apple": 5.5, "dorr": 2.5, "zzzzzz": 0.0}
    records = build_records(
        candidates_path=candidates,
        twl_path=twl,
        config=config,
        config_path=tmp_path / "config.yaml",
        zipf_lookup=lambda w: score_map.get(w, 0.0),
    )
    by_tier: dict[str, set[str]] = {}
    for row in records:
        by_tier.setdefault(row.tier, set()).add(row.word)
    assert "zzzzzz" not in by_tier.get("tier1_junior", set())
    assert "zzzzzz" not in by_tier.get("tier2_core", set())
    assert "zzzzzz" in by_tier.get("tier3_standard", set())
    assert "zzzzzz" in by_tier.get("tier4_advanced", set())
    assert "zzzzzz" in by_tier.get("tier5_twl", set())


def test_assignment_modes_highest_only_vs_multi(tmp_path: Path) -> None:
    """Final canonical tiers stay stable regardless of intermediate assignment mode."""
    candidates = tmp_path / "candidates.txt"
    twl = tmp_path / "twl.txt"
    candidates.write_text("apple\n", encoding="utf-8")
    twl.write_text("", encoding="utf-8")

    # apple zipf qualifies tiers 1..4 with given thresholds
    score_map = {"apple": 5.5}

    highest_cfg = make_config(tmp_path, assignment_mode="highest_only")
    highest = build_records(
        candidates_path=candidates,
        twl_path=twl,
        config=highest_cfg,
        config_path=tmp_path / "config.yaml",
        zipf_lookup=lambda w: score_map.get(w, 0.0),
    )
    highest_tiers = [r.tier for r in highest if r.word == "apple"]

    multi_cfg = make_config(tmp_path, assignment_mode="multi")
    multi = build_records(
        candidates_path=candidates,
        twl_path=twl,
        config=multi_cfg,
        config_path=tmp_path / "config.yaml",
        zipf_lookup=lambda w: score_map.get(w, 0.0),
    )
    tiers = [r.tier for r in multi if r.word == "apple"]
    assert highest_tiers == ["tier1_junior", "tier2_core", "tier3_standard", "tier4_advanced", "tier5_twl"]
    assert tiers == highest_tiers


def test_tier5_overlap_policy(tmp_path: Path) -> None:
    """Canonical rebuilt tiers are stable regardless of overlap policy."""
    candidates = tmp_path / "candidates.txt"
    twl = tmp_path / "twl.txt"
    candidates.write_text("licker\n", encoding="utf-8")
    twl.write_text("licker\n", encoding="utf-8")
    score_map = {"licker": 4.2}

    cfg_allow = make_config(tmp_path, assignment_mode="highest_only", overlap_policy="allow")
    rows_allow = build_records(
        candidates_path=candidates,
        twl_path=twl,
        config=cfg_allow,
        config_path=tmp_path / "config.yaml",
        zipf_lookup=lambda w: score_map.get(w, 0.0),
    )
    tiers_allow = [r.tier for r in rows_allow if r.word == "licker"]

    cfg_remove = make_config(tmp_path, assignment_mode="highest_only", overlap_policy="remove_from_1to4")
    rows_remove = build_records(
        candidates_path=candidates,
        twl_path=twl,
        config=cfg_remove,
        config_path=tmp_path / "config.yaml",
        zipf_lookup=lambda w: score_map.get(w, 0.0),
    )
    tiers_remove = [r.tier for r in rows_remove if r.word == "licker"]
    assert tiers_allow == ["tier2_core", "tier3_standard", "tier4_advanced", "tier5_twl"]
    assert tiers_remove == tiers_allow


def test_deterministic_sort_and_output_files(tmp_path: Path) -> None:
    """records_sorted + write_outputs should be deterministic and uppercase in txt/csv."""
    rows = records_sorted(
        [
            WordRecord(word="tour", zipf=3.1, length=4, tier="tier5_twl", source="twl"),
            WordRecord(word="apple", zipf=5.6, length=5, tier="tier2_core", source="candidates"),
            WordRecord(word="about", zipf=5.6, length=5, tier="tier2_core", source="candidates"),
        ]
    )
    outdir = tmp_path / "out"
    write_outputs(records=rows, outdir=outdir, output_case="uppercase")

    tier2 = (outdir / "tier2_core.txt").read_text(encoding="utf-8").strip().splitlines()
    # same zipf => alphabetical
    assert tier2 == ["ABOUT", "APPLE"]

    csv_lines = (outdir / "tiers_full.csv").read_text(encoding="utf-8").splitlines()
    assert csv_lines[0] == "word,zipf,length,tier,source"
    assert any("ABOUT,5.6000,5,tier2_core,candidates" in line for line in csv_lines)
    assert any("TOUR,3.1000,4,tier5_twl,twl" in line for line in csv_lines)

    summary = json.loads((outdir / "summary.json").read_text(encoding="utf-8"))
    assert summary["tiers"]["tier2_core"]["count"] == 2
    assert (outdir / "core_full.txt").exists()
    assert (outdir / "tier_advanced_4_6.json").exists()
    assert (outdir / "tier_canon_4_6.json").exists()
    assert (outdir / "wordlist_modified_4_6.json").exists()
    assert (outdir / "dictionary_manifest.json").exists()
    assert (outdir / "junior_3_5.json").exists()


def test_subset_ladder_and_filters_enforced(tmp_path: Path) -> None:
    """core ⊂ standard ⊂ advanced ⊂ canon and curation rules are applied."""
    candidates = tmp_path / "candidates.txt"
    twl = tmp_path / "twl.txt"
    candidates.write_text("game\ngames\narmor\narmour\napple\nslurword\n", encoding="utf-8")
    twl.write_text("game\ngames\narmor\narmour\napple\n", encoding="utf-8")
    config = make_config(tmp_path, assignment_mode="multi")

    score_map = {
        "game": 5.5,
        "games": 5.5,
        "armor": 5.5,
        "armour": 5.5,
        "apple": 5.5,
        "slurword": 5.5,
    }
    records = build_records(
        candidates_path=candidates,
        twl_path=twl,
        config=config,
        config_path=tmp_path / "config.yaml",
        zipf_lookup=lambda w: score_map.get(w, 0.0),
    )

    by_tier: dict[str, set[str]] = {}
    for row in records:
        by_tier.setdefault(row.tier, set()).add(row.word)

    core = by_tier.get("tier2_core", set())
    standard = by_tier.get("tier3_standard", set())
    advanced = by_tier.get("tier4_advanced", set())
    canon = by_tier.get("tier5_twl", set())

    assert core.issubset(standard)
    assert standard.issubset(advanced)
    assert advanced.issubset(canon)

    # Simple plural suppressed on lower tiers.
    assert "game" in core
    assert "games" not in core

    # UK variant suppressed when US preferred exists (lower tiers only).
    assert "armor" in core
    assert "armour" not in core

    # Slur/hate denylist removed globally.
    assert "slurword" not in canon
