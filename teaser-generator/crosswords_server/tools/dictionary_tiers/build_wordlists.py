"""Build 5-tier dictionary files using wordfreq Zipf scores.

CLI:
    python build_wordlists.py --candidates candidates.txt --twl twl.txt --outdir out/ --config config.yaml

Design notes:
- Tiers 1-4 are sourced from candidates.
- Tier 5 is sourced from TWL.
- Every row is normalized to lowercase internally, then exported in configured output case.
- All matching is exact-word (no stemming, no substring clipping).
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import re
import statistics
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Set, Tuple

import yaml

ASCII_WORD_RE = re.compile(r"^[a-z]+$")
TIER_ORDER = [
    "tier1_junior",
    "tier2_core",
    "tier3_standard",
    "tier4_advanced",
    "tier5_twl",
]


@dataclass(frozen=True)
class TierRule:
    """Thresholds for one tier."""

    name: str
    zipf_min: float
    min_len: int
    max_len: int

    def qualifies(self, word: str, zipf: float) -> bool:
        """Return True if word+zipf satisfy this tier's constraints."""
        length = len(word)
        return self.min_len <= length <= self.max_len and zipf >= self.zipf_min


@dataclass(frozen=True)
class WordRecord:
    """Canonical row written to outputs."""

    word: str
    zipf: float
    length: int
    tier: str
    source: str  # "candidates" | "twl"


def load_yaml_mapping(path: Path) -> Dict[str, str]:
    """Load a YAML mapping file, normalizing keys/values as words."""
    if not path.exists():
        raise FileNotFoundError(f"Missing YAML mapping file: {path}")
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError(f"YAML file must be a mapping: {path}")
    out: Dict[str, str] = {}
    for key, value in data.items():
        k = normalize_word(str(key))
        v = normalize_word(str(value))
        if k and v:
            out[k] = v
    return out


def remove_simple_plurals(words: Set[str], singular_lookup_words: Set[str]) -> Set[str]:
    """Drop basic plural forms when the singular exists in the same set.

    This intentionally handles only simple trailing-s plural shapes to avoid
    heavy stemming logic.
    """
    out = set(words)
    for word in list(words):
        if len(word) < 4 or not word.endswith("s"):
            continue
        # Keep common endings that are often not basic singular+S plural forms.
        if word.endswith(("ss", "us", "is")):
            continue
        singular = word[:-1]
        if len(singular) >= 3 and singular in singular_lookup_words:
            out.discard(word)
    return out


def apply_us_variant_preference(
    words: Set[str],
    us_variant_map: Dict[str, str],
    canon_words: Set[str],
) -> Set[str]:
    """Drop UK/alternate spelling when a preferred US spelling is present."""
    out = set(words)
    for variant, preferred in us_variant_map.items():
        if variant in out and (preferred in out or preferred in canon_words):
            out.discard(variant)
    return out


def load_config(path: Path) -> Dict[str, object]:
    """Load YAML config as a plain dict."""
    with path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if not isinstance(data, dict):
        raise ValueError("Config root must be a mapping.")
    return data


def resolve_path(raw_path: str | None, config_path: Path) -> Optional[Path]:
    """Resolve file path values relative to config location."""
    if not raw_path:
        return None
    p = Path(raw_path)
    if p.is_absolute():
        return p
    return (config_path.parent / p).resolve()


def has_uppercase(text: str) -> bool:
    """Return True if any uppercase ASCII letter is present."""
    return any("A" <= ch <= "Z" for ch in text)


def normalize_word(raw: str) -> Optional[str]:
    """Normalize one raw line into a strict lowercase ASCII token.

    Rules:
    - trim whitespace
    - lowercase
    - reject if NFKD-ascii stripping changes the token
    - keep only words matching ^[a-z]+$
    """
    token = raw.strip()
    if not token:
        return None
    lower = token.lower()
    stripped = unicodedata.normalize("NFKD", lower).encode("ascii", "ignore").decode("ascii")
    if stripped != lower:
        return None
    if not ASCII_WORD_RE.fullmatch(stripped):
        return None
    return stripped


