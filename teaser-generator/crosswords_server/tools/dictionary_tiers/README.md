# Dictionary Tier Builder (wordfreq Zipf)

This tool builds 5 dictionary tiers for CrosSwords using `wordfreq` Zipf frequency scores.

## Why Zipf?
`wordfreq.zipf_frequency(word, "en")` returns a log-scaled frequency estimate:
- Around `6+`: very common words
- Around `4-5`: common-to-moderate words
- Around `3`: rarer words
- Near `0`: unseen/very rare

Using Zipf gives a practical way to separate beginner-friendly words from advanced words.

## Tier Rules
Configured in `config.yaml`:
- `tier1_junior`: Zipf >= 5.0, length 3–5 (candidates only)
- `tier2_core`: Zipf >= 4.5, length 3–6 (candidates only)
- `tier3_standard`: Zipf >= 4.0, length 4–6 (candidates only)
- `tier4_advanced`: Zipf >= 3.3, length 4–7 (candidates only)
- `tier5_twl`: TWL source, length 4–7, Zipf cutoff optional (default ON, 2.2)

## Important Filters
- Normalize to lowercase internally.
- Keep only strict ASCII words matching `^[a-z]+$`.
- Drop punctuation, apostrophes, hyphens, spaces, digits.
- Drop words with diacritics if ASCII stripping changes text.
- Optional proper-noun heuristic (`exclude_capitalized_candidates`).
- Unseen Zipf words (score 0) are removed, with optional TWL override.
- Optional US-only enforcement for tiers 1–4 via `us_allowlist_path`.

## Overlap Behavior
- `assignment_mode`:
  - `highest_only`: candidates words go to highest qualifying tier among 1–4.
  - `multi`: candidates words appear in every qualifying tier among 1–4.
- `tier5_overlap_policy`:
  - `allow`: tier 5 can overlap with tiers 1–4.
  - `remove_from_1to4`: remove tier 5 words from tiers 1–4.

## Install
```bash
cd crosswords_server/tools/dictionary_tiers
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Run
```bash
python build_wordlists.py ^
  --candidates candidates.txt ^
  --twl twl.txt ^
  --outdir out ^
  --config config.yaml
```

Dry run (no file writes):
```bash
python build_wordlists.py --candidates candidates.txt --twl twl.txt --outdir out --config config.yaml --dry-run
```

## Outputs
- `out/tier1_junior.txt`
- `out/tier2_core.txt`
- `out/tier3_standard.txt`
- `out/tier4_advanced.txt`
- `out/tier5_twl.txt`
- `out/tiers_full.csv` (`word, zipf, length, tier, source`)
- `out/summary.json`
- Runtime artifacts:
  - `out/core_full.txt`, `out/standard_full.txt`, `out/advanced_full.txt`, `out/canon_full.txt`, `out/junior_full.txt`
  - `out/tier_core_4_6.json`, `out/tier_standard_4_6.json`, `out/tier_advanced_4_6.json`, `out/tier_canon_4_6.json`
  - `out/junior_3_5.json`
  - `out/dictionary_manifest.json`
  - Compatibility aliases:
    - `out/wordlist_common_4_6.json` -> core
    - `out/wordlist_modified_4_6.json` -> standard
    - `out/wordlist_twl_4_6.json` -> canon

## Swapping Candidate Sources
Replace `candidates.txt` with your preferred list and rerun the command.
If using US-only filtering for tiers 1–4, update:
- `us_allowlist_path`
- optionally `us_keep_exceptions_path`
