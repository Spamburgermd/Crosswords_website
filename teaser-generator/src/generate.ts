/**
 * generate.ts — Main entry point for the daily teaser generator.
 *
 * Usage:
 *   npm run generate
 *   npm run generate -- --date 2026-04-17
 */

import * as path from 'path';
import { getDailyPuzzleSeed }    from './pipeline/seedMath.js';
import { generateTargetsFromSeed } from './pipeline/seededTargets.js';
import { buildLocalPlacement }   from './pipeline/localPlacement.js';
import { renderTeaser }          from './render-teaser.js';

function parseDate(): string {
  const args = process.argv.slice(2);
  const idx  = args.indexOf('--date');
  if (idx !== -1 && args[idx + 1]) {
    // Normalize to zero-padded YYYY-MM-DD (e.g. 2026-4-8 → 2026-04-08)
    const parts = args[idx + 1]!.split('-');
    const y   = parts[0] ?? '';
    const m   = String(Number(parts[1] ?? '1')).padStart(2, '0');
    const day = String(Number(parts[2] ?? '1')).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function main(): void {
  const dateStr = parseDate();
  const seed    = getDailyPuzzleSeed(dateStr);

  console.log('='.repeat(52));
  console.log(`[teaser] Date : ${dateStr}`);
  console.log(`[teaser] Seed : ${seed}`);
  console.log('='.repeat(52));

  // 1. Generate words
  let words: string[];
  try {
    words = generateTargetsFromSeed(seed, 'core', 5);
  } catch (err) {
    console.error('[teaser] Word generation failed:', err);
    process.exit(1);
  }
  console.log(`[teaser] Words : ${words.join(', ')}`);

  // 2. Place on grid
  const placement = buildLocalPlacement(words);
  if (!placement.ok) {
    console.error('[teaser] Placement failed:', placement.error);
    process.exit(1);
  }
  console.log(`[teaser] Grid  : ${placement.words.length} words placed`);

  // 3. Render
  const outputDir  = path.join(process.cwd(), 'output');
  const outputPath = path.join(outputDir, 'daily-teaser.png');
  const archivePath = path.join(outputDir, 'archive', `${dateStr}.png`);

  const { tiles } = renderTeaser({
    words:       placement.words,
    targetsMeta: placement.targets_meta,
    seed,
    outputPath,
    archivePath,
  });

  // 4. Summary
  const feedbackLabel: Record<string, string> = {
    correct:     'correct     (green)',
    wrongSpot:   'wrongSpot   (amber)',
    notInWord:   'notInWord   (teal) ',
    notInPuzzle: 'notInPuzzle (pink) ',
  };
  console.log(`[teaser] Tiles: ${tiles.length}`);
  for (const t of tiles) {
    console.log(`  ${feedbackLabel[t.feedback] ?? t.feedback}  ${t.key} → ${t.letter}`);
  }
  console.log(`[teaser] Output  : ${outputPath}`);
  console.log(`[teaser] Archive : ${archivePath}`);
  console.log('[teaser] Done.');
}

main();
