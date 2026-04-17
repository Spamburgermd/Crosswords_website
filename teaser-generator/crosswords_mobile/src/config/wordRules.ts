/**
 * src/config/wordRules.ts
 * ---------------------------------------------
 * Central word-length rules for challenges/Jotts.
 * Prepared for future 3–7 expansion; currently enforce 4–6.
 */
export const ALLOWED_WORD_LENGTHS = [4, 5, 6] as const;
export type AllowedWordLength = (typeof ALLOWED_WORD_LENGTHS)[number];
