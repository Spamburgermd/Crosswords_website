/**
 * test-pipeline.ts
 * Runs the daily puzzle pipeline for a given date and prints:
 *   - date + seed
 *   - selected words
 *   - ASCII 10x10 grid
 *   - position metadata per word
 *
 * Usage:
 *   npm run test-pipeline
 *   npm run test-pipeline -- --date 2026-04-17
 */

import { getDailyPuzzleSeed } from './pipeline/seedMath.js';
import { generateTargetsFromSeed } from './pipeline/seededTargets.js';
import { buildLocalPlacement } from './pipeline/localPlacement.js';

const GRID_SIZE = 10;

function parseDate(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--date');
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1]!;
  }
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildAsciiGrid(targets_meta: Array<{ dir: 'A' | 'D'; coords: Array<[number, number]> }>, words: string[]): string {
  const grid: string[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('.'));

  targets_meta.forEach((meta, i) => {
    const word = words[i] ?? '';
    meta.coords.forEach(([r, c], pos) => {
      const letter = word[pos];
      if (letter) grid[r]![c] = letter;
    });
  });

  const colHeader = '  ' + Array.from({ length: GRID_SIZE }, (_, i) => i).join('');
  const rows = grid.map((row, i) => `${i} ${row.join('')}`);
  return [colHeader, ...rows].join('\n');
}

function main() {
  const dateStr = parseDate();
  const seed = getDailyPuzzleSeed(dateStr);

  console.log('='.repeat(50));
  console.log(`Date : ${dateStr}`);
  console.log(`Seed : ${seed}`);
  console.log('='.repeat(50));

  let words: string[];
  try {
    words = generateTargetsFromSeed(seed, 5);
  } catch (err) {
    console.error('Word generation failed:', err);
    process.exit(1);
  }

  console.log('\nWords:', words.join(', '));

  const placement = buildLocalPlacement(words);
  if (!placement.ok) {
    console.error('Placement failed:', placement.error);
    process.exit(1);
  }

  console.log('\nGrid (10×10):');
  console.log(buildAsciiGrid(placement.targets_meta, placement.words));

  console.log('\nPosition metadata:');
  placement.targets_meta.forEach((meta, i) => {
    const word = placement.words[i] ?? '';
    const dir = meta.dir === 'A' ? 'across' : 'down';
    const [row, col] = meta.start;
    console.log(`  ${word.padEnd(8)}  row=${row}, col=${col}, direction=${dir}`);
  });

  console.log('');
}

main();
