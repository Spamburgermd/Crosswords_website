# teaser-generator

Generates a daily teaser image for CrosSwords — a 700×750px crossword grid preview
that hints at the day's puzzle without giving it away.

## What it does

The generator runs the same deterministic puzzle pipeline used by the game (date → seed → words → grid),
then selects 3–5 letters to reveal using a date-seeded PRNG. The image is rendered with the Steel Blue
palette and the CrosSwords wordmark, and is committed to `docs/teaser/daily-teaser.png` automatically
each night via GitHub Actions.

## Running locally

```bash
cd teaser-generator
npm install
npm run generate                          # today's teaser
npm run generate -- --date 2026-04-17    # specific date
```

Output is written to:
- `teaser-generator/output/daily-teaser.png` — always the latest run
- `teaser-generator/output/archive/YYYY-MM-DD.png` — dated archive copy

## How the automation works

A GitHub Actions workflow (`.github/workflows/daily-teaser.yml`) runs on a cron schedule at
**5:00 AM UTC** (midnight US Eastern during DST). It installs system dependencies for
[node-canvas](https://github.com/Automattic/node-canvas), runs `npm run generate`, and commits
the result to `docs/teaser/daily-teaser.png` on the main branch.

You can also trigger it manually from the Actions tab with an optional `date` input.

## Letter reveal selection

Reveal selection is deterministic for a given date. The algorithm:

1. Uses the daily seed (same LCG hash as the game) to derive a reveal-specific seed.
2. Seeds a **Mulberry32 PRNG** and Fisher-Yates shuffles all candidate tile positions.
3. Iterates the shuffled list and accepts each candidate subject to these hard caps:
   - **At most 1 intersection tile** revealed across the whole image.
   - **Intersection reveals use the `wrongSpot` color** (`#4A6378`) — never the `correct` green/navy.
   - **Per-word cap**: 4-letter words → max 2 revealed; 5-letter → max 2; 6-letter → max 3.
   - **Total**: 3–5 letters revealed.

Same date → same seed → same shuffle → same reveals every time.

## Palette

Steel Blue palette (`crosswords_mobile/src/theme/tilePalette.ts`):

| Role               | Hex       | Used for                              |
|--------------------|-----------|---------------------------------------|
| App background     | `#0D1B2A` | Canvas background                     |
| Idle tile          | `#FFFFFF` / border `#D3D3D6` | Unrevealed tiles     |
| Correct (reveal)   | `#1E2D3D` | Non-intersection revealed letters     |
| WrongSpot (reveal) | `#4A6378` | Intersection revealed letter (max 1)  |
| Brand red          | `#E7131A` | The two S glyphs in CrosSwords        |
| Tagline            | `#93A8B8` | "Wit is your weapon."                 |