def parse_tier_rules(config: Dict[str, object]) -> Dict[str, TierRule]:
    """Extract tier rule objects from config."""
    tiers_obj = config.get("tiers")
    if not isinstance(tiers_obj, dict):
        raise ValueError("config.tiers must be a mapping.")
    out: Dict[str, TierRule] = {}
    for tier_name in TIER_ORDER:
        row = tiers_obj.get(tier_name)
        if not isinstance(row, dict):
            raise ValueError(f"Missing or invalid rule for {tier_name}.")
        out[tier_name] = TierRule(
            name=tier_name,
            zipf_min=float(row["zipf_min"]),
            min_len=int(row["min_len"]),
            max_len=int(row["max_len"]),
        )
    return out


def make_wordfreq_lookup() -> Callable[[str], float]:
    """Build a wordfreq-backed Zipf lookup.

    Import is local so tests can run without wordfreq installed.
    """
    try:
        from wordfreq import zipf_frequency  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "wordfreq is required at runtime. Install dependencies from requirements.txt."
        ) from exc

    def lookup(word: str) -> float:
        val = zipf_frequency(word, "en")
        if val is None:
            return 0.0
        try:
            score = float(val)
        except Exception:
            return 0.0
        if score != score:  # NaN guard
            return 0.0
        return max(0.0, score)

    return lookup


def load_wordset_file(path: Path) -> Set[str]:
    """Load a .txt or .json word list into normalized lowercase set."""
    if not path.exists():
        raise FileNotFoundError(f"Missing wordset file: {path}")
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError(f"JSON file must be an array: {path}")
        lines = [str(x) for x in data]
    else:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    out: Set[str] = set()
    for raw in lines:
        norm = normalize_word(raw)
        if norm:
            out.add(norm)
    return out


def iter_input_words(
    path: Path,
    *,
    exclude_capitalized: bool,
) -> Iterable[str]:
    """Yield normalized candidate words from raw text input."""
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if exclude_capitalized and has_uppercase(raw):
            continue
        norm = normalize_word(raw)
        if norm:
            yield norm


def choose_tiers_for_word(
    word: str,
    zipf: float,
    rules: Dict[str, TierRule],
    assignment_mode: str,
) -> List[str]:
    """Choose qualifying tiers among tiers 1-4 for a candidates word."""
    qualified: List[str] = []
    for tier_name in TIER_ORDER[:4]:
        if rules[tier_name].qualifies(word, zipf):
            qualified.append(tier_name)
    if assignment_mode == "multi":
        return qualified
    if assignment_mode == "highest_only":
        return qualified[:1]
    raise ValueError(f"Invalid assignment_mode: {assignment_mode}")


def recase(word: str, output_case: str) -> str:
    """Render lowercase canonical word in configured output case."""
    if output_case == "lowercase":
        return word
    if output_case == "uppercase":
        return word.upper()
    raise ValueError(f"Invalid output_case: {output_case}")


def records_sorted(rows: Iterable[WordRecord]) -> List[WordRecord]:
    """Sort deterministically by tier order, Zipf desc, then alphabetical."""
    tier_rank = {tier: i for i, tier in enumerate(TIER_ORDER)}
    return sorted(rows, key=lambda r: (tier_rank[r.tier], -r.zipf, r.word))


def summarize_tier(rows: Sequence[WordRecord]) -> Dict[str, object]:
    """Compute count/min/median/max and sample words for one tier."""
    if not rows:
        return {
            "count": 0,
            "zipf_min": None,
            "zipf_median": None,
            "zipf_max": None,
            "sample_head": [],
            "sample_tail": [],
        }
    zipfs = [r.zipf for r in rows]
    words_sorted = sorted({r.word for r in rows})
    return {
        "count": len(rows),
        "zipf_min": round(min(zipfs), 4),
        "zipf_median": round(statistics.median(zipfs), 4),
        "zipf_max": round(max(zipfs), 4),
        "sample_head": words_sorted[:10],
        "sample_tail": words_sorted[-10:],
    }


