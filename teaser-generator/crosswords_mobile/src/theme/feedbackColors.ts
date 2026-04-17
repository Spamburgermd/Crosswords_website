/**
 * src/theme/feedbackColors.ts
 * ---------------------------------------------
 * Centralized feedback color palettes with colorblind-accessible alternatives.
 * All components that render guess feedback (G/Y/B/R) should pull colors from
 * the `useFeedbackColors` hook rather than hardcoding values.
 */
import useUIStore from '../stores/uiStore';
import colors from './colors';

export type ColorblindMode = 'none' | 'universal';

export type FeedbackEntry = { bg: string; text: string };
export type FeedbackPalette = Record<string, FeedbackEntry>;

const DEFAULT_PALETTE: FeedbackPalette = {
  G: { bg: colors.green, text: '#fff' },
  Y: { bg: colors.yellow, text: '#fff' },
  B: { bg: colors.blue, text: '#fff' },
  R: { bg: '#E7131A66', text: '#fff' },
  keyboardAbsent: { bg: '#b0b0b0', text: '#fff' },
};

/** IBM colorblind-safe palette (Wong 2011) */
const UNIVERSAL_PALETTE: FeedbackPalette = {
  G: { bg: '#648FFF', text: '#fff' },
  Y: { bg: '#FFB000', text: '#fff' },
  B: { bg: '#DC267F', text: '#fff' },
  R: { bg: '#785EF0', text: '#fff' },
  keyboardAbsent: { bg: '#b0b0b0', text: '#fff' },
};

const PALETTES: Record<ColorblindMode, FeedbackPalette> = {
  none: DEFAULT_PALETTE,
  universal: UNIVERSAL_PALETTE,
};

export function getFeedbackColors(mode: ColorblindMode): FeedbackPalette {
  return PALETTES[mode] ?? DEFAULT_PALETTE;
}

export type FeedbackLegendItem = { code: string; bg: string; label: string };

const LEGEND_LABELS: Record<string, string> = {
  G: 'Correct letter, correct spot',
  Y: 'In this word, wrong spot',
  B: 'Not in this word, in the puzzle',
  R: 'Not in the puzzle',
};

export function getFeedbackLegend(mode: ColorblindMode): FeedbackLegendItem[] {
  const palette = getFeedbackColors(mode);
  return (['G', 'Y', 'B', 'R'] as const).map((code) => ({
    code,
    bg: palette[code].bg,
    label: LEGEND_LABELS[code],
  }));
}

export function useFeedbackColors(): FeedbackPalette {
  const mode = useUIStore((state) => state.colorblindMode);
  return getFeedbackColors(mode);
}
