/**
 * render-teaser.ts
 *
 * Renders a daily teaser image on a white background.
 * Simulates a mid-game guess: 3–5 tiles with realistic feedback colors
 * as if a player guessed some letters and received results.
 *
 * Feedback mapping (CLASSIC game palette):
 *   correct     — green (#6A9B6E): letter is correct and in the right position
 *   wrongSpot   — amber (#C4A84D): letter is in this word but at the wrong position
 *   notInWord   — teal  (#5A8A91): letter exists in the puzzle but not in this word
 *   notInPuzzle — pink  (#F5A1A3): letter is nowhere in the puzzle
 *
 * Tile composition:
 *   - 3–5 tiles total (PRNG-chosen)
 *   - Always: 1 red, 1 yellow, 1 teal
 *   - Optional: extra yellow (~50%), extra teal (~50%), green (~25%)
 *   - At most 2 tiles from any one word; no duplicate cells
 *   - Deterministic: same date → same image
 */

import { createCanvas, loadImage, registerFont } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

// Register LibreBaskerville for cell letters
registerFont(
  path.resolve(process.cwd(), 'assets', 'fonts', 'LibreBaskerville-Regular.ttf'),
  { family: 'LibreBaskerville' },
);
import type { TargetMeta } from './pipeline/localCanonicalTargetsFromLayout.js';

// ---------------------------------------------------------------------------
// CLASSIC game palette (from crosswords_mobile/src/theme/tilePalette.ts)
// ---------------------------------------------------------------------------
const PALETTE = {
  appBackground: '#FFFFFF',
  idle:        { bg: '#f6f6f9', border: '#000000' },
  correct:     { bg: '#6A9B6E', letter: '#FFFFFF' }, // green — correct position
  wrongSpot:   { bg: '#C4A84D', letter: '#FFFFFF' }, // amber — in word, wrong position
  notInWord:   { bg: '#5A8A91', letter: '#FFFFFF' }, // teal  — in puzzle, not this word
  notInPuzzle: { bg: '#F5A1A3', letter: '#FFFFFF' }, // pink  — not in puzzle at all
  branding: {
    accent:   '#E7131A', // brand red — the two S glyphs in CrosSwords
    wordmark: '#1E2D3D', // dark navy on white
    tagline:  '#4A6378', // medium blue-grey on white
  },
} as const;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const GAP             = 4;
const CORNER_RADIUS   = 0;
const BRANDING_HEIGHT = 100;
const MARGIN          = 32;
const TARGET_GRID_W   = 640;
const TILE_MIN        = 60;
const TILE_MAX        = 82;