def build_records(
    *,
    candidates_path: Path,
    twl_path: Path,
    config: Dict[str, object],
    config_path: Path,
    zipf_lookup: Callable[[str], float],
) -> List[WordRecord]:
    """Build all tier records from candidates + twl inputs."""
    rules = parse_tier_rules(config)
    assignment_mode = str(config.get("assignment_mode", "highest_only"))
    overlap_policy = str(config.get("tier5_overlap_policy", "allow"))
    exclude_caps_candidates = bool(config.get("exclude_capitalized_candidates", True))
    exclude_caps_twl = bool(config.get("exclude_capitalized_twl", False))
    enforce_twl_cutoff = bool(config.get("enforce_twl_zipf_cutoff", True))
    allow_twl_unknown = bool(config.get("allow_twl_unknown_zipf", False))
    enforce_us_filter = bool(config.get("enforce_us_spelling_for_1to4", False))
    slur_hate_denylist_path = resolve_path(str(config.get("slur_hate_denylist_path", "") or ""), config_path)
    lower_tier_exclude_simple_plurals = bool(config.get("lower_tier_exclude_simple_plurals", False))
    lower_tier_us_variant_map_path = resolve_path(
        str(config.get("lower_tier_us_variant_map_path", "") or ""),
        config_path,
    )

    us_allowlist_path = resolve_path(str(config.get("us_allowlist_path", "") or ""), config_path)
    us_keep_exceptions_path = resolve_path(str(config.get("us_keep_exceptions_path", "") or ""), config_path)

    us_allowlist: Set[str] = set()
    if enforce_us_filter:
        if us_allowlist_path is None:
            raise ValueError("US filter enabled but us_allowlist_path is not configured.")
        us_allowlist = load_wordset_file(us_allowlist_path)
        if us_keep_exceptions_path and us_keep_exceptions_path.exists():
            us_allowlist.update(load_wordset_file(us_keep_exceptions_path))

    slur_hate_denylist: Set[str] = set()
    if slur_hate_denylist_path:
        slur_hate_denylist = load_wordset_file(slur_hate_denylist_path)

    us_variant_map: Dict[str, str] = {}
    if lower_tier_us_variant_map_path and lower_tier_us_variant_map_path.exists():
        us_variant_map = load_yaml_mapping(lower_tier_us_variant_map_path)

    # Build 1-4 from candidates.
    rows: List[WordRecord] = []
    seen_pairs: Set[Tuple[str, str, str]] = set()
    word_zipf: Dict[str, float] = {}
    word_sources: Dict[str, Set[str]] = {}
    candidate_words_all: Set[str] = set()
    twl_words_all: Set[str] = set()
    candidate_words_any_len: Set[str] = set()
    twl_words_any_len: Set[str] = set()

    # Keep current playable range fixed at 4-6. This keeps runtime stable while
    # we defer 7-letter gameplay rollout.
    canon_min_len = int(config.get("canon_min_len", 4))
    canon_max_len = int(config.get("canon_max_len", 6))
    standard_min_zipf = float(config.get("standard_min_zipf", 0.0))
    advanced_min_zipf = float(config.get("advanced_min_zipf", 0.0))
    for word in iter_input_words(candidates_path, exclude_capitalized=exclude_caps_candidates):
        candidate_words_any_len.add(word)
        if canon_min_len <= len(word) <= canon_max_len:
            candidate_words_all.add(word)
        zipf = zipf_lookup(word)
        word_zipf[word] = max(word_zipf.get(word, 0.0), zipf)
        word_sources.setdefault(word, set()).add("candidates")
        if zipf <= 0.0:
            continue
        if enforce_us_filter and word not in us_allowlist:
            continue
        for tier_name in choose_tiers_for_word(word, zipf, rules, assignment_mode):
            key = (word, tier_name, "candidates")
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            rows.append(
                WordRecord(
                    word=word,
                    zipf=zipf,
                    length=len(word),
                    tier=tier_name,
                    source="candidates",
                )
            )

    # Build 5 from twl.
    tier5 = rules["tier5_twl"]
    for word in iter_input_words(twl_path, exclude_capitalized=exclude_caps_twl):
        twl_words_any_len.add(word)
        if canon_min_len <= len(word) <= canon_max_len:
            twl_words_all.add(word)
        zipf = zipf_lookup(word)
        word_zipf[word] = max(word_zipf.get(word, 0.0), zipf)
        word_sources.setdefault(word, set()).add("twl")
        if zipf <= 0.0 and not allow_twl_unknown:
            continue
        if enforce_twl_cutoff and zipf < tier5.zipf_min and not (zipf <= 0.0 and allow_twl_unknown):
            continue
        if not (tier5.min_len <= len(word) <= tier5.max_len):
            continue
        key = (word, "tier5_twl", "twl")
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        rows.append(
            WordRecord(
                word=word,
                zipf=zipf,
                length=len(word),
                tier="tier5_twl",
                source="twl",
            )
        )

    if overlap_policy not in {"allow", "remove_from_1to4"}:
        raise ValueError(f"Invalid tier5_overlap_policy: {overlap_policy}")
    if overlap_policy == "remove_from_1to4":
        tier5_words = {r.word for r in rows if r.tier == "tier5_twl"}
        rows = [r for r in rows if r.tier == "tier5_twl" or r.word not in tier5_words]

    # ---- Canonicalization pass (v3) ---------------------------------------
    # Build canon from the full merged 4-6 sources and preserve legacy lower
    # tiers as the baseline before applying the locked cleanup rules.
    canon_words = {w for w in (candidate_words_all | twl_words_all) if canon_min_len <= len(w) <= canon_max_len}
    all_source_words = candidate_words_any_len | twl_words_any_len
    if slur_hate_denylist:
        canon_words.difference_update(slur_hate_denylist)

    by_tier_words: Dict[str, Set[str]] = {tier: set() for tier in TIER_ORDER}
    for row in rows:
        by_tier_words[row.tier].add(row.word)

    # Keep junior untouched for now (feature deferred) but maintain compatibility.
    core_words = {
        w for w in us_allowlist
        if canon_min_len <= len(w) <= canon_max_len
    } if us_allowlist else set()
    standard_words = {w for w in candidate_words_all if canon_min_len <= len(w) <= canon_max_len}
    advanced_words = set(canon_words)

    # Lower tiers must stay inside canon.
    core_words &= canon_words
    standard_words &= canon_words
    advanced_words &= canon_words

    if slur_hate_denylist:
        core_words.difference_update(slur_hate_denylist)
        standard_words.difference_update(slur_hate_denylist)
        advanced_words.difference_update(slur_hate_denylist)

    if lower_tier_exclude_simple_plurals:
        core_words = remove_simple_plurals(core_words, all_source_words)
        standard_words = remove_simple_plurals(standard_words, all_source_words)
        advanced_words = remove_simple_plurals(advanced_words, all_source_words)

    if us_variant_map:
        core_words = apply_us_variant_preference(core_words, us_variant_map, canon_words)
        standard_words = apply_us_variant_preference(standard_words, us_variant_map, canon_words)
        advanced_words = apply_us_variant_preference(advanced_words, us_variant_map, canon_words)

    # Enforce strict ladder: core ⊂ standard ⊂ advanced ⊂ canon.
    standard_words = {w for w in standard_words if word_zipf.get(w, 0.0) >= standard_min_zipf}
    advanced_words = {w for w in advanced_words if word_zipf.get(w, 0.0) >= advanced_min_zipf}
    standard_words |= core_words
    advanced_words |= standard_words
    advanced_words &= canon_words
    standard_words &= advanced_words
    core_words &= standard_words

    # Rebuild rows from canonical sets.
    final_rows: List[WordRecord] = []
    for word in sorted(by_tier_words["tier1_junior"]):
        final_rows.append(
            WordRecord(
                word=word,
                zipf=word_zipf.get(word, 0.0),
                length=len(word),
                tier="tier1_junior",
                source="candidates",
            )
        )
    for tier_name, words in (
        ("tier2_core", core_words),
        ("tier3_standard", standard_words),
        ("tier4_advanced", advanced_words),
        ("tier5_twl", canon_words),
    ):
        for word in sorted(words):
            srcs = word_sources.get(word, set())
            source = "twl" if "twl" in srcs and "candidates" not in srcs else "candidates"
            if "twl" in srcs and "candidates" in srcs:
                source = "twl"
            final_rows.append(
                WordRecord(
                    word=word,
                    zipf=word_zipf.get(word, 0.0),
                    length=len(word),
                    tier=tier_name,
                    source=source,
                )
            )

    return records_sorted(final_rows)


