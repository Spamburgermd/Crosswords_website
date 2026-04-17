/**
 * render-teaser.ts
 *
 * Renders a daily teaser image using the Steel Blue palette from the game.
 * Reveals 3-5 letters deterministically via a date-seeded Mulberry32 PRNG.
 *
 * Constraints:
 *   - At most 1 intersection tile revealed (rendered in wrongSpot color, not correct)
 *   - Non-intersection reveals use the correct (deep navy) color
 *   - Per-word caps: 4-letter → 2, 5-letter → 2, 6-letter → 3
 *   - Deterministic: same date → same image
 */

import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { TargetMeta } from './pipeline/localCanonicalTargetsFromLayout.js';

// ---------------------------------------------------------------------------
// Steel Blue palette (from crosswords_mobile/src/theme/tilePalette.ts)
// ---------------------------------------------------------------------------
const PALETTE = {
  appBackground: '#0D1B2A',
  idle:       { bg: '#FFFFFF', border: '#D3D3D6', letter: '#2A2A2E' },
  correct:    { bg: '#1E2D3D', letter: '#FFFFFF' }, // non-intersection reveals
  wrongSpot:  { bg: '#4A6378', letter: '#FFFFFF' }, // intersection reveal
  branding: {
    accent:   '#E7131A', // brand red — applied to the two S glyphs in CrosSwords
    wordmark: '#FFFFFF',
    tagline:  '#93A8B8', // notInWord blue-grey
  },
} as const;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const GAP             = 4;
const CORNER_RADIUS   = 5;
const BRANDING_HEIGHT = 100;
const MARGIN          = 32;
const TARGET_GRID_W   = 640; // target pixel width for the grid area
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
// Per-word reveal cap
// ---------------------------------------------------------------------------
function wordRevealCap(wordLen: number): number {
  if (wordLen <= 4) return 2;
  if (wordLen <= 5) return 2;
  return 3; // 6+
}

// ---------------------------------------------------------------------------
// Reveal cell selection
// ---------------------------------------------------------------------------
export type RevealResult = {
  revealedCoords: string[];
  intersectionCoords: Set<string>;
};

