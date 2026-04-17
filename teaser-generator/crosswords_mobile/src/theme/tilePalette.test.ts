/**
 * src/theme/tilePalette.test.ts
 * -----------------------------------------------------------
 * Guard rails for the settings palette picker metadata.
 */
import {
  DEFAULT_TILE_PALETTE_ID,
  TILE_PALETTE_IDS,
  TILE_PALETTE_OPTIONS,
  TILE_PALETTE_SEMANTICS,
  getTilePaletteById,
  getTilePaletteOptionById,
  getTilePalettePreviewEntries,
} from './tilePalette';

describe('tile palette metadata', () => {
  it('keeps the settings picker order aligned with the palette options', () => {
    expect(TILE_PALETTE_IDS).toEqual(TILE_PALETTE_OPTIONS.map((option) => option.id));
    expect(TILE_PALETTE_IDS).toEqual([
      'classic',
      'steelBlue',
      'warmSlate',
      'monochromeSteel',
      'inkAndSteel',
      'warmCoolSplit',
      'highContrastMono',
      'colorblind',
    ]);
  });

  it('maps each palette to the four semantic preview entries in the right order', () => {
    const preview = getTilePalettePreviewEntries('classic');

    expect(preview.map((entry) => entry.key)).toEqual(TILE_PALETTE_SEMANTICS.map((entry) => entry.key));
    expect(preview.map((entry) => entry.label)).toEqual([
      'Right spot',
      'Wrong spot',
      'Other word',
      'Not in puzzle',
    ]);
    expect(preview.map((entry) => entry.bg)).toEqual([
      '#6A9B6E',
      '#C4A84D',
      '#5A8A91',
      '#F5A1A3',
    ]);
  });

  it('falls back to the default palette and metadata for unknown ids', () => {
    const fallbackPalette = getTilePaletteById('does-not-exist');
    const defaultPalette = getTilePaletteById(DEFAULT_TILE_PALETTE_ID);
    const fallbackOption = getTilePaletteOptionById('does-not-exist');

    expect(fallbackPalette).toEqual(defaultPalette);
    expect(fallbackOption.id).toBe(DEFAULT_TILE_PALETTE_ID);
  });
});
