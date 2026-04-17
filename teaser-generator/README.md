# teaser-generator

Generates a daily teaser image for CrosSwords: a crossword preview that hints at the day's puzzle without giving it away.

## What it does

The generator runs a deterministic pipeline:

1. Date -> seed
2. Seed -> target words
3. Target words -> crossword placement
4. Placement -> teaser image with 3-5 revealed letters

The output is written locally to `teaser-generator/output/` and the GitHub Actions workflow publishes the latest image to `public/teaser/daily-teaser.png`.

## Running locally

```bash
cd teaser-generator
npm install
npm run generate
npm run generate -- --date 2026-04-17
```

Output files:

- `teaser-generator/output/daily-teaser.png`
- `teaser-generator/output/archive/YYYY-MM-DD.png`

## Automation

The workflow lives at repo root in `.github/workflows/daily-teaser.yml`.

It:

1. Installs the generator dependencies
2. Runs the generator for the requested date or today
3. Copies the latest image into `public/teaser/daily-teaser.png`
4. Commits that generated asset back to `main`