def write_outputs(
    *,
    records: Sequence[WordRecord],
    outdir: Path,
    output_case: str,
) -> None:
    """Write required txt/csv/json outputs."""
    outdir.mkdir(parents=True, exist_ok=True)
    by_tier: Dict[str, List[WordRecord]] = {tier: [] for tier in TIER_ORDER}
    for row in records:
        by_tier[row.tier].append(row)

    # Tier files: de-duplicated words sorted by Zipf desc, then alpha.
    for tier in TIER_ORDER:
        words = sorted(
            {r.word for r in by_tier[tier]},
            key=lambda w: (
                -max((x.zipf for x in by_tier[tier] if x.word == w), default=0.0),
                w,
            ),
        )
        path = outdir / f"{tier}.txt"
        path.write_text("\n".join(recase(w, output_case) for w in words) + ("\n" if words else ""), encoding="utf-8")

    # Full CSV.
    csv_path = outdir / "tiers_full.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["word", "zipf", "length", "tier", "source"])
        for row in records:
            writer.writerow(
                [
                    recase(row.word, output_case),
                    f"{row.zipf:.4f}",
                    row.length,
                    row.tier,
                    row.source,
                ]
            )

    # Summary JSON.
    summary = {
        "total_rows": len(records),
        "tiers": {tier: summarize_tier(by_tier[tier]) for tier in TIER_ORDER},
    }
    summary_path = outdir / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    # Runtime artifacts for the mobile game and future tier-aware integrations.
    write_runtime_artifacts(by_tier=by_tier, outdir=outdir, output_case=output_case)