// ---------------------------------------------------------------------------
// Mulberry32 PRNG — matches the game's seeded RNG implementation
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function coordKey(r: number, c: number): string {
  return `${r},${c}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type FeedbackType = 'correct' | 'wrongSpot' | 'notInWord' | 'notInPuzzle';

export type RevealTile = {
  key: string;
  letter: string;
  feedback: FeedbackType;
};

export type RevealResult = {
  tiles: RevealTile[];
};

// ---------------------------------------------------------------------------
// Reveal tile selection
// ---------------------------------------------------------------------------
export function selectRevealTiles(
  words: string[],
  targetsMeta: TargetMeta[],
  seed: number,
): RevealResult {
  const upperWords = words.map(w => w.toUpperCase());

  // Build coord → word indices map
  const coordToWords = new Map<string, number[]>();
  targetsMeta.forEach((meta, wi) => {
    meta.coords.forEach(([r, c]) => {
      const k = coordKey(r, c);
      const arr = coordToWords.get(k) ?? [];
      arr.push(wi);
      coordToWords.set(k, arr);
    });
  });

  // Build occupied cells list
  type Cell = { key: string; wordIndices: number[] };
  const occupiedCells: Cell[] = [];
  coordToWords.forEach((wordIndices, key) => {
    occupiedCells.push({ key, wordIndices });
  });

  // Puzzle letter set and letters absent from all words
  const puzzleLetterSet = new Set<string>();
  for (const w of upperWords) for (const ch of w) puzzleLetterSet.add(ch);
  const notInPuzzleLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    .split('')
    .filter(ch => !puzzleLetterSet.has(ch));

  // PRNG — derived seed so reveal randomness is independent from puzzle generation
  const revealSeed = ((seed * 0x9e3779b9) ^ 0x5a4fcf12) >>> 0;
  const rng = mulberry32(revealSeed);

  // Shuffle occupied cells
  const cells = [...occupiedCells];
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = cells[i]!;
    cells[i] = cells[j]!;
    cells[j] = tmp;
  }

  // Structural decisions
  const totalTiles   = 3 + Math.floor(rng() * 3); // 3, 4, or 5
  const includeGreen = rng() < 0.25;              // green on ~25% of days
  const extraYellow  = rng() < 0.50;              // second wrongSpot on ~50%
  const extraBlue    = rng() < 0.50;              // second notInWord on ~50%

  // Build target sequence:
  //   required (always): 1 red + 1 yellow + 1 teal = 3
  //   optional extras trimmed to fit totalTiles
  const required: FeedbackType[] = ['notInPuzzle', 'wrongSpot', 'notInWord'];
  const extras: FeedbackType[] = [];
  if (extraYellow)  extras.push('wrongSpot');
  if (extraBlue)    extras.push('notInWord');
  if (includeGreen) extras.push('correct');

  // Shuffle extras so the trim doesn't always drop green last
  for (let i = extras.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = extras[i]!;
    extras[i] = extras[j]!;
    extras[j] = tmp;
  }

  const targets: FeedbackType[] = [
    ...required,
    ...extras.slice(0, totalTiles - required.length),
  ];

  // Shuffle final order so feedback colors appear at random positions in the grid
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = targets[i]!;
    targets[i] = targets[j]!;
    targets[j] = tmp;
  }

  // Helper: pick a random element from an array (1 PRNG call)
  function pick<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    return arr[Math.floor(rng() * arr.length)];
  }

  // Helper: the letter at a given cell for word wi
  function letterAt(wi: number, key: string): string | undefined {
    const meta = targetsMeta[wi];
    if (!meta) return undefined;
    const idx = meta.coords.findIndex(([r, c]) => coordKey(r, c) === key);
    return idx >= 0 ? upperWords[wi]?.[idx] : undefined;
  }

  // Place tiles — for each target feedback type, find the first valid cell
  const tiles: RevealTile[] = [];
  const usedKeys = new Set<string>();
  const countPerWord = new Map<number, number>();

  for (const feedback of targets) {
    for (const cell of cells) {
      if (usedKeys.has(cell.key)) continue;
      if (cell.wordIndices.some(wi => (countPerWord.get(wi) ?? 0) >= 2)) continue;

      let letter: string | undefined;

      if (feedback === 'correct') {
        // Actual letter at this cell (intersection cells share the same letter)
        letter = letterAt(cell.wordIndices[0]!, cell.key);

      } else if (feedback === 'wrongSpot') {
        // A letter that IS in this cell's word(s) but NOT at this specific position.
        // Exclude the actual letter(s) at this cell to prevent confusion with green.
        const actualAtCell = new Set(
          cell.wordIndices
            .map(wi => letterAt(wi, cell.key))
            .filter((ch): ch is string => ch !== undefined),
        );
        const candidates = new Set<string>();
        for (const wi of cell.wordIndices) {
          for (const ch of upperWords[wi] ?? '') {
            if (!actualAtCell.has(ch)) candidates.add(ch);
          }
        }
        letter = pick(Array.from(candidates));

      } else if (feedback === 'notInWord') {
        // A letter that exists somewhere in the puzzle but NOT in any word at this cell.
        // For intersection cells: must not be in either intersecting word.
        const cellWordLetters = new Set<string>();
        for (const wi of cell.wordIndices) {
          for (const ch of upperWords[wi] ?? '') cellWordLetters.add(ch);
        }
        const candidates = Array.from(puzzleLetterSet).filter(ch => !cellWordLetters.has(ch));
        letter = pick(candidates);

      } else {
        // notInPuzzle — a letter that appears in none of the puzzle's words
        letter = pick(notInPuzzleLetters);
      }

      if (!letter) continue; // this cell can't satisfy this feedback type; try next cell

      tiles.push({ key: cell.key, letter, feedback });
      usedKeys.add(cell.key);
      for (const wi of cell.wordIndices) {
        countPerWord.set(wi, (countPerWord.get(wi) ?? 0) + 1);
      }
      break;
    }
    // If no valid cell exists for this feedback type, that tile is silently omitted
  }

  return { tiles };
}

// ---------------------------------------------------------------------------
// Rounded rectangle helper
// ---------------------------------------------------------------------------
function roundRect(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
  strokeWidth = 1,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Corner accent brackets (matches game's atlanticStyles boardCornerTL/BR)
// ---------------------------------------------------------------------------
const MOTIF_RED = '#E7131A';

function drawLCornerTL(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  x: number,
  y: number,
  w: number,
  h: number,
  strokeWidth: number,
  radius: number,
  color: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.lineTo(x + w, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawLCornerBR(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  x: number,
  y: number,
  w: number,
  h: number,
  strokeWidth: number,
  radius: number,
  color: string,
): void {
  const rx = x + w;
  const by = y + h;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(rx, y);
  ctx.lineTo(rx, by - radius);
  ctx.arcTo(rx, by, rx - radius, by, radius);
  ctx.lineTo(x, by);
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawCornerAccents(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  canvasW: number,
  canvasH: number,
): void {
  // Scale constants from game code proportionally to canvas width (game ~390pt wide)
  const scale      = canvasW / 390;
  const INSET_H    = 0;
  const INSET_V    = Math.round(2  * scale);
  const OUTER_W    = Math.round(70 * scale);
  const OUTER_H    = Math.round(220 * scale);
  const OUTER_STR  = Math.max(2, Math.round(3 * scale));
  const INNER_GAP  = Math.round(6  * scale);
  const INNER_W    = OUTER_W - INNER_GAP * 2;
  const INNER_H    = OUTER_H - INNER_GAP * 2;
  const INNER_STR  = Math.max(1, Math.round(2 * scale));
  const RADIUS     = 2;

  // Top-left outer + inner
  drawLCornerTL(ctx, INSET_H, INSET_V, OUTER_W, OUTER_H, OUTER_STR, RADIUS, MOTIF_RED);
  drawLCornerTL(ctx, INSET_H + INNER_GAP, INSET_V + INNER_GAP, INNER_W, INNER_H, INNER_STR, RADIUS, MOTIF_RED);

  // Bottom-right outer + inner
  drawLCornerBR(ctx, canvasW - INSET_H - OUTER_W, canvasH - INSET_V - OUTER_H, OUTER_W, OUTER_H, OUTER_STR, RADIUS, MOTIF_RED);
  drawLCornerBR(ctx, canvasW - INSET_H - INNER_GAP - INNER_W, canvasH - INSET_V - INNER_GAP - INNER_H, INNER_W, INNER_H, INNER_STR, RADIUS, MOTIF_RED);
}

// ---------------------------------------------------------------------------
// Branding strip
// ---------------------------------------------------------------------------
function drawBranding(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  canvasW: number,
  brandingTop: number,
  logo: Awaited<ReturnType<typeof loadImage>> | null,
): void {
  const centerX  = canvasW / 2;
  const taglineY = brandingTop + 78;

  if (logo) {
    // Draw logo image centered, scaled to fit the branding area
    const maxH = 48;
    const maxW = canvasW * 0.78;
    const scale = Math.min(maxW / logo.width, maxH / logo.height);
    const lw = logo.width  * scale;
    const lh = logo.height * scale;
    const lx = (canvasW - lw) / 2;
    const ly = brandingTop + 14;
    ctx.drawImage(logo as Parameters<typeof ctx.drawImage>[0], lx, ly, lw, lh);
  } else {
    // Fallback: text wordmark
    const wordmarkY  = brandingTop + 34;
    const wordmark   = 'CrosSwords';
    const redIndices = new Set([4, 9]);
    ctx.font         = `bold 30px Arial, Helvetica, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'left';
    let totalW = 0;
    for (const ch of wordmark) totalW += ctx.measureText(ch).width;
    let x = centerX - totalW / 2;
    wordmark.split('').forEach((ch, i) => {
      ctx.fillStyle = redIndices.has(i) ? PALETTE.branding.accent : PALETTE.branding.wordmark;
      ctx.fillText(ch, x, wordmarkY);
      x += ctx.measureText(ch).width;
    });
  }

  // Tagline
  ctx.font         = `14px Arial, Helvetica, sans-serif`;
  ctx.fillStyle    = PALETTE.branding.tagline;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Wit is your weapon.', centerX, taglineY);
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------
export type RenderTeaserOptions = {
  words: string[];
  targetsMeta: TargetMeta[];
  seed: number;
  outputPath: string;
  archivePath: string;
};

