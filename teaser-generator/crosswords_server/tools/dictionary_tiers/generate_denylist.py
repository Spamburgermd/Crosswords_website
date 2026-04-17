#!/usr/bin/env python3
"""Generate a draft profanity/slur denylist by intersecting known offensive words
with the Canon tier dictionary.

Usage:
    python generate_denylist.py

Outputs:
    denylist_draft.txt  — words found in Canon that should be reviewed and then
                          copied to slur_hate_denylist.txt
"""

from __future__ import annotations

import json
from pathlib import Path

# ---------------------------------------------------------------------------
# 1. Load Canon tier
# ---------------------------------------------------------------------------
CANON_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "tier_canon_4_6.json"

canon_words: set[str] = set()
with open(CANON_PATH, encoding="utf-8") as f:
    canon_words = {w.upper() for w in json.load(f)}

print(f"Canon tier: {len(canon_words)} words loaded")

# ---------------------------------------------------------------------------
# 2. Collect profanity sources
# ---------------------------------------------------------------------------

# Source A: better-profanity's built-in word list
try:
    from better_profanity import profanity
    profanity.load_censor_words()
    bp_words: set[str] = set()
    # Access the internal word list
    if hasattr(profanity, "CENSOR_WORDSET"):
        bp_words = set()
        for w in profanity.CENSOR_WORDSET:
            try:
                bp_words.add(str(w).upper())
            except Exception:
                pass
    else:
        # Fallback: check each canon word
        for w in canon_words:
            if profanity.contains_profanity(w.lower()):
                bp_words.add(w)
    print(f"better-profanity source: {len(bp_words)} words")
except ImportError:
    print("better-profanity not installed, skipping that source")
    bp_words = set()

# Source B: Comprehensive curated list of slurs, strong profanity, and
# offensive terms. This covers IARC/Google Play categories:
#   - Racial/ethnic slurs
#   - Sexual orientation / gender identity slurs
#   - Disability slurs
#   - Explicit sexual/anatomical terms
#   - Strong profanity (base forms)
#   - Gendered slurs
#   - Drug-related vulgar terms
#
# We intentionally KEEP mild terms like DAMN, HELL, CRAP, DARN, HECK, BUTT
# as they appear in all-ages crosswords (NYT, etc.)

CURATED_BASE_WORDS: list[str] = [
    # --- Racial / ethnic slurs ---
    "CHINK", "COON", "COONS", "DARKY", "DAGO", "DAGOS",
    "GOOK", "GOOKS", "GRINGO", "HONKY", "JIGABOO",
    "KIKE", "KIKES", "KRAUT", "NEGRO", "NEGROS",
    "NIGGA", "NIGGAS", "NIGGER", "PICKANINNY",
    "REDSKIN", "SAMBO", "SPIC", "SPICK", "SPICS",
    "SPOOK", "TOWELHEAD", "WETBACK", "WOP", "WOPS",

    # --- Sexual orientation / gender slurs ---
    "DYKE", "DYKES", "FAG", "FAGS", "FAGGOT", "FAGGY",
    "HOMO", "HOMOS", "LESBO", "LESBOS", "QUEER", "QUEERS",
    "TRANNY",

    # --- Disability slurs ---
    "GIMP", "GIMPS", "MIDGET", "RETARD", "SPAZ", "SPAZZ",
    "TARD", "TARDS",

    # --- Strong profanity (base + variants) ---
    "FUCK", "FUCKS", "FUCKER", "FUCKED",
    "SHIT", "SHITS", "SHITTY",
    "CUNT", "CUNTS",
    "TWAT", "TWATS",
    "PISS", "PISSY",
    "BITCH", "BITCHY",
    "WHORE", "WHORES",
    "SLUT", "SLUTS", "SLUTTY",
    "SKANK", "SKANKS", "SKANKY",

    # --- Explicit sexual / anatomical ---
    "COCK", "COCKS", "DILDO", "DILDOS",
    "PUSSY", "JIZZ", "CUMSHOT",
    "WANK", "WANKS", "WANKER",
    "TITS", "TITTY",
    "PRICK", "PRICKS",
    "DONG", "DONGS",
    "PENIS", "PENILE",
    "BALLS", "BONER", "BONERS",
    "ERECT",
    "ANAL", "ANUS",
    "RAPE", "RAPED", "RAPES", "RAPIST",
    "ORGASM", "ORGY",
    "HOOKER", "HOOKERS",
    "PIMP", "PIMPS",

    # --- Gendered / body-shaming ---
    "HOE", "HOES",

    # --- Misc offensive ---
    "NAZI", "NAZIS",
]

curated_words = {w.upper() for w in CURATED_BASE_WORDS}
print(f"Curated source: {len(curated_words)} base words")

# ---------------------------------------------------------------------------
# 3. Merge sources and generate morphological variants
# ---------------------------------------------------------------------------
all_offensive = bp_words | curated_words

# Add common morphological suffixes to catch variants
SUFFIXES = ["S", "ED", "ER", "ERS", "ES", "ING", "Y", "IER", "IEST"]
expanded: set[str] = set()
for word in all_offensive:
    expanded.add(word)
    for suffix in SUFFIXES:
        expanded.add(word + suffix)

print(f"After morphological expansion: {len(expanded)} candidate patterns")

# ---------------------------------------------------------------------------
# 4. Intersect with Canon
# ---------------------------------------------------------------------------
matches = canon_words & expanded

# Also check: for each canon word, does better-profanity flag it?
if bp_words:
    for w in canon_words:
        try:
            if profanity.contains_profanity(w.lower()) and w not in matches:
                matches.add(w)
        except Exception:
            pass

# ---------------------------------------------------------------------------
# 5. Remove false positives / mild terms we want to KEEP
# ---------------------------------------------------------------------------
KEEP_WORDS = {
    "DAMN", "DAMNS", "DAMNED",
    "HELL", "HELLS",
    "CRAP", "CRAPS",  # also a dice game
    "DARN", "DARNS", "DARNED",
    "HECK",
    "BUTT", "BUTTS",
    "SUCK", "SUCKS",
    "JERK", "JERKS", "JERKY",  # also beef jerky
    "BOOZE",
    "SEXY",
}

matches -= KEEP_WORDS

# Sort for review
sorted_matches = sorted(matches)

# ---------------------------------------------------------------------------
# 6. Output
# ---------------------------------------------------------------------------
output_path = Path(__file__).resolve().parent / "denylist_draft.txt"
with open(output_path, "w", encoding="utf-8") as f:
    for word in sorted_matches:
        f.write(word.lower() + "\n")

print(f"\n{'='*60}")
print(f"DRAFT DENYLIST: {len(sorted_matches)} words written to {output_path.name}")
print(f"{'='*60}")
print("\nWords found:")
for w in sorted_matches:
    print(f"  {w}")
print(f"\nReview this list, then copy approved words to slur_hate_denylist.txt")