export function selectRevealCells(
  words: string[],
  targetsMeta: TargetMeta[],
  seed: number,
): RevealResult {
  // Build coord → [wordIndices] map
  const coordToWords = new Map<string, number[]>();
  targetsMeta.forEach((meta, wi) => {
    meta.coords.forEach(([r, c]) => {
      const k = coordKey(r, c);
      const arr = coordToWords.get(k) ?? [];
      arr.push(wi);
      coordToWords.set(k, arr);
    });
  });

  const intersectionCoords = new Set<string>();
  coordToWords.forEach((indices, k) => {
    if (indices.length > 1) intersectionCoords.add(k);
  });

  // Build candidates: one entry per (wordIndex, posInWord) pair
  type Candidate = { wi: number; key: string; isIntersection: boolean };
  const candidates: Candidate[] = [];
  targetsMeta.forEach((meta, wi) => {
    meta.coords.forEach(([r, c]) => {
      const k = coordKey(r, c);
      candidates.push({ wi, key: k, isIntersection: intersectionCoords.has(k) });
    });
  });

  // Fisher-Yates shuffle with a derived seed (so reveal randomness is
  // independent from puzzle-generation randomness, yet still date-locked)
  const revealSeed = ((seed * 0x9e3779b9) ^ 0x5a4fcf12) >>> 0;
  const rng = mulberry32(revealSeed);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = candidates[i]!;
    candidates[i] = candidates[j]!;
    candidates[j] = tmp;
  }

  const revealedCoords: string[] = [];
  const revealedSet = new Set<string>();
  const countPerWord = new Map<number, number>();
  let intersectionUsed = 0;

  for (const c of candidates) {
    if (revealedCoords.length >= 5) break;
    if (revealedSet.has(c.key)) continue;

    // Intersection cap
    if (c.isIntersection && intersectionUsed >= 1) continue;

    // Per-word cap: must satisfy the cap for EVERY word sharing this coord
    const wordIndices = coordToWords.get(c.key) ?? [c.wi];
    const capViolated = wordIndices.some(
      (wi) => (countPerWord.get(wi) ?? 0) >= wordRevealCap(words[wi]?.length ?? 0),
    );
    if (capViolated) continue;

    // Accept this reveal
    revealedCoords.push(c.key);
    revealedSet.add(c.key);
    for (const wi of wordIndices) {
      countPerWord.set(wi, (countPerWord.get(wi) ?? 0) + 1);
    }
    if (c.isIntersection) intersectionUsed++;
  }

  return { revealedCoords, intersectionCoords };
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
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Branding strip
// ---------------------------------------------------------------------------
function drawBranding(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  canvasW: number,
  brandingTop: number,
): void {
  const centerX = canvasW / 2;
  const wordmarkY = brandingTop + 34;
  const taglineY  = brandingTop + 66;

  // "CrosSwords" — render character by character to colour the two S glyphs
  // Positions (0-based): C(0)r(1)o(2)s(3)S(4)w(5)o(6)r(7)d(8)s(9)
  const wordmark    = 'CrosSwords';
  const redIndices  = new Set([4, 9]);
  const fontSize    = 30;

  ctx.font          = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline  = 'middle';
  ctx.textAlign     = 'left';

  // Measure total width for centering
  let totalW = 0;
  for (const ch of wordmark) totalW += ctx.measureText(ch).width;

  let x = centerX - totalW / 2;
  wordmark.split('').forEach((ch, i) => {
    ctx.fillStyle = redIndices.has(i) ? PALETTE.branding.accent : PALETTE.branding.wordmark;
    ctx.fillText(ch, x, wordmarkY);
    x += ctx.measureText(ch).width;
  });

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

export function renderTeaser(opts: RenderTeaserOptions): RevealResult {
  const { words, targetsMeta, seed, outputPath, archivePath } = opts;

  // Build 10×10 letter grid
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

  // Background
  ctx.fillStyle = PALETTE.appBackground;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Select reveal cells
  const result = selectRevealCells(words, targetsMeta, seed);
  const { revealedCoords, intersectionCoords } = result;
  const revealedSet = new Set(revealedCoords);

  // Letter font
  const letterFontSize = Math.round(tileSize * 0.58);

  // Draw tiles
  for (let r = padR1; r <= padR2; r++) {
    for (let c = padC1; c <= padC2; c++) {
      const letter = grid[r]![c];
      if (letter === null) continue; // empty cell — no tile

      const x   = MARGIN + (c - padC1) * (tileSize + GAP);
      const y   = MARGIN + (r - padR1) * (tileSize + GAP);
      const key = coordKey(r, c);

      if (revealedSet.has(key)) {
        const isIntersection = intersectionCoords.has(key);
        const colors = isIntersection ? PALETTE.wrongSpot : PALETTE.correct;
        roundRect(ctx, x, y, tileSize, tileSize, CORNER_RADIUS, colors.bg);
        ctx.font         = `bold ${letterFontSize}px Arial, Helvetica, sans-serif`;
        ctx.fillStyle    = colors.letter;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, x + tileSize / 2, y + tileSize / 2 + 1);
      } else {
        // Unrevealed tile — white with grey border, no letter
        roundRect(ctx, x, y, tileSize, tileSize, CORNER_RADIUS, PALETTE.idle.bg, PALETTE.idle.border);
      }
    }
  }

  // Branding
  drawBranding(ctx, canvasW, gridPixH + MARGIN * 2);

  // Write output files
  const buf = canvas.toBuffer('image/png');
  fs.mkdirSync(path.dirname(outputPath),  { recursive: true });
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.writeFileSync(outputPath,  buf);
  fs.writeFileSync(archivePath, buf);

  return result;
}
