/**
 * Copied from crosswords_mobile/src/config/wordRules.ts
 * No modifications needed.
 */
export const ALLOWED_WORD_LENGTHS = [4, 5, 6] as const;
export type AllowedWordLength = (typeof ALLOWED_WORD_LENGTHS)[number];
