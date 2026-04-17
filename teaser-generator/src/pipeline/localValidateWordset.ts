/**
 * Copied from crosswords_mobile/src/lib/localValidateWordset.ts
 * No modifications needed — no imports.
 */

export type ValidateResult =
  | { ok: true; words: string[] }
  | { ok: false; error: string };

const REQUIRED: Record<number, number> = { 4: 2, 5: 2, 6: 1 };

export function localValidateWordset(rawWords: string[] | undefined | null): ValidateResult {
  if (!rawWords || rawWords.length !== 5) {
    return { ok: false, error: 'You must provide exactly 5 words.' };
  }
  const cleaned = rawWords.map((w) => (w || '').replace(/[^A-Za-z]/g, '').toUpperCase());

  const counts: Record<number, number> = {};
  for (const w of cleaned) {
    counts[w.length] = (counts[w.length] ?? 0) + 1;
  }
  for (const len of Object.keys(REQUIRED).map((v) => Number(v))) {
    const need = REQUIRED[len];
    const have = counts[len] ?? 0;
    if (have !== need) {
      return { ok: false, error: `Need ${need} word(s) of length ${len}, got ${have}.` };
    }
  }
  const uniq = new Set(cleaned);
  if (uniq.size !== 5) {
    return { ok: false, error: 'Words must be unique.' };
  }
  return { ok: true, words: cleaned };
}
