/**
 * src/utils/wordParsing.ts
 * ---------------------------------------------
 * Centralized word tokenization for challenge/jott inputs.
 * Split on any non-letter, trim empties, and uppercase.
 *
 * Examples:
 *  "WORD, WORD\nWORD" -> ["WORD","WORD","WORD"]
 *  "apple   berry,candy" -> ["APPLE","BERRY","CANDY"]
 */
export function parseWords(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[^A-Za-z]+/)
    .map((w) => w.trim().toUpperCase())
    .filter(Boolean);
}
