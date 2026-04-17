/**
 * src/theme/tilePalette.ts
 * ---------------------------------------------
 * Board tile reveal palette. All components that render settled tile colors
 * (board, color guide modal, tutorial) should use the `useTilePalette` hook
 * and `codeToTileFromPalette` helper rather than accessing a static constant.
 *
 * Named presets live in TILE_PALETTES. To add a new color scheme, drop another
 * entry into that record and it will appear in the Settings picker.
 */

import useUIStore from '../stores/uiStore';

export type TilePaletteEntry = { bg: string; letter: string };
export type TileIdleEntry = { bg: string; border: string; letter: string };
export type TilePalette = {
  correct:        TilePaletteEntry;
  wrongSpot:      TilePaletteEntry;
  notInWord:      TilePaletteEntry;
  notInPuzzle:    TilePaletteEntry;
  /** Optional idle tile style (unguessed, not highlighted). Falls back to defaults when omitted. */
  idle?: TileIdleEntry;
};

export type TilePaletteId =
  | 'classic'
  | 'steelBlue'
  | 'warmSlate'
  | 'monochromeSteel'
  | 'inkAndSteel'
  | 'warmCoolSplit'
  | 'highContrastMono'
  | 'colorblind';

export type TilePaletteSemanticKey = 'correct' | 'wrongSpot' | 'notInWord' | 'notInPuzzle';

export type TilePaletteOption = {
  id: TilePaletteId;
  shortLabel: string;
  title: string;
  description: string;
  palette: TilePalette;
};

export type TilePalettePreviewEntry = {
  key: TilePaletteSemanticKey;
  label: string;
  bg: string;
  letter: string;
};

/* ------------------------------------------------------------------ */
/*  Named presets                                                      */
/* ------------------------------------------------------------------ */

const CLASSIC: TilePalette = {
  correct:       { bg: '#6A9B6E', letter: '#FFFFFF' },
  wrongSpot:     { bg: '#C4A84D', letter: '#FFFFFF' },
  notInWord:     { bg: '#5A8A91', letter: '#FFFFFF' },
  // Preblended equivalent of #E7131A at 40% over white so board reds match the keyboard appearance.
  notInPuzzle:   { bg: '#F5A1A3', letter: '#FFFFFF' },
};

const STEEL_BLUE: TilePalette = {
  correct:     { bg: '#1E2D3D', letter: '#FFFFFF' },
  wrongSpot:   { bg: '#4A6378', letter: '#FFFFFF' },
  notInWord:   { bg: '#93A8B8', letter: '#FFFFFF' },
  notInPuzzle: { bg: '#F5A1A3', letter: '#FFFFFF' },
  idle:        { bg: '#FFFFFF', border: '#D3D3D6', letter: '#2A2A2E' },
};

const WARM_SLATE: TilePalette = {
  correct:     { bg: '#2C2622', letter: '#FFFFFF' },
  wrongSpot:   { bg: '#6E5F54', letter: '#FFFFFF' },
  notInWord:   { bg: '#B0A498', letter: '#FFFFFF' },
  notInPuzzle: { bg: '#E8E2DA', letter: '#96897C' },
  idle:        { bg: '#FFFFFF', border: '#D3D3D6', letter: '#2A2A2E' },
};

const MONOCHROME_STEEL: TilePalette = {
  correct:     { bg: '#2A2A2E', letter: '#FFFFFF' },
  wrongSpot:   { bg: '#7A7A84', letter: '#FFFFFF' },
  notInWord:   { bg: '#BBBBC3', letter: '#FFFFFF' },
  notInPuzzle: { bg: '#F5A1A3', letter: '#FFFFFF' },
  idle:        { bg: '#FFFFFF', border: '#D3D3D6', letter: '#2A2A2E' },
};

const INK_AND_STEEL: TilePalette = {
  correct:     { bg: '#1A1A1E', letter: '#FFFFFF' },
  wrongSpot:   { bg: '#3D5167', letter: '#FFFFFF' },
  notInWord:   { bg: '#8896A4', letter: '#FFFFFF' },
  notInPuzzle: { bg: '#F5A1A3', letter: '#FFFFFF' },
  idle:        { bg: '#FFFFFF', border: '#D3D3D6', letter: '#2A2A2E' },
};

const WARM_COOL_SPLIT: TilePalette = {
  correct:     { bg: '#2C2622', letter: '#FFFFFF' },
  wrongSpot:   { bg: '#7A6455', letter: '#FFFFFF' },
  notInWord:   { bg: '#8D9BA6', letter: '#FFFFFF' },
  notInPuzzle: { bg: '#E0E5EA', letter: '#8293A0' },
  idle:        { bg: '#FFFFFF', border: '#D3D3D6', letter: '#2A2A2E' },
};

const HIGH_CONTRAST_MONO: TilePalette = {
  correct:     { bg: '#1A1A1E', letter: '#FFFFFF' },
  wrongSpot:   { bg: '#636369', letter: '#FFFFFF' },
  notInWord:   { bg: '#A8A8B0', letter: '#FFFFFF' },
  notInPuzzle: { bg: '#EDEDF0', letter: '#919198' },
  idle:        { bg: '#FFFFFF', border: '#D3D3D6', letter: '#2A2A2E' },
};