export async function renderTeaser(opts: RenderTeaserOptions): Promise<RevealResult> {
  const { words, targetsMeta, seed, outputPath, archivePath } = opts;

  // Load assets (fall back gracefully if missing)
  type LoadedImage = Awaited<ReturnType<typeof loadImage>>;
  const assetsDir = path.resolve(process.cwd(), 'assets');

  let logo: LoadedImage | null = null;
  try { logo = await loadImage(path.join(assetsDir, 'logo.png')); } catch { /* fallback to text */ }

  let motif: LoadedImage | null = null;
  try { motif = await loadImage(path.join(assetsDir, 'icons', 'CWMotifBlack.png')); } catch { /* no motif */ }

  // Build intersection map (cells used by more than one word)
  const coordWordCount = new Map<string, number>();
  targetsMeta.forEach(meta => {
    meta.coords.forEach(([r, c]) => {
      const k = coordKey(r, c);
      coordWordCount.set(k, (coordWordCount.get(k) ?? 0) + 1);
    });
  });

  // Build 10×10 letter grid from actual solution
  const grid: (string | null)[][] = Array.from({ length: 10 }, () => Array(10).fill(null) as null[]);
  targetsMeta.forEach((meta, wi) => {
    meta.coords.forEach(([r, c], pos) => {
      const letter = words[wi]?.[pos];
      if (letter) grid[r]![c] = letter.toUpperCase();
    });
  });

  // Find bounding box of placed letters
  let minR = 9, maxR = 0, minC = 9, maxC = 0;
  let hasLetters = false;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (grid[r]![c] !== null) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
        hasLetters = true;
      }
    }
  }
  if (!hasLetters) throw new Error('No letters placed — empty grid.');

  // Add 1-cell padding (clamped to grid bounds)
  const padR1 = Math.max(0, minR - 1);
  const padR2 = Math.min(9, maxR + 1);
  const padC1 = Math.max(0, minC - 1);
  const padC2 = Math.min(9, maxC + 1);

  const gridRows = padR2 - padR1 + 1;
  const gridCols = padC2 - padC1 + 1;

  // Dynamic tile size
  const rawTile  = Math.floor((TARGET_GRID_W - (gridCols - 1) * GAP) / gridCols);
  const tileSize = Math.max(TILE_MIN, Math.min(TILE_MAX, rawTile));

  const gridPixW = gridCols * tileSize + (gridCols - 1) * GAP;
  const gridPixH = gridRows * tileSize + (gridRows - 1) * GAP;
  const canvasW  = gridPixW + MARGIN * 2;
  const canvasH  = gridPixH + MARGIN * 2 + BRANDING_HEIGHT;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx    = canvas.getContext('2d');

  // White background
  ctx.fillStyle = PALETTE.appBackground;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Select reveal tiles
  const result  = selectRevealTiles(words, targetsMeta, seed);
  const tileMap = new Map(result.tiles.map(t => [t.key, t]));

  // Letter font size
  const letterFontSize = Math.round(tileSize * 0.58);

  // Draw tiles
  for (let r = padR1; r <= padR2; r++) {
    for (let c = padC1; c <= padC2; c++) {
      if (grid[r]![c] === null) continue; // empty cell — no tile

      const x   = MARGIN + (c - padC1) * (tileSize + GAP);
      const y   = MARGIN + (r - padR1) * (tileSize + GAP);
      const key = coordKey(r, c);
      const tile = tileMap.get(key);

      const isIntersection = (coordWordCount.get(key) ?? 0) > 1;

      if (tile) {
        const colors = PALETTE[tile.feedback];
        roundRect(ctx, x, y, tileSize, tileSize, CORNER_RADIUS, colors.bg, '#000000', 1.5);
        // Motif watermark on revealed intersection cells (white, low opacity)
        if (isIntersection && motif) {
          const pad = 2;
          const ms  = tileSize - pad * 2;
          ctx.save();
          ctx.globalAlpha = 0.20;
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(motif as Parameters<typeof ctx.drawImage>[0], x + pad, y + pad, ms, ms);
          ctx.restore();
        }
        ctx.font         = `${letterFontSize}px LibreBaskerville, serif`;
        ctx.fillStyle    = colors.letter;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tile.letter, x + tileSize / 2, y + tileSize / 2 + 1);
      } else {
        // Unrevealed tile
        roundRect(ctx, x, y, tileSize, tileSize, CORNER_RADIUS, PALETTE.idle.bg, PALETTE.idle.border, 1.5);
        // Motif watermark on unrevealed intersection cells (dark, low opacity)
        if (isIntersection && motif) {
          const pad = 2;
          const ms  = tileSize - pad * 2;
          ctx.save();
          ctx.globalAlpha = 0.18;
          ctx.drawImage(motif as Parameters<typeof ctx.drawImage>[0], x + pad, y + pad, ms, ms);
          ctx.restore();
        }
      }
    }
  }

  // Corner accent brackets
  drawCornerAccents(ctx, canvasW, canvasH);

  // Branding
  drawBranding(ctx, canvasW, gridPixH + MARGIN * 2, logo);

  // Write output files
  const buf = canvas.toBuffer('image/png');
  fs.mkdirSync(path.dirname(outputPath),  { recursive: true });
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.writeFileSync(outputPath,  buf);
  fs.writeFileSync(archivePath, buf);

  return result;
}
