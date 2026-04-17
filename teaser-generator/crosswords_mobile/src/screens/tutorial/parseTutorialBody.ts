import type { TilePaletteSemanticKey } from '../../theme/tilePalette';

export type TutorialBodySegment =
  | { type: 'text'; value: string }
  | { type: 'swatch'; paletteKey: TilePaletteSemanticKey };

const VALID_KEYS = new Set<string>(['correct', 'wrongSpot', 'notInWord', 'notInPuzzle']);

export function parseTutorialBody(body: string): TutorialBodySegment[] {
  const parts = body.split(/(\{\{[a-zA-Z]+\}\})/);
  const segments: TutorialBodySegment[] = [];

  for (const part of parts) {
    if (!part) continue;
    const match = part.match(/^\{\{([a-zA-Z]+)\}\}$/);
    if (match && VALID_KEYS.has(match[1])) {
      segments.push({ type: 'swatch', paletteKey: match[1] as TilePaletteSemanticKey });
    } else {
      // merge adjacent text segments
      const last = segments[segments.length - 1];
      if (last?.type === 'text') {
        last.value += part;
      } else {
        segments.push({ type: 'text', value: part });
      }
    }
  }

  return segments;
}