/** IBM colorblind-safe palette (Wong 2011) — universally accessible feedback colors. */
const COLORBLIND: TilePalette = {
  correct:     { bg: '#648FFF', letter: '#FFFFFF' },
  wrongSpot:   { bg: '#FFB000', letter: '#FFFFFF' },
  notInWord:   { bg: '#DC267F', letter: '#FFFFFF' },
  notInPuzzle: { bg: '#785EF0', letter: '#FFFFFF' },
};

export const DEFAULT_TILE_PALETTE_ID: TilePaletteId = 'classic';

export const TILE_PALETTE_SEMANTICS: { key: TilePaletteSemanticKey; label: string }[] = [
  { key: 'correct', label: 'Right spot' },
  { key: 'wrongSpot', label: 'Wrong spot' },
  { key: 'notInWord', label: 'Other word' },
  { key: 'notInPuzzle', label: 'Not in puzzle' },
];

export const TILE_PALETTE_OPTIONS: TilePaletteOption[] = [
  {
    id: 'classic',
    shortLabel: 'Classic',
    title: 'Classic',
    description: 'Vivid tile colors - green, yellow, blue, red - familiar from the original release.',
    palette: CLASSIC,
  },
  {
    id: 'steelBlue',
    shortLabel: 'Steel',
    title: 'Steel Blue',
    description: 'Cool blue-grey gradient from deep navy to pale ice. Clean and modern.',
    palette: STEEL_BLUE,
  },
  {
    id: 'warmSlate',
    shortLabel: 'Slate',
    title: 'Warm Slate',
    description: 'Warm brown-grey tones from dark espresso to soft linen.',
    palette: WARM_SLATE,
  },
  {
    id: 'monochromeSteel',
    shortLabel: 'Mono',
    title: 'Monochrome Steel',
    description: 'True greyscale from near-black to light grey. Minimal and distraction-free.',
    palette: MONOCHROME_STEEL,
  },
  {
    id: 'inkAndSteel',
    shortLabel: 'Ink',
    title: 'Ink & Steel',
    description: 'Near-black ink correct, steel-blue wrong-spot, grey notInWord. High contrast with a cool accent.',
    palette: INK_AND_STEEL,
  },
  {
    id: 'warmCoolSplit',
    shortLabel: 'Split',
    title: 'Warm / Cool Split',
    description: 'Warm tones for correct and wrong-spot, cool steel for in-word. A balanced contrast pair.',
    palette: WARM_COOL_SPLIT,
  },
  {
    id: 'highContrastMono',
    shortLabel: 'Hi-Con',
    title: 'High Contrast Mono',
    description: 'Maximum contrast greyscale - deepest black to near-white. Ideal for bright environments.',
    palette: HIGH_CONTRAST_MONO,
  },
  {
    id: 'colorblind',
    shortLabel: 'CBF',
    title: 'Colorblind Friendly',
    description: 'IBM colorblind-safe palette (Wong 2011). Blue, orange, magenta, and purple — universally accessible for all types of color vision deficiency.',
    palette: COLORBLIND,
  },
];

export const TILE_PALETTES: Record<TilePaletteId, TilePalette> = TILE_PALETTE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = option.palette;
    return acc;
  },
  {} as Record<TilePaletteId, TilePalette>,
);

/** Ordered list of palette IDs for the settings picker. */
export const TILE_PALETTE_IDS: TilePaletteId[] = TILE_PALETTE_OPTIONS.map((option) => option.id);

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/** Returns the active TilePalette based on the user's colorScheme preference. */
export function useTilePalette(): TilePalette {
  const schemeId = useUIStore((s) => s.colorScheme);
  return getTilePaletteById(schemeId);
}

export function getTilePaletteById(id: string): TilePalette {
  return TILE_PALETTES[id as TilePaletteId] ?? TILE_PALETTES[DEFAULT_TILE_PALETTE_ID];
}

export function getTilePaletteOptionById(id: string): TilePaletteOption {
  return TILE_PALETTE_OPTIONS.find((option) => option.id === id) ?? TILE_PALETTE_OPTIONS[0];
}

export function getTilePalettePreviewEntries(input: string | TilePalette): TilePalettePreviewEntry[] {
  const palette = typeof input === 'string' ? getTilePaletteById(input) : input;
  return TILE_PALETTE_SEMANTICS.map(({ key, label }) => ({
    key,
    label,
    bg: palette[key].bg,
    letter: palette[key].letter,
  }));
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Maps a feedback code (G/Y/B/R) to the given palette entry. */
export function codeToTileFromPalette(code: string, palette: TilePalette): TilePaletteEntry {
  switch (code.toUpperCase()) {
    case 'G':  return palette.correct;
    case 'Y':  return palette.wrongSpot;
    case 'B':  return palette.notInWord;
    case 'R':  return palette.notInPuzzle;
    default:   return palette.notInPuzzle;
  }
}

/* ------------------------------------------------------------------ */
/*  Legacy aliases (backward compat during migration)                  */
/* ------------------------------------------------------------------ */

/** @deprecated Use `useTilePalette()` inside components instead. */
export const TILE_PALETTE: TilePalette = CLASSIC;

/** @deprecated Use `codeToTileFromPalette(code, palette)` instead. */
export function codeToTile(code: string): TilePaletteEntry {
  return codeToTileFromPalette(code, CLASSIC);
}