def write_runtime_artifacts(
    *,
    by_tier: Dict[str, List[WordRecord]],
    outdir: Path,
    output_case: str,
) -> None:
    """Write canonical tier artifacts used by runtime clients.

    Files written:
    - <tier>_full.txt
    - core_4_6.json, standard_4_6.json, advanced_4_6.json, twl_4_6.json
    - junior_3_5.json
    """
    canonical_mapping = {
        "tier1_junior": "junior",
        "tier2_core": "core",
        "tier3_standard": "standard",
        "tier4_advanced": "advanced",
        "tier5_twl": "canon",
    }

    def words_for(tier_name: str) -> List[str]:
        return sorted(
            {row.word for row in by_tier.get(tier_name, [])},
            key=lambda w: (
                -max((x.zipf for x in by_tier.get(tier_name, []) if x.word == w), default=0.0),
                w,
            ),
        )

    all_words_by_name: Dict[str, List[str]] = {}
    for tier_name, output_name in canonical_mapping.items():
        words = words_for(tier_name)
        all_words_by_name[output_name] = words
        full_txt = outdir / f"{output_name}_full.txt"
        full_txt.write_text(
            "\n".join(recase(word, output_case) for word in words) + ("\n" if words else ""),
            encoding="utf-8",
        )

    # Current game pattern artifacts.
    for output_name in ("core", "standard", "advanced", "canon"):
        words = [word for word in all_words_by_name.get(output_name, []) if 4 <= len(word) <= 6]
        payload = [recase(word, output_case) for word in words]
        (outdir / f"tier_{output_name}_4_6.json").write_text(json.dumps(payload), encoding="utf-8")

    # Compatibility aliases for existing app imports.
    compat_aliases = {
        "wordlist_common_4_6.json": "tier_core_4_6.json",
        "wordlist_modified_4_6.json": "tier_standard_4_6.json",
        "wordlist_twl_4_6.json": "tier_canon_4_6.json",
    }
    for compat_name, canonical_name in compat_aliases.items():
        source_path = outdir / canonical_name
        if source_path.exists():
            (outdir / compat_name).write_text(source_path.read_text(encoding="utf-8"), encoding="utf-8")

    junior_words = [word for word in all_words_by_name.get("junior", []) if 3 <= len(word) <= 5]
    (outdir / "junior_3_5.json").write_text(
        json.dumps([recase(word, output_case) for word in junior_words]),
        encoding="utf-8",
    )

    # Machine-readable manifest for runtime/debug.
    manifest = {
        "version": 1,
        "length_range_active": [4, 6],
        "tiers": {
            name: {
                "count": len(all_words_by_name.get(name, [])),
                "artifact_full": f"{name}_full.txt",
                "artifact_active_json": f"tier_{name}_4_6.json" if name in {"core", "standard", "advanced", "canon"} else None,
            }
            for name in ("junior", "core", "standard", "advanced", "canon")
        },
        "aliases": {
            "common": "core",
            "modified": "standard",
            "twl": "canon",
        },
    }
    (outdir / "dictionary_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def log_summary(records: Sequence[WordRecord]) -> None:
    """Log counts and top/bottom Zipf examples by tier."""
    by_tier: Dict[str, List[WordRecord]] = {tier: [] for tier in TIER_ORDER}
    for row in records:
        by_tier[row.tier].append(row)
    for tier in TIER_ORDER:
        rows = by_tier[tier]
        if not rows:
            logging.info("%s: count=0", tier)
            continue
        sorted_rows = sorted(rows, key=lambda r: (-r.zipf, r.word))
        top = ", ".join(f"{r.word}:{r.zipf:.2f}" for r in sorted_rows[:5])
        bottom = ", ".join(f"{r.word}:{r.zipf:.2f}" for r in sorted_rows[-5:])
        logging.info("%s: count=%d | top=%s | bottom=%s", tier, len(rows), top, bottom)


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    """Build CLI parser."""
    parser = argparse.ArgumentParser(description="Build tiered dictionaries using wordfreq Zipf scores.")
    parser.add_argument("--candidates", required=True, type=Path, help="Path to candidates.txt")
    parser.add_argument("--twl", required=True, type=Path, help="Path to twl.txt")
    parser.add_argument("--outdir", required=True, type=Path, help="Output directory")
    parser.add_argument("--config", required=True, type=Path, help="Path to config.yaml")
    parser.add_argument("--dry-run", action="store_true", help="Compute and log counts without writing files")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    """CLI entrypoint."""
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
    args = parse_args(argv)
    config = load_config(args.config)
    output_case = str(config.get("output_case", "uppercase"))

    lookup = make_wordfreq_lookup()
    records = build_records(
        candidates_path=args.candidates,
        twl_path=args.twl,
        config=config,
        config_path=args.config.resolve(),
        zipf_lookup=lookup,
    )
    log_summary(records)
    if args.dry_run:
        logging.info("Dry run complete. No files written.")
        return 0
    write_outputs(records=records, outdir=args.outdir, output_case=output_case)
    logging.info("Wrote outputs to %s", args.outdir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
